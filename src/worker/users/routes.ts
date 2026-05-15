import type { Context, Hono } from 'hono';
import { recordAuditEvent } from '../audit/writer';
import { revokeAllForEmail } from '../auth/session';
import type { Session } from '../auth/session';

function requireAdmin(c: Context): Response | null {
  const session = c.get('session') as Session | undefined;
  if (!session) return new Response(null, { status: 401 });
  if (session.role !== 'admin') return new Response(null, { status: 403 });
  return null;
}

export function registerUserRoutes(app: Hono<{ Bindings: Env }>): void {
  app.get('/api/users', async (c) => {
    const guard = requireAdmin(c);
    if (guard) return guard;
    const { results } = await c.env.DB.prepare(
      'SELECT email, org_id, role, first_seen_at, last_seen_at, banned_at FROM users ORDER BY last_seen_at DESC',
    ).all<{ email: string; org_id: string | null; role: string | null; first_seen_at: number; last_seen_at: number; banned_at: number | null }>();
    return c.json(
      results.map((u) => ({
        email: u.email,
        orgId: u.org_id,
        role: u.role,
        firstSeenAt: u.first_seen_at,
        lastSeenAt: u.last_seen_at,
        bannedAt: u.banned_at,
      })),
    );
  });

  app.patch('/api/users/:email', async (c) => {
    const guard = requireAdmin(c);
    if (guard) return guard;

    const session = c.get('session') as Session;
    const email = decodeURIComponent(c.req.param('email')).toLowerCase();
    const existing = await c.env.DB.prepare('SELECT email, banned_at FROM users WHERE email = ?').bind(email).first<{ email: string; banned_at: number | null }>();
    if (!existing) return c.json({ ok: false, error: 'unknown_user' }, 404);

    let body: { banned?: unknown; orgId?: unknown; role?: unknown };
    try { body = await c.req.json(); } catch { return c.json({ ok: false, error: 'invalid_json' }, 400); }

    const setClauses: string[] = [];
    const binds: unknown[] = [];
    let action: 'user.ban' | 'user.unban' | 'user.update' = 'user.update';

    if (typeof body.banned === 'boolean') {
      if (body.banned) {
        setClauses.push('banned_at = ?');
        binds.push(Math.floor(Date.now() / 1000));
        action = 'user.ban';
      } else {
        setClauses.push('banned_at = NULL');
        action = 'user.unban';
      }
    }
    if (typeof body.orgId === 'string' || body.orgId === null) {
      setClauses.push('org_id = ?');
      binds.push(body.orgId ?? null);
    }
    if (typeof body.role === 'string' || body.role === null) {
      setClauses.push('role = ?');
      binds.push(body.role ?? null);
    }

    if (setClauses.length === 0) {
      return c.json({ ok: false, error: 'no_fields_to_update' }, 400);
    }

    binds.push(email);
    await c.env.DB.prepare(`UPDATE users SET ${setClauses.join(', ')} WHERE email = ?`).bind(...binds).run();

    // Banning revokes all sessions so the user is signed out everywhere immediately.
    if (action === 'user.ban') {
      await revokeAllForEmail(c.env.DB, email);
    }

    await recordAuditEvent(c.env.DB, {
      action,
      actor: { email: session.email, orgId: session.orgId, role: session.role },
      detail: { targetEmail: email, ...body },
      ip: c.req.header('CF-Connecting-IP') ?? '',
    });
    return c.json({ ok: true });
  });
}
