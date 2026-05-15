# Deploy

The boilerplate runs entirely on Cloudflare: a Worker (SPA + API), a D1 database, two KV namespaces, and (optionally) the Email Workers `send_email` binding for outbound magic links.

## Production env vars

| Var | Required | Default | Notes |
|---|---|---|---|
| `ADMIN_EMAILS` | yes | — | Comma-separated. Bootstrap admins, always allowed, always `role=admin`. |
| `ACCESS_POLICY` | no | `allowlist` | `allowlist` / `domain` / `open`. |
| `ALLOWED_DOMAINS` | conditional | — | Required if `ACCESS_POLICY=domain`. Comma-separated. |
| `DERIVE_ORG_FROM_DOMAIN` | no | `false` | If `true`, domain policy derives `orgId` from the email's domain. |
| `EMAIL_PROVIDER` | no | `console` | `console` / `cloudflare` / `resend`. |
| `FROM_ADDRESS` | yes (prod) | — | Verified `From:` address for outbound magic links. |
| `RESEND_API_KEY` | conditional | — | Required if `EMAIL_PROVIDER=resend`. Set via `wrangler secret`. |
| `PUBLIC_URL` | yes | — | Canonical SPA URL. Used in magic-link callback URLs. |
| `SECRETS_KEY` | yes | — | Base64-encoded 32 random bytes. Generated via `openssl rand -base64 32`. Set via `wrangler secret`. |
| `CAPTCHA_PROVIDER` | no | — | (Phase 2.) `turnstile` to gate `/sign-in` under open registration. |
| `CAPTCHA_SECRET` | conditional | — | If CAPTCHA enabled. |
| `EMAIL_BLOCKLIST` | no | — | Regex for `OpenRegistrationPolicy`. |

## Deploy steps

```bash
pnpm dlx wrangler secret put SECRETS_KEY     # paste: openssl rand -base64 32
pnpm migrate:remote
pnpm deploy
```

Set the rest of the env vars either via `wrangler.toml [vars]` (non-secrets) or `wrangler secret put <NAME>` (secrets).

## Email setup

### Cloudflare Email Workers (recommended for low-volume admin tools)

1. In the Cloudflare dashboard, enable Email Routing on your domain.
2. Add each admin email (i.e. every address in `ADMIN_EMAILS`, plus any address that domain rules let in if you use `DomainAllowlistPolicy`) as a **verified destination address**. Cloudflare emails them a confirmation link — click it.
3. Add the binding to `wrangler.toml`:

```toml
[[send_email]]
name = "SEND_EMAIL"
```

4. Set the env vars:

```toml
[vars]
EMAIL_PROVIDER = "cloudflare"
FROM_ADDRESS = "admin@yourdomain.com"
```

5. Redeploy.

### Resend (when you outgrow per-address verification)

1. Sign up at https://resend.com and verify your sending domain.
2. Generate an API key.
3. Set:

```bash
pnpm dlx wrangler secret put RESEND_API_KEY
```

4. `wrangler.toml`:

```toml
[vars]
EMAIL_PROVIDER = "resend"
FROM_ADDRESS = "admin@yourdomain.com"
```

5. Redeploy.

## Multi-CF-account note

If your CF user has access to multiple accounts, wrangler needs to know which. Either:

```bash
export CLOUDFLARE_ACCOUNT_ID=<your-account-id>
```

or add to `wrangler.toml`:

```toml
account_id = "<your-account-id>"
```

> ⚠️ This is a public boilerplate — `wrangler.toml` ships uncommitted of personal IDs by default. If you commit `account_id`, you're publishing it. Prefer the env-var approach for shared/forked configs.
