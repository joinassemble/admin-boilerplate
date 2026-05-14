/**
 * Simple per-key counter in KV with a sliding TTL window.
 *
 * Each call increments the counter and returns whether the call is allowed
 * (count <= limit). The TTL resets the window — there's no perfect sliding-window
 * algorithm here, just a leaky-bucket-ish approximation that's good enough
 * for magic-link rate limiting (a few requests per hour).
 */

export interface RateLimitResult {
  allowed: boolean;
  count: number;
}

export async function checkAndIncrement(
  kv: KVNamespace,
  key: string,
  limit: number,
  ttlSeconds: number,
): Promise<RateLimitResult> {
  const raw = await kv.get(key);
  const count = (raw ? Number(raw) : 0) + 1;
  await kv.put(key, String(count), { expirationTtl: ttlSeconds });
  return { allowed: count <= limit, count };
}
