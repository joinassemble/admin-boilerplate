/**
 * AES-GCM encrypt/decrypt for connection secrets.
 *
 * The root key (`SECRETS_KEY`, a Worker secret) is run through HKDF
 * with the salt = the connection_id, producing a per-connection key.
 * This means re-using the same ciphertext under a different salt fails
 * to decrypt — a small extra safety on top of the GCM auth tag.
 */

export interface Encrypted {
  ciphertext: Uint8Array;
  iv: Uint8Array;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

async function rootKey(rootKeyB64: string): Promise<CryptoKey> {
  let raw: Uint8Array;
  try {
    raw = base64ToBytes(rootKeyB64);
  } catch {
    throw new Error(
      'SECRETS_KEY is not valid base64. Generate one with: openssl rand -base64 32',
    );
  }
  if (raw.byteLength < 16) {
    throw new Error(
      `SECRETS_KEY must decode to at least 16 bytes (got ${raw.byteLength}). Generate one with: openssl rand -base64 32`,
    );
  }
  return crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey']);
}

async function derivePerSaltKey(rootKeyB64: string, salt: string): Promise<CryptoKey> {
  const root = await rootKey(rootKeyB64);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: enc.encode(salt),
      info: enc.encode('admin-boilerplate:connection-secret:v1'),
    },
    root,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJson(
  payload: unknown,
  rootKeyB64: string,
  salt: string,
): Promise<Encrypted> {
  const key = await derivePerSaltKey(rootKeyB64, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = enc.encode(JSON.stringify(payload));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return { ciphertext: new Uint8Array(ct), iv };
}

export async function decryptJson<T = unknown>(
  encrypted: Encrypted,
  rootKeyB64: string,
  salt: string,
): Promise<T> {
  const key = await derivePerSaltKey(rootKeyB64, salt);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: encrypted.iv },
    key,
    encrypted.ciphertext,
  );
  return JSON.parse(dec.decode(pt)) as T;
}

function base64ToBytes(b64: string): Uint8Array {
  // Strip whitespace and any URL-safe substitutions just in case.
  const clean = b64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  // Pad to multiple of 4.
  const padded = clean + '='.repeat((4 - (clean.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
