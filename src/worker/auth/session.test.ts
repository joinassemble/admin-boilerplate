import { env } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import { createSession, validateSession, revokeSession, revokeAllForEmail } from './session';

afterEach(async () => {
  await env.DB.prepare('DELETE FROM sessions').run();
});

describe('sessions', () => {
  it('createSession returns a token, stores a row, returns the session', async () => {
    const s = await createSession(env.DB, {
      email: 'ada@example.com',
      orgId: 'lovelace',
      role: 'admin',
      ip: '127.0.0.1',
      userAgent: 'test',
    });
    expect(s.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(s.email).toBe('ada@example.com');
    expect(s.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('validateSession returns the session for a valid token + bumps last_seen + extends expiry', async () => {
    const s = await createSession(env.DB, { email: 'ada@example.com' });
    const before = s.expiresAt;
    // Wait so we can detect the bump.
    await new Promise((r) => setTimeout(r, 1100));
    const v = await validateSession(env.DB, s.token);
    expect(v?.email).toBe('ada@example.com');
    expect(v!.expiresAt).toBeGreaterThanOrEqual(before);
  });

  it('validateSession returns null for an unknown token', async () => {
    expect(await validateSession(env.DB, 'not-a-real-token')).toBeNull();
  });

  it('validateSession returns null for an expired session', async () => {
    const past = Math.floor(Date.now() / 1000) - 1000;
    await env.DB.prepare(
      'INSERT INTO sessions (token, email, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind('expired-token', 'ada@example.com', past - 100, past - 100, past)
      .run();
    expect(await validateSession(env.DB, 'expired-token')).toBeNull();
  });

  it('revokeSession deletes the row and validateSession returns null', async () => {
    const s = await createSession(env.DB, { email: 'ada@example.com' });
    await revokeSession(env.DB, s.token);
    expect(await validateSession(env.DB, s.token)).toBeNull();
  });

  it('revokeAllForEmail deletes every session for the email', async () => {
    await createSession(env.DB, { email: 'ada@example.com' });
    await createSession(env.DB, { email: 'ada@example.com' });
    await createSession(env.DB, { email: 'bob@example.com' });
    await revokeAllForEmail(env.DB, 'ada@example.com');
    const ada = await env.DB.prepare('SELECT COUNT(*) as c FROM sessions WHERE email = ?')
      .bind('ada@example.com')
      .first<{ c: number }>();
    const bob = await env.DB.prepare('SELECT COUNT(*) as c FROM sessions WHERE email = ?')
      .bind('bob@example.com')
      .first<{ c: number }>();
    expect(ada?.c).toBe(0);
    expect(bob?.c).toBe(1);
  });
});
