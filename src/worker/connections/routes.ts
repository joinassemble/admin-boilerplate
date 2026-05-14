import type { Hono } from 'hono';
import { recordAuditEvent } from '../audit/writer';
import type { Session } from '../auth/session';
import { listConnections } from './registry';
import { deleteConnectionSecret, isConnectionConfigured, setConnectionSecret } from './secrets';
import type { ConnectionSecret } from './types';

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
    if (!listConnections().some((conn) => conn.id === id)) {
      return c.json({ ok: false, error: 'unknown_connection' }, 404);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ ok: false, error: 'invalid_json' }, 400);
    }
    const secret = body as ConnectionSecret;
    // Lightweight runtime shape validation. Crypto fail-closed handles the rest.
    if (!secret || typeof (secret as { type?: unknown }).type !== 'string') {
      return c.json({ ok: false, error: 'invalid_secret_shape' }, 400);
    }

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
