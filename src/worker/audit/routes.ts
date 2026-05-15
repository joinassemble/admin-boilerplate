import type { Context, Hono } from 'hono';
import type { Session } from '../auth/session';

function requireAdmin(c: Context): Response | null {
  const session = c.get('session') as Session | undefined;
  if (!session) return new Response(null, { status: 401 });
  if (session.role !== 'admin') return new Response(null, { status: 403 });
  return null;
}

export function registerAuditRoutes(app: Hono<{ Bindings: Env }>): void {
  app.get('/api/audit', async (c) => {
    const guard = requireAdmin(c);
    if (guard) return guard;
    const rawLimit = Number(c.req.query('limit') ?? '200');
    const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? rawLimit : 200, 1000));
    const { results } = await c.env.DB.prepare(
      'SELECT id, ts, actor_email, actor_org_id, actor_role, action, resource_id, record_id, connection_id, detail_json, ip FROM audit_log ORDER BY ts DESC LIMIT ?',
    ).bind(limit).all();
    return c.json(results);
  });
}
