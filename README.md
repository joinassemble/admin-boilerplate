# admin-boilerplate

Open-source admin-area boilerplate for SaaS-style projects. Cloudflare Worker (SPA + API). Magic-link sign-in over a pluggable access policy (allowlist / domain / open registration). Declare resources as TypeScript files; the boilerplate auto-renders a polished CRUD dashboard for them. Swiss/Apple-feel UI, light + dark mode.

## Quickstart

### Requirements

- Node 22+, pnpm 9+
- A Cloudflare account (free tier is fine)
- `gh` CLI if you want to fork via the CLI (optional)

### Setup

```bash
git clone https://github.com/joinassemble/admin-boilerplate.git my-admin
cd my-admin
pnpm install
```

Create the Cloudflare resources:

```bash
pnpm dlx wrangler d1 create admin-boilerplate
pnpm dlx wrangler kv namespace create RATE_LIMIT
pnpm dlx wrangler kv namespace create MAGIC_TOKENS
```

Paste the three IDs into `wrangler.toml` where the placeholders are.

Apply the initial migration:

```bash
pnpm migrate:local
```

Set local dev env vars. Copy the example, then **generate a real SECRETS_KEY** (the example value is a placeholder, not valid base64):

```bash
cp .dev.vars.example .dev.vars
echo "SECRETS_KEY=\"$(openssl rand -base64 32)\"" >> .dev.vars
# edit .dev.vars to set ADMIN_EMAILS to your address
```

> **If you have multiple Cloudflare accounts:** set `CLOUDFLARE_ACCOUNT_ID=...` in your shell before running wrangler commands, or add `account_id = "..."` to `wrangler.toml`.

### Dev loop

```bash
pnpm dev:all
```

- SPA on http://localhost:5173 (proxies `/api/*` to the Worker)
- Worker on http://localhost:8787

Sign in with the email you put in `ADMIN_EMAILS`. The magic link prints to the worker terminal (Console email provider). Click it, you're in.

### Tests

```bash
pnpm test         # one-shot
pnpm test:watch   # watch mode
pnpm typecheck    # tsc project-references build
```

### Production deploy

See [docs/deploy.md](docs/deploy.md). Short version:

```bash
pnpm dlx wrangler secret put SECRETS_KEY   # paste: openssl rand -base64 32
pnpm migrate:remote
pnpm deploy
```

Plus configure an email provider in production — `EMAIL_PROVIDER=cloudflare` (via Cloudflare Email Routing) or `EMAIL_PROVIDER=resend` (with `RESEND_API_KEY` set). See deploy docs.

## Desktop app

The boilerplate ships a Tauri 2 wrapper that bundles the SPA as a native binary for macOS / Windows / Linux. Same SPA, same Worker — the desktop is a thin distribution channel.

```bash
pnpm desktop:build
```

Requires the Rust toolchain. Full setup, distribution notes, and the magic-link-in-browser limitation + fix paths: [docs/desktop.md](docs/desktop.md).

## Concepts

- **Connections** declare API services your admin proxies (Stripe, GitHub, your own backend, etc.). Defined in `src/connections/<id>.ts`. Secrets stored encrypted in D1, set via Settings → Connections.
- **Resources** declare CRUD-able collections inside a connection. Defined in `src/resources/<id>.ts`. The Worker auto-exposes list/detail/create/update/delete endpoints; the SPA auto-renders the UI.
- **Access policies** decide who can sign in. Three v1 policies: `EnvAllowlistPolicy` (static admin email list), `DomainAllowlistPolicy` (email domains + bulk individual emails), `OpenRegistrationPolicy` (anyone signs up).

## Adding things

- **Add a resource:** [docs/adding-a-resource.md](docs/adding-a-resource.md)
- **Customise the shell (left rail, top bar switcher, subnav):** [docs/customising-the-shell.md](docs/customising-the-shell.md)

## License

MIT — see [LICENSE](LICENSE).
