interface Env {
  // D1
  DB: D1Database;

  // KV namespaces
  RATE_LIMIT: KVNamespace;
  MAGIC_TOKENS: KVNamespace;

  // Static assets binding (Workers Assets)
  ASSETS: Fetcher;

  // Secrets (set via `wrangler secret put`) — declared here for type safety;
  // not yet populated in Plan 1 but listed so the type stays stable.
  SECRETS_KEY?: string;
  RESEND_API_KEY?: string;
  CAPTCHA_SECRET?: string;

  // Vars (set via wrangler.toml [vars] or .dev.vars)
  ADMIN_EMAILS?: string;
  ACCESS_POLICY?: string;
  ALLOWED_DOMAINS?: string;
  DERIVE_ORG_FROM_DOMAIN?: string;
  EMAIL_PROVIDER?: string;
  FROM_ADDRESS?: string;
  PUBLIC_URL?: string;
  CAPTCHA_PROVIDER?: string;
  EMAIL_BLOCKLIST?: string;
}
