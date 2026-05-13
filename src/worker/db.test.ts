import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('D1 binding', () => {
  it('can query an empty users table', async () => {
    const result = await env.DB.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>();
    expect(result?.c).toBe(0);
  });

  it('can insert and read a user row', async () => {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      'INSERT INTO users (email, first_seen_at, last_seen_at) VALUES (?, ?, ?)'
    ).bind('test@example.com', now, now).run();

    const user = await env.DB.prepare(
      'SELECT email FROM users WHERE email = ?'
    ).bind('test@example.com').first<{ email: string }>();

    expect(user?.email).toBe('test@example.com');

    await env.DB.prepare('DELETE FROM users WHERE email = ?').bind('test@example.com').run();
  });
});
