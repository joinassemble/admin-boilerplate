import { fetchMock } from 'cloudflare:test';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ResendProvider } from './resend-provider';

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => fetchMock.assertNoPendingInterceptors());

describe('ResendProvider', () => {
  it('POSTs to api.resend.com with bearer auth and JSON body', async () => {
    fetchMock.get('https://api.resend.com').intercept({ path: '/emails', method: 'POST' })
      .reply(200, { id: 'em_123' });

    const provider = new ResendProvider({
      apiKey: 'test_key_abc',
      fromAddress: 'admin@example.com',
    });
    await provider.sendMagicLink({
      email: 'user@example.com',
      magicLinkUrl: 'https://app.example.com/auth/callback?token=xyz',
    });
  });

  it('throws on a non-2xx response', async () => {
    fetchMock.get('https://api.resend.com').intercept({ path: '/emails', method: 'POST' })
      .reply(403, { error: 'forbidden' });

    const provider = new ResendProvider({
      apiKey: 'test_key',
      fromAddress: 'admin@example.com',
    });
    await expect(
      provider.sendMagicLink({ email: 'a@b.com', magicLinkUrl: 'https://x.test/' }),
    ).rejects.toThrow();
  });

  it('throws if apiKey is empty', () => {
    expect(() => new ResendProvider({ apiKey: '', fromAddress: 'a@b.com' })).toThrow();
  });
});
