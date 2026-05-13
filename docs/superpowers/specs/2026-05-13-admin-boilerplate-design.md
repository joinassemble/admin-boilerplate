# admin-boilerplate — design spec

**Date:** 2026-05-13
**Status:** draft, awaiting review

---

## 1. Overview

An open-source **admin-area boilerplate** for SaaS-style projects. "Admin" here means *the management UI* — whether that's the internal-ops dashboard for a SaaS, the customer-facing settings area, or a B2B partner portal. Ships as a Cloudflare Worker (SPA + API) with a Tauri wrapper so the same admin can also be a desktop app. Authentication is **magic-link only** behind a pluggable access policy (static allowlist, domain allowlist, or open registration). Forks define data resources as typed TypeScript files; the boilerplate auto-renders polished CRUD dashboards for them. The product is opinionated about design — Swiss typography, premium Apple-style feel — and about deployment — everything runs on Cloudflare.

**License:** MIT.

### Goals

- **Minimum setup** — clone → set 2–3 env vars → `wrangler deploy` → sign in. No infrastructure beyond a CF account.
- **Premium feel** — Swiss/Apple aesthetic, generous whitespace, restrained palette, considered motion. Light + dark from day one.
- **Vibe-code friendly** — designed to be extended by Claude Code: typed primitives, single-file resource definitions, no UI-based config dance for things code already does well.
- **Fork-flexibility** — slot-based shell so forks can add Slack-style account rails, top-bar switchers, sub-navs without forking the shell internals.
- **Audience-flexibility** — same shell, three access policies (allowlist / domain / open registration). One boilerplate covers internal ops tools, B2B portals, and customer-facing dashboards.
- **All on Cloudflare** — Workers, D1, KV, optionally CF Email Workers. No third-party services required in the default config.

### Non-goals (v1)

- Row-level data scoping helpers (the substrate — `session.orgId` / `session.userId` / `session.role` — is provided; declarative per-resource scoping is phase 2).
- OAuth 2.0 connections (bearer / header / basic / none cover ~95% of admin-tool integrations).
- SAML / SSO sign-in.
- Runtime resource editor UI (resources are code; secrets are runtime).
- Offline / local-only desktop mode (Tauri is a thin client over a deployed Worker).
- GraphQL or non-HTTP connections.
- OpenAPI import (phase 2).
- Rich org / tenant management UI beyond a basic users + allowed-emails admin (phase 2).

---

## 2. Audience and use cases

**Primary user:** developer working with Claude Code who needs a management UI for one or more SaaS-style apps they operate or ship.

### Representative use cases

Three distinct *access patterns* the boilerplate must cover, all still backed by magic-link sign-in:

| Pattern | Who signs in | Policy | Typical sizing |
|---|---|---|---|
| **Static allowlist** | A small internal ops team | `EnvAllowlistPolicy` (env var) | 1–20 emails |
| **Domain allowlist** | B2B partners / customers from known orgs (e.g. anyone `@example.com`) | `DomainAllowlistPolicy` (env var domains + D1 table of individual emails) | 10s–1000s, often grouped by org |
| **Open registration** | Customer-facing dashboard — anyone can sign up via magic link | `OpenRegistrationPolicy` (D1 `users` table, rate-limited) | Unbounded |

### Representative fork shapes (validate the slot system)

- **Multi-account / workspace-switching admin** — left rail of account or workspace icons (Slack-style switcher); top-bar entity switcher for entity-within-org (e.g. project, file, record). Common with `DomainAllowlistPolicy`.
- **Domain-heavy admin** — comprehensive secondary nav under the top bar to separate sections within one product surface (summary / records / settings / audit / reports).
- **Customer dashboard** — open registration, no left rail, simple sidebar nav over the user's own resources.

All shapes should be achievable as forks with **a handful of slot overrides and a few resource files**, not by editing the shell internals.

