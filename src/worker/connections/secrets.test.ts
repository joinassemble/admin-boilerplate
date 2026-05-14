import { env } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import {
  deleteConnectionSecret,
  getConnectionSecret,
  isConnectionConfigured,
  setConnectionSecret,
} from './secrets';

const ROOT_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

afterEach(async () => {
  await env.DB.prepare('DELETE FROM connection_secrets').run();
});

describe('connection secrets', () => {
  it('round-trips a bearer secret through D1 + AES-GCM', async () => {
    await setConnectionSecret(
      env.DB,
      'stripe',
      { type: 'bearer', token: 'sk_test_abc' },
      ROOT_KEY,
      'admin@example.com',
    );
    const got = await getConnectionSecret(env.DB, 'stripe', ROOT_KEY);
    expect(got).toEqual({ type: 'bearer', token: 'sk_test_abc' });
  });

  it('round-trips a basic secret', async () => {
    await setConnectionSecret(
      env.DB,
      'jira',
      { type: 'basic', username: 'admin', password: 'hunter2' },
      ROOT_KEY,
      'admin@example.com',
    );
    const got = await getConnectionSecret(env.DB, 'jira', ROOT_KEY);
    expect(got).toEqual({ type: 'basic', username: 'admin', password: 'hunter2' });
  });

  it('setConnectionSecret overwrites any prior value (rotation)', async () => {
    await setConnectionSecret(env.DB, 'stripe', { type: 'bearer', token: 'old' }, ROOT_KEY, 'admin@example.com');
    await setConnectionSecret(env.DB, 'stripe', { type: 'bearer', token: 'new' }, ROOT_KEY, 'admin@example.com');
    const got = await getConnectionSecret(env.DB, 'stripe', ROOT_KEY);
    expect(got).toEqual({ type: 'bearer', token: 'new' });
  });

  it('isConnectionConfigured returns true when a secret exists', async () => {
    expect(await isConnectionConfigured(env.DB, 'stripe')).toBe(false);
    await setConnectionSecret(env.DB, 'stripe', { type: 'bearer', token: 'x' }, ROOT_KEY, 'admin@example.com');
    expect(await isConnectionConfigured(env.DB, 'stripe')).toBe(true);
  });

  it('getConnectionSecret returns null when missing', async () => {
    expect(await getConnectionSecret(env.DB, 'absent', ROOT_KEY)).toBeNull();
  });

  it('deleteConnectionSecret removes the row', async () => {
    await setConnectionSecret(env.DB, 'stripe', { type: 'bearer', token: 'x' }, ROOT_KEY, 'admin@example.com');
    await deleteConnectionSecret(env.DB, 'stripe');
    expect(await getConnectionSecret(env.DB, 'stripe', ROOT_KEY)).toBeNull();
  });

  it('getConnectionSecret throws on wrong root key (tamper-evident)', async () => {
    await setConnectionSecret(env.DB, 'stripe', { type: 'bearer', token: 'x' }, ROOT_KEY, 'admin@example.com');
    const wrong = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBA=';
    await expect(getConnectionSecret(env.DB, 'stripe', wrong)).rejects.toThrow();
  });
});
