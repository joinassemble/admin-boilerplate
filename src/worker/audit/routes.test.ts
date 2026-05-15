import { env, SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import { createSession } from '../auth/session';
import { recordAuditEvent } from './writer';

afterEach(async () => {
  await env.DB.prepare('DELETE FROM sessions').run();
  await env.DB.prepare('DELETE FROM audit_log').run();
});

async function adminCookie(): Promise<string> {
  const s = await createSession(env.DB, { email: 'admin@example.com', role: 'admin' });
  return `__Host-session=${s.token}`;
}

describe('GET /api/audit', () => {
  it('200 with recent-first ordering', async () => {
    await recordAuditEvent(env.DB, { action: 'sign_in', actor: { email: 'a@x.io' } });
    await new Promise((r) => setTimeout(r, 1100));
    await recordAuditEvent(env.DB, { action: 'sign_in', actor: { email: 'b@x.io' } });

    const res = await SELF.fetch('http://localhost/api/audit', { headers: { Cookie: await adminCookie() } });
    expect(res.status).toBe(200);
    const list = (await res.json()) as Array<{ actor_email: string }>;
    expect(list[0]!.actor_email).toBe('b@x.io');
    expect(list[1]!.actor_email).toBe('a@x.io');
  });

  it('honours ?limit=N', async () => {
    for (let i = 0; i < 5; i++) {
      await recordAuditEvent(env.DB, { action: 'sign_in', actor: { email: `a${i}@x.io` } });
    }
    const res = await SELF.fetch('http://localhost/api/audit?limit=2', { headers: { Cookie: await adminCookie() } });
    const list = (await res.json()) as unknown[];
    expect(list).toHaveLength(2);
  });
});
