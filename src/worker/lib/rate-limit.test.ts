import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { checkAndIncrement } from './rate-limit';

describe('rate-limit', () => {
  it('allows under-limit requests and increments the counter', async () => {
    const result = await checkAndIncrement(env.RATE_LIMIT, 'test:key:1', 3, 60);
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(1);
  });

  it('blocks once the limit is reached', async () => {
    const key = 'test:key:2';
    await checkAndIncrement(env.RATE_LIMIT, key, 2, 60);
    await checkAndIncrement(env.RATE_LIMIT, key, 2, 60);
    const result = await checkAndIncrement(env.RATE_LIMIT, key, 2, 60);
    expect(result.allowed).toBe(false);
    expect(result.count).toBe(3);
  });
});
