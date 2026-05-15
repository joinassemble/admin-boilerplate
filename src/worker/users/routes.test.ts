import { env, SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import { createSession } from '../auth/session';

afterEach(async () => {
  await env.DB.prepare('DELETE FROM sessions').run();
  await env.DB.prepare('DELETE FROM users').run();
  await env.DB.prepare('DELETE FROM audit_log').run();
});

async function adminCookie(): Promise<string> {
  const s = await createSession(env.DB, { email: 'admin@example.com', role: 'admin' });
  return `__Host-session=${s.token}`;
}

describe('GET /api/users', () => {
  it('200 with last_seen DESC ordering, banned and active mixed', async () => {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare('INSERT INTO users (email, first_seen_at, last_seen_at) VALUES (?, ?, ?)').bind('older@x.io', now - 100, now - 100).run();
    await env.DB.prepare('INSERT INTO users (email, first_seen_at, last_seen_at, banned_at) VALUES (?, ?, ?, ?)').bind('banned@x.io', now - 50, now - 50, now).run();
    await env.DB.prepare('INSERT INTO users (email, first_seen_at, last_seen_at) VALUES (?, ?, ?)').bind('newer@x.io', now, now).run();

    const res = await SELF.fetch('http://localhost/api/users', { headers: { Cookie: await adminCookie() } });
    expect(res.status).toBe(200);
    const list = (await res.json()) as Array<{ email: string }>;
    expect(list.map((u) => u.email)).toEqual(['newer@x.io', 'banned@x.io', 'older@x.io']);
  });
});

describe('PATCH /api/users/:email', () => {
  it('bans a user (sets banned_at) + deletes sessions + writes audit', async () => {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare('INSERT INTO users (email, first_seen_at, last_seen_at) VALUES (?, ?, ?)').bind('victim@x.io', now, now).run();
    await createSession(env.DB, { email: 'victim@x.io' });

    const res = await SELF.fetch('http://localhost/api/users/victim%40x.io', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: await adminCookie() },
      body: JSON.stringify({ banned: true }),
    });
    expect(res.status).toBe(200);

    const u = await env.DB.prepare('SELECT banned_at FROM users WHERE email = ?').bind('victim@x.io').first<{ banned_at: number | null }>();
    expect(u?.banned_at).not.toBeNull();

    const sessions = await env.DB.prepare('SELECT COUNT(*) as c FROM sessions WHERE email = ?').bind('victim@x.io').first<{ c: number }>();
    expect(sessions?.c).toBe(0);

    const a = await env.DB.prepare('SELECT action FROM audit_log WHERE action = ?').bind('user.ban').first<{ action: string }>();
    expect(a?.action).toBe('user.ban');
  });

  it('unbans a user', async () => {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare('INSERT INTO users (email, first_seen_at, last_seen_at, banned_at) VALUES (?, ?, ?, ?)').bind('back@x.io', now, now, now).run();
    const res = await SELF.fetch('http://localhost/api/users/back%40x.io', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: await adminCookie() },
      body: JSON.stringify({ banned: false }),
    });
    expect(res.status).toBe(200);
    const u = await env.DB.prepare('SELECT banned_at FROM users WHERE email = ?').bind('back@x.io').first<{ banned_at: number | null }>();
    expect(u?.banned_at).toBeNull();
  });

  it('updates orgId and role', async () => {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare('INSERT INTO users (email, first_seen_at, last_seen_at) VALUES (?, ?, ?)').bind('promote@x.io', now, now).run();
    const res = await SELF.fetch('http://localhost/api/users/promote%40x.io', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: await adminCookie() },
      body: JSON.stringify({ orgId: 'special', role: 'admin' }),
    });
    expect(res.status).toBe(200);
    const u = await env.DB.prepare('SELECT org_id, role FROM users WHERE email = ?').bind('promote@x.io').first<{ org_id: string; role: string }>();
    expect(u?.org_id).toBe('special');
    expect(u?.role).toBe('admin');
  });

  it('404 if user does not exist', async () => {
    const res = await SELF.fetch('http://localhost/api/users/absent%40x.io', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: await adminCookie() },
      body: JSON.stringify({ banned: true }),
    });
    expect(res.status).toBe(404);
  });
});
