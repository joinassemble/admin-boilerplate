import { env, SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import { createSession } from './session';

afterEach(async () => {
  await env.DB.prepare('DELETE FROM sessions').run();
});

describe('session middleware + /api/me + /auth/sign-out', () => {
  it('GET /api/me returns 401 with no cookie', async () => {
    const res = await SELF.fetch('http://localhost/api/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/me returns 401 with a bogus cookie', async () => {
    const res = await SELF.fetch('http://localhost/api/me', {
      headers: { Cookie: '__Host-session=bogus' },
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/me returns the session metadata with a valid cookie', async () => {
    const s = await createSession(env.DB, {
      email: 'ada@example.com',
      orgId: 'lovelace',
      role: 'admin',
    });
    const res = await SELF.fetch('http://localhost/api/me', {
      headers: { Cookie: `__Host-session=${s.token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { email: string; orgId: string; role: string };
    expect(body).toEqual({ email: 'ada@example.com', orgId: 'lovelace', role: 'admin' });
  });

  it('POST /auth/sign-out clears the cookie and revokes the session', async () => {
    const s = await createSession(env.DB, { email: 'ada@example.com' });
    const res = await SELF.fetch('http://localhost/auth/sign-out', {
      method: 'POST',
      headers: { Cookie: `__Host-session=${s.token}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toMatch(/__Host-session=;.*Max-Age=0/);
    const meRes = await SELF.fetch('http://localhost/api/me', {
      headers: { Cookie: `__Host-session=${s.token}` },
    });
    expect(meRes.status).toBe(401);
  });
});