---

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | **Svelte 5 + runes** | Best CF Workers fit (tiny bundles), single-file components, less vibe-coding friction than React. |
| Build | **Vite** | Standard Svelte tooling. Outputs static `dist/`. |
| Styling | **Tailwind CSS v4** | Token-friendly, scales to a custom design system, easy to keep restrained. |
| Routing | **Plain client-side router** (e.g. `svelte-spa-router`) | Pure SPA. No SSR. |
| Backend | **Cloudflare Worker + Hono** | Edge runtime, tiny cold-start, ergonomic routing. |
| Database | **Cloudflare D1** | App data: users, sessions, connections, resources cache, audit log. |
| KV | **Cloudflare KV** | Rate-limit counters, magic-link tokens (short-lived). |
| Email (dev) | `ConsoleProvider` | Magic link printed to `wrangler tail`. Zero config. |
| Email (prod default) | `CloudflareEmailProvider` via `send_email` binding | All-CF, no third-party vendor. Sends to verified destination addresses (which the allowlist already is). |
| Email (alt) | `ResendProvider` | Documented swap-in for higher volume or unverified recipients. |
| Desktop | **Tauri 2** | Native webview (WebKit on macOS = real Apple rendering), 5–15 MB binaries, premium feel. Wraps the same `dist/`. |
| Language | TypeScript everywhere | Worker, SPA, resources, shared types. |
| Migrations | `wrangler d1 migrations` | Plain SQL files. |

---

## 4. Architecture

### 4.1 High level

```
                                          ┌────────────────────────┐
                                          │ External APIs          │
                                          │ (Stripe, GitHub,       │
                                          │  your own Workers, …)  │
                                          └──────────┬─────────────┘
                                                     │ HTTPS w/ auth
                                                     │ (bearer/header/basic)
                                                     ▼
   ┌─────────────────────┐         ┌────────────────────────────────────┐
   │  Browser SPA        │ ◀──/api/▶│  CF Worker (Hono)                  │
   │  Svelte 5 + Vite    │         │  - /auth/* (magic link, session)   │
   │  (served as static  │         │  - /api/connections                │
   │   from the Worker)  │         │  - /api/resources/:id/list, detail │
   │                     │         │  - /api/resources/:id (mutations)  │
   └─────────────────────┘         │  - /api/audit                      │
              ▲                    └────┬──────────┬──────────┬─────────┘
              │                         │          │          │
   ┌─────────────────────┐              ▼          ▼          ▼
   │  Tauri Desktop      │           ┌─────┐   ┌─────┐   ┌────────┐
   │  (wraps same dist/) │           │ D1  │   │ KV  │   │ Secrets│
   │  configurable URL   │           └─────┘   └─────┘   └────────┘
   └─────────────────────┘
```

### 4.2 Cloudflare Worker

Single Worker, Hono router:

- `GET /*` (catch-all, last) → serves the built SPA static assets via the Workers Assets binding.
- `POST /auth/request` → request a magic link (rate-limited 5/hr per email, KV-stored).
- `GET /auth/callback?token=…` → exchange magic-link token for a session cookie.
- `POST /auth/sign-out` → invalidate session.
- `GET /api/me` → current session info.
- `GET /api/resources` → registry of available resources (built-in at deploy time).
- `GET /api/resources/:id/list` → proxies the configured list endpoint, applies auth from the resource's Connection.
- `GET /api/resources/:id/detail/:recordId` → proxies the detail endpoint.
- `POST /api/resources/:id` / `PATCH …/:recordId` / `DELETE …/:recordId` → mutations (when enabled per-resource).
- `GET /api/connections` / `PATCH /api/connections/:id` → list connections; set/rotate the secret for a connection. Admin-only.
- `GET /api/access` / `POST /api/access` / `DELETE /api/access/:email` → manage `allowed_emails` (bulk import supported via array body). Admin-only, `DomainAllowlistPolicy` only.
- `GET /api/users` / `PATCH /api/users/:email` → list users, ban/unban, set `org_id` / `role`. Admin-only, `DomainAllowlistPolicy` and `OpenRegistrationPolicy` only.
- `GET /api/audit` → recent audit-log entries. Admin-only.

All `/api/*` and `/auth/sign-out` require a valid session cookie. Admin-only endpoints additionally require `session.role === "admin"`. The Worker resolves the resource registry from a build-time glob over `src/resources/*.ts`.

### 4.3 SPA

Plain Svelte 5 SPA. Routes:

- `/sign-in` — public, request magic link.
- `/auth/callback` — token exchange + redirect.
- `/` — overview (default resource or summary).
- `/r/:resourceId` — list view (auto-rendered from resource schema).
- `/r/:resourceId/:recordId` — detail view (auto-rendered).
- `/r/:resourceId/:recordId/edit` — edit form (auto-rendered, only if writable).
- `/r/:resourceId/new` — create form.
- `/settings/connections` — set/rotate connection secrets.
- `/settings/access` — manage `allowed_emails` table (bulk-add via paste/CSV, remove). Visible under `DomainAllowlistPolicy` only.
- `/settings/users` — list users, view metadata, ban/unban, edit `org_id` / `role`. Visible under `DomainAllowlistPolicy` and `OpenRegistrationPolicy`.
- `/settings/audit` — audit log viewer.

