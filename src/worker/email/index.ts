import { CloudflareEmailProvider } from './cloudflare-provider';
import { ConsoleProvider } from './console-provider';
import { ResendProvider } from './resend-provider';
import type { EmailProvider } from './types';

export type { EmailProvider } from './types';

export function getEmailProvider(env: Env): EmailProvider {
  const which = env.EMAIL_PROVIDER ?? 'console';
  switch (which) {
    case 'console':
      return new ConsoleProvider();
    case 'cloudflare': {
      if (!env.SEND_EMAIL) {
        throw new Error('EMAIL_PROVIDER=cloudflare requires the SEND_EMAIL binding to be declared in wrangler.toml');
      }
      if (!env.FROM_ADDRESS) {
        throw new Error('EMAIL_PROVIDER=cloudflare requires FROM_ADDRESS');
      }
      return new CloudflareEmailProvider(env.SEND_EMAIL, env.FROM_ADDRESS);
    }
    case 'resend': {
      if (!env.RESEND_API_KEY) {
        throw new Error('EMAIL_PROVIDER=resend requires RESEND_API_KEY');
      }
      if (!env.FROM_ADDRESS) {
        throw new Error('EMAIL_PROVIDER=resend requires FROM_ADDRESS');
      }
      return new ResendProvider({ apiKey: env.RESEND_API_KEY, fromAddress: env.FROM_ADDRESS });
    }
    default:
      throw new Error(`Unknown EMAIL_PROVIDER: ${which}. Expected one of: console, cloudflare, resend.`);
  }
}
