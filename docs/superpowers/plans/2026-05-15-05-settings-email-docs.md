# Plan 5 — Settings UI + Production Email + Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the boilerplate deployable and documented as a complete web product. Adds the four `/settings/*` admin pages (Connections, Access, Users, Audit) on top of the substrate built in Plans 2 and 3, ships the two production email providers (Cloudflare Email Workers and Resend), addresses two carried-over follow-ups (`SECRETS_KEY` shape validation, cursor pagination UI), and writes a real README quickstart plus three supporting docs files. After this plan merges, a developer can `git clone`, follow the README, and have a working admin tool live on Cloudflare in ~20 minutes. Tauri desktop wrapper is deferred to a separate Plan 6.

**Architecture:**

```
   ┌──────────────────────── SPA ───────────────────────┐
   │ AppShell (Plan 4)                                  │
   │ Sidebar now includes a "Settings" group:           │
   │   • Connections  → manage connection secrets       │
   │   • Access       → allowed_emails CRUD             │
   │   • Users        → ban / edit roles / orgs         │
   │   • Audit        → recent audit_log viewer         │
   └────────┬───────────────────────────────────────────┘
            │
            │ talks to NEW admin endpoints from this plan:
            │   GET    /api/access            POST /api/access  DELETE /api/access/:email
            │   GET    /api/users             PATCH /api/users/:email
            │   GET    /api/audit
            ▼
   ┌──────────────────────── Worker ────────────────────┐
   │ All admin endpoints require session.role==='admin' │
   │ Mutations write audit_log entries:                 │
   │   access.allow_add, access.allow_remove            │
   │   user.ban, user.unban, user.update                │
   └────────────────────────────────────────────────────┘

   Plus: prod email providers (CloudflareEmailProvider via send_email
   binding, ResendProvider via api.resend.com fetch) replace the
   ConsoleProvider when EMAIL_PROVIDER is set accordingly.
```

**Tech Stack:** No new runtime deps. ResendProvider uses native `fetch`. CloudflareEmailProvider uses the Workers `send_email` binding (declared in `wrangler.toml`).

---

## Prerequisites

- Plan 4 merged to `main`. Local `main` synced.
- 100 Worker tests passing (will grow to ~120 in this plan).
- The boilerplate runs end-to-end as a web admin (Plan 4 verified this).

---

## Files Created / Modified by this Plan

```
src/
├── worker/
│   ├── index.ts                                # MODIFY: mount new admin routes
│   ├── lib/crypto.ts                            # MODIFY: clearer error on bad SECRETS_KEY
│   ├── access/
│   │   ├── routes.ts                            # new: /api/access endpoints
│   │   └── routes.test.ts                       # new
│   ├── users/
│   │   ├── routes.ts                            # new: /api/users endpoints
│   │   └── routes.test.ts                       # new
│   ├── audit/
│   │   ├── routes.ts                            # new: GET /api/audit endpoint
│   │   ├── routes.test.ts                       # new
│   │   └── writer.ts                            # already exists
│   └── email/
│       ├── cloudflare-provider.ts               # new
│       ├── cloudflare-provider.test.ts          # new
│       ├── resend-provider.ts                   # new
│       ├── resend-provider.test.ts              # new
│       └── index.ts                             # MODIFY: factory adds the two new providers
├── client/
│   ├── app.svelte                               # MODIFY: register settings routes
│   ├── lib/shell/DefaultSidebar.svelte          # MODIFY: append a "Settings" group (admins only)
│   ├── lib/resource/ResourceTable.svelte        # MODIFY: cursor pagination Next/Prev UI
│   └── routes/
│       ├── SettingsConnectionsPage.svelte       # new
│       ├── SettingsAccessPage.svelte            # new
│       ├── SettingsUsersPage.svelte             # new
│       └── SettingsAuditPage.svelte             # new
README.md                                         # MODIFY: real quickstart
docs/
├── deploy.md                                    # new
├── adding-a-resource.md                         # new
└── customising-the-shell.md                     # new
```

---

## Tasks

### Task 1: Branch + commit Plan 5 doc

- [ ] **Step 1.1**

```bash
git checkout main
git pull origin main
git checkout -b feature/settings-email-docs
```

- [ ] **Step 1.2**