All `/settings/*` pages require `session.role === "admin"` (i.e. the bootstrap admins from `ADMIN_EMAILS`, plus any user explicitly promoted via `/settings/users`).

The SPA fetches `/api/resources` on app load to know which resources exist; route components render against the schema returned.

### 4.4 Desktop (Tauri)

Tauri 2 wrapper in `desktop/` that:

- Bundles the same `dist/` output as the web SPA.
- On first launch, prompts for the Worker base URL and stores it in Tauri app config.
- Sets `VITE_API_BASE` (or equivalent runtime config) so all SPA fetches go to that Worker.
- Uses the OS's native webview (WebKit on macOS → real SF Pro rendering).

No local database, no offline mode, no separate codebase. Phase 2 may add local SQLite + sync.

---

## 5. Authentication and sessions

Sign-in is always magic-link. **Who is allowed to sign in** is decided by a pluggable `AccessPolicy`. The three v1 policies cover internal-admin, B2B/partner, and customer-facing use cases respectively.

### 5.1 `AccessPolicy` interface

```ts
// src/worker/auth/policy/types.ts
export interface AccessDecision {
  allowed: boolean;
  // optional metadata threaded into the session (read on every request)
  orgId?: string;
  role?: string;
  metadata?: Record<string, unknown>;
}

export interface AccessPolicy {
  /** Called when a magic-link is requested. Decides whether to send. */
  evaluate(email: string, ctx: { ip?: string }): Promise<AccessDecision>;

  /** Called after successful token exchange. Returns final session metadata
   *  and may create a `users` row (open-registration / first-login flows). */
  onSignIn(email: string, ctx: { ip?: string }): Promise<AccessDecision>;
}
```

The selected policy is chosen by the `ACCESS_POLICY` env var (`allowlist` | `domain` | `open`). Forks can also import a policy directly in `src/config.ts` for fully programmatic setups.

### 5.2 v1 policies

**`EnvAllowlistPolicy`** (default)

- Reads `ADMIN_EMAILS` env var. Comma-separated, lowercased on compare.
- Emails not on the list silently fail (generic success message). No D1 reads.
- `orgId` / `role` not set unless the env var uses `email|orgId|role` triplet syntax (optional convenience).
- Best for: internal ops tools, small known teams.

**`DomainAllowlistPolicy`**

- Reads `ALLOWED_DOMAINS` env var (comma-separated, e.g. `amc.com,regal.com`). Any email with a matching domain is allowed.
- Also reads the `allowed_emails` D1 table for individual exceptions (one-off external partners, ex-employees, etc.). Bulk add via `/settings/access` (CSV paste / API endpoint) — documented as an edge-case path, not the primary UX.
- Optional `derivedOrgFromDomain: true` → `ada@amc.com` → `orgId = "amc"`. Otherwise `orgId` comes from the matching `allowed_emails` row.
- On first sign-in, an entry is upserted in `users` for tracking (`last_seen_at`, `org_id`, `role`).
- Best for: B2B portals, partner dashboards.

**`OpenRegistrationPolicy`**

- Any email is allowed.
- Stricter abuse protection:
  - Per-email magic-link rate limit (KV-stored, 3/hour, slower than the policy default of 5/hour).
  - Per-IP magic-link rate limit (KV-stored, 20/hour).
  - Optional CAPTCHA hook: if `CAPTCHA_PROVIDER=turnstile` is set, the SPA includes a Cloudflare Turnstile widget on `/sign-in` and the Worker verifies the token before sending.
  - Optional `EMAIL_BLOCKLIST` env var (regex, e.g. disposable-domain blocklist).
- On first successful sign-in, a `users` row is created (`email`, `created_at`, `role = null`, `org_id = null`).
- Bootstrap admin: emails in `ADMIN_EMAILS` (if set) are always treated as `role = "admin"`, regardless of policy. This is how the deploying developer signs in even when the policy is otherwise open.
- Best for: customer-facing dashboards.

