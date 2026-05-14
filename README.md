# admin-boilerplate

Open-source admin-area boilerplate for SaaS-style projects. Runs on Cloudflare (Worker + D1 + KV). Authenticates with magic links over a pluggable access policy. Same SPA wraps as a Tauri desktop app.

> **Status:** Foundation milestone — bare SPA + Worker + D1 + crypto helpers landed. Auth, connections, resources, settings, and desktop wrapper still in progress.

## Quickstart

### Requirements

- Node 22+, pnpm 9+
- A Cloudflare account (for D1 + KV; the free tier is fine)
- `wrangler` (installed as a dev dependency — no global install needed)

### Setup

```bash
git clone https://github.com/USER/admin-boilerplate.git my-admin
cd my-admin
pnpm install

# Create CF resources
pnpm dlx wrangler d1 create admin-boilerplate
pnpm dlx wrangler kv namespace create RATE_LIMIT
pnpm dlx wrangler kv namespace create MAGIC_TOKENS
# → paste the three IDs into wrangler.toml

# Run migrations
pnpm migrate:local

# Local secrets / env vars
cp .dev.vars.example .dev.vars   # then edit
```

#### Multiple Cloudflare accounts

If your wrangler login has access to more than one Cloudflare account, every wrangler command will fail with a non-interactive error. Either:

- Set `export CLOUDFLARE_ACCOUNT_ID=your-account-id` in your shell profile, or
- Add `account_id = "your-account-id"` to the top of `wrangler.toml` (do NOT commit this if your repo is public — your account ID is non-secret but worth keeping out of public history).

### Dev loop

```bash
pnpm dev:all
```

- SPA on http://localhost:5173 (proxies `/api/*` to the Worker)
- Worker on http://localhost:8787

### Tests

```bash
pnpm test         # one-shot
pnpm test:watch   # watch mode
pnpm typecheck    # tsc project-references build
```

### Deploy

```bash
pnpm deploy
```

## Design

Full design spec: [`docs/superpowers/specs/2026-05-13-admin-boilerplate-design.md`](docs/superpowers/specs/2026-05-13-admin-boilerplate-design.md)

Implementation plans: [`docs/superpowers/plans/`](docs/superpowers/plans/)

## License

MIT — see [LICENSE](LICENSE).