```bash
git add docs/superpowers/plans/2026-05-15-05-settings-email-docs.md
git commit -m "$(cat <<'EOF'
docs: add Plan 5 — settings UI + production email + docs

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `/api/access` endpoints (TDD)

**Files:**
- Create: `src/worker/access/routes.ts`
- Create: `src/worker/access/routes.test.ts`

Endpoints, all admin-only:
- `GET /api/access` → list rows from `allowed_emails`, ordered by `added_at DESC`
- `POST /api/access` → body is either `{email, orgId?, role?, note?}` OR an array of those; upserts each; writes `access.allow_add` audit entries
- `DELETE /api/access/:email` → removes the row; writes `access.allow_remove` audit entry

- [ ] **Step 2.1: Failing test — `src/worker/access/routes.test.ts`**

```ts
import { env, SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import { createSession } from '../auth/session';

afterEach(async () => {
  await env.DB.prepare('DELETE FROM sessions').run();
  await env.DB.prepare('DELETE FROM allowed_emails').run();
  await env.DB.prepare('DELETE FROM audit_log').run();
});

async function adminCookie(): Promise<string> {
  const s = await createSession(env.DB, { email: 'admin@example.com', role: 'admin' });
  return `__Host-session=${s.token}`;
}
async function userCookie(): Promise<string> {
  const s = await createSession(env.DB, { email: 'user@example.com' });
  return `__Host-session=${s.token}`;
}

describe('GET /api/access', () => {
  it('401 with no cookie', async () => {
    expect((await SELF.fetch('http://localhost/api/access')).status).toBe(401);
  });
  it('403 for non-admin', async () => {
    const res = await SELF.fetch('http://localhost/api/access', {
      headers: { Cookie: await userCookie() },
    });
    expect(res.status).toBe(403);
  });
  it('200 returns rows ordered by added_at DESC', async () => {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare('INSERT INTO allowed_emails (email, added_at, added_by) VALUES (?, ?, ?)').bind('a@x.io', now - 10, 'admin@example.com').run();
    await env.DB.prepare('INSERT INTO allowed_emails (email, added_at, added_by) VALUES (?, ?, ?)').bind('b@x.io', now, 'admin@example.com').run();
    const res = await SELF.fetch('http://localhost/api/access', { headers: { Cookie: await adminCookie() } });
    expect(res.status).toBe(200);
    const rows = (await res.json()) as Array<{ email: string }>;
    expect(rows.map((r) => r.email)).toEqual(['b@x.io', 'a@x.io']);
  });
});

describe('POST /api/access', () => {
  it('adds a single email', async () => {
    const res = await SELF.fetch('http://localhost/api/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await adminCookie() },
      body: JSON.stringify({ email: 'partner@example.io', orgId: 'partner', role: 'editor' }),
    });
    expect(res.status).toBe(200);
    const row = await env.DB.prepare('SELECT email, org_id, role FROM allowed_emails WHERE email = ?').bind('partner@example.io').first<{ email: string; org_id: string; role: string }>();
    expect(row?.org_id).toBe('partner');
    expect(row?.role).toBe('editor');
    // audit
    const a = await env.DB.prepare('SELECT action FROM audit_log WHERE action = ?').bind('access.allow_add').first<{ action: string }>();
    expect(a?.action).toBe('access.allow_add');
  });

  it('adds an array of emails (bulk)', async () => {
    const res = await SELF.fetch('http://localhost/api/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await adminCookie() },
      body: JSON.stringify([
        { email: 'one@example.io' },
        { email: 'two@example.io', orgId: 'two' },
      ]),
    });
    expect(res.status).toBe(200);
    const count = await env.DB.prepare('SELECT COUNT(*) as c FROM allowed_emails').first<{ c: number }>();
    expect(count?.c).toBe(2);
  });

  it('rejects malformed bodies', async () => {
    const res = await SELF.fetch('http://localhost/api/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: await adminCookie() },
      body: JSON.stringify({ orgId: 'no-email' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/access/:email', () => {
  it('removes a row + writes audit', async () => {
    await env.DB.prepare('INSERT INTO allowed_emails (email, added_at, added_by) VALUES (?, ?, ?)').bind('gone@x.io', 1, 'admin@example.com').run();
    const res = await SELF.fetch('http://localhost/api/access/gone%40x.io', {
      method: 'DELETE',
      headers: { Cookie: await adminCookie() },
    });
    expect(res.status).toBe(200);
    const left = await env.DB.prepare('SELECT COUNT(*) as c FROM allowed_emails').first<{ c: number }>();
    expect(left?.c).toBe(0);
    const a = await env.DB.prepare('SELECT action FROM audit_log WHERE action = ?').bind('access.allow_remove').first<{ action: string }>();
    expect(a?.action).toBe('access.allow_remove');
  });
});
```

- [ ] **Step 2.2: Run, confirm failure.**

```bash
pnpm test src/worker/access/routes.test.ts
```

- [ ] **Step 2.3: Implement `src/worker/access/routes.ts`**

```ts
import type { Context, Hono } from 'hono';
import { recordAuditEvent } from '../audit/writer';
import type { Session } from '../auth/session';

interface AccessEntry {
  email: string;
  orgId?: string;
  role?: string;
  note?: string;
}

function requireAdmin(c: Context): Response | null {
  const session = c.get('session') as Session | undefined;
  if (!session) return new Response(null, { status: 401 });
  if (session.role !== 'admin') return new Response(null, { status: 403 });
  return null;
}

function parseEntry(x: unknown): AccessEntry | null {
  if (!x || typeof x !== 'object') return null;
  const e = x as Record<string, unknown>;
  if (typeof e.email !== 'string' || e.email.length === 0) return null;
  return {
    email: e.email.toLowerCase().trim(),
    orgId: typeof e.orgId === 'string' ? e.orgId : undefined,
    role: typeof e.role === 'string' ? e.role : undefined,
    note: typeof e.note === 'string' ? e.note : undefined,
  };
}

export function registerAccessRoutes(app: Hono<{ Bindings: Env }>): void {
  app.get('/api/access', async (c) => {
    const guard = requireAdmin(c);
    if (guard) return guard;
    const { results } = await c.env.DB.prepare(
      'SELECT email, org_id, role, added_at, added_by, note FROM allowed_emails ORDER BY added_at DESC',
    ).all<{ email: string; org_id: string | null; role: string | null; added_at: number; added_by: string; note: string | null }>();
    return c.json(
      results.map((r) => ({
        email: r.email,
        orgId: r.org_id,
        role: r.role,
        addedAt: r.added_at,
        addedBy: r.added_by,
        note: r.note,
      })),
    );
  });

  app.post('/api/access', async (c) => {
    const guard = requireAdmin(c);
    if (guard) return guard;

    let body: unknown;
    try { body = await c.req.json(); } catch { return c.json({ ok: false, error: 'invalid_json' }, 400); }

    const list: AccessEntry[] = [];
    if (Array.isArray(body)) {
      for (const item of body) {
        const parsed = parseEntry(item);
        if (!parsed) return c.json({ ok: false, error: 'invalid_entry' }, 400);
        list.push(parsed);
      }
    } else {
      const parsed = parseEntry(body);
      if (!parsed) return c.json({ ok: false, error: 'invalid_entry' }, 400);
      list.push(parsed);
    }

    const session = c.get('session') as Session;
    const now = Math.floor(Date.now() / 1000);
    const ip = c.req.header('CF-Connecting-IP') ?? '';

    for (const entry of list) {
      await c.env.DB.prepare(
        `INSERT INTO allowed_emails (email, org_id, role, added_at, added_by, note)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           org_id = excluded.org_id,
           role   = excluded.role,
           added_at = excluded.added_at,
           added_by = excluded.added_by,
           note   = excluded.note`,
      ).bind(entry.email, entry.orgId ?? null, entry.role ?? null, now, session.email, entry.note ?? null).run();

      await recordAuditEvent(c.env.DB, {
        action: 'access.allow_add',
        actor: { email: session.email, orgId: session.orgId, role: session.role },
        detail: entry,
        ip,
      });
    }
    return c.json({ ok: true, added: list.length });
  });

  app.delete('/api/access/:email', async (c) => {
    const guard = requireAdmin(c);
    if (guard) return guard;
    const session = c.get('session') as Session;
    const email = decodeURIComponent(c.req.param('email')).toLowerCase();
    await c.env.DB.prepare('DELETE FROM allowed_emails WHERE email = ?').bind(email).run();
    await recordAuditEvent(c.env.DB, {
      action: 'access.allow_remove',
      actor: { email: session.email, orgId: session.orgId, role: session.role },
      detail: { email },
      ip: c.req.header('CF-Connecting-IP') ?? '',
    });
    return c.json({ ok: true });
  });
}
```

- [ ] **Step 2.4: Mount this in Task 4 (with the audit endpoint).** Just verify typecheck passes for now.

```bash
pnpm typecheck
```

- [ ] **Step 2.5: Commit**

```bash
git add src/worker/access/routes.ts src/worker/access/routes.test.ts
git commit -m "$(cat <<'EOF'
feat(access): admin endpoints for allowed_emails CRUD with audit

Note: routes mount in Task 4. Tests pass after that.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `/api/users` endpoints (TDD)

**Files:**
- Create: `src/worker/users/routes.ts`
- Create: `src/worker/users/routes.test.ts`

Endpoints, all admin-only:
- `GET /api/users` → list rows from `users` ordered by `last_seen_at DESC`
- `PATCH /api/users/:email` → update `org_id` / `role` / `banned_at` (toggle). Body fields are all optional — present ones get applied. Writes appropriate audit (`user.ban`, `user.unban`, `user.update`).

When banning, also delete the user's sessions so they're signed out everywhere.

- [ ] **Step 3.1: Failing test — `src/worker/users/routes.test.ts`**

```ts
import { env, SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import { createSession } from '../auth/session';

afterEach(async () => {
  await env.DB.prepare('DELETE FROM sessions').run();
  await env.DB.prepare('DELETE FROM users').run();
  await env.DB.prepare('DELETE FROM audit_log').run();
});

async function adminCookie(): Promise<string> {
  const s = await createSession(env.DB, { email: 'admin@example.com', role: 'admin' });
  return `__Host-session=${s.token}`;
}

describe('GET /api/users', () => {
  it('200 with last_seen DESC ordering, banned and active mixed', async () => {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare('INSERT INTO users (email, first_seen_at, last_seen_at) VALUES (?, ?, ?)').bind('older@x.io', now - 100, now - 100).run();
    await env.DB.prepare('INSERT INTO users (email, first_seen_at, last_seen_at, banned_at) VALUES (?, ?, ?, ?)').bind('banned@x.io', now - 50, now - 50, now).run();
    await env.DB.prepare('INSERT INTO users (email, first_seen_at, last_seen_at) VALUES (?, ?, ?)').bind('newer@x.io', now, now).run();

    const res = await SELF.fetch('http://localhost/api/users', { headers: { Cookie: await adminCookie() } });
    expect(res.status).toBe(200);
    const list = (await res.json()) as Array<{ email: string }>;
    expect(list.map((u) => u.email)).toEqual(['newer@x.io', 'banned@x.io', 'older@x.io']);
  });
});

describe('PATCH /api/users/:email', () => {
  it('bans a user (sets banned_at) + deletes sessions + writes audit', async () => {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare('INSERT INTO users (email, first_seen_at, last_seen_at) VALUES (?, ?, ?)').bind('victim@x.io', now, now).run();
    // Give the victim a live session.
    await createSession(env.DB, { email: 'victim@x.io' });

    const res = await SELF.fetch('http://localhost/api/users/victim%40x.io', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: await adminCookie() },
      body: JSON.stringify({ banned: true }),
    });
    expect(res.status).toBe(200);

    const u = await env.DB.prepare('SELECT banned_at FROM users WHERE email = ?').bind('victim@x.io').first<{ banned_at: number | null }>();
    expect(u?.banned_at).not.toBeNull();

    const sessions = await env.DB.prepare('SELECT COUNT(*) as c FROM sessions WHERE email = ?').bind('victim@x.io').first<{ c: number }>();
    expect(sessions?.c).toBe(0);

    const a = await env.DB.prepare('SELECT action FROM audit_log WHERE action = ?').bind('user.ban').first<{ action: string }>();
    expect(a?.action).toBe('user.ban');
  });

  it('unbans a user', async () => {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare('INSERT INTO users (email, first_seen_at, last_seen_at, banned_at) VALUES (?, ?, ?, ?)').bind('back@x.io', now, now, now).run();
    const res = await SELF.fetch('http://localhost/api/users/back%40x.io', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: await adminCookie() },
      body: JSON.stringify({ banned: false }),
    });
    expect(res.status).toBe(200);
    const u = await env.DB.prepare('SELECT banned_at FROM users WHERE email = ?').bind('back@x.io').first<{ banned_at: number | null }>();
    expect(u?.banned_at).toBeNull();
  });

  it('updates orgId and role', async () => {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare('INSERT INTO users (email, first_seen_at, last_seen_at) VALUES (?, ?, ?)').bind('promote@x.io', now, now).run();
    const res = await SELF.fetch('http://localhost/api/users/promote%40x.io', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: await adminCookie() },
      body: JSON.stringify({ orgId: 'special', role: 'admin' }),
    });
    expect(res.status).toBe(200);
    const u = await env.DB.prepare('SELECT org_id, role FROM users WHERE email = ?').bind('promote@x.io').first<{ org_id: string; role: string }>();
    expect(u?.org_id).toBe('special');
    expect(u?.role).toBe('admin');
  });

  it('404 if user does not exist', async () => {
    const res = await SELF.fetch('http://localhost/api/users/absent%40x.io', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: await adminCookie() },
      body: JSON.stringify({ banned: true }),
    });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 3.2: Run, confirm failure.**

- [ ] **Step 3.3: Implement `src/worker/users/routes.ts`**

```ts
import type { Context, Hono } from 'hono';
import { recordAuditEvent } from '../audit/writer';
import { revokeAllForEmail } from '../auth/session';
import type { Session } from '../auth/session';

function requireAdmin(c: Context): Response | null {
  const session = c.get('session') as Session | undefined;
  if (!session) return new Response(null, { status: 401 });
  if (session.role !== 'admin') return new Response(null, { status: 403 });
  return null;
}

export function registerUserRoutes(app: Hono<{ Bindings: Env }>): void {
  app.get('/api/users', async (c) => {
    const guard = requireAdmin(c);
    if (guard) return guard;
    const { results } = await c.env.DB.prepare(
      'SELECT email, org_id, role, first_seen_at, last_seen_at, banned_at FROM users ORDER BY last_seen_at DESC',
    ).all<{ email: string; org_id: string | null; role: string | null; first_seen_at: number; last_seen_at: number; banned_at: number | null }>();
    return c.json(
      results.map((u) => ({
        email: u.email,
        orgId: u.org_id,
        role: u.role,
        firstSeenAt: u.first_seen_at,
        lastSeenAt: u.last_seen_at,
        bannedAt: u.banned_at,
      })),
    );
  });

  app.patch('/api/users/:email', async (c) => {
    const guard = requireAdmin(c);
    if (guard) return guard;

    const session = c.get('session') as Session;
    const email = decodeURIComponent(c.req.param('email')).toLowerCase();
    const existing = await c.env.DB.prepare('SELECT email, banned_at FROM users WHERE email = ?').bind(email).first<{ email: string; banned_at: number | null }>();
    if (!existing) return c.json({ ok: false, error: 'unknown_user' }, 404);

    let body: { banned?: unknown; orgId?: unknown; role?: unknown };
    try { body = await c.req.json(); } catch { return c.json({ ok: false, error: 'invalid_json' }, 400); }

    const setClauses: string[] = [];
    const binds: unknown[] = [];
    let action: 'user.ban' | 'user.unban' | 'user.update' = 'user.update';

    if (typeof body.banned === 'boolean') {
      if (body.banned) {
        setClauses.push('banned_at = ?');
        binds.push(Math.floor(Date.now() / 1000));
        action = 'user.ban';
      } else {
        setClauses.push('banned_at = NULL');
        action = 'user.unban';
      }
    }
    if (typeof body.orgId === 'string' || body.orgId === null) {
      setClauses.push('org_id = ?');
      binds.push(body.orgId ?? null);
    }
    if (typeof body.role === 'string' || body.role === null) {
      setClauses.push('role = ?');
      binds.push(body.role ?? null);
    }

    if (setClauses.length === 0) {
      return c.json({ ok: false, error: 'no_fields_to_update' }, 400);
    }

    binds.push(email);
    await c.env.DB.prepare(`UPDATE users SET ${setClauses.join(', ')} WHERE email = ?`).bind(...binds).run();

    // Banning revokes all sessions so the user is signed out everywhere immediately.
    if (action === 'user.ban') {
      await revokeAllForEmail(c.env.DB, email);
    }

    await recordAuditEvent(c.env.DB, {
      action,
      actor: { email: session.email, orgId: session.orgId, role: session.role },
      detail: { targetEmail: email, ...body },
      ip: c.req.header('CF-Connecting-IP') ?? '',
    });
    return c.json({ ok: true });
  });
}
```

- [ ] **Step 3.4: Typecheck + commit (routes mount in Task 4).**

```bash
pnpm typecheck
git add src/worker/users/routes.ts src/worker/users/routes.test.ts
git commit -m "$(cat <<'EOF'
feat(users): admin endpoints for user list / ban / role update with audit

Note: routes mount in Task 4. Tests pass after that.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `/api/audit` endpoint + mount all admin routes (TDD)

**Files:**
- Create: `src/worker/audit/routes.ts`
- Create: `src/worker/audit/routes.test.ts`
- Modify: `src/worker/index.ts`

`GET /api/audit?limit=200` → list recent entries from `audit_log`, ordered by `ts DESC`. Admin-only.

- [ ] **Step 4.1: Test — `src/worker/audit/routes.test.ts`**

```ts
import { env, SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import { createSession } from '../auth/session';
import { recordAuditEvent } from './writer';

afterEach(async () => {
  await env.DB.prepare('DELETE FROM sessions').run();
  await env.DB.prepare('DELETE FROM audit_log').run();
});

async function adminCookie(): Promise<string> {
  const s = await createSession(env.DB, { email: 'admin@example.com', role: 'admin' });
  return `__Host-session=${s.token}`;
}

describe('GET /api/audit', () => {
  it('401 / 403 / 200 happy path with recent-first ordering', async () => {
    // Setup
    await recordAuditEvent(env.DB, { action: 'sign_in', actor: { email: 'a@x.io' } });
    await new Promise((r) => setTimeout(r, 1100));
    await recordAuditEvent(env.DB, { action: 'sign_in', actor: { email: 'b@x.io' } });

    const res = await SELF.fetch('http://localhost/api/audit', { headers: { Cookie: await adminCookie() } });
    expect(res.status).toBe(200);
    const list = (await res.json()) as Array<{ actor_email: string }>;
    expect(list[0].actor_email).toBe('b@x.io');
    expect(list[1].actor_email).toBe('a@x.io');
  });

  it('honours ?limit=N (default 200, max 1000)', async () => {
    for (let i = 0; i < 5; i++) {
      await recordAuditEvent(env.DB, { action: 'sign_in', actor: { email: `a${i}@x.io` } });
    }
    const res = await SELF.fetch('http://localhost/api/audit?limit=2', { headers: { Cookie: await adminCookie() } });
    const list = (await res.json()) as unknown[];
    expect(list).toHaveLength(2);
  });
});
```

- [ ] **Step 4.2: Implement `src/worker/audit/routes.ts`**

```ts
import type { Context, Hono } from 'hono';
import type { Session } from '../auth/session';

function requireAdmin(c: Context): Response | null {
  const session = c.get('session') as Session | undefined;
  if (!session) return new Response(null, { status: 401 });
  if (session.role !== 'admin') return new Response(null, { status: 403 });
  return null;
}

export function registerAuditRoutes(app: Hono<{ Bindings: Env }>): void {
  app.get('/api/audit', async (c) => {
    const guard = requireAdmin(c);
    if (guard) return guard;
    const rawLimit = Number(c.req.query('limit') ?? '200');
    const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? rawLimit : 200, 1000));
    const { results } = await c.env.DB.prepare(
      'SELECT id, ts, actor_email, actor_org_id, actor_role, action, resource_id, record_id, connection_id, detail_json, ip FROM audit_log ORDER BY ts DESC LIMIT ?',
    ).bind(limit).all();
    return c.json(results);
  });
}
```

- [ ] **Step 4.3: Modify `src/worker/index.ts`** — mount the three new route groups:

```ts
import { Hono } from 'hono';
import { registerAccessRoutes } from './access/routes';
import { registerAuditRoutes } from './audit/routes';
import { registerAuthRoutes } from './auth/routes';
import { registerConnectionRoutes } from './connections/routes';
import { registerResourceRoutes } from './resources/routes';
import { registerUserRoutes } from './users/routes';

const app = new Hono<{ Bindings: Env }>();

registerAuthRoutes(app);
registerConnectionRoutes(app);
registerResourceRoutes(app);
registerAccessRoutes(app);
registerUserRoutes(app);
registerAuditRoutes(app);

app.get('/api/health', (c) => c.json({ ok: true }));

app.all('*', async (c) => {
  if (c.req.path === '/api' || c.req.path.startsWith('/api/')) {
    return c.notFound();
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
```

- [ ] **Step 4.4: Run the full suite.** Tasks 2–4's new tests now have routes to talk to.

```bash
pnpm test 2>&1 | tail -10
```

Expected: ~114 tests pass (was 100; +14 from this plan so far — access 5 + users 4 + audit 2 + a couple incidental boundary tests).

- [ ] **Step 4.5: Typecheck + commit**

```bash
pnpm typecheck
git add src/worker/audit/routes.ts src/worker/audit/routes.test.ts src/worker/index.ts
git commit -m "$(cat <<'EOF'
feat(audit,worker): /api/audit list endpoint + mount all admin routes

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `/settings/connections` page

**Files:**
- Create: `src/client/routes/SettingsConnectionsPage.svelte`

Lists connections from `GET /api/connections`. Each row expands into a form keyed off the connection's `authType` (none / bearer / header / basic). Submit calls `PUT /api/connections/:id`.

- [ ] **Step 5.1: Implement**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { api, ApiError } from '$client/lib/api';
  import { toast } from '$client/lib/toast.svelte';
  import Button from '$client/lib/ui/Button.svelte';
  import Field from '$client/lib/ui/Field.svelte';
  import Input from '$client/lib/ui/Input.svelte';
  import Pill from '$client/lib/ui/Pill.svelte';

  interface ConnectionListed {
    id: string;
    name: string;
    baseUrl: string;
    authType: 'none' | 'bearer' | 'header' | 'basic';
    isConfigured: boolean;
  }

  let items = $state<ConnectionListed[]>([]);
  let loading = $state(true);
  let openId = $state<string | null>(null);
  let formValues = $state<Record<string, string>>({});
  let saving = $state<string | null>(null);

  async function load() {
    loading = true;
    try {
      items = await api<ConnectionListed[]>('/api/connections');
    } catch {
      toast.error('Failed to load connections');
    } finally {
      loading = false;
    }
  }
  onMount(load);

  function toggle(id: string): void {
    openId = openId === id ? null : id;
    formValues = {};
  }

  async function submit(conn: ConnectionListed): Promise<void> {
    saving = conn.id;
    try {
      const body: Record<string, string> = { type: conn.authType };
      if (conn.authType === 'bearer') body.token = formValues.token ?? '';
      if (conn.authType === 'header') body.value = formValues.value ?? '';
      if (conn.authType === 'basic') {
        body.username = formValues.username ?? '';
        body.password = formValues.password ?? '';
      }
      await api(`/api/connections/${conn.id}`, { method: 'PUT', body: JSON.stringify(body) });
      toast.success('Saved');
      openId = null;
      await load();
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      toast.error(`Save failed (${status || 'network'})`);
    } finally {
      saving = null;
    }
  }
</script>

<div class="space-y-4 max-w-3xl">
  <header>
    <h1 class="text-xl font-semibold tracking-tight">Connections</h1>
    <p class="text-sm text-[var(--color-muted)]">Configure the API credentials your resources use.</p>
  </header>

  {#if loading}
    <p class="text-sm text-[var(--color-muted)]">Loading…</p>
  {:else if items.length === 0}
    <p class="text-sm text-[var(--color-muted)]">
      No connections declared. Add one in <code class="font-mono">src/connections/</code>.
    </p>
  {:else}
    <ul class="border border-[var(--color-border)] rounded-md divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
      {#each items as conn}
        <li class="p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium">{conn.name}</div>
              <div class="text-xs text-[var(--color-muted)] font-mono">{conn.id} · {conn.baseUrl}</div>
            </div>
            <div class="flex items-center gap-2">
              {#if conn.isConfigured}
                <Pill tone="success">configured</Pill>
              {:else}
                <Pill tone="warning">unconfigured</Pill>
              {/if}
              <Button variant="secondary" size="sm" onclick={() => toggle(conn.id)}>
                {openId === conn.id ? 'Cancel' : conn.isConfigured ? 'Rotate' : 'Configure'}
              </Button>
            </div>
          </div>

          {#if openId === conn.id}
            <form
              class="space-y-3 border-t border-[var(--color-border)] pt-3"
              onsubmit={(e) => { e.preventDefault(); void submit(conn); }}
            >
              <p class="text-xs text-[var(--color-muted)]">Auth type: <span class="font-mono">{conn.authType}</span></p>

              {#if conn.authType === 'none'}
                <p class="text-xs text-[var(--color-muted)]">No secret required. Click Save to mark configured.</p>
              {:else if conn.authType === 'bearer'}
                <Field label="Token" required>
                  <Input type="text" bind:value={formValues.token} placeholder="sk_…" monospace required />
                </Field>
              {:else if conn.authType === 'header'}
                <Field label="Header value" required>
                  <Input type="text" bind:value={formValues.value} placeholder="…" monospace required />
                </Field>
              {:else if conn.authType === 'basic'}
                <Field label="Username" required>
                  <Input type="text" bind:value={formValues.username} required />
                </Field>
                <Field label="Password" required>
                  <Input type="text" bind:value={formValues.password} required />
                </Field>
              {/if}

              <div class="flex gap-2">
                <Button type="submit" disabled={saving === conn.id}>
                  {saving === conn.id ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </form>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
```

- [ ] **Step 5.2: Build + commit**

```bash
pnpm build
pnpm typecheck
git add src/client/routes/SettingsConnectionsPage.svelte
git commit -m "$(cat <<'EOF'
feat(settings): /settings/connections page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `/settings/access` page

**Files:**
- Create: `src/client/routes/SettingsAccessPage.svelte`

List entries from `GET /api/access`. Add form (email + optional orgId + optional role). Row-level delete button.

- [ ] **Step 6.1: Implement**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { api, ApiError } from '$client/lib/api';
  import { toast } from '$client/lib/toast.svelte';
  import Button from '$client/lib/ui/Button.svelte';
  import Field from '$client/lib/ui/Field.svelte';
  import Input from '$client/lib/ui/Input.svelte';
  import Table from '$client/lib/ui/Table.svelte';

  interface Entry {
    email: string;
    orgId: string | null;
    role: string | null;
    addedAt: number;
    addedBy: string;
  }

  let items = $state<Entry[]>([]);
  let loading = $state(true);
  let saving = $state(false);

  let newEmail = $state('');
  let newOrgId = $state('');
  let newRole = $state('');

  async function load() {
    loading = true;
    try { items = await api<Entry[]>('/api/access'); }
    catch { toast.error('Failed to load'); }
    finally { loading = false; }
  }
  onMount(load);

  async function add(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    if (saving) return;
    saving = true;
    try {
      await api('/api/access', { method: 'POST', body: JSON.stringify({
        email: newEmail,
        orgId: newOrgId || undefined,
        role: newRole || undefined,
      }) });
      toast.success('Added');
      newEmail = ''; newOrgId = ''; newRole = '';
      await load();
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      toast.error(`Add failed (${status || 'network'})`);
    } finally { saving = false; }
  }

  async function remove(email: string): Promise<void> {
    try {
      await api(`/api/access/${encodeURIComponent(email)}`, { method: 'DELETE' });
      toast.success('Removed');
      await load();
    } catch {
      toast.error('Remove failed');
    }
  }
</script>

<div class="space-y-4 max-w-3xl">
  <header>
    <h1 class="text-xl font-semibold tracking-tight">Access</h1>
    <p class="text-sm text-[var(--color-muted)]">
      Individual emails the <code class="font-mono">DomainAllowlistPolicy</code> admits in addition to the domain rules.
    </p>
  </header>

  <form class="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end" onsubmit={add}>
    <Field label="Email" required>
      <Input type="email" bind:value={newEmail} required placeholder="user@example.com" />
    </Field>
    <Field label="Org ID (optional)">
      <Input type="text" bind:value={newOrgId} placeholder="acme" />
    </Field>
    <Field label="Role (optional)">
      <Input type="text" bind:value={newRole} placeholder="editor" />
    </Field>
    <Button type="submit" disabled={saving}>Add</Button>
  </form>

  {#if loading}
    <p class="text-sm text-[var(--color-muted)]">Loading…</p>
  {:else if items.length === 0}
    <p class="text-sm text-[var(--color-muted)]">No individual emails. Domain rules in <code class="font-mono">ALLOWED_DOMAINS</code> still apply.</p>
  {:else}
    <Table>
      <thead>
        <tr><th>Email</th><th>Org</th><th>Role</th><th>Added by</th><th></th></tr>
      </thead>
      <tbody>
        {#each items as e}
          <tr>
            <td class="font-mono text-xs">{e.email}</td>
            <td>{e.orgId ?? '—'}</td>
            <td>{e.role ?? '—'}</td>
            <td class="text-xs text-[var(--color-muted)]">{e.addedBy}</td>
            <td><Button variant="ghost" size="sm" onclick={() => remove(e.email)}>Remove</Button></td>
          </tr>
        {/each}
      </tbody>
    </Table>
  {/if}
</div>
```

- [ ] **Step 6.2: Build + commit**

```bash
pnpm build && pnpm typecheck
git add src/client/routes/SettingsAccessPage.svelte
git commit -m "$(cat <<'EOF'
feat(settings): /settings/access page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `/settings/users` page

**Files:**
- Create: `src/client/routes/SettingsUsersPage.svelte`

List users from `GET /api/users`. Inline edit of role + orgId via small form. Toggle ban via button. Patch via `PATCH /api/users/:email`.

- [ ] **Step 7.1: Implement**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$client/lib/api';
  import { toast } from '$client/lib/toast.svelte';
  import Button from '$client/lib/ui/Button.svelte';
  import Input from '$client/lib/ui/Input.svelte';
  import Pill from '$client/lib/ui/Pill.svelte';
  import Table from '$client/lib/ui/Table.svelte';

  interface UserRow {
    email: string;
    orgId: string | null;
    role: string | null;
    lastSeenAt: number;
    bannedAt: number | null;
  }

  let items = $state<UserRow[]>([]);
  let loading = $state(true);
  let editingEmail = $state<string | null>(null);
  let editOrgId = $state('');
  let editRole = $state('');

  async function load() {
    loading = true;
    try { items = await api<UserRow[]>('/api/users'); }
    catch { toast.error('Failed to load'); }
    finally { loading = false; }
  }
  onMount(load);

  function startEdit(u: UserRow): void {
    editingEmail = u.email;
    editOrgId = u.orgId ?? '';
    editRole = u.role ?? '';
  }

  async function saveEdit(email: string): Promise<void> {
    try {
      await api(`/api/users/${encodeURIComponent(email)}`, {
        method: 'PATCH',
        body: JSON.stringify({ orgId: editOrgId || null, role: editRole || null }),
      });
      toast.success('Saved');
      editingEmail = null;
      await load();
    } catch { toast.error('Save failed'); }
  }

  async function toggleBan(u: UserRow): Promise<void> {
    try {
      await api(`/api/users/${encodeURIComponent(u.email)}`, {
        method: 'PATCH',
        body: JSON.stringify({ banned: !u.bannedAt }),
      });
      toast.success(u.bannedAt ? 'Unbanned' : 'Banned');
      await load();
    } catch { toast.error('Failed'); }
  }

  function fmtTs(ts: number): string {
    return new Date(ts * 1000).toISOString().slice(0, 10);
  }
</script>

<div class="space-y-4 max-w-4xl">
  <header>
    <h1 class="text-xl font-semibold tracking-tight">Users</h1>
    <p class="text-sm text-[var(--color-muted)]">
      Created on first sign-in under domain / open registration policies.
    </p>
  </header>

  {#if loading}
    <p class="text-sm text-[var(--color-muted)]">Loading…</p>
  {:else if items.length === 0}
    <p class="text-sm text-[var(--color-muted)]">
      No users yet. (None are created under <code class="font-mono">EnvAllowlistPolicy</code>.)
    </p>
  {:else}
    <Table>
      <thead>
        <tr><th>Email</th><th>Org</th><th>Role</th><th>Last seen</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        {#each items as u}
          <tr>
            <td class="font-mono text-xs">{u.email}</td>
            {#if editingEmail === u.email}
              <td><Input type="text" bind:value={editOrgId} placeholder="—" /></td>
              <td><Input type="text" bind:value={editRole} placeholder="—" /></td>
            {:else}
              <td>{u.orgId ?? '—'}</td>
              <td>{u.role ?? '—'}</td>
            {/if}
            <td class="text-xs font-mono">{fmtTs(u.lastSeenAt)}</td>
            <td>{#if u.bannedAt}<Pill tone="error">banned</Pill>{:else}<Pill tone="success">active</Pill>{/if}</td>
            <td class="space-x-1">
              {#if editingEmail === u.email}
                <Button size="sm" onclick={() => saveEdit(u.email)}>Save</Button>
                <Button size="sm" variant="ghost" onclick={() => (editingEmail = null)}>Cancel</Button>
              {:else}
                <Button size="sm" variant="secondary" onclick={() => startEdit(u)}>Edit</Button>
                <Button size="sm" variant="ghost" onclick={() => toggleBan(u)}>{u.bannedAt ? 'Unban' : 'Ban'}</Button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </Table>
  {/if}
</div>
```

- [ ] **Step 7.2: Build + commit**

```bash
pnpm build && pnpm typecheck
git add src/client/routes/SettingsUsersPage.svelte
git commit -m "$(cat <<'EOF'
feat(settings): /settings/users page with inline edit + ban toggle

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `/settings/audit` page

**Files:**
- Create: `src/client/routes/SettingsAuditPage.svelte`

Recent audit log entries. Simple, no filters in first pass — just chronological list.

- [ ] **Step 8.1: Implement**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$client/lib/api';
  import { toast } from '$client/lib/toast.svelte';
  import Pill from '$client/lib/ui/Pill.svelte';
  import Table from '$client/lib/ui/Table.svelte';

  interface Entry {
    id: number;
    ts: number;
    actor_email: string | null;
    actor_role: string | null;
    action: string;
    resource_id: string | null;
    record_id: string | null;
    connection_id: string | null;
    detail_json: string | null;
    ip: string | null;
  }

  let items = $state<Entry[]>([]);
  let loading = $state(true);

  async function load() {
    loading = true;
    try { items = await api<Entry[]>('/api/audit?limit=200'); }
    catch { toast.error('Failed to load'); }
    finally { loading = false; }
  }
  onMount(load);

  function fmtTs(ts: number): string {
    return new Date(ts * 1000).toISOString().replace('T', ' ').slice(0, 19);
  }
  function tone(action: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
    if (action === 'sign_in') return 'success';
    if (action === 'sign_out') return 'neutral';
    if (action.startsWith('user.ban')) return 'error';
    if (action.startsWith('user.unban')) return 'success';
    if (action.startsWith('access.')) return 'info';
    if (action.startsWith('connection.')) return 'warning';
    if (action.startsWith('resource.create')) return 'info';
    if (action.startsWith('resource.update')) return 'info';
    if (action.startsWith('resource.delete')) return 'error';
    return 'neutral';
  }
</script>

<div class="space-y-4">
  <header>
    <h1 class="text-xl font-semibold tracking-tight">Audit log</h1>
    <p class="text-sm text-[var(--color-muted)]">Recent events. Latest 200.</p>
  </header>

  {#if loading}
    <p class="text-sm text-[var(--color-muted)]">Loading…</p>
  {:else if items.length === 0}
    <p class="text-sm text-[var(--color-muted)]">No entries yet.</p>
  {:else}
    <Table>
      <thead>
        <tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>IP</th></tr>
      </thead>
      <tbody>
        {#each items as e}
          <tr>
            <td class="font-mono text-xs">{fmtTs(e.ts)}</td>
            <td class="text-xs">{e.actor_email ?? '—'}</td>
            <td><Pill tone={tone(e.action)}>{e.action}</Pill></td>
            <td class="text-xs font-mono">
              {[e.connection_id, e.resource_id, e.record_id].filter(Boolean).join(' / ') || '—'}
            </td>
            <td class="text-xs font-mono text-[var(--color-muted)]">{e.ip ?? '—'}</td>
          </tr>
        {/each}
      </tbody>
    </Table>
  {/if}
</div>
```

- [ ] **Step 8.2: Build + commit**

```bash
pnpm build && pnpm typecheck
git add src/client/routes/SettingsAuditPage.svelte
git commit -m "$(cat <<'EOF'
feat(settings): /settings/audit page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Register settings routes in `app.svelte` + add Settings group to sidebar

**Files:**
- Modify: `src/client/app.svelte`
- Modify: `src/client/lib/shell/DefaultSidebar.svelte`

- [ ] **Step 9.1: In `app.svelte`** — add the four new routes inside `authedRoutes`:

```ts
const authedRoutes = {
  '/': Home,
  '/r/:id': ResourceListPage,
  '/r/:id/new': ResourceFormPage,
  '/r/:id/:recordId': ResourceDetailPage,
  '/r/:id/:recordId/edit': ResourceFormPage,
  '/settings/connections': SettingsConnectionsPage,
  '/settings/access': SettingsAccessPage,
  '/settings/users': SettingsUsersPage,
  '/settings/audit': SettingsAuditPage,
  '*': Home,
};
```

Add the imports at the top:

```ts
import SettingsConnectionsPage from './routes/SettingsConnectionsPage.svelte';
import SettingsAccessPage from './routes/SettingsAccessPage.svelte';
import SettingsUsersPage from './routes/SettingsUsersPage.svelte';
import SettingsAuditPage from './routes/SettingsAuditPage.svelte';
```

- [ ] **Step 9.2: In `DefaultSidebar.svelte`** — append a fixed "Settings" group AFTER the resource registry groups. Only show to admins (`session.value?.role === 'admin'`).

Add this at the top of the script (after imports):

```ts
import { session } from '$client/lib/session.svelte';

const settingsItems = [
  { href: '/settings/connections', label: 'Connections' },
  { href: '/settings/access',      label: 'Access' },
  { href: '/settings/users',       label: 'Users' },
  { href: '/settings/audit',       label: 'Audit' },
];
```

And append to the template, after the `{#each Object.entries(groups) as ...}` block (inside the `{#if registry.status === 'ready'}` branch — or unconditionally below it, since settings shouldn't depend on resources loading):

```svelte
{#if session.value?.role === 'admin'}
  <div>
    <div class="text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted)] font-medium px-2 mb-1">
      Settings
    </div>
    <ul class="space-y-0.5">
      {#each settingsItems as item}
        <li>
          <a
            href={item.href}
            use:link
            class="block px-2 py-1 rounded text-sm hover:bg-[var(--color-surface-2)] {isActive(item.href) ? 'bg-[var(--color-surface-2)] font-medium' : 'text-[var(--color-text-secondary)]'}"
          >
            {item.label}
          </a>
        </li>
      {/each}
    </ul>
  </div>
{/if}
```

- [ ] **Step 9.3: Build + commit**

```bash
pnpm build && pnpm typecheck
git add src/client/app.svelte src/client/lib/shell/DefaultSidebar.svelte
git commit -m "$(cat <<'EOF'
feat(settings): wire settings routes + admin-only sidebar group

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: `CloudflareEmailProvider` (TDD)

**Files:**
- Create: `src/worker/email/cloudflare-provider.ts`
- Create: `src/worker/email/cloudflare-provider.test.ts`

Uses the Workers `send_email` binding. Construction takes the binding + the from-address from env. In tests we use a stub binding that records the call instead of actually sending.

- [ ] **Step 10.1: Failing test — `src/worker/email/cloudflare-provider.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';
import { CloudflareEmailProvider } from './cloudflare-provider';

describe('CloudflareEmailProvider', () => {
  it('calls SEND_EMAIL.send with a properly formed RFC822 message', async () => {
    const sendMock = vi.fn().mockResolvedValue(undefined);
    const stubBinding = { send: sendMock } as unknown as SendEmail;
    const provider = new CloudflareEmailProvider(stubBinding, 'admin@example.com');

    await provider.sendMagicLink({
      email: 'user@example.com',
      magicLinkUrl: 'https://app.example.com/auth/callback?token=abc',
    });

    expect(sendMock).toHaveBeenCalledOnce();
    const message = sendMock.mock.calls[0][0] as { from: string; to: string; raw: string };
    expect(message.from).toBe('admin@example.com');
    expect(message.to).toBe('user@example.com');
    expect(message.raw).toContain('https://app.example.com/auth/callback?token=abc');
    expect(message.raw).toContain('Subject:');
  });

  it('throws if FROM_ADDRESS is empty', async () => {
    const stubBinding = { send: vi.fn() } as unknown as SendEmail;
    expect(() => new CloudflareEmailProvider(stubBinding, '')).toThrow();
  });
});
```

- [ ] **Step 10.2: Implement `src/worker/email/cloudflare-provider.ts`**

```ts
import type { EmailProvider } from './types';

/**
 * Cloudflare Email Workers provider — uses the `send_email` binding declared
 * in wrangler.toml. The destination address must be verified in Cloudflare
 * Email Routing before delivery succeeds. For an allowlist-style boilerplate,
 * that aligns naturally with the existing email allowlist.
 *
 * Production setup:
 *   1. Enable Email Routing on your domain in the Cloudflare dashboard.
 *   2. Verify each admin email as a destination address.
 *   3. Add `[[send_email]] name = "SEND_EMAIL"` to wrangler.toml.
 *   4. Set EMAIL_PROVIDER=cloudflare and FROM_ADDRESS=<verified-on-your-domain>.
 */
export class CloudflareEmailProvider implements EmailProvider {
  constructor(
    private readonly binding: SendEmail,
    private readonly fromAddress: string,
  ) {
    if (!fromAddress) {
      throw new Error('CloudflareEmailProvider requires FROM_ADDRESS to be set');
    }
  }

  async sendMagicLink(args: { email: string; magicLinkUrl: string }): Promise<void> {
    const raw = [
      `From: ${this.fromAddress}`,
      `To: ${args.email}`,
      `Subject: Your sign-in link`,
      `Content-Type: text/plain; charset=utf-8`,
      ``,
      `Click to sign in:`,
      ``,
      args.magicLinkUrl,
      ``,
      `If you didn't request this, ignore this email.`,
    ].join('\r\n');

    await this.binding.send({ from: this.fromAddress, to: args.email, raw });
  }
}
```

> Note: `SendEmail` is the Workers binding type from `@cloudflare/workers-types`. If the type isn't resolving, the binding type may be named `SendEmailType` or `MailChannelsBinding` depending on the workers-types version — use whichever exists.

- [ ] **Step 10.3: Pass + typecheck + commit**

```bash
pnpm test src/worker/email/cloudflare-provider.test.ts
pnpm typecheck
git add src/worker/email/cloudflare-provider.ts src/worker/email/cloudflare-provider.test.ts
git commit -m "$(cat <<'EOF'
feat(email): CloudflareEmailProvider using send_email binding

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: `ResendProvider` (TDD with fetchMock)

**Files:**
- Create: `src/worker/email/resend-provider.ts`
- Create: `src/worker/email/resend-provider.test.ts`

POSTs to `https://api.resend.com/emails` with `Authorization: Bearer <RESEND_API_KEY>`.

- [ ] **Step 11.1: Failing test**

```ts
import { fetchMock } from 'cloudflare:test';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ResendProvider } from './resend-provider';

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => fetchMock.assertNoPendingInterceptors());

describe('ResendProvider', () => {
  it('POSTs to api.resend.com with bearer auth and JSON body', async () => {
    fetchMock.get('https://api.resend.com').intercept({ path: '/emails', method: 'POST' })
      .reply(200, { id: 'em_123' });

    const provider = new ResendProvider({
      apiKey: 'test_key_abc',
      fromAddress: 'admin@example.com',
    });
    await provider.sendMagicLink({
      email: 'user@example.com',
      magicLinkUrl: 'https://app.example.com/auth/callback?token=xyz',
    });
  });

  it('throws on a non-2xx response', async () => {
    fetchMock.get('https://api.resend.com').intercept({ path: '/emails', method: 'POST' })
      .reply(403, { error: 'forbidden' });

    const provider = new ResendProvider({
      apiKey: 'test_key',
      fromAddress: 'admin@example.com',
    });
    await expect(
      provider.sendMagicLink({ email: 'a@b.com', magicLinkUrl: 'https://x.test/' }),
    ).rejects.toThrow();
  });

  it('throws if apiKey is empty', () => {
    expect(() => new ResendProvider({ apiKey: '', fromAddress: 'a@b.com' })).toThrow();
  });
});
```

- [ ] **Step 11.2: Implement `src/worker/email/resend-provider.ts`**

```ts
import type { EmailProvider } from './types';

interface Config {
  apiKey: string;
  fromAddress: string;
}

export class ResendProvider implements EmailProvider {
  constructor(private readonly config: Config) {
    if (!config.apiKey) throw new Error('ResendProvider requires apiKey');
    if (!config.fromAddress) throw new Error('ResendProvider requires fromAddress');
  }

  async sendMagicLink(args: { email: string; magicLinkUrl: string }): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.config.fromAddress,
        to: args.email,
        subject: 'Your sign-in link',
        text:
`Click to sign in:

${args.magicLinkUrl}

If you didn't request this, ignore this email.`,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`ResendProvider: ${res.status} ${text}`);
    }
  }
}
```

- [ ] **Step 11.3: Pass + typecheck + commit**

```bash
pnpm test src/worker/email/resend-provider.test.ts
pnpm typecheck
git add src/worker/email/resend-provider.ts src/worker/email/resend-provider.test.ts
git commit -m "$(cat <<'EOF'
feat(email): ResendProvider via api.resend.com

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Email factory update + SECRETS_KEY validation

**Files:**
- Modify: `src/worker/email/index.ts`
- Modify: `src/worker/lib/crypto.ts`
- Modify: `worker-configuration.d.ts` — add the `SEND_EMAIL` binding type if not present.

- [ ] **Step 12.1: `src/worker/email/index.ts`**

```ts
import { CloudflareEmailProvider } from './cloudflare-provider';
import { ConsoleProvider } from './console-provider';
import { ResendProvider } from './resend-provider';
import type { EmailProvider } from './types';

export type { EmailProvider } from './types';

export function getEmailProvider(env: Env): EmailProvider {
  const which = env.EMAIL_PROVIDER ?? 'console';
  switch (which) {
    case 'console':
      return new ConsoleProvider();
    case 'cloudflare': {
      if (!env.SEND_EMAIL) {
        throw new Error('EMAIL_PROVIDER=cloudflare requires the SEND_EMAIL binding to be declared in wrangler.toml');
      }
      if (!env.FROM_ADDRESS) {
        throw new Error('EMAIL_PROVIDER=cloudflare requires FROM_ADDRESS');
      }
      return new CloudflareEmailProvider(env.SEND_EMAIL, env.FROM_ADDRESS);
    }
    case 'resend': {
      if (!env.RESEND_API_KEY) {
        throw new Error('EMAIL_PROVIDER=resend requires RESEND_API_KEY');
      }
      if (!env.FROM_ADDRESS) {
        throw new Error('EMAIL_PROVIDER=resend requires FROM_ADDRESS');
      }
      return new ResendProvider({ apiKey: env.RESEND_API_KEY, fromAddress: env.FROM_ADDRESS });
    }
    default:
      throw new Error(`Unknown EMAIL_PROVIDER: ${which}. Expected one of: console, cloudflare, resend.`);
  }
}
```

- [ ] **Step 12.2: Add `SEND_EMAIL?: SendEmail` to `worker-configuration.d.ts`** (in the existing `Env` interface).

- [ ] **Step 12.3: SECRETS_KEY validation in `src/worker/lib/crypto.ts`** — add a sanity check inside `rootKey` so a malformed key fails fast with a useful message instead of throwing inside `atob`:

Wrap the body of `base64ToBytes` like this (or add a check inside `rootKey`):

```ts
async function rootKey(rootKeyB64: string): Promise<CryptoKey> {
  let raw: Uint8Array;
  try {
    raw = base64ToBytes(rootKeyB64);
  } catch (err) {
    throw new Error(
      `SECRETS_KEY is not valid base64. Generate one with: openssl rand -base64 32`,
    );
  }
  if (raw.byteLength < 16) {
    throw new Error(
      `SECRETS_KEY must decode to at least 16 bytes (got ${raw.byteLength}). Generate one with: openssl rand -base64 32`,
    );
  }
  return crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey']);
}
```

Make sure existing crypto tests still pass.

- [ ] **Step 12.4: Run full suite + typecheck + commit**

```bash
pnpm test 2>&1 | tail -8
pnpm typecheck
git add src/worker/email/index.ts src/worker/lib/crypto.ts worker-configuration.d.ts
git commit -m "$(cat <<'EOF'
feat(email,crypto): factory selects cloudflare/resend; clearer SECRETS_KEY errors

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: ResourceTable cursor pagination

**Files:**
- Modify: `src/client/lib/resource/ResourceTable.svelte`
- Modify: `src/worker/resources/proxy.ts` — pass through query params correctly (it already does via `query`).
- Modify: `src/worker/resources/routes.ts` — pass `cursorParam` info to the client by including upstream pagination headers OR just relying on the response. Simplest: SPA tracks the last seen cursor manually.

Approach: simple "Next" button. When clicked, takes the last record's primary value and appends `?starting_after=<value>` (or whatever the resource's `cursorParam` says). No "Prev" in first pass — too easy to mess up; users can browser-back.

- [ ] **Step 13.1: Add cursor handling to `ResourceTable.svelte`**

In the existing `ResourceTable.svelte`, find the `load()` function and replace it with one that takes an optional cursor; add a Next button.

```ts
// inside <script>
let cursor = $state<string | null>(null);
let hasMore = $state(false);

async function load(c: string | null = null) {
  loading = true;
  errorMsg = null;
  try {
    const path = c
      ? `/api/resources/${resource.id}/list?${resource.list.cursorParam ?? 'starting_after'}=${encodeURIComponent(c)}`
      : `/api/resources/${resource.id}/list`;
    const data = await api<Row[] | Row>(path);
    const newRows = Array.isArray(data) ? data : ((data as { data?: Row[] }).data ?? []);
    rows = newRows;
    // Heuristic: if we got a full page (e.g. 10+), there's likely more.
    hasMore = newRows.length >= 10 && Boolean(resource.list.cursorParam) && Boolean(primaryField);
  } catch (err) {
    // ... existing handler
  } finally {
    loading = false;
  }
}

function next() {
  if (!hasMore || !primaryField) return;
  const last = rows[rows.length - 1];
  const lastId = last[primaryField.key];
  if (lastId !== undefined) {
    cursor = String(lastId);
    load(cursor);
  }
}
```

Add a Next button below the Table:

```svelte
{#if hasMore && !loading}
  <div class="flex justify-end pt-2">
    <Button variant="secondary" onclick={next}>Next →</Button>
  </div>
{/if}
```

- [ ] **Step 13.2: Build + commit**

```bash
pnpm build && pnpm typecheck
git add src/client/lib/resource/ResourceTable.svelte
git commit -m "$(cat <<'EOF'
feat(resource): cursor pagination Next button on ResourceTable

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: README quickstart

**Files:**
- Modify: `README.md`

Real quickstart that *works*. Includes the openssl-rand step we hit during Plan 3's smoke test.

- [ ] **Step 14.1: Replace `README.md` contents**

```markdown
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

## Concepts

- **Connections** declare API services your admin proxies (Stripe, GitHub, your own backend, etc.). Defined in `src/connections/<id>.ts`. Secrets stored encrypted in D1, set via Settings → Connections.
- **Resources** declare CRUD-able collections inside a connection. Defined in `src/resources/<id>.ts`. The Worker auto-exposes list/detail/create/update/delete endpoints; the SPA auto-renders the UI.
- **Access policies** decide who can sign in. Three v1 policies: `EnvAllowlistPolicy` (static admin email list), `DomainAllowlistPolicy` (email domains + bulk individual emails), `OpenRegistrationPolicy` (anyone signs up).

## Adding things

- **Add a resource:** [docs/adding-a-resource.md](docs/adding-a-resource.md)
- **Customise the shell (left rail, top bar switcher, subnav):** [docs/customising-the-shell.md](docs/customising-the-shell.md)

## License

MIT — see [LICENSE](LICENSE).
```

- [ ] **Step 14.2: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: real README quickstart with working setup walkthrough

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Three docs files

**Files:**
- Create: `docs/deploy.md`
- Create: `docs/adding-a-resource.md`
- Create: `docs/customising-the-shell.md`

- [ ] **Step 15.1: `docs/deploy.md`**

```markdown
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
```

- [ ] **Step 15.2: `docs/adding-a-resource.md`**

```markdown
# Adding a resource

Two file edits, no rebuild needed beyond `pnpm dev:all` hot-reload.

## 1. Define the resource

Create `src/resources/<id>.ts`. Example:

```ts
import { defineResource } from '../worker/resources/define';

export default defineResource({
  id: 'stripe-customers',
  connection: 'stripe',       // must match a connection in src/connections/
  name: 'Customers',
  group: 'Stripe',             // sidebar group; optional
  list:   { method: 'GET', path: '/v1/customers', dataPath: 'data', cursorParam: 'starting_after' },
  detail: { method: 'GET', path: '/v1/customers/:id' },
  // Mutations are opt-in: must set `enabled: true` for the route to be live.
  update: { method: 'POST',   path: '/v1/customers/:id', enabled: true },
  delete: { method: 'DELETE', path: '/v1/customers/:id', enabled: true },
  fields: [
    { key: 'id',      label: 'ID',     type: 'string', primary: true, monospace: true },
    { key: 'email',   label: 'Email',  type: 'email',  tableColumn: true, searchable: true },
    { key: 'name',    label: 'Name',   type: 'string', tableColumn: true, editable: true },
    { key: 'created', label: 'Joined', type: 'unix-ts', tableColumn: true, readOnly: true },
  ],
});
```

## 2. Register it

Edit `src/resources/index.ts` and add the import + array entry:

```ts
import stripeCustomers from './stripe-customers';

export const resources: Resource[] = [
  jsonplaceholderPosts,
  stripeCustomers,         // ← add here
];
```

## 3. (If new connection) define the connection

If the resource references a connection that doesn't exist yet, also:

- Create `src/connections/<id>.ts`
- Register it in `src/connections/index.ts`
- After redeploy, configure the secret via Settings → Connections.

## Field types

`string | text | email | url | number | integer | boolean | date | unix-ts | enum | json | image-url | currency`

Each field also accepts: `tableColumn`, `searchable`, `editable`, `readOnly`, `required`, `primary`, `monospace`, `collapsible`, `format`, `enumOptions`.

## Templating

Paths support these placeholders:

- `:id` (or any `:paramName`) — record id / route param
- `:query.<key>` — URL query param
- `:session.userId | email | orgId | role` — current session metadata. **Used for row-level scoping in multi-tenant forks** (e.g. `path: '/orgs/:session.orgId/projects'`). If a session field is null, the request is rejected with 403.
```

- [ ] **Step 15.3: `docs/customising-the-shell.md`**

```markdown
# Customising the shell

The AppShell is a CSS Grid with eight named slots. Forks override only what they need by passing snippet props.

## Slots

| Slot | Position | Default |
|---|---|---|
| `leftRail` | Full-height column, far left | Empty |
| `topbarLeft` | Top bar, left | Empty |
| `topbarCenter` | Top bar, middle | Empty |
| `topbarRight` | Top bar, right | Theme toggle + user + sign-out |
| `subnav` | Strip below top bar | Empty |
| `sidebar` | Column right of left-rail | Auto-generated resource nav + Settings group |
| `main` | Centre content area | Routed page |
| `aside` | Right column | Empty |

The three-level navigation hierarchy:

- **Left rail** → workspace / org / account switcher (Slack-style)
- **Topbar centre** → entity-within-org switcher (film, project, customer)
- **Sidebar** → navigation within the current entity (resources, settings)

## Fork example — workspace switcher in the left rail

`src/client/app.svelte`:

```svelte
<script lang="ts">
  // ... existing imports
  import WorkspaceSwitcher from './lib/your-stuff/WorkspaceSwitcher.svelte';
  import EntitySwitcher from './lib/your-stuff/EntitySwitcher.svelte';
  import SectionTabs from './lib/your-stuff/SectionTabs.svelte';
</script>

{#if session.status === 'authed'}
  <AppShell>
    {#snippet leftRail()}<WorkspaceSwitcher />{/snippet}
    {#snippet topbarCenter()}<EntitySwitcher />{/snippet}
    {#snippet subnav()}<SectionTabs />{/snippet}

    {#snippet main()}
      <Router routes={authedRoutes} />
    {/snippet}
  </AppShell>
{/if}
```

That's it. Unfilled slots collapse their grid tracks to zero. Defaults stay in place for the slots you don't pass.

## Replacing the sidebar entirely

If the auto-generated sidebar isn't what you want, pass your own:

```svelte
<AppShell>
  {#snippet sidebar()}<MyCustomSidebar />{/snippet}
  {#snippet main()}<Router routes={authedRoutes} />{/snippet}
</AppShell>
```
```

- [ ] **Step 15.4: Commit**

```bash
mkdir -p docs
git add docs/deploy.md docs/adding-a-resource.md docs/customising-the-shell.md
git commit -m "$(cat <<'EOF'
docs: deploy.md + adding-a-resource.md + customising-the-shell.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Final pre-flight (automated + manual)

- [ ] **Step 16.1: Full suite + typecheck + build + worker dry-run**

```bash
lsof -ti :8787 | xargs kill 2>/dev/null
pnpm test 2>&1 | tail -8
pnpm typecheck
rm -rf dist .wrangler/dry-run node_modules/.vite
pnpm build 2>&1 | tail -6
pnpm dlx wrangler deploy --dry-run --outdir .wrangler/dry-run 2>&1 | tail -10
```

Expected: ~120 tests pass (was 100; +6 access, +4 users, +2 audit, +2 cloudflare-provider, +3 resend-provider). Worker bundle grows ~10 KB.

- [ ] **Step 16.2: Manual smoke test** — controller runs

1. `pnpm dev:all`, sign in as admin
2. See Settings group in sidebar with 4 entries
3. /settings/connections — see jsonplaceholder listed, `unconfigured`. Click Configure → form for `type: none` → Save → flips to `configured` + toast.
4. /settings/users — empty (allowlist policy = no users table rows)
5. /settings/access — shows the access form + empty table
6. /settings/audit — see the `connection.secret_set` entry we just created
7. Existing flow: `/r/jsonplaceholder-posts` still works → table, detail, edit, create, redirect-to-list, theme toggle.

Hand off DONE to controller.

---

### Task 17: Push + open PR

- [ ] **Step 17.1: Push**

```bash
git push -u origin feature/settings-email-docs
```

- [ ] **Step 17.2: PR**

```bash
gh pr create --base main --head feature/settings-email-docs \
  --title "Settings UI + production email + docs" \
  --body "$(cat <<'EOF'
## Summary
- Four \`/settings/*\` admin pages on top of the substrate from Plans 2 + 3:
  - **Connections** — set / rotate per-auth-type secrets, see configured status
  - **Access** — \`allowed_emails\` CRUD with audit
  - **Users** — list, inline-edit role + orgId, ban / unban (ban also revokes sessions)
  - **Audit** — recent 200 entries with tone-coded action pills
- New admin endpoints: \`/api/access\`, \`/api/users\`, \`/api/audit\`. All admin-only, all mutations write audit.
- **CloudflareEmailProvider** (via the \`send_email\` binding) and **ResendProvider** (via api.resend.com). Factory picks based on \`EMAIL_PROVIDER\` env. \`console\` remains the dev default.
- Carried-over fixes: \`SECRETS_KEY\` shape validation in \`crypto.ts\` (clear error instead of "Internal Server Error" on bad base64); ResourceTable cursor-pagination Next button.
- Real README quickstart and three docs files: deploy, adding-a-resource, customising-the-shell.

## What's NOT in this PR
- **Tauri desktop wrapper** — moved to Plan 6 (independent build target, doesn't touch web code).
- Audit log filters (action / actor / date range) — first pass is unfiltered.
- "Prev" pagination on ResourceTable — only Next for now (browser-back works for prev).
- CAPTCHA enforcement on \`OpenRegistrationPolicy\` — env var declared, integration deferred.

## Test plan
- [x] \`pnpm test\` — ~120 tests pass
- [x] \`pnpm typecheck\` — clean
- [x] \`pnpm build\` — clean
- [x] \`wrangler deploy --dry-run\` — clean
- [x] \`pnpm dev:all\` — sign in, see Settings group, configure jsonplaceholder via Settings, verify audit, browse resources, theme toggle, sign out

## Design
Spec: [\`docs/superpowers/specs/2026-05-13-admin-boilerplate-design.md\`](docs/superpowers/specs/2026-05-13-admin-boilerplate-design.md) (§4.2, §4.3 settings routes; §5.4 ban behaviour)
Plan: [\`docs/superpowers/plans/2026-05-15-05-settings-email-docs.md\`](docs/superpowers/plans/2026-05-15-05-settings-email-docs.md)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage** against the design doc:
- §4.2 admin endpoints (`/api/access`, `/api/users`, `/api/audit`) — Tasks 2–4 ✓
- §4.3 SPA settings routes — Tasks 5–9 ✓
- §5.4 banning revokes all sessions — Task 3 ✓
- §3 production email providers (`CloudflareEmailProvider`, `ResendProvider`) — Tasks 10–12 ✓
- §12 env var documentation — Task 15 ✓
- §13 phase-2 deferrals respected — Tauri, CAPTCHA, audit filters, prev-pagination all explicitly out ✓

**Placeholder scan** — none.

**Type consistency** — endpoint response shapes match the SPA's interface declarations (camelCase translation done in the route handlers, SPA reads them directly).

**Scope** — 17 tasks. Each task small (avg ~10–15 minutes of subagent time). Backend tasks have TDD; SPA tasks are mechanical and rely on the established primitives.