### 5.3 Magic-link flow (any policy)

1. User enters their email on `/sign-in` (with optional CAPTCHA if configured).
2. Worker calls `accessPolicy.evaluate(email, ctx)`. If `allowed === false`, return a generic success message (no enumeration) and stop.
3. Worker checks rate limits in KV (per-email + per-IP if applicable). If exceeded, generic success message.
4. Worker generates a one-time token (32 bytes, base64url), stores `magic:{token}` → `{email, expires, decision}` in KV with 15-minute TTL.
5. Worker calls `EmailProvider.sendMagicLink(email, callbackUrl)` where the URL is `${PUBLIC_URL}/auth/callback?token=…`.
6. User clicks the link → Worker validates the token (single-use, deletes after read).
7. Worker calls `accessPolicy.onSignIn(email, ctx)` — this re-evaluates (in case access was revoked between request and click) and may upsert the `users` row.
8. Worker creates a session with `{ email, orgId, role }` threaded in, sets an `httpOnly secure SameSite=Lax` cookie, redirects to the post-sign-in destination.

### 5.4 Sessions

Opaque session tokens stored in D1, **not JWTs**.

- 256-bit random token, base64url-encoded.
- Stored in `sessions` table (see schema). Carries `email`, optional `org_id`, optional `role`.
- 30-day sliding expiry — every request renews the expiry.
- Server-side revocation: deleting the row signs the user out everywhere immediately.
- Banning a user (`users.banned_at IS NOT NULL`) deletes all their sessions and rejects future sign-ins.
- Cookie name: `__Host-session`. Attributes: `httpOnly; Secure; SameSite=Lax; Path=/`.

### 5.5 Bootstrap admin

Regardless of which policy is active, emails listed in `ADMIN_EMAILS` are **always** allowed and assigned `role = "admin"`. This guarantees the deploying developer can always sign in (and access `/settings/*` admin pages) even when the policy is otherwise restrictive or open.

---

## 6. Connections and secrets

A **Connection** is one API service (e.g. "Stripe", "GitHub", "Our backend"). Connections are *declared in code* but their secrets live in D1, encrypted.

### 6.1 Declaration (in code)

```ts
// src/connections/stripe.ts
export default defineConnection({
  id: 'stripe',
  name: 'Stripe',
  baseUrl: 'https://api.stripe.com',
  auth: { type: 'bearer' },     // shape — actual token comes from D1
});
```

Supported `auth.type` values in v1:

| Type | Stored fields | HTTP applied |
|---|---|---|
| `none` | — | (no header) |
| `bearer` | `token` | `Authorization: Bearer {token}` |
| `header` | `headerName`, `value` | `{headerName}: {value}` |
| `basic` | `username`, `password` | `Authorization: Basic base64(username:password)` |

OAuth 2.0 is explicitly out of scope for v1.

### 6.2 Secrets (in D1)

After deploy, the admin goes to **Settings → Connections** and sets the secret for each declared connection. The values are encrypted at rest using AES-GCM with a key derived from `SECRETS_KEY` (a Worker secret, generated by the user at setup with `openssl rand -base64 32` and set via `wrangler secret put SECRETS_KEY`).

```
ciphertext = AES-GCM(key=HKDF(SECRETS_KEY, salt=connection_id), plaintext=secret_json)
```

The Worker decrypts only when it needs to make an outbound call. The decrypted value is never returned to the SPA. The SPA only sees `{ id, name, isConfigured: true|false, lastRotatedAt }`.

---

## 7. Resources — the core abstraction

A **Resource** is a CRUD-able collection in one Connection. Defined as a single TypeScript file in `src/resources/`:

```ts
// src/resources/stripe-customers.ts
import { defineResource } from '@admin/sdk';

export default defineResource({
  id: 'stripe-customers',
  connection: 'stripe',
  name: 'Customers',
  group: 'Stripe',
  list:   { method: 'GET', path: '/v1/customers', dataPath: 'data', cursorParam: 'starting_after' },
  detail: { method: 'GET', path: '/v1/customers/:id' },
  update: { method: 'POST', path: '/v1/customers/:id', enabled: true },
  delete: { method: 'DELETE', path: '/v1/customers/:id', enabled: true },
  fields: [
    { key: 'id',      label: 'ID',      type: 'string', primary: true, monospace: true },
    { key: 'email',   label: 'Email',   type: 'email',  tableColumn: true, searchable: true },
    { key: 'name',    label: 'Name',    type: 'string', tableColumn: true, editable: true },
    { key: 'created', label: 'Joined',  type: 'unix-ts', tableColumn: true, readOnly: true },
    { key: 'metadata', label: 'Metadata', type: 'json',  collapsible: true },
  ],
});
```

