import { isBootstrapAdmin } from './bootstrap';
import type { AccessPolicy, AccessDecision, AccessContext } from './types';

interface DomainEnv {
  ADMIN_EMAILS?: string;
  ALLOWED_DOMAINS?: string;
  DERIVE_ORG_FROM_DOMAIN?: string;
}

interface AllowedEmailRow {
  email: string;
  org_id: string | null;
  role: string | null;
}

interface UserRow {
  email: string;
  banned_at: number | null;
  org_id: string | null;
  role: string | null;
}

export class DomainAllowlistPolicy implements AccessPolicy {
  constructor(
    private readonly db: D1Database,
    private readonly env: DomainEnv,
  ) {}

  private get domains(): string[] {
    if (!this.env.ALLOWED_DOMAINS) return [];
    return this.env.ALLOWED_DOMAINS
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter((d) => d.length > 0);
  }

  private get derive(): boolean {
    return this.env.DERIVE_ORG_FROM_DOMAIN === 'true';
  }

  async evaluate(email: string, _ctx: AccessContext): Promise<AccessDecision> {
    const lower = email.toLowerCase();

    // 1. Bootstrap admin always wins.
    if (isBootstrapAdmin(lower, this.env.ADMIN_EMAILS)) {
      return { allowed: true, role: 'admin' };
    }

    // 2. Individual D1 entry wins over domain.
    const row = await this.db
      .prepare('SELECT email, org_id, role FROM allowed_emails WHERE email = ?')
      .bind(lower)
      .first<AllowedEmailRow>();
    if (row) {
      return {
        allowed: true,
        orgId: row.org_id ?? undefined,
        role: row.role ?? undefined,
      };
    }

    // 3. Domain match.
    const domain = lower.split('@')[1];
    if (domain && this.domains.includes(domain)) {
      const decision: AccessDecision = { allowed: true };
      if (this.derive) decision.orgId = domain.split('.')[0];
      return decision;
    }

    return { allowed: false };
  }

  async onSignIn(email: string, ctx: AccessContext): Promise<AccessDecision> {
    const lower = email.toLowerCase();

    // Re-evaluate from scratch.
    const decision = await this.evaluate(lower, ctx);
    if (!decision.allowed) return decision;

    // Banned check.
    const user = await this.db
      .prepare('SELECT email, banned_at, org_id, role FROM users WHERE email = ?')
      .bind(lower)
      .first<UserRow>();
    if (user?.banned_at) return { allowed: false };

    const now = Math.floor(Date.now() / 1000);
    if (user) {
      await this.db
        .prepare('UPDATE users SET last_seen_at = ?, org_id = COALESCE(org_id, ?), role = COALESCE(role, ?) WHERE email = ?')
        .bind(now, decision.orgId ?? null, decision.role ?? null, lower)
        .run();
      // Existing user values win over freshly-derived ones (stable sessions across renames).
      return {
        allowed: true,
        orgId: user.org_id ?? decision.orgId,
        role: user.role ?? decision.role,
      };
    }

    await this.db
      .prepare(
        'INSERT INTO users (email, org_id, role, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(lower, decision.orgId ?? null, decision.role ?? null, now, now)
      .run();
    return decision;
  }
}
