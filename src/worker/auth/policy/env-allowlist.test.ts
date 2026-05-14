import { describe, expect, it } from 'vitest';
import { EnvAllowlistPolicy } from './env-allowlist';

describe('EnvAllowlistPolicy', () => {
  it('allows emails in ADMIN_EMAILS and assigns role=admin', async () => {
    const p = new EnvAllowlistPolicy({ ADMIN_EMAILS: 'ada@example.com,bob@example.com' });
    const r = await p.evaluate('ada@example.com', {});
    expect(r.allowed).toBe(true);
    expect(r.role).toBe('admin');
  });

  it('denies emails not in ADMIN_EMAILS', async () => {
    const p = new EnvAllowlistPolicy({ ADMIN_EMAILS: 'ada@example.com' });
    const r = await p.evaluate('eve@example.com', {});
    expect(r.allowed).toBe(false);
  });

  it('matches case-insensitively', async () => {
    const p = new EnvAllowlistPolicy({ ADMIN_EMAILS: 'Ada@Example.com' });
    const r = await p.evaluate('ADA@example.com', {});
    expect(r.allowed).toBe(true);
  });

  it('denies everyone when ADMIN_EMAILS is empty', async () => {
    const p = new EnvAllowlistPolicy({ ADMIN_EMAILS: '' });
    const r = await p.evaluate('ada@example.com', {});
    expect(r.allowed).toBe(false);
  });

  it('onSignIn returns the same decision (no D1 upsert in env-only mode)', async () => {
    const p = new EnvAllowlistPolicy({ ADMIN_EMAILS: 'ada@example.com' });
    const r = await p.onSignIn('ada@example.com', {});
    expect(r).toEqual({ allowed: true, role: 'admin' });
  });
});
