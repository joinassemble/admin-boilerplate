import type { EmailProvider } from './types';

interface Config {
  apiKey: string;
  fromAddress: string;
}

export class ResendProvider implements EmailProvider {
  constructor(private readonly config: Config) {
    if (!config.apiKey) throw new Error('ResendProvider requires apiKey');
    if (!config.fromAddress) throw new Error('ResendProvider requires fromAddress');
  }

  async sendMagicLink(args: { email: string; magicLinkUrl: string }): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.config.fromAddress,
        to: args.email,
        subject: 'Your sign-in link',
        text:
`Click to sign in:

${args.magicLinkUrl}

If you didn't request this, ignore this email.`,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`ResendProvider: ${res.status} ${text}`);
    }
  }
}
