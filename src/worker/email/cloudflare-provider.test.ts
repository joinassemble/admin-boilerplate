import { describe, expect, it, vi } from 'vitest';
import { CloudflareEmailProvider } from './cloudflare-provider';

describe('CloudflareEmailProvider', () => {
  it('calls SEND_EMAIL.send with a properly formed RFC822 message', async () => {
    const sendMock = vi.fn().mockResolvedValue(undefined);
    const stubBinding = { send: sendMock } as unknown as SendEmail;
    const provider = new CloudflareEmailProvider(stubBinding, 'admin@example.com');

    await provider.sendMagicLink({
      email: 'user@example.com',
      magicLinkUrl: 'https://app.example.com/auth/callback?token=abc',
    });

    expect(sendMock).toHaveBeenCalledOnce();
    const message = sendMock.mock.calls[0]![0] as { from: string; to: string; raw: string };
    expect(message.from).toBe('admin@example.com');
    expect(message.to).toBe('user@example.com');
    expect(message.raw).toContain('https://app.example.com/auth/callback?token=abc');
    expect(message.raw).toContain('Subject:');
  });

  it('throws if FROM_ADDRESS is empty', async () => {
    const stubBinding = { send: vi.fn() } as unknown as SendEmail;
    expect(() => new CloudflareEmailProvider(stubBinding, '')).toThrow();
  });
});
