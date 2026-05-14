import { isBootstrapAdmin } from './bootstrap';
import type { AccessPolicy, AccessDecision, AccessContext } from './types';

/**
 * Static allowlist policy.
 *
 * Reads ADMIN_EMAILS env var. Anyone in the list is allowed and gets role='admin'.
 * No D1 reads, no users table. Best for internal ops tools.
 */
export class EnvAllowlistPolicy implements AccessPolicy {
  constructor(private readonly env: { ADMIN_EMAILS?: string }) {}

  async evaluate(email: string, _ctx: AccessContext): Promise<AccessDecision> {
    if (isBootstrapAdmin(email, this.env.ADMIN_EMAILS)) {
      return { allowed: true, role: 'admin' };
    }
    return { allowed: false };
  }

  async onSignIn(email: string, ctx: AccessContext): Promise<AccessDecision> {
    return this.evaluate(email, ctx);
  }
}
