import { env } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import { DomainAllowlistPolicy } from './domain-allowlist';

afterEach(async () => {
  await env.DB.prepare('DELETE FROM users').run();
  await env.DB.prepare('DELETE FROM allowed_emails').run();
});

describe('DomainAllowlistPolicy', () => {
  it('allows emails matching an allowed domain', async () => {
    const p = new DomainAllowlistPolicy(env.DB, {
      ADMIN_EMAILS: '',
      ALLOWED_DOMAINS: 'example.com,partner.io',
    });
    const r = await p.evaluate('user@example.com', {});
    expect(r.allowed).toBe(true);
  });

  it('denies emails not on a domain or in allowed_emails', async () => {
    const p = new DomainAllowlistPolicy(env.DB, {
      ADMIN_EMAILS: '',
      ALLOWED_DOMAINS: 'example.com',
    });
    const r = await p.evaluate('eve@somewhere-else.io', {});
    expect(r.allowed).toBe(false);
  });

  it('allows individual emails added via allowed_emails table', async () => {
    await env.DB.prepare(
      'INSERT INTO allowed_emails (email, org_id, role, added_at, added_by) VALUES (?, ?, ?, ?, ?)',
    )
      .bind('contractor@external.io', 'partner-org', 'editor', Date.now() / 1000, 'admin@example.com')
      .run();

    const p = new DomainAllowlistPolicy(env.DB, {
      ADMIN_EMAILS: '',
      ALLOWED_DOMAINS: 'example.com',
    });
    const r = await p.evaluate('contractor@external.io', {});
    expect(r.allowed).toBe(true);
    expect(r.orgId).toBe('partner-org');
    expect(r.role).toBe('editor');
  });

  it('derives orgId from domain when DERIVE_ORG_FROM_DOMAIN=true', async () => {
    const p = new DomainAllowlistPolicy(env.DB, {
      ADMIN_EMAILS: '',
      ALLOWED_DOMAINS: 'amc.com,regal.com',
      DERIVE_ORG_FROM_DOMAIN: 'true',
    });
    const r = await p.evaluate('manager@amc.com', {});
    expect(r.allowed).toBe(true);
    expect(r.orgId).toBe('amc');
  });

  it('bootstrap admin overrides domain check', async () => {
    const p = new DomainAllowlistPolicy(env.DB, {
      ADMIN_EMAILS: 'me@anywhere.io',
      ALLOWED_DOMAINS: 'example.com',
    });
    const r = await p.evaluate('me@anywhere.io', {});
    expect(r.allowed).toBe(true);
    expect(r.role).toBe('admin');
  });

  it('rejects banned users on onSignIn', async () => {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      'INSERT INTO users (email, banned_at, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)',
    )
      .bind('bad@example.com', now, now, now)
      .run();

    const p = new DomainAllowlistPolicy(env.DB, {
      ADMIN_EMAILS: '',
      ALLOWED_DOMAINS: 'example.com',
    });
    const r = await p.onSignIn('bad@example.com', {});
    expect(r.allowed).toBe(false);
  });

  it('upserts a users row on successful onSignIn', async () => {
    const p = new DomainAllowlistPolicy(env.DB, {
      ADMIN_EMAILS: '',
      ALLOWED_DOMAINS: 'example.com',
      DERIVE_ORG_FROM_DOMAIN: 'true',
    });
    await p.onSignIn('first@example.com', {});

    const u = await env.DB.prepare('SELECT email, org_id FROM users WHERE email = ?')
      .bind('first@example.com')
      .first<{ email: string; org_id: string }>();
    expect(u?.email).toBe('first@example.com');
    expect(u?.org_id).toBe('example');
  });
});
