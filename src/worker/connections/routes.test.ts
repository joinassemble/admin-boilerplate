import { env, SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import { createSession } from '../auth/session';

afterEach(async () => {
  await env.DB.prepare('DELETE FROM sessions').run();
  await env.DB.prepare('DELETE FROM connection_secrets').run();
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

describe('GET /api/connections', () => {
  it('401 with no cookie', async () => {
    expect((await SELF.fetch('http://localhost/api/connections')).status).toBe(401);
  });

  it('403 for non-admin', async () => {
    const res = await SELF.fetch('http://localhost/api/connections', {
      headers: { Cookie: await userCookie() },
    });
    expect(res.status).toBe(403);
  });

  it('200 with the registry (empty until Task 13 adds the example)', async () => {
    const res = await SELF.fetch('http://localhost/api/connections', {
      headers: { Cookie: await adminCookie() },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });
});

describe('PUT /api/connections/:id', () => {
  it('401 with no cookie', async () => {
    const res = await SELF.fetch('http://localhost/api/connections/stripe', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'bearer', token: 'sk_test_x' }),
    });
    expect(res.status).toBe(401);
  });

  it('404 for an unknown connection id', async () => {
    const res = await SELF.fetch('http://localhost/api/connections/does-not-exist', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: await adminCookie() },
      body: JSON.stringify({ type: 'bearer', token: 'x' }),
    });
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/connections/:id (happy path with example connection)', () => {
  it('sets a secret for jsonplaceholder (auth.type=none accepts {type:none})', async () => {
    const res = await SELF.fetch('http://localhost/api/connections/jsonplaceholder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: await adminCookie() },
      body: JSON.stringify({ type: 'none' }),
    });
    expect(res.status).toBe(200);

    // isConfigured flips to true.
    const listRes = await SELF.fetch('http://localhost/api/connections', {
      headers: { Cookie: await adminCookie() },
    });
    const list = (await listRes.json()) as Array<{ id: string; isConfigured: boolean }>;
    const jp = list.find((c) => c.id === 'jsonplaceholder');
    expect(jp?.isConfigured).toBe(true);

    // Audit log.
    const audit = await env.DB.prepare(`SELECT action FROM audit_log WHERE connection_id = ?`)
      .bind('jsonplaceholder').first<{ action: string }>();
    expect(audit?.action).toBe('connection.secret_set');
  });
});
