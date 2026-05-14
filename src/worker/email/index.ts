import { ConsoleProvider } from './console-provider';
import type { EmailProvider } from './types';

export type { EmailProvider } from './types';

export function getEmailProvider(env: Env): EmailProvider {
  const which = env.EMAIL_PROVIDER ?? 'console';
  switch (which) {
    case 'console':
      return new ConsoleProvider();
    // 'cloudflare' and 'resend' added in Plan 5.
    default:
      throw new Error(`Unknown EMAIL_PROVIDER: ${which}. v1 only ships 'console'.`);
  }
}
