import type { EmailProvider } from './types';

/**
 * Dev/test email provider: prints the magic link to console.log.
 * Operators following along in `wrangler tail` or local terminal can copy + paste it.
 */
export class ConsoleProvider implements EmailProvider {
  async sendMagicLink(args: { email: string; magicLinkUrl: string }): Promise<void> {
    console.log(
      `[email] magic link for ${args.email}\n  → ${args.magicLinkUrl}\n  (this provider is for dev only — use Cloudflare Email or Resend in production)`,
    );
  }
}
