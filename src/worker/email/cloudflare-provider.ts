import type { EmailProvider } from './types';

/**
 * Structural type for the send_email Workers binding when using raw RFC822
 * delivery. The official `SendEmail` type in @cloudflare/workers-types
 * exposes `send(message: EmailMessage)` where `EmailMessage` only carries
 * `from` and `to`. The raw-message overload is not reflected in the
 * current bundled types, so we use a local structural interface that
 * matches the binding's actual runtime API.
 */
interface SendEmailLike {
  send(message: { from: string; to: string; raw: string }): Promise<unknown>;
}

/**
 * Cloudflare Email Workers provider — uses the `send_email` binding declared
 * in wrangler.toml. The destination address must be verified in Cloudflare
 * Email Routing before delivery succeeds. For an allowlist-style boilerplate,
 * that aligns naturally with the existing email allowlist.
 *
 * Production setup:
 *   1. Enable Email Routing on your domain in the Cloudflare dashboard.
 *   2. Verify each admin email as a destination address.
 *   3. Add `[[send_email]] name = "SEND_EMAIL"` to wrangler.toml.
 *   4. Set EMAIL_PROVIDER=cloudflare and FROM_ADDRESS=<verified-on-your-domain>.
 */
export class CloudflareEmailProvider implements EmailProvider {
  constructor(
    private readonly binding: SendEmailLike,
    private readonly fromAddress: string,
  ) {
    if (!fromAddress) {
      throw new Error('CloudflareEmailProvider requires FROM_ADDRESS to be set');
    }
  }

  async sendMagicLink(args: { email: string; magicLinkUrl: string }): Promise<void> {
    const raw = [
      `From: ${this.fromAddress}`,
      `To: ${args.email}`,
      `Subject: Your sign-in link`,
      `Content-Type: text/plain; charset=utf-8`,
      ``,
      `Click to sign in:`,
      ``,
      args.magicLinkUrl,
      ``,
      `If you didn't request this, ignore this email.`,
    ].join('\r\n');

    await this.binding.send({ from: this.fromAddress, to: args.email, raw });
  }
}
