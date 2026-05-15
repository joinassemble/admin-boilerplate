import type { Context, Hono } from 'hono';
import { recordAuditEvent } from '../audit/writer';
import type { Session } from '../auth/session';

interface AccessEntry {
  email: string;
  orgId?: string;
  role?: string;
  note?: string;
}

function requireAdmin(c: Context): Response | null {
  const session = c.get('session') as Session | undefined;
  if (!session) return new Response(null, { status: 401 });
  if (session.role !== 'admin') return new Response(null, { status: 403 });
  return null;
}

function parseEntry(x: unknown): AccessEntry | null {
  if (!x || typeof x !== 'object') return null;
  const e = x as Record<string, unknown>;
  if (typeof e.email !== 'string' || e.email.length === 0) return null;
  return {
    email: e.email.toLowerCase().trim(),
    orgId: typeof e.orgId === 'string' ? e.orgId : undefined,
    role: typeof e.role === 'string' ? e.role : undefined,
    note: typeof e.note === 'string' ? e.note : undefined,
  };
}

export function registerAccessRoutes(app: Hono<{ Bindings: Env }>): void {
  app.get('/api/access', async (c) => {
    const guard = requireAdmin(c);
    if (guard) return guard;
    const { results } = await c.env.DB.prepare(
      'SELECT email, org_id, role, added_at, added_by, note FROM allowed_emails ORDER BY added_at DESC',
    ).all<{ email: string; org_id: string | null; role: string | null; added_at: number; added_by: string; note: string | null }>();
    return c.json(
      results.map((r) => ({
        email: r.email,
        orgId: r.org_id,
        role: r.role,
        addedAt: r.added_at,
        addedBy: r.added_by,
        note: r.note,
      })),
    );
  });

  app.post('/api/access', async (c) => {
    const guard = requireAdmin(c);
    if (guard) return guard;

    let body: unknown;
    try { body = await c.req.json(); } catch { return c.json({ ok: false, error: 'invalid_json' }, 400); }

    const list: AccessEntry[] = [];
    if (Array.isArray(body)) {
      for (const item of body) {
        const parsed = parseEntry(item);
        if (!parsed) return c.json({ ok: false, error: 'invalid_entry' }, 400);
        list.push(parsed);
      }
    } else {
      const parsed = parseEntry(body);
      if (!parsed) return c.json({ ok: false, error: 'invalid_entry' }, 400);
      list.push(parsed);
    }

    const session = c.get('session') as Session;
    const now = Math.floor(Date.now() / 1000);
    const ip = c.req.header('CF-Connecting-IP') ?? '';

    for (const entry of list) {
      await c.env.DB.prepare(
        `INSERT INTO allowed_emails (email, org_id, role, added_at, added_by, note)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           org_id = excluded.org_id,
           role   = excluded.role,
           added_at = excluded.added_at,
           added_by = excluded.added_by,
           note   = excluded.note`,
      ).bind(entry.email, entry.orgId ?? null, entry.role ?? null, now, session.email, entry.note ?? null).run();

      await recordAuditEvent(c.env.DB, {
        action: 'access.allow_add',
        actor: { email: session.email, orgId: session.orgId, role: session.role },
        detail: entry,
        ip,
      });
    }
    return c.json({ ok: true, added: list.length });
  });

  app.delete('/api/access/:email', async (c) => {
    const guard = requireAdmin(c);
    if (guard) return guard;
    const session = c.get('session') as Session;
    const email = decodeURIComponent(c.req.param('email')).toLowerCase();
    await c.env.DB.prepare('DELETE FROM allowed_emails WHERE email = ?').bind(email).run();
    await recordAuditEvent(c.env.DB, {
      action: 'access.allow_remove',
      actor: { email: session.email, orgId: session.orgId, role: session.role },
      detail: { email },
      ip: c.req.header('CF-Connecting-IP') ?? '',
    });
    return c.json({ ok: true });
  });
}