### 7.1 Field types (v1)

`string | text | email | url | number | integer | boolean | date | unix-ts | enum | json | image-url | currency`

Each field can declare: `tableColumn`, `searchable`, `editable`, `readOnly`, `required`, `primary`, `monospace`, `collapsible`, `format`, `enumOptions`.

### 7.2 Registry

`src/resources/index.ts` re-exports via `import.meta.glob('./*.ts', { eager: true })`. Both the Worker and SPA import the typed registry at build time. The Worker exposes the schema (without server-only details) at `GET /api/resources`.

### 7.3 Generic renderers (SPA side)

The boilerplate ships three renderer components in `src/client/lib/resource/`:

- `<ResourceTable>` — paginated/cursor list view from the field schema.
- `<ResourceDetail>` — labeled key/value layout for one record.
- `<ResourceForm>` — create/edit form, per-field-type input components.

Custom renderers can be plugged in per-resource later (phase 2). For v1, the generic renderers cover all field types.

### 7.4 Mutations and proxy

All outbound calls go through the Worker. The SPA never sees connection secrets or talks directly to external APIs. The Worker:

1. Looks up the resource and its Connection.
2. Fetches the encrypted secret from D1, decrypts.
3. Builds the outbound request (path interpolation, auth header).
4. Fetches, normalises the response (uses `dataPath` for list responses).
5. Returns to the SPA.
6. Records a row in `audit_log` for any write operation.

### 7.5 Session-scoped resources (forks)

The Worker exposes `session.userId`, `session.email`, `session.orgId`, and `session.role` to the resource layer. Resources can reference these in path templates and query params for fork-level data scoping:

```ts
// src/resources/my-projects.ts
export default defineResource({
  id: 'my-projects',
  connection: 'api',
  list:   { method: 'GET', path: '/orgs/:session.orgId/projects' },
  detail: { method: 'GET', path: '/orgs/:session.orgId/projects/:id' },
  // ...
});
```

Templating syntax: `:session.<key>` is resolved server-side before the outbound request. The v1 helpers cover the common cases; richer declarative scoping is phase 2.

---

## 8. Shell and slot system

The default visual layout is **Option A from the brainstorm** (sidebar + topbar-right + main). The shell is built as a slot-based primitive so forks compose extra layout pieces without editing the shell internals.

### 8.1 Slots

The shell expresses a three-level navigation hierarchy:

