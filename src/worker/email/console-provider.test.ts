import { describe, expect, it, vi } from 'vitest';
import { ConsoleProvider } from './console-provider';

describe('ConsoleProvider', () => {
  it('logs the magic link URL to console for dev', async () => {
    const provider = new ConsoleProvider();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await provider.sendMagicLink({
      email: 'ada@example.com',
      magicLinkUrl: 'https://app.example.com/auth/callback?token=abc',
    });
    expect(spy).toHaveBeenCalled();
    const logged = spy.mock.calls.flat().join(' ');
    expect(logged).toContain('ada@example.com');
    expect(logged).toContain('https://app.example.com/auth/callback?token=abc');
    spy.mockRestore();
  });
});
