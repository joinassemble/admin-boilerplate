import { isBootstrapAdmin } from './bootstrap';
import type { AccessPolicy, AccessDecision, AccessContext } from './types';

interface OpenEnv {
  ADMIN_EMAILS?: string;
  EMAIL_BLOCKLIST?: string;
}

interface UserRow {
  email: string;
  banned_at: number | null;
  org_id: string | null;
  role: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class OpenRegistrationPolicy implements AccessPolicy {
  constructor(
    private readonly db: D1Database,
    private readonly env: OpenEnv,
  ) {}

  async evaluate(email: string, _ctx: AccessContext): Promise<AccessDecision> {
    const lower = email.toLowerCase();
    if (!EMAIL_RE.test(lower)) return { allowed: false };

    if (isBootstrapAdmin(lower, this.env.ADMIN_EMAILS)) {
      return { allowed: true, role: 'admin' };
    }

    if (this.env.EMAIL_BLOCKLIST) {
      try {
        const re = new RegExp(this.env.EMAIL_BLOCKLIST);
        if (re.test(lower)) return { allowed: false };
      } catch {
        // Invalid regex → fail closed: skip blocklist, but log.
        console.warn('OpenRegistrationPolicy: invalid EMAIL_BLOCKLIST regex, ignoring');
      }
    }

    return { allowed: true };
  }

  async onSignIn(email: string, ctx: AccessContext): Promise<AccessDecision> {
    const decision = await this.evaluate(email, ctx);
    if (!decision.allowed) return decision;

    const lower = email.toLowerCase();
    const user = await this.db
      .prepare('SELECT email, banned_at, org_id, role FROM users WHERE email = ?')
      .bind(lower)
      .first<UserRow>();
    if (user?.banned_at) return { allowed: false };

    const now = Math.floor(Date.now() / 1000);
    if (user) {
      await this.db.prepare('UPDATE users SET last_seen_at = ? WHERE email = ?').bind(now, lower).run();
      return {
        allowed: true,
        orgId: user.org_id ?? undefined,
        role: user.role ?? decision.role,
      };
    }

    await this.db
      .prepare(
        'INSERT INTO users (email, role, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)',
      )
      .bind(lower, decision.role ?? null, now, now)
      .run();
    return decision;
  }
}
