import { describe, expect, it } from 'vitest';
import { encryptJson, decryptJson, type Encrypted } from './crypto';

// Valid base64-encoded 32-byte keys for tests. Generated via:
//   node -e "console.log(crypto.randomBytes(32).toString('base64'))"
const TEST_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const WRONG_KEY = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBA=';

describe('crypto', () => {
  it('encrypts and decrypts a JSON payload round-trip', async () => {
    const payload = { token: 'sk_test_abc', extra: 42 };
    const enc: Encrypted = await encryptJson(payload, TEST_KEY, 'stripe');
    expect(enc.ciphertext).toBeInstanceOf(Uint8Array);
    expect(enc.iv).toBeInstanceOf(Uint8Array);
    expect(enc.iv.byteLength).toBe(12); // AES-GCM IV size

    const decrypted = await decryptJson(enc, TEST_KEY, 'stripe');
    expect(decrypted).toEqual(payload);
  });

  it('uses a different IV on each call (non-deterministic)', async () => {
    const a = await encryptJson({ a: 1 }, TEST_KEY, 'salt');
    const b = await encryptJson({ a: 1 }, TEST_KEY, 'salt');
    expect(a.iv).not.toEqual(b.iv);
    expect(a.ciphertext).not.toEqual(b.ciphertext);
  });

  it('rejects decryption with the wrong root key', async () => {
    const enc = await encryptJson({ secret: 'x' }, TEST_KEY, 'stripe');
    await expect(decryptJson(enc, WRONG_KEY, 'stripe')).rejects.toThrow();
  });

  it('rejects decryption with the wrong salt (connection_id mismatch)', async () => {
    const enc = await encryptJson({ secret: 'x' }, TEST_KEY, 'stripe');
    await expect(decryptJson(enc, TEST_KEY, 'github')).rejects.toThrow();
  });
});
