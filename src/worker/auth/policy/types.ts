export interface AccessDecision {
  allowed: boolean;
  /** Threaded into the session and audit log. */
  orgId?: string;
  /** Threaded into the session. 'admin' reserved for bootstrap admins + admin-promoted users. */
  role?: string;
  /** Free-form policy-specific metadata. */
  metadata?: Record<string, unknown>;
}

export interface AccessContext {
  ip?: string;
  userAgent?: string;
}

export interface AccessPolicy {
  /** Called when a magic link is requested. Decides whether to send. */
  evaluate(email: string, ctx: AccessContext): Promise<AccessDecision>;

  /**
   * Called after the magic-link token is validated, before the session is created.
   * Re-evaluates (in case access was revoked between request and click) AND may
   * upsert a `users` row (open-registration / first-login flows).
   */
  onSignIn(email: string, ctx: AccessContext): Promise<AccessDecision>;
}
