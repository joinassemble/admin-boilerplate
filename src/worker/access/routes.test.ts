import { env, SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import { createSession } from '../auth/session';

afterEach(async () => {
  await env.DB.prepare('DELETE FROM sessions').run();
  await env.DB.prepare('DELETE FROM allowed_emails').run();
  await env.DB.prepare('DELETE FROM audit_log').run();
});

async function adminCookie(): Promise<string> {
  const s = await createSession(env.DB, { email: 'admin@example.com', role: 'admin' });
  return `__Host-session=${s.token}`;
}
async function userCookie(): Promise<string> {
  const s = await createSession(env.DB, { email: 'user@example.com' });
  return `__Host-session=${s.token}`;
}

describe('GET /api/access', () => {
  it('401 with no cookie', async () => {
    expect((await SELF.fetch('http://localhost/api/access')).status).toBe(401);
  });
  it('403 for non-admin', async () => {
    const res = await SELF.fetch('http://localhost/api/access', {
      headers: { Cookie: await userCookie() },
    });
    expect(res.status).toBe(403);
  });
  it('200 returns rows ordered by added_at DESC', async () => {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare('INSERT INTO allowed_emails (email, added_at, added_by) VALUES (?, ?, ?)').bind('a@x.io', now - 10, 'admin@example.com').run();
    await env.DB.prepare('INSERT INTO allowed_emails (email, added_at, added_by) VALUES (?, ?, ?)').bind('b@x.io', now, 'admin@example.com').run();
    const res = await SELF.fetch('http://localhost/api/access', { headers: { Cookie: await adminCookie() } });
    expect(res.status).toBe(200);
    const rows = (await res.json()) as Array<{ email: string }>;
    expect(rows.map((r) => r.email)).toEqual(['b@x.io', 'a@x.io']);
  });
});

describe('POST /api/access', () => {
  it('adds a single email', async () => {
    const res = await SELF.fetch('http://localhost/api/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await adminCookie() },
      body: JSON.stringify({ email: 'partner@example.io', orgId: 'partner', role: 'editor' }),
    });
    expect(res.status).toBe(200);
    const row = await env.DB.prepare('SELECT email, org_id, role FROM allowed_emails WHERE email = ?').bind('partner@example.io').first<{ email: string; org_id: string; role: string }>();
    expect(row?.org_id).toBe('partner');
    expect(row?.role).toBe('editor');
    const a = await env.DB.prepare('SELECT action FROM audit_log WHERE action = ?').bind('access.allow_add').first<{ action: string }>();
    expect(a?.action).toBe('access.allow_add');
  });

  it('adds an array of emails (bulk)', async () => {
    const res = await SELF.fetch('http://localhost/api/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await adminCookie() },
      body: JSON.stringify([
        { email: 'one@example.io' },
        { email: 'two@example.io', orgId: 'two' },
      ]),
    });
    expect(res.status).toBe(200);
    const count = await env.DB.prepare('SELECT COUNT(*) as c FROM allowed_emails').first<{ c: number }>();
    expect(count?.c).toBe(2);
  });

  it('rejects malformed bodies', async () => {
    const res = await SELF.fetch('http://localhost/api/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await adminCookie() },
      body: JSON.stringify({ orgId: 'no-email' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/access/:email', () => {
  it('removes a row + writes audit', async () => {
    await env.DB.prepare('INSERT INTO allowed_emails (email, added_at, added_by) VALUES (?, ?, ?)').bind('gone@x.io', 1, 'admin@example.com').run();
    const res = await SELF.fetch('http://localhost/api/access/gone%40x.io', {
      method: 'DELETE',
      headers: { Cookie: await adminCookie() },
    });
    expect(res.status).toBe(200);
    const left = await env.DB.prepare('SELECT COUNT(*) as c FROM allowed_emails').first<{ c: number }>();
    expect(left?.c).toBe(0);
    const a = await env.DB.prepare('SELECT action FROM audit_log WHERE action = ?').bind('access.allow_remove').first<{ action: string }>();
    expect(a?.action).toBe('access.allow_remove');
  });
});
