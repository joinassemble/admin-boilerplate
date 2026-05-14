import { describe, expect, it } from 'vitest';
import { randomToken, bytesToBase64Url } from './tokens';

describe('tokens', () => {
  it('randomToken() returns a 32-byte token encoded as base64url (43 chars, no padding)', () => {
    const t = randomToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('randomToken() returns different values on each call', () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toBe(b);
  });

  it('randomToken(16) produces 22-char base64url tokens', () => {
    const t = randomToken(16);
    expect(t).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('bytesToBase64Url() round-trips ASCII bytes', () => {
    const b = new Uint8Array([0x68, 0x69]); // "hi"
    expect(bytesToBase64Url(b)).toBe('aGk');
  });
});