- **Left rail** → org / account / workspace switcher (Slack-style icon column).
- **Topbar centre** → entity-within-org switcher (a specific project, film, customer, record).
- **Sidebar** → navigation *within* the current entity (this org's resources).

Most forks use one or two of these levels, not all three. The default boilerplate uses only sidebar + topbar-right.

| Slot | Position | Default | Typical content |
|---|---|---|---|
| `leftRail` | Full-height column, far left | Empty | Org / workspace switcher (icons) |
| `topbarLeft` | Top bar, left of centre | Empty | Breadcrumbs, back button |
| `topbarCenter` | Top bar, middle | Empty | Entity-within-org switcher (project / film / record) |
| `topbarRight` | Top bar, right | User menu + search | Notifications, command palette trigger |
| `subnav` | Strip below top bar | Empty | Section tabs (summary / records / settings / audit / reports) |
| `sidebar` | Column right of left-rail | Resource nav (auto-generated from registry) | Custom resource grouping |
| `main` | Centre content area | Route content (required) | — |
| `aside` | Right column | Empty | Three-pane detail / inspector panel |

### 8.2 API (Svelte 5 snippet props)

```svelte
<!-- src/client/lib/shell/AppShell.svelte -->
<script lang="ts">
  let {
    leftRail, topbarLeft, topbarCenter, topbarRight,
    subnav, sidebar, main, aside,
    children,                   // fallback for `main`
  }: AppShellProps = $props();
</script>
```

### 8.3 Fork examples

```svelte
<!-- Multi-account fork: src/client/app.svelte -->
<AppShell>
  {#snippet leftRail()}     <AccountSwitcher /> {/snippet}
  {#snippet topbarCenter()} <EntitySwitcher />  {/snippet}
</AppShell>
```

```svelte
<!-- Domain-heavy fork: src/client/app.svelte -->
<AppShell>
  {#snippet subnav()}       <SectionTabs />     {/snippet}
</AppShell>
```

### 8.4 Grid implementation

CSS Grid with `grid-template-areas` for the layout. When a slot is empty, its grid track collapses to zero. No JS layout logic. Clean and reorderable.

---

## 9. Visual design language

**Aesthetic:** Swiss typography meets Apple software. Restrained, generous, deliberate.

- **Typography stack** (body):
  `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Helvetica Neue", Arial, sans-serif`
  On Apple devices this renders as SF Pro natively. Inter is the cross-platform fallback (self-hosted, no external font CDN).
- **Mono stack:** `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace`.
- **Type scale:** 11 / 12 / 13 / 14 / 16 / 18 / 22 / 28 / 36. `letter-spacing: -0.005em` on body, `-0.02em` on headings.
- **Spacing scale:** Tailwind defaults; admin pages target 24px page padding, 12–16px between blocks, dense tables (10–12px row padding).
- **Color tokens** (light):
  - bg: `#fafafa` · surface: `#ffffff` · border: `#e8e8e8` / `#d4d4d4` strong
  - text: `#0a0a0a` · muted: `#737373`
  - accent: monochrome black `#0a0a0a` (intentionally restrained)
  - success: `#047857` on `#ecfdf5` · warning: `#92400e` on `#fef3c7` · error: `#991b1b` on `#fee2e2`
- **Color tokens** (dark): mirrored, computed against true black for OLED-aware feel.
- **Radii:** 4 / 6 / 8 px. No large rounded "cute" radii.
- **Shadows:** virtually none. Borders carry hierarchy.
- **Motion:** 120–200 ms ease, used only on state changes (hover, selection, route transition). No decorative motion.

A small set of UI primitives lives in `src/client/lib/ui/`: `Button`, `Input`, `Select`, `Pill`, `Table`, `Field`, `IconButton`, `Toast`. Built from scratch (no shadcn) so the aesthetic stays coherent.

---

## 10. Data model (D1)

```sql
-- Users: created on first sign-in under DomainAllowlistPolicy and OpenRegistrationPolicy.
-- EnvAllowlistPolicy does not require a row here (sessions reference the email directly).
CREATE TABLE users (
  email            TEXT PRIMARY KEY,           -- lowercased
  org_id           TEXT,                       -- free-form string, may be derived from domain
  role             TEXT,                       -- free-form string, 'admin' for bootstrap admins
  first_seen_at    INTEGER NOT NULL,
  last_seen_at     INTEGER NOT NULL,
  banned_at        INTEGER,                    -- nullable; non-null blocks future sign-ins
  metadata_json    TEXT                        -- policy-specific extras
);
CREATE INDEX users_org ON users(org_id);
CREATE INDEX users_banned ON users(banned_at);

-- Bulk-added individual email exceptions, consulted by DomainAllowlistPolicy.
-- Primary UX is domain-based; this table is the edge-case path
-- (one-off external partners, migrations from legacy systems).
CREATE TABLE allowed_emails (
  email            TEXT PRIMARY KEY,           -- lowercased
  org_id           TEXT,
  role             TEXT,
  added_at         INTEGER NOT NULL,
  added_by         TEXT NOT NULL,              -- email of the admin who added it
  note             TEXT
);
CREATE INDEX allowed_emails_org ON allowed_emails(org_id);

CREATE TABLE sessions (
  token            TEXT PRIMARY KEY,           -- opaque 32-byte token, base64url
  email            TEXT NOT NULL,              -- lowercased
  org_id           TEXT,                       -- snapshotted at sign-in time
  role             TEXT,                       -- snapshotted at sign-in time
  created_at       INTEGER NOT NULL,           -- unix seconds
  last_seen_at     INTEGER NOT NULL,
  expires_at       INTEGER NOT NULL,
  user_agent       TEXT,
  ip               TEXT
);
CREATE INDEX sessions_email ON sessions(email);
CREATE INDEX sessions_expires ON sessions(expires_at);

CREATE TABLE connection_secrets (
  connection_id    TEXT PRIMARY KEY,           -- matches declared connection.id
  ciphertext       BLOB NOT NULL,              -- AES-GCM encrypted JSON
  iv               BLOB NOT NULL,
  last_rotated_at  INTEGER NOT NULL,
  last_rotated_by  TEXT NOT NULL
);

CREATE TABLE audit_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ts               INTEGER NOT NULL,
  actor_email      TEXT,                       -- null for system events
  actor_org_id     TEXT,
  actor_role       TEXT,
  action           TEXT NOT NULL,              -- 'sign_in', 'sign_out', 'rotate_secret',
                                               -- 'access.allow_add', 'access.allow_remove',
                                               -- 'user.ban', 'user.unban', 'user.update',
                                               -- 'resource.create', 'resource.update', 'resource.delete'
  resource_id      TEXT,                       -- e.g. 'stripe-customers'
  record_id        TEXT,                       -- the external API's id
  connection_id    TEXT,
  detail_json      TEXT,                       -- diff or context
  ip               TEXT
);
CREATE INDEX audit_log_ts ON audit_log(ts DESC);
CREATE INDEX audit_log_actor ON audit_log(actor_email, ts DESC);
```

KV namespaces:

- `RATE_LIMIT` — `rl:magic:email:{email}` and `rl:magic:ip:{ip}` counters (1-hour TTL).
- `MAGIC_TOKENS` — `magic:{token}` → `{email, expires, decision}` (15-minute TTL).

---

## 11. Project structure

```
admin-boilerplate/
├── README.md
├── LICENSE                       # MIT
├── wrangler.toml
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── .gitignore                    # includes .superpowers/
├── migrations/
│   └── 0001_init.sql
├── docs/
│   ├── deploy.md
│   ├── adding-a-resource.md
│   ├── customising-the-shell.md
│   └── superpowers/specs/        # design doc lives here
├── src/
│   ├── client/                   # SPA
│   │   ├── main.ts
│   │   ├── app.svelte            # users edit this to add slot overrides
│   │   ├── lib/
│   │   │   ├── shell/            # AppShell.svelte, defaults
│   │   │   ├── ui/               # Button, Input, Pill, Table, Field, ...
│   │   │   ├── resource/         # ResourceTable, ResourceDetail, ResourceForm
│   │   │   ├── auth/             # sign-in, callback handler
│   │   │   ├── api.ts            # fetch wrapper with session cookie + error handling
│   │   │   ├── tokens.ts         # design tokens
│   │   │   └── theme.svelte.ts   # light/dark store with system pref
│   │   └── routes/
│   ├── worker/                   # CF Worker
│   │   ├── index.ts              # Hono app entry
│   │   ├── auth/
│   │   │   ├── magic-link.ts     # request + callback handlers
│   │   │   ├── session.ts        # create / validate / revoke
│   │   │   └── policy/
│   │   │       ├── types.ts      # AccessPolicy interface
│   │   │       ├── env-allowlist.ts
│   │   │       ├── domain-allowlist.ts
│   │   │       ├── open-registration.ts
│   │   │       └── index.ts      # factory: reads ACCESS_POLICY env, returns instance
│   │   ├── email/                # EmailProvider interface + Console/CF/Resend impls
│   │   ├── connections/          # CRUD + secret encryption
│   │   ├── resources/            # registry, proxy endpoint, session-templating
│   │   ├── access/               # /settings/access endpoints (allowed_emails bulk mgmt)
│   │   ├── users/                # /settings/users endpoints (list, ban, edit)
│   │   ├── audit/                # writer + reader
│   │   └── lib/
│   │       ├── crypto.ts         # AES-GCM helpers
│   │       └── captcha.ts        # optional Turnstile verification
│   ├── connections/              # USER-DEFINED — example: example-stripe.ts
│   ├── resources/                # USER-DEFINED — example: example-stripe-customers.ts
│   └── shared/
│       ├── types.ts              # AppShellProps, ResourceSchema, FieldType, ...
│       └── define.ts             # defineResource, defineConnection helpers
├── desktop/                      # Tauri wrapper
│   ├── tauri.conf.json
│   ├── Cargo.toml
│   └── src/main.rs
└── .superpowers/                 # gitignored (brainstorm artefacts)
```

---

## 12. Deploy story / minimum setup

The README walks through this exact sequence.

```bash
# 1. Clone
git clone https://github.com/USER/admin-boilerplate.git my-admin && cd my-admin

# 2. Install
pnpm install

# 3. Create D1 database
wrangler d1 create my-admin
# -> copy database_id into wrangler.toml

# 4. Create KV namespaces
wrangler kv namespace create RATE_LIMIT
wrangler kv namespace create MAGIC_TOKENS
# -> copy ids into wrangler.toml

# 5. Run migrations
wrangler d1 migrations apply my-admin

# 6. Set secrets
wrangler secret put SECRETS_KEY          # paste: openssl rand -base64 32

# 7. Configure access policy in .dev.vars
cat >> .dev.vars <<EOF
ADMIN_EMAILS="you@example.com"           # bootstrap admins, always allowed
ACCESS_POLICY="allowlist"                # allowlist | domain | open
# ALLOWED_DOMAINS="example.com"          # required if ACCESS_POLICY=domain
# CAPTCHA_PROVIDER="turnstile"           # optional, for open registration
# CAPTCHA_SECRET="..."                   # if CAPTCHA_PROVIDER set
EOF

# 8. (Optional) Enable CF Email Routing on your domain and verify each
#    bootstrap-admin address. Add the send_email binding in wrangler.toml.
#    Skip for now to use ConsoleProvider in dev — magic links print to terminal.

# 9. Dev
pnpm dev   # runs Vite + Wrangler dev.

# 10. Deploy
wrangler deploy
```

### Environment variables

| Var | Required | Default | Notes |
|---|---|---|---|
| `ADMIN_EMAILS` | yes | — | Comma-separated. Bootstrap admins, always allowed, always `role=admin`. |
| `ACCESS_POLICY` | no | `allowlist` | One of `allowlist`, `domain`, `open`. |
| `ALLOWED_DOMAINS` | conditional | — | Required if `ACCESS_POLICY=domain`. Comma-separated, e.g. `amc.com,regal.com`. |
| `DERIVE_ORG_FROM_DOMAIN` | no | `false` | If true, `domain` policy derives `org_id` from the email's domain. |
| `EMAIL_PROVIDER` | no | `console` | One of `console`, `cloudflare`, `resend`. |
| `RESEND_API_KEY` | conditional | — | Required if `EMAIL_PROVIDER=resend`. |
| `FROM_ADDRESS` | yes (prod) | — | e.g. `admin@yourdomain.com`. |
| `PUBLIC_URL` | yes | — | Used in magic-link callback URLs. |
| `SECRETS_KEY` | yes | — | 32-byte secret for encrypting connection secrets. Worker secret, not env var. |
| `CAPTCHA_PROVIDER` | no | — | Set to `turnstile` to require CAPTCHA on `/sign-in` under `open` policy. |
| `CAPTCHA_SECRET` | conditional | — | Required if `CAPTCHA_PROVIDER` set. |
| `EMAIL_BLOCKLIST` | no | — | Optional regex for `open` policy (e.g. disposable-domain blocklist). |

Adding a resource (the common Claude task):

```bash
# "Hey Claude, add a Stripe customers resource"
# → Claude creates src/resources/stripe-customers.ts
# → pnpm dev rebuilds; the SPA auto-discovers and renders it.
```

---

## 13. Phase 2 / explicitly deferred

- **Declarative row-level scoping** for resources (the substrate exists in v1 via `:session.*` templating; phase 2 adds richer filtering rules, allow/deny lists per role, and tests).
- **Rich org / tenant management UI** — proper orgs table, per-org settings, transfer flows, org-level audit views.
- **SAML / SSO** sign-in (sits alongside magic-link, doesn't replace it).
- **Invite emails** — admin sends an invite-link instead of relying on the user to request one.
- **OAuth 2.0 connection auth** (with refresh tokens, callback handling).
- **OpenAPI / Swagger import** to scaffold resources.
- **Sample-JSON inference helper** as a Claude subagent.
- **Local SQLite + offline mode** for Tauri desktop.
- **GraphQL connection type.**
- **Per-resource custom renderers / custom forms.**
- **Saved views, filters, query DSL.**
- **Inbound webhooks** (CF receives outbound events from your APIs).

---

## 14. Open questions

None at design-doc time. Implementation may surface details around:

- Exact CF Email Workers `send_email` binding semantics (need to confirm during impl whether unverified destinations are blocked outright or just warned).
- Whether to use the new CF Workers Static Assets feature or hand-roll asset serving — likely Static Assets, but pin during impl.
