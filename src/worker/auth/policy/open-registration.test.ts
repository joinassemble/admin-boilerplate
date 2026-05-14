import { env } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import { OpenRegistrationPolicy } from './open-registration';

afterEach(async () => {
  await env.DB.prepare('DELETE FROM users').run();
});

describe('OpenRegistrationPolicy', () => {
  it('allows any well-formed email', async () => {
    const p = new OpenRegistrationPolicy(env.DB, { ADMIN_EMAILS: '' });
    const r = await p.evaluate('anybody@anywhere.io', {});
    expect(r.allowed).toBe(true);
  });

  it('rejects malformed emails', async () => {
    const p = new OpenRegistrationPolicy(env.DB, { ADMIN_EMAILS: '' });
    expect((await p.evaluate('not-an-email', {})).allowed).toBe(false);
    expect((await p.evaluate('', {})).allowed).toBe(false);
  });

  it('honours EMAIL_BLOCKLIST regex', async () => {
    const p = new OpenRegistrationPolicy(env.DB, {
      ADMIN_EMAILS: '',
      EMAIL_BLOCKLIST: '@(mailinator\\.com|tempmail\\.io)$',
    });
    expect((await p.evaluate('test@mailinator.com', {})).allowed).toBe(false);
    expect((await p.evaluate('real@gmail.com', {})).allowed).toBe(true);
  });

  it('bootstrap admin is recognised + given role=admin', async () => {
    const p = new OpenRegistrationPolicy(env.DB, { ADMIN_EMAILS: 'me@example.com' });
    const r = await p.evaluate('me@example.com', {});
    expect(r.allowed).toBe(true);
    expect(r.role).toBe('admin');
  });

  it('onSignIn creates users row on first sign-in', async () => {
    const p = new OpenRegistrationPolicy(env.DB, { ADMIN_EMAILS: '' });
    await p.onSignIn('newcomer@example.io', {});
    const u = await env.DB.prepare('SELECT email FROM users WHERE email = ?')
      .bind('newcomer@example.io')
      .first<{ email: string }>();
    expect(u?.email).toBe('newcomer@example.io');
  });

  it('onSignIn rejects banned users', async () => {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      'INSERT INTO users (email, banned_at, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)',
    )
      .bind('bad@example.com', now, now, now)
      .run();

    const p = new OpenRegistrationPolicy(env.DB, { ADMIN_EMAILS: '' });
    const r = await p.onSignIn('bad@example.com', {});
    expect(r.allowed).toBe(false);
  });
});
