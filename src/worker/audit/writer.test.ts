import { env } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import { recordAuditEvent } from './writer';

afterEach(async () => {
  await env.DB.prepare('DELETE FROM audit_log').run();
});

describe('audit writer', () => {
  it('records a sign_in event with actor metadata', async () => {
    await recordAuditEvent(env.DB, {
      action: 'sign_in',
      actor: { email: 'ada@example.com', orgId: 'lovelace', role: 'admin' },
      ip: '127.0.0.1',
    });

    const row = await env.DB.prepare(
      'SELECT action, actor_email, actor_org_id, actor_role, ip FROM audit_log WHERE action = ?',
    )
      .bind('sign_in')
      .first<{ action: string; actor_email: string; actor_org_id: string; actor_role: string; ip: string }>();
    expect(row?.actor_email).toBe('ada@example.com');
    expect(row?.actor_org_id).toBe('lovelace');
    expect(row?.actor_role).toBe('admin');
    expect(row?.ip).toBe('127.0.0.1');
  });

  it('records system events with no actor', async () => {
    await recordAuditEvent(env.DB, { action: 'rotate_secret', connectionId: 'stripe' });
    const row = await env.DB.prepare(
      'SELECT action, actor_email, connection_id FROM audit_log WHERE action = ?',
    )
      .bind('rotate_secret')
      .first<{ action: string; actor_email: string | null; connection_id: string }>();
    expect(row?.actor_email).toBeNull();
    expect(row?.connection_id).toBe('stripe');
  });
});
