/**
 * URL-safe random token generation.
 *
 * Used for magic-link tokens (15-min TTL in KV) and session tokens (30-day in D1).
 * Output uses base64url (RFC 4648 §5) — no `+`, no `/`, no `=` padding.
 */

export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  // btoa returns standard base64; convert to base64url and strip padding.
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
