import type { Hono } from 'hono';
import { recordAuditEvent } from '../audit/writer';
import type { Session } from '../auth/session';
import { getConnection, listConnections } from './registry';
import { deleteConnectionSecret, isConnectionConfigured, setConnectionSecret } from './secrets';
import type { Connection, ConnectionSecret } from './types';

/**
 * Validate that a request body is a well-formed ConnectionSecret matching
 * the declared auth type of the target connection. Returns a typed secret
 * or an error string suitable for a 400 response.
 *
 * Validating here (rather than letting buildAuthHeaders throw at outbound
 * call time) means a bad secret is rejected at the API boundary with a
 * useful error message instead of surfacing as an Internal Server Error
 * on the first proxy attempt — sometimes hours later.
 */
function validateSecretForConnection(
  conn: Connection,
  body: unknown,
): { ok: true; secret: ConnectionSecret } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'invalid_secret_shape' };
  }
  const b = body as { type?: unknown };
  if (typeof b.type !== 'string') {
    return { ok: false, error: 'invalid_secret_shape' };
  }
  if (b.type !== conn.auth.type) {
    return { ok: false, error: `secret_type_mismatch (connection.auth.type is "${conn.auth.type}", got "${b.type}")` };
  }
  switch (conn.auth.type) {
    case 'none':
      return { ok: true, secret: { type: 'none' } };
    case 'bearer': {
      const token = (body as { token?: unknown }).token;
      if (typeof token !== 'string' || token.length === 0) {
        return { ok: false, error: 'bearer_secret_requires_token_string' };
      }
      return { ok: true, secret: { type: 'bearer', token } };
    }
    case 'header': {
      const value = (body as { value?: unknown }).value;
      if (typeof value !== 'string' || value.length === 0) {
        return { ok: false, error: 'header_secret_requires_value_string' };
      }
      return { ok: true, secret: { type: 'header', value } };
    }
    case 'basic': {
      const username = (body as { username?: unknown }).username;
      const password = (body as { password?: unknown }).password;
      if (typeof username !== 'string' || username.length === 0) {
        return { ok: false, error: 'basic_secret_requires_username_string' };
      }
      if (typeof password !== 'string' || password.length === 0) {
        return { ok: false, error: 'basic_secret_requires_password_string' };
      }
      return { ok: true, secret: { type: 'basic', username, password } };
    }
  }
}

function requireAdmin(c: { get: (k: 'session') => Session | undefined }): Response | null {
  const session = c.get('session');
  if (!session) return new Response(null, { status: 401 });
  if (session.role !== 'admin') return new Response(null, { status: 403 });
  return null;
}

async function getConnectionsListing(db: D1Database) {
  const all = listConnections();
  return Promise.all(
    all.map(async (conn) => ({
      id: conn.id,
      name: conn.name,
      baseUrl: conn.baseUrl,
      authType: conn.auth.type,
      isConfigured: await isConnectionConfigured(db, conn.id),
    })),
  );
}

export function registerConnectionRoutes(app: Hono<{ Bindings: Env }>): void {
  app.get('/api/connections', async (c) => {
    const guard = requireAdmin(c);
    if (guard) return guard;
    return c.json(await getConnectionsListing(c.env.DB));
  });

  app.put('/api/connections/:id', async (c) => {
    const guard = requireAdmin(c);
    if (guard) return guard;

    const id = c.req.param('id');
    const conn = getConnection(id);
    if (!conn) {
      return c.json({ ok: false, error: 'unknown_connection' }, 404);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ ok: false, error: 'invalid_json' }, 400);
    }

    const validation = validateSecretForConnection(conn, body);
    if (!validation.ok) {
      return c.json({ ok: false, error: validation.error }, 400);
    }
    const secret: ConnectionSecret = validation.secret;

    if (!c.env.SECRETS_KEY) {
      return c.json({ ok: false, error: 'SECRETS_KEY not configured' }, 500);
    }

    const session = c.get('session') as Session;

    if (secret.type === 'none') {
      // 'none' means no secret needed for outbound auth — record presence so
      // isConfigured returns true but don't bother storing a payload.
      await deleteConnectionSecret(c.env.DB, id);
      // Re-store an empty payload so isConfigured stays true.
      await setConnectionSecret(c.env.DB, id, { type: 'none' }, c.env.SECRETS_KEY, session.email);
    } else {
      await setConnectionSecret(c.env.DB, id, secret, c.env.SECRETS_KEY, session.email);
    }

    await recordAuditEvent(c.env.DB, {
      action: 'connection.secret_set',
      actor: { email: session.email, orgId: session.orgId, role: session.role },
      connectionId: id,
      ip: c.req.header('CF-Connecting-IP') ?? '',
    });

    return c.json({ ok: true });
  });
}
