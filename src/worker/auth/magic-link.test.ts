import { env, SELF } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  await env.DB.prepare('DELETE FROM sessions').run();
  await env.DB.prepare('DELETE FROM audit_log').run();
});

describe('magic-link flow (allowlist policy)', () => {
  it('POST /auth/request returns ok and logs link for an allowed email', async () => {
    const res = await SELF.fetch('http://localhost/auth/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dev@localhost' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('returns generic ok for a denied email (no enumeration)', async () => {
    const res = await SELF.fetch('http://localhost/auth/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'eve@example.com' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('GET /auth/callback with an unknown token returns 400', async () => {
    const res = await SELF.fetch('http://localhost/auth/callback?token=does-not-exist', {
      redirect: 'manual',
    });
    expect(res.status).toBe(400);
  });

  it('full happy-path: request + callback creates a session cookie + redirects', async () => {
    // Insert a magic token directly (bypass the request handler so we don't need
    // to deal with the rate limiter or unique-email-per-test concerns).
    const { randomToken } = await import('../lib/tokens');
    const token = randomToken();
    await env.MAGIC_TOKENS.put(
      `magic:${token}`,
      JSON.stringify({
        email: 'dev@localhost',
        expires: Math.floor(Date.now() / 1000) + 600,
      }),
      { expirationTtl: 600 },
    );

    const res = await SELF.fetch(`http://localhost/auth/callback?token=${token}`, {
      redirect: 'manual',
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/');
    const setCookie = res.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toMatch(/__Host-session=[A-Za-z0-9_-]{43}/);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/Secure/);
    expect(setCookie).toMatch(/SameSite=Lax/);

    // Audit log written.
    const audit = await env.DB.prepare('SELECT action FROM audit_log WHERE actor_email = ?')
      .bind('dev@localhost')
      .first<{ action: string }>();
    expect(audit?.action).toBe('sign_in');
  });

  it('callback with a valid token but malformed body returns 400', async () => {
    const { randomToken } = await import('../lib/tokens');
    const token = randomToken();
    await env.MAGIC_TOKENS.put(`magic:${token}`, 'not-json', { expirationTtl: 60 });

    const res = await SELF.fetch(`http://localhost/auth/callback?token=${token}`, {
      redirect: 'manual',
    });
    expect(res.status).toBe(400);
  });

  it('magic-link URL uses the request origin when PUBLIC_URL is unset', async () => {
    // Regression: previously fell back to hardcoded 'http://localhost:5173',
    // which would leak into production emails if PUBLIC_URL was forgotten.
    // We capture what the ConsoleProvider logs, which contains the URL.
    const logSpy = vi.spyOn(console, 'log');
    logSpy.mockClear();

    const res = await SELF.fetch('https://my-deployment.workers.dev/auth/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dev@localhost' }),
    });
    expect(res.status).toBe(200);

    const logged = logSpy.mock.calls.flat().join(' ');
    // No PUBLIC_URL set in test env → falls back to the request's origin.
    expect(logged).toContain('https://my-deployment.workers.dev/auth/callback?token=');
    expect(logged).not.toContain('http://localhost:5173');
  });
});
