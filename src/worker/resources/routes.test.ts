import { env, SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import { createSession } from '../auth/session';

afterEach(async () => {
  await env.DB.prepare('DELETE FROM sessions').run();
  await env.DB.prepare('DELETE FROM connection_secrets').run();
  await env.DB.prepare('DELETE FROM audit_log').run();
});

async function cookieFor(email: string, role: string | null = null): Promise<string> {
  const s = await createSession(env.DB, { email, role: role ?? undefined });
  return `__Host-session=${s.token}`;
}

describe('GET /api/resources', () => {
  it('401 with no cookie', async () => {
    expect((await SELF.fetch('http://localhost/api/resources')).status).toBe(401);
  });

  it('200 with a valid session', async () => {
    const res = await SELF.fetch('http://localhost/api/resources', {
      headers: { Cookie: await cookieFor('user@example.com') },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });
});

describe('GET /api/resources/:id/list', () => {
  it('404 for unknown resource id', async () => {
    const res = await SELF.fetch('http://localhost/api/resources/does-not-exist/list', {
      headers: { Cookie: await cookieFor('user@example.com') },
    });
    expect(res.status).toBe(404);
  });
});

// Happy-path proxy tests with the example resource added in Task 14.

describe('GET /api/resources/:id/list (live proxy through to JSONPlaceholder)', () => {
  it('lists posts from JSONPlaceholder via the proxy', async () => {
    // jsonplaceholder is auth.type=none — but the proxy still requires
    // `isConfigured`, so we set the empty payload first.
    const adminCookieStr = await cookieFor('admin@example.com', 'admin');
    await SELF.fetch('http://localhost/api/connections/jsonplaceholder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookieStr },
      body: JSON.stringify({ type: 'none' }),
    });

    // Stub the outbound call with fetchMock.
    const { fetchMock } = await import('cloudflare:test');
    fetchMock.activate();
    fetchMock.disableNetConnect();
    fetchMock.get('https://jsonplaceholder.typicode.com').intercept({ path: '/posts' })
      .reply(200, [{ id: 1, userId: 1, title: 't', body: 'b' }]);

    const res = await SELF.fetch('http://localhost/api/resources/jsonplaceholder-posts/list', {
      headers: { Cookie: adminCookieStr },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body).toHaveLength(1);

    fetchMock.assertNoPendingInterceptors();
  });
});
