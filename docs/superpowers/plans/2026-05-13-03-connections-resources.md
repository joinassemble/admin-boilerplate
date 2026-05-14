# Plan 3 — Connections + Resources Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the unique-value-prop of the boilerplate end-to-end: declare a typed `defineConnection(...)` and a typed `defineResource(...)` in source files; the Worker auto-registers them at build time, exposes a schema endpoint (`GET /api/resources`), and proxies CRUD through encrypted-at-rest connection secrets stored in D1. Includes `:session.*` path templating for fork-level row scoping, audit-log writes on every mutation, and a working example (JSONPlaceholder) that proves the loop with zero external configuration.

**Architecture:**

```
        ┌──────────────── SPA ────────────────┐
        │ GET /api/resources                  │  schema (no secrets)
        │ GET /api/resources/:id/list         │  → proxied to external API
        │ GET /api/resources/:id/detail/:rid  │
        │ POST   /api/resources/:id           │  + audit
        │ PATCH  /api/resources/:id/:rid      │  + audit
        │ DELETE /api/resources/:id/:rid      │  + audit
        │ GET    /api/connections             │  admin-only
        │ PUT    /api/connections/:id         │  admin-only, audit
        └──────┬──────────────────────────────┘
               │
        ┌──────▼──────────── Worker ─────────────┐
        │ Build-time:                            │
        │  src/connections/*.ts ─┐               │
        │  src/resources/*.ts   ─┴► import.meta  │
        │                          .glob registry │
        │ Runtime:                               │
        │  connection_secrets (D1, AES-GCM)      │
        │  audit_log (D1) writes on mutations    │
        │  session (Plan 2) → :session.* templating│
        └──────┬──────────────────────────────┬──┘
               │                              │
               ▼ outbound fetch + auth header │
        ┌──────────────────┐                  ▼
        │ External API     │            ┌─────────────┐
        │ (Stripe, GitHub, │            │ Decrypt     │
        │  jsonplaceholder)│            │ secret JSON │
        └──────────────────┘            └─────────────┘
```

**Tech Stack:** Same as Plan 2. New runtime concern: `fetchMock` from `@cloudflare/vitest-pool-workers/test-runtime` for mocking outbound API calls in tests.

---

## Prerequisites

- Plan 2 merged to `main`. Local `main` synced.
- D1 schema unchanged from Plan 1 (`connection_secrets`, `audit_log` already exist).
- Worker `SECRETS_KEY` not yet wired into a deploy (we're still dev-only); for tests, the vitest pool will set it explicitly.
- Crypto helpers from Plan 1 (`src/worker/lib/crypto.ts`) and audit writer from Plan 2 (`src/worker/audit/writer.ts`) are the substrate this plan consumes.

---

## Files Created / Modified by this Plan

```
src/
├── worker/
│   ├── index.ts                            # MODIFY: register resource + connection routes
│   ├── shared/                             # cross-Worker types (resources, connections) — exposed to SPA via /api/resources
│   ├── connections/
│   │   ├── types.ts                        # new: Connection + ConnectionAuth (discriminated union)
│   │   ├── define.ts                       # new: defineConnection helper
│   │   ├── registry.ts                     # new: import.meta.glob loader
│   │   ├── auth-header.ts                  # new: builds outbound auth header from auth type + secret
│   │   ├── auth-header.test.ts             # new
│   │   ├── secrets.ts                      # new: encrypt + store + read + decrypt connection secrets
│   │   ├── secrets.test.ts                 # new
│   │   ├── routes.ts                       # new: GET /api/connections, PUT /api/connections/:id
│   │   └── routes.test.ts                  # new
│   ├── resources/
│   │   ├── types.ts                        # new: Resource, Field, FieldType
│   │   ├── define.ts                       # new: defineResource helper
│   │   ├── registry.ts                     # new: import.meta.glob loader
│   │   ├── templating.ts                   # new: :session.*, :query.*, :param replacements
│   │   ├── templating.test.ts              # new
│   │   ├── proxy.ts                        # new: outbound request builder + response normaliser
│   │   ├── proxy.test.ts                   # new (fetchMock-based)
│   │   ├── routes.ts                       # new: /api/resources endpoints
│   │   └── routes.test.ts                  # new
├── shared/
│   └── resource-schema.ts                  # new: types reused by SPA when rendering resources
├── connections/                            # USER-DEFINED area
│   └── jsonplaceholder.ts                  # new: example, ships with the boilerplate
└── resources/                              # USER-DEFINED area
    └── jsonplaceholder-posts.ts            # new: example resource
```

---

## Tasks

### Task 1: Branch + commit Plan 3 doc

- [ ] **Step 1.1: New working branch**

```bash
git checkout main
git pull origin main
git checkout -b feature/connections-resources
```

- [ ] **Step 1.2: Commit the plan doc**

```bash
git add docs/superpowers/plans/2026-05-13-03-connections-resources.md
git commit -m "$(cat <<'EOF'
docs: add Plan 3 — connections + resources backend plan

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Connection types + `defineConnection` helper

**Files:**
- Create: `src/worker/connections/types.ts`
- Create: `src/worker/connections/define.ts`
- Create: `src/worker/connections/define.test.ts`

- [ ] **Step 2.1: `src/worker/connections/types.ts`**

```ts
/**
 * A Connection describes ONE external service the Worker proxies.
 * Declared in code at `src/connections/<id>.ts`.
 *
 * The auth `type` selects what shape of secret D1 will hold for this
 * connection. The actual secret values are NEVER in code — only the
 * structural declaration.
 */

export type ConnectionAuth =
  | { type: 'none' }
  | { type: 'bearer' }
  | { type: 'header'; headerName: string }
  | { type: 'basic' };

export interface Connection {
  id: string;
  name: string;
  baseUrl: string;
  auth: ConnectionAuth;
}

/**
 * Shape of the (encrypted) JSON blob stored in `connection_secrets.ciphertext`
 * for each auth type. The Worker never returns these to the SPA — they're
 * only decrypted at outbound-fetch time.
 */
export type ConnectionSecret =
  | { type: 'none' } // empty, but stored so `isConfigured` is true
  | { type: 'bearer'; token: string }
  | { type: 'header'; value: string }
  | { type: 'basic'; username: string; password: string };
```

- [ ] **Step 2.2: Failing test — `src/worker/connections/define.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { defineConnection } from './define';

describe('defineConnection', () => {
  it('returns the connection object verbatim (declarative helper)', () => {
    const c = defineConnection({
      id: 'stripe',
      name: 'Stripe',
      baseUrl: 'https://api.stripe.com',
      auth: { type: 'bearer' },
    });
    expect(c).toEqual({
      id: 'stripe',
      name: 'Stripe',
      baseUrl: 'https://api.stripe.com',
      auth: { type: 'bearer' },
    });
  });

  it('preserves header auth config including headerName', () => {
    const c = defineConnection({
      id: 'custom',
      name: 'Custom',
      baseUrl: 'https://example.com',
      auth: { type: 'header', headerName: 'X-API-Key' },
    });
    expect(c.auth).toEqual({ type: 'header', headerName: 'X-API-Key' });
  });
});
```

- [ ] **Step 2.3: Run, confirm failure.**

- [ ] **Step 2.4: Implement `src/worker/connections/define.ts`**

```ts
import type { Connection } from './types';

/**
 * Type-checked identity helper. Doesn't transform the input — its
 * job is to give consumers full type inference on the literal config
 * object and to mark intent. `as const` is implicit via type widening.
 */
export function defineConnection<C extends Connection>(c: C): C {
  return c;
}
```

- [ ] **Step 2.5: Pass, typecheck, commit**

```bash
pnpm test src/worker/connections/define.test.ts
pnpm typecheck
git add src/worker/connections/types.ts src/worker/connections/define.ts src/worker/connections/define.test.ts
git commit -m "$(cat <<'EOF'
feat(connections): Connection types + defineConnection helper

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Outbound auth-header builder (TDD)

**Files:**
- Create: `src/worker/connections/auth-header.ts`
- Create: `src/worker/connections/auth-header.test.ts`

Pure function: given a `Connection.auth` and the decrypted `ConnectionSecret`, return a `HeadersInit` object to spread into the outbound `fetch`.

- [ ] **Step 3.1: Failing test**

```ts
// src/worker/connections/auth-header.test.ts
import { describe, expect, it } from 'vitest';
import { buildAuthHeaders } from './auth-header';

describe('buildAuthHeaders', () => {
  it('returns empty for type=none', () => {
    expect(buildAuthHeaders({ type: 'none' }, { type: 'none' })).toEqual({});
  });

  it('adds Authorization: Bearer for type=bearer', () => {
    const h = buildAuthHeaders({ type: 'bearer' }, { type: 'bearer', token: 'sk_test_xyz' });
    expect(h).toEqual({ Authorization: 'Bearer sk_test_xyz' });
  });

  it('adds custom header for type=header', () => {
    const h = buildAuthHeaders(
      { type: 'header', headerName: 'X-API-Key' },
      { type: 'header', value: 'secret123' },
    );
    expect(h).toEqual({ 'X-API-Key': 'secret123' });
  });

  it('adds Authorization: Basic base64(user:pass) for type=basic', () => {
    const h = buildAuthHeaders(
      { type: 'basic' },
      { type: 'basic', username: 'admin', password: 'hunter2' },
    );
    expect(h).toEqual({ Authorization: `Basic ${btoa('admin:hunter2')}` });
  });

  it('throws if auth type and secret type disagree (defensive)', () => {
    expect(() =>
      // @ts-expect-error — deliberate mismatch
      buildAuthHeaders({ type: 'bearer' }, { type: 'basic', username: 'x', password: 'y' }),
    ).toThrow();
  });
});
```

- [ ] **Step 3.2: Run, confirm failure.**

- [ ] **Step 3.3: Implement `src/worker/connections/auth-header.ts`**

```ts
import type { ConnectionAuth, ConnectionSecret } from './types';

/**
 * Build the outbound auth headers for a Connection given its declared
 * auth type and the decrypted secret blob. Throws if the secret shape
 * doesn't match the declared type — that's a programming error
 * (someone stored a malformed secret), not a runtime input.
 */
export function buildAuthHeaders(auth: ConnectionAuth, secret: ConnectionSecret): Record<string, string> {
  if (auth.type !== secret.type) {
    throw new Error(`Connection auth.type (${auth.type}) does not match secret.type (${secret.type})`);
  }

  switch (auth.type) {
    case 'none':
      return {};
    case 'bearer':
      if (secret.type !== 'bearer') throw new Error('unreachable');
      return { Authorization: `Bearer ${secret.token}` };
    case 'header':
      if (secret.type !== 'header') throw new Error('unreachable');
      return { [auth.headerName]: secret.value };
    case 'basic': {
      if (secret.type !== 'basic') throw new Error('unreachable');
      const encoded = btoa(`${secret.username}:${secret.password}`);
      return { Authorization: `Basic ${encoded}` };
    }
  }
}
```

- [ ] **Step 3.4: Pass, typecheck, commit**

```bash
pnpm test src/worker/connections/auth-header.test.ts
pnpm typecheck
git add src/worker/connections/auth-header.ts src/worker/connections/auth-header.test.ts
git commit -m "$(cat <<'EOF'
feat(connections): outbound auth-header builder for bearer/header/basic/none

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Connection secrets storage (TDD)

**Files:**
- Create: `src/worker/connections/secrets.ts`
- Create: `src/worker/connections/secrets.test.ts`

`setConnectionSecret(db, connectionId, plaintext, rootKey, actorEmail)` and `getConnectionSecret(db, connectionId, rootKey)` and `deleteConnectionSecret(db, connectionId)`.

- [ ] **Step 4.1: Failing test**

```ts
// src/worker/connections/secrets.test.ts
import { env } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import {
  deleteConnectionSecret,
  getConnectionSecret,
  isConnectionConfigured,
  setConnectionSecret,
} from './secrets';

const ROOT_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

afterEach(async () => {
  await env.DB.prepare('DELETE FROM connection_secrets').run();
});

describe('connection secrets', () => {
  it('round-trips a bearer secret through D1 + AES-GCM', async () => {
    await setConnectionSecret(
      env.DB,
      'stripe',
      { type: 'bearer', token: 'sk_test_abc' },
      ROOT_KEY,
      'admin@example.com',
    );
    const got = await getConnectionSecret(env.DB, 'stripe', ROOT_KEY);
    expect(got).toEqual({ type: 'bearer', token: 'sk_test_abc' });
  });

  it('round-trips a basic secret', async () => {
    await setConnectionSecret(
      env.DB,
      'jira',
      { type: 'basic', username: 'admin', password: 'hunter2' },
      ROOT_KEY,
      'admin@example.com',
    );
    const got = await getConnectionSecret(env.DB, 'jira', ROOT_KEY);
    expect(got).toEqual({ type: 'basic', username: 'admin', password: 'hunter2' });
  });

  it('setConnectionSecret overwrites any prior value (rotation)', async () => {
    await setConnectionSecret(env.DB, 'stripe', { type: 'bearer', token: 'old' }, ROOT_KEY, 'admin@example.com');
    await setConnectionSecret(env.DB, 'stripe', { type: 'bearer', token: 'new' }, ROOT_KEY, 'admin@example.com');
    const got = await getConnectionSecret(env.DB, 'stripe', ROOT_KEY);
    expect(got).toEqual({ type: 'bearer', token: 'new' });
  });

  it('isConnectionConfigured returns true when a secret exists', async () => {
    expect(await isConnectionConfigured(env.DB, 'stripe')).toBe(false);
    await setConnectionSecret(env.DB, 'stripe', { type: 'bearer', token: 'x' }, ROOT_KEY, 'admin@example.com');
    expect(await isConnectionConfigured(env.DB, 'stripe')).toBe(true);
  });

  it('getConnectionSecret returns null when missing', async () => {
    expect(await getConnectionSecret(env.DB, 'absent', ROOT_KEY)).toBeNull();
  });

  it('deleteConnectionSecret removes the row', async () => {
    await setConnectionSecret(env.DB, 'stripe', { type: 'bearer', token: 'x' }, ROOT_KEY, 'admin@example.com');
    await deleteConnectionSecret(env.DB, 'stripe');
    expect(await getConnectionSecret(env.DB, 'stripe', ROOT_KEY)).toBeNull();
  });

  it('getConnectionSecret throws on wrong root key (tamper-evident)', async () => {
    await setConnectionSecret(env.DB, 'stripe', { type: 'bearer', token: 'x' }, ROOT_KEY, 'admin@example.com');
    const wrong = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBA=';
    await expect(getConnectionSecret(env.DB, 'stripe', wrong)).rejects.toThrow();
  });
});
```

- [ ] **Step 4.2: Run, confirm failure.**

- [ ] **Step 4.3: Implement `src/worker/connections/secrets.ts`**

```ts
import { decryptJson, encryptJson } from '../lib/crypto';
import type { ConnectionSecret } from './types';

interface SecretRow {
  ciphertext: ArrayBuffer;
  iv: ArrayBuffer;
}

export async function setConnectionSecret(
  db: D1Database,
  connectionId: string,
  secret: ConnectionSecret,
  rootKey: string,
  actorEmail: string,
): Promise<void> {
  const encrypted = await encryptJson(secret, rootKey, connectionId);
  const now = Math.floor(Date.now() / 1000);
  // Use INSERT ... ON CONFLICT to upsert.
  await db
    .prepare(
      `INSERT INTO connection_secrets (connection_id, ciphertext, iv, last_rotated_at, last_rotated_by)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(connection_id) DO UPDATE SET
         ciphertext = excluded.ciphertext,
         iv = excluded.iv,
         last_rotated_at = excluded.last_rotated_at,
         last_rotated_by = excluded.last_rotated_by`,
    )
    .bind(connectionId, encrypted.ciphertext, encrypted.iv, now, actorEmail)
    .run();
}

export async function getConnectionSecret(
  db: D1Database,
  connectionId: string,
  rootKey: string,
): Promise<ConnectionSecret | null> {
  const row = await db
    .prepare('SELECT ciphertext, iv FROM connection_secrets WHERE connection_id = ?')
    .bind(connectionId)
    .first<SecretRow>();
  if (!row) return null;
  // D1 BLOBs come back as ArrayBuffer; crypto helpers expect Uint8Array.
  return decryptJson<ConnectionSecret>(
    { ciphertext: new Uint8Array(row.ciphertext), iv: new Uint8Array(row.iv) },
    rootKey,
    connectionId,
  );
}

export async function isConnectionConfigured(db: D1Database, connectionId: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 FROM connection_secrets WHERE connection_id = ? LIMIT 1')
    .bind(connectionId)
    .first<{ '1': number }>();
  return row !== null;
}

export async function deleteConnectionSecret(db: D1Database, connectionId: string): Promise<void> {
  await db.prepare('DELETE FROM connection_secrets WHERE connection_id = ?').bind(connectionId).run();
}
```

- [ ] **Step 4.4: Pass (7 tests), typecheck, commit**

```bash
pnpm test src/worker/connections/secrets.test.ts
pnpm typecheck
git add src/worker/connections/secrets.ts src/worker/connections/secrets.test.ts
git commit -m "$(cat <<'EOF'
feat(connections): encrypted secret storage in D1 with rotation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Connection registry (build-time glob)

**Files:**
- Create: `src/worker/connections/registry.ts`
- Create: `src/connections/.gitkeep` already exists from Plan 1 — that's where user-defined connections will live.

- [ ] **Step 5.1: Implement `src/worker/connections/registry.ts`**

```ts
import type { Connection } from './types';

// Eager glob — all matching files are imported at build time.
// The user-defined area is `src/connections/*.ts` (sibling of `src/worker/`).
// Vite resolves this relative to THIS file, so `../../connections/*.ts`.
const modules = import.meta.glob<{ default: Connection }>('../../connections/*.ts', {
  eager: true,
});

const byId = new Map<string, Connection>();
for (const [path, mod] of Object.entries(modules)) {
  const c = mod.default;
  if (!c?.id) {
    throw new Error(`Connection module ${path} is missing a default export with an .id`);
  }
  if (byId.has(c.id)) {
    throw new Error(`Duplicate connection id "${c.id}" (from ${path})`);
  }
  byId.set(c.id, c);
}

export function listConnections(): Connection[] {
  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export function getConnection(id: string): Connection | undefined {
  return byId.get(id);
}
```

> **NOTE:** the relative path in `import.meta.glob` is computed from the CURRENT FILE. `src/worker/connections/registry.ts` → `../../connections/*.ts` = `src/connections/*.ts` (`..` → `src/worker/`, `../..` → `src/`, `../../connections/` → `src/connections/`). Double-check after building.

- [ ] **Step 5.2: Quick verification** — try to build, expect no errors (no connections yet means an empty Map, no compile failure).

```bash
pnpm typecheck
```

If typecheck complains about empty glob result, that's fine — `eager: true` returns `{}`, the loop simply doesn't iterate.

- [ ] **Step 5.3: Commit**

```bash
git add src/worker/connections/registry.ts
git commit -m "$(cat <<'EOF'
feat(connections): build-time registry via import.meta.glob

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Connection routes — list + set-secret (TDD)

**Files:**
- Create: `src/worker/connections/routes.ts`
- Create: `src/worker/connections/routes.test.ts`

Endpoints:
- `GET /api/connections` — admin-only, returns `{ id, name, baseUrl, auth: { type }, isConfigured, lastRotatedAt }[]`. Note: `auth` only exposes `type`, never sensitive fields like `headerName` values.
- `PUT /api/connections/:id` — admin-only, body = `ConnectionSecret`, writes via `setConnectionSecret`, audits, returns `{ ok: true }`.

- [ ] **Step 6.1: Implement `src/worker/connections/routes.ts`**

```ts
import type { Hono } from 'hono';
import { recordAuditEvent } from '../audit/writer';
import type { Session } from '../auth/session';
import { listConnections } from './registry';
import { deleteConnectionSecret, isConnectionConfigured, setConnectionSecret } from './secrets';
import type { ConnectionSecret } from './types';

function requireAdmin(c: { get: (k: 'session') => Session | undefined }): Response | null {
  const session = c.get('session');
  if (!session) return new Response(null, { status: 401 });
  if (session.role !== 'admin') return new Response(null, { status: 403 });
  return null;
}

async function getConnectionsListing(db: D1Database) {
  const all = listConnections();
  return Promise.all(
    all.map(async (conn) => ({
      id: conn.id,
      name: conn.name,
      baseUrl: conn.baseUrl,
      authType: conn.auth.type,
      isConfigured: await isConnectionConfigured(db, conn.id),
    })),
  );
}

export function registerConnectionRoutes(app: Hono<{ Bindings: Env }>): void {
  app.get('/api/connections', async (c) => {
    const guard = requireAdmin(c);
    if (guard) return guard;
    return c.json(await getConnectionsListing(c.env.DB));
  });

  app.put('/api/connections/:id', async (c) => {
    const guard = requireAdmin(c);
    if (guard) return guard;

    const id = c.req.param('id');
    if (!listConnections().some((conn) => conn.id === id)) {
      return c.json({ ok: false, error: 'unknown_connection' }, 404);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ ok: false, error: 'invalid_json' }, 400);
    }
    const secret = body as ConnectionSecret;
    // Lightweight runtime shape validation. Crypto fail-closed handles the rest.
    if (!secret || typeof (secret as { type?: unknown }).type !== 'string') {
      return c.json({ ok: false, error: 'invalid_secret_shape' }, 400);
    }

    if (!c.env.SECRETS_KEY) {
      return c.json({ ok: false, error: 'SECRETS_KEY not configured' }, 500);
    }

    const session = c.get('session') as Session;

    if (secret.type === 'none') {
      // 'none' means no secret needed for outbound auth — record presence so
      // isConfigured returns true but don't bother storing a payload.
      await deleteConnectionSecret(c.env.DB, id);
      // Re-store an empty payload so isConfigured stays true.
      await setConnectionSecret(c.env.DB, id, { type: 'none' }, c.env.SECRETS_KEY, session.email);
    } else {
      await setConnectionSecret(c.env.DB, id, secret, c.env.SECRETS_KEY, session.email);
    }

    await recordAuditEvent(c.env.DB, {
      action: 'connection.secret_set',
      actor: { email: session.email, orgId: session.orgId, role: session.role },
      connectionId: id,
      ip: c.req.header('CF-Connecting-IP') ?? '',
    });

    return c.json({ ok: true });
  });
}
```

- [ ] **Step 6.2: Test — `src/worker/connections/routes.test.ts`**

```ts
import { env, SELF } from 'cloudflare:test';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createSession } from '../auth/session';

const ROOT_KEY_FOR_TESTS = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

beforeAll(() => {
  // The Worker reads env.SECRETS_KEY at request time; the test pool
  // doesn't have it by default, so we set it via miniflare bindings in
  // vitest.config.ts.
});

afterEach(async () => {
  await env.DB.prepare('DELETE FROM sessions').run();
  await env.DB.prepare('DELETE FROM connection_secrets').run();
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

describe('GET /api/connections', () => {
  it('401 with no cookie', async () => {
    expect((await SELF.fetch('http://localhost/api/connections')).status).toBe(401);
  });

  it('403 for non-admin', async () => {
    const res = await SELF.fetch('http://localhost/api/connections', {
      headers: { Cookie: await userCookie() },
    });
    expect(res.status).toBe(403);
  });

  it('200 with the registry (empty until Task 14 adds the example)', async () => {
    const res = await SELF.fetch('http://localhost/api/connections', {
      headers: { Cookie: await adminCookie() },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });
});

describe('PUT /api/connections/:id', () => {
  it('401 with no cookie', async () => {
    const res = await SELF.fetch('http://localhost/api/connections/stripe', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'bearer', token: 'sk_test_x' }),
    });
    expect(res.status).toBe(401);
  });

  it('404 for an unknown connection id', async () => {
    const res = await SELF.fetch('http://localhost/api/connections/does-not-exist', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: await adminCookie() },
      body: JSON.stringify({ type: 'bearer', token: 'x' }),
    });
    expect(res.status).toBe(404);
  });

  // Task 14 ships a real example. Until then we don't have a valid id to test
  // the happy path. This test is enabled in Task 14.
});
```

> **NOTE:** Task 6 only tests the guards + 404. The happy-path PUT test is added in Task 14 after the example connection is declared.

- [ ] **Step 6.3: Update `vitest.config.ts` to add `SECRETS_KEY`** so Task 6's tests pass (and Task 14+ too).

Edit `vitest.config.ts` `bindings`:

```ts
bindings: {
  TEST_MIGRATIONS: migrations,
  ADMIN_EMAILS: 'dev@localhost',
  PUBLIC_URL: '',
  SECRETS_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
},
```

- [ ] **Step 6.4: NOTE — routes not mounted until Task 8.** Tests in this task will fail with 404/405 until Task 8 mounts the routes. That's expected.

```bash
pnpm typecheck  # must pass
```

- [ ] **Step 6.5: Commit**

```bash
git add src/worker/connections/routes.ts src/worker/connections/routes.test.ts vitest.config.ts
git commit -m "$(cat <<'EOF'
feat(connections): admin routes for listing + setting connection secrets

Note: routes mount in Task 8. Tests for this file pass after that.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Resource types + `defineResource` helper (TDD)

**Files:**
- Create: `src/worker/resources/types.ts`
- Create: `src/worker/resources/define.ts`
- Create: `src/worker/resources/define.test.ts`
- Create: `src/shared/resource-schema.ts` — re-exports the SPA-safe portion of these types.

- [ ] **Step 7.1: `src/worker/resources/types.ts`**

```ts
export type FieldType =
  | 'string'
  | 'text'
  | 'email'
  | 'url'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'date'
  | 'unix-ts'
  | 'enum'
  | 'json'
  | 'image-url'
  | 'currency';

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  primary?: boolean;
  tableColumn?: boolean;
  searchable?: boolean;
  editable?: boolean;
  readOnly?: boolean;
  required?: boolean;
  monospace?: boolean;
  collapsible?: boolean;
  format?: string;
  enumOptions?: Array<{ value: string; label: string }>;
}

export interface ResourceOp {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  /** For list operations: JSON dot-path to the array within the response. */
  dataPath?: string;
  /** For list operations: query param name for cursor-based pagination. */
  cursorParam?: string;
  /** Whether this operation is enabled. Mutations default to false. */
  enabled?: boolean;
}

export interface Resource {
  id: string;
  connection: string;
  name: string;
  group?: string;
  list: ResourceOp;
  detail: ResourceOp;
  create?: ResourceOp;
  update?: ResourceOp;
  delete?: ResourceOp;
  fields: Field[];
}
```

- [ ] **Step 7.2: `src/shared/resource-schema.ts`** (SPA-safe re-export)

```ts
// Re-export only the SPA-safe portion of resource types so the client
// can render schemas without pulling in the Worker registry. Worker
// routes return JSON shaped after these types via /api/resources.

export type {
  Field,
  FieldType,
  ResourceOp,
  Resource,
} from '../worker/resources/types';
```

- [ ] **Step 7.3: Failing test — `src/worker/resources/define.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { defineResource } from './define';

describe('defineResource', () => {
  it('returns the resource object verbatim', () => {
    const r = defineResource({
      id: 'stripe-customers',
      connection: 'stripe',
      name: 'Customers',
      list: { method: 'GET', path: '/v1/customers', dataPath: 'data' },
      detail: { method: 'GET', path: '/v1/customers/:id' },
      fields: [
        { key: 'id', label: 'ID', type: 'string', primary: true },
        { key: 'email', label: 'Email', type: 'email', tableColumn: true },
      ],
    });
    expect(r.id).toBe('stripe-customers');
    expect(r.fields).toHaveLength(2);
    expect(r.list.dataPath).toBe('data');
  });
});
```

- [ ] **Step 7.4: Implement `src/worker/resources/define.ts`**

```ts
import type { Resource } from './types';

export function defineResource<R extends Resource>(r: R): R {
  return r;
}
```

- [ ] **Step 7.5: Pass, typecheck, commit**

```bash
pnpm test src/worker/resources/define.test.ts
pnpm typecheck
git add src/worker/resources/types.ts src/worker/resources/define.ts src/worker/resources/define.test.ts src/shared/resource-schema.ts
git commit -m "$(cat <<'EOF'
feat(resources): Resource types + defineResource helper + shared schema

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Path templating (TDD)

**Files:**
- Create: `src/worker/resources/templating.ts`
- Create: `src/worker/resources/templating.test.ts`

Pure function. Supports three substitutions:
- `:session.<key>` → from `session.email` / `session.orgId` / `session.role` / `session.userId` (alias for email in v1)
- `:query.<key>` → from URL query params
- `:<param>` → from a `params` map (e.g. `{ id: 'cus_xyz' }`)

If a `:session.*` lookup is missing (e.g. `:session.orgId` but session has no orgId), throw a `TemplatingError` with `kind: 'missing_session_field'`. The route handler converts this to 403.

- [ ] **Step 8.1: Failing test**

```ts
// src/worker/resources/templating.test.ts
import { describe, expect, it } from 'vitest';
import { interpolatePath, TemplatingError } from './templating';

const session = { userId: 'ada@example.com', email: 'ada@example.com', orgId: 'lovelace', role: 'admin' };

describe('interpolatePath', () => {
  it('substitutes :session.* tokens', () => {
    expect(interpolatePath('/orgs/:session.orgId/things', session, {}, {})).toBe('/orgs/lovelace/things');
  });

  it('substitutes :param tokens from the params map', () => {
    expect(interpolatePath('/things/:id', session, {}, { id: 'thing_123' })).toBe('/things/thing_123');
  });

  it('substitutes :query.* tokens', () => {
    expect(interpolatePath('/list?since=:query.since', session, { since: '2024' }, {})).toBe('/list?since=2024');
  });

  it('handles multiple substitutions in one path', () => {
    expect(
      interpolatePath('/orgs/:session.orgId/things/:id', session, {}, { id: 't1' }),
    ).toBe('/orgs/lovelace/things/t1');
  });

  it('throws missing_session_field when :session.* key is missing', () => {
    const noOrg = { userId: 'x', email: 'x', orgId: null, role: null };
    expect(() => interpolatePath('/orgs/:session.orgId/things', noOrg, {}, {})).toThrow(TemplatingError);
  });

  it('leaves a literal colon-prefixed string alone if it doesn\'t match a known pattern', () => {
    // e.g. ":port" is not a token we substitute
    expect(interpolatePath('/foo/:bar', session, {}, {})).toBe('/foo/:bar');
  });
});
```

- [ ] **Step 8.2: Implement `src/worker/resources/templating.ts`**

```ts
export class TemplatingError extends Error {
  constructor(public readonly kind: 'missing_session_field', message: string) {
    super(message);
  }
}

export interface TemplateSession {
  userId: string | null;
  email: string | null;
  orgId: string | null;
  role: string | null;
}

/**
 * Replace tokens in a URL path:
 *   :session.<key>   — values from the session (userId, email, orgId, role)
 *   :query.<key>     — values from URL query params
 *   :<paramName>     — values from the params map (e.g. {id: 'cus_xyz'})
 *
 * If a :session.<key> resolves to null, throw TemplatingError so the
 * route can return 403 — this means a resource declared org-scoping
 * but the current session has no orgId set.
 *
 * Tokens that don't match any of the three known patterns are left as-is.
 */
export function interpolatePath(
  path: string,
  session: TemplateSession,
  query: Record<string, string>,
  params: Record<string, string>,
): string {
  // :session.<key>
  let out = path.replace(/:session\.([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, key: string) => {
    const value = (session as unknown as Record<string, string | null>)[key];
    if (value == null) {
      throw new TemplatingError('missing_session_field', `session.${key} is not set`);
    }
    return encodeURIComponent(value);
  });

  // :query.<key>
  out = out.replace(/:query\.([a-zA-Z_][a-zA-Z0-9_]*)/g, (m, key: string) => {
    const value = query[key];
    return value === undefined ? m : encodeURIComponent(value);
  });

  // :<paramName>  (one segment only, no dots)
  out = out.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)(?![.a-zA-Z0-9_])/g, (m, key: string) => {
    const value = params[key];
    return value === undefined ? m : encodeURIComponent(value);
  });

  return out;
}
```

- [ ] **Step 8.3: Pass tests (6), typecheck, commit**

```bash
pnpm test src/worker/resources/templating.test.ts
pnpm typecheck
git add src/worker/resources/templating.ts src/worker/resources/templating.test.ts
git commit -m "$(cat <<'EOF'
feat(resources): :session.*, :query.*, :param path templating

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Resource registry

**Files:**
- Create: `src/worker/resources/registry.ts`

- [ ] **Step 9.1: Implement (same pattern as connections registry)**

```ts
import type { Resource } from './types';

const modules = import.meta.glob<{ default: Resource }>('../../resources/*.ts', {
  eager: true,
});

const byId = new Map<string, Resource>();
for (const [path, mod] of Object.entries(modules)) {
  const r = mod.default;
  if (!r?.id) {
    throw new Error(`Resource module ${path} is missing a default export with an .id`);
  }
  if (byId.has(r.id)) {
    throw new Error(`Duplicate resource id "${r.id}" (from ${path})`);
  }
  byId.set(r.id, r);
}

export function listResources(): Resource[] {
  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export function getResource(id: string): Resource | undefined {
  return byId.get(id);
}
```

- [ ] **Step 9.2: Typecheck + commit**

```bash
pnpm typecheck
git add src/worker/resources/registry.ts
git commit -m "$(cat <<'EOF'
feat(resources): build-time registry via import.meta.glob

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Proxy core — outbound fetch + response normaliser (TDD)

**Files:**
- Create: `src/worker/resources/proxy.ts`
- Create: `src/worker/resources/proxy.test.ts`

The proxy core is a single function: given a resource, an operation (list/detail/create/update/delete), a session, query params, URL params, and an optional body — it builds and executes the outbound request, returning a normalised response. Uses `fetchMock` for testing.

- [ ] **Step 10.1: Failing test** (uses `fetchMock` from cloudflare:test)

```ts
// src/worker/resources/proxy.test.ts
import { env, fetchMock } from 'cloudflare:test';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setConnectionSecret } from '../connections/secrets';
import type { Resource } from './types';
import { proxyResourceOp } from './proxy';

const ROOT_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(async () => {
  await env.DB.prepare('DELETE FROM connection_secrets').run();
  fetchMock.assertNoPendingInterceptors();
});

const session = { userId: 'ada@example.com', email: 'ada@example.com', orgId: null, role: 'admin' };

const stripeConnection = {
  id: 'stripe',
  name: 'Stripe',
  baseUrl: 'https://api.stripe.com',
  auth: { type: 'bearer' as const },
};

const customersResource: Resource = {
  id: 'stripe-customers',
  connection: 'stripe',
  name: 'Customers',
  list: { method: 'GET', path: '/v1/customers', dataPath: 'data' },
  detail: { method: 'GET', path: '/v1/customers/:id' },
  fields: [
    { key: 'id', label: 'ID', type: 'string', primary: true },
    { key: 'email', label: 'Email', type: 'email' },
  ],
};

describe('proxyResourceOp', () => {
  it('proxies a list call with bearer auth and extracts dataPath', async () => {
    await setConnectionSecret(env.DB, 'stripe', { type: 'bearer', token: 'sk_test_xyz' }, ROOT_KEY, 'admin@example.com');

    fetchMock.get('https://api.stripe.com').intercept({ path: '/v1/customers' })
      .reply(200, { data: [{ id: 'cus_1', email: 'a@b.com' }], has_more: false });

    const res = await proxyResourceOp({
      db: env.DB,
      rootKey: ROOT_KEY,
      connection: stripeConnection,
      resource: customersResource,
      op: 'list',
      session,
      query: {},
      params: {},
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([{ id: 'cus_1', email: 'a@b.com' }]);
  });

  it('proxies a detail call with :id param', async () => {
    await setConnectionSecret(env.DB, 'stripe', { type: 'bearer', token: 'sk_test_xyz' }, ROOT_KEY, 'admin@example.com');

    fetchMock.get('https://api.stripe.com').intercept({ path: '/v1/customers/cus_42' })
      .reply(200, { id: 'cus_42', email: 'x@y.com' });

    const res = await proxyResourceOp({
      db: env.DB,
      rootKey: ROOT_KEY,
      connection: stripeConnection,
      resource: customersResource,
      op: 'detail',
      session,
      query: {},
      params: { id: 'cus_42' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'cus_42', email: 'x@y.com' });
  });

  it('returns 502 when the upstream returns a 5xx', async () => {
    await setConnectionSecret(env.DB, 'stripe', { type: 'bearer', token: 'sk_test_xyz' }, ROOT_KEY, 'admin@example.com');
    fetchMock.get('https://api.stripe.com').intercept({ path: '/v1/customers' }).reply(500, 'Internal Error');

    const res = await proxyResourceOp({
      db: env.DB,
      rootKey: ROOT_KEY,
      connection: stripeConnection,
      resource: customersResource,
      op: 'list',
      session,
      query: {},
      params: {},
    });
    expect(res.status).toBe(502);
  });

  it('returns 412 if the connection has no secret stored', async () => {
    // No setConnectionSecret call.
    const res = await proxyResourceOp({
      db: env.DB,
      rootKey: ROOT_KEY,
      connection: stripeConnection,
      resource: customersResource,
      op: 'list',
      session,
      query: {},
      params: {},
    });
    expect(res.status).toBe(412); // Precondition Failed
  });

  it('returns 403 when :session.<key> is null', async () => {
    await setConnectionSecret(env.DB, 'stripe', { type: 'bearer', token: 'sk_test_xyz' }, ROOT_KEY, 'admin@example.com');

    const orgScopedResource: Resource = {
      ...customersResource,
      list: { method: 'GET', path: '/v1/customers?org=:session.orgId', dataPath: 'data' },
    };

    const res = await proxyResourceOp({
      db: env.DB,
      rootKey: ROOT_KEY,
      connection: stripeConnection,
      resource: orgScopedResource,
      op: 'list',
      session, // orgId is null
      query: {},
      params: {},
    });
    expect(res.status).toBe(403);
  });

  it('returns 405 when the op is not enabled', async () => {
    await setConnectionSecret(env.DB, 'stripe', { type: 'bearer', token: 'sk_test_xyz' }, ROOT_KEY, 'admin@example.com');

    const res = await proxyResourceOp({
      db: env.DB,
      rootKey: ROOT_KEY,
      connection: stripeConnection,
      resource: customersResource, // no `create` op
      op: 'create',
      session,
      query: {},
      params: {},
      body: { email: 'new@example.com' },
    });
    expect(res.status).toBe(405);
  });
});
```

- [ ] **Step 10.2: Run, confirm failure.**

- [ ] **Step 10.3: Implement `src/worker/resources/proxy.ts`**

```ts
import { buildAuthHeaders } from '../connections/auth-header';
import { getConnectionSecret } from '../connections/secrets';
import type { Connection } from '../connections/types';
import { interpolatePath, TemplatingError, type TemplateSession } from './templating';
import type { Resource, ResourceOp } from './types';

export type OpName = 'list' | 'detail' | 'create' | 'update' | 'delete';

interface ProxyArgs {
  db: D1Database;
  rootKey: string;
  connection: Connection;
  resource: Resource;
  op: OpName;
  session: TemplateSession;
  query: Record<string, string>;
  params: Record<string, string>;
  body?: unknown;
}

export async function proxyResourceOp(args: ProxyArgs): Promise<Response> {
  const opConfig = pickOp(args.resource, args.op);
  if (!opConfig) {
    return new Response(JSON.stringify({ ok: false, error: 'op_not_enabled' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Load + decrypt the secret.
  const secret = await getConnectionSecret(args.db, args.connection.id, args.rootKey);
  if (!secret) {
    return new Response(JSON.stringify({ ok: false, error: 'connection_not_configured' }), {
      status: 412,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build the outbound URL.
  let fullPath: string;
  try {
    fullPath = interpolatePath(opConfig.path, args.session, args.query, args.params);
  } catch (err) {
    if (err instanceof TemplatingError) {
      return new Response(JSON.stringify({ ok: false, error: err.kind }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw err;
  }

  const url = args.connection.baseUrl.replace(/\/$/, '') + (fullPath.startsWith('/') ? fullPath : `/${fullPath}`);

  // Build the outbound request.
  const headers: Record<string, string> = {
    ...buildAuthHeaders(args.connection.auth, secret),
    Accept: 'application/json',
  };
  const init: RequestInit = { method: opConfig.method, headers };
  if (args.body !== undefined) {
    init.body = JSON.stringify(args.body);
    headers['Content-Type'] = 'application/json';
  }

  // Outbound call.
  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: 'upstream_unreachable', detail: String(err) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Pass through 4xx as-is (upstream knows best); convert 5xx to 502 so
  // the caller knows it wasn't our Worker.
  if (upstream.status >= 500) {
    return new Response(JSON.stringify({ ok: false, error: 'upstream_5xx', status: upstream.status }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Extract dataPath for list operations.
  if (args.op === 'list' && upstream.ok && opConfig.dataPath) {
    const json = await upstream.json<Record<string, unknown>>();
    const extracted = extractByDotPath(json, opConfig.dataPath);
    return new Response(JSON.stringify(extracted), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Otherwise return the upstream body unchanged.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
  });
}

function pickOp(resource: Resource, op: OpName): ResourceOp | undefined {
  switch (op) {
    case 'list':
      return resource.list;
    case 'detail':
      return resource.detail;
    case 'create':
      return resource.create?.enabled === false ? undefined : resource.create;
    case 'update':
      return resource.update?.enabled === false ? undefined : resource.update;
    case 'delete':
      return resource.delete?.enabled === false ? undefined : resource.delete;
  }
}

function extractByDotPath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const segment of path.split('.')) {
    if (cur && typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return cur;
}
```

- [ ] **Step 10.4: Pass (6 tests), typecheck, commit**

```bash
pnpm test src/worker/resources/proxy.test.ts
pnpm typecheck
git add src/worker/resources/proxy.ts src/worker/resources/proxy.test.ts
git commit -m "$(cat <<'EOF'
feat(resources): outbound proxy with templating + dataPath extraction

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Resource routes (TDD)

**Files:**
- Create: `src/worker/resources/routes.ts`
- Create: `src/worker/resources/routes.test.ts`

Endpoints (all require session, none require admin):
- `GET /api/resources` → schema (no secrets, no business data)
- `GET /api/resources/:id/list` → proxy list
- `GET /api/resources/:id/detail/:recordId` → proxy detail
- `POST /api/resources/:id` → proxy create + audit
- `PATCH /api/resources/:id/:recordId` → proxy update + audit
- `DELETE /api/resources/:id/:recordId` → proxy delete + audit

- [ ] **Step 11.1: Implement `src/worker/resources/routes.ts`**

```ts
import type { Hono } from 'hono';
import { recordAuditEvent } from '../audit/writer';
import type { Session } from '../auth/session';
import { getConnection } from '../connections/registry';
import { proxyResourceOp, type OpName } from './proxy';
import { getResource, listResources } from './registry';

export function registerResourceRoutes(app: Hono<{ Bindings: Env }>): void {
  app.get('/api/resources', (c) => {
    const session = c.get('session') as Session | undefined;
    if (!session) return new Response(null, { status: 401 });

    // Return everything except things only relevant server-side (e.g. cursorParam stays — SPA paginates).
    return c.json(
      listResources().map((r) => ({
        id: r.id,
        connection: r.connection,
        name: r.name,
        group: r.group,
        list: r.list,
        detail: r.detail,
        create: r.create,
        update: r.update,
        delete: r.delete,
        fields: r.fields,
      })),
    );
  });

  // Helper for the proxy endpoints.
  const handle = async (
    c: Parameters<Parameters<typeof app.get>[1]>[0],
    op: OpName,
    recordIdParam: string | undefined,
  ): Promise<Response> => {
    const session = c.get('session') as Session | undefined;
    if (!session) return new Response(null, { status: 401 });

    const id = c.req.param('id');
    const resource = id ? getResource(id) : undefined;
    if (!resource) return new Response(JSON.stringify({ ok: false, error: 'unknown_resource' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

    const connection = getConnection(resource.connection);
    if (!connection) return new Response(JSON.stringify({ ok: false, error: 'unknown_connection' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

    if (!c.env.SECRETS_KEY) {
      return new Response(JSON.stringify({ ok: false, error: 'SECRETS_KEY not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    let body: unknown = undefined;
    if (op === 'create' || op === 'update') {
      try { body = await c.req.json(); } catch { /* allow empty body */ }
    }

    const query: Record<string, string> = {};
    for (const [k, v] of new URL(c.req.url).searchParams.entries()) query[k] = v;

    const params: Record<string, string> = {};
    if (recordIdParam) params.id = recordIdParam;

    const res = await proxyResourceOp({
      db: c.env.DB,
      rootKey: c.env.SECRETS_KEY,
      connection,
      resource,
      op,
      session: {
        userId: session.email,
        email: session.email,
        orgId: session.orgId,
        role: session.role,
      },
      query,
      params,
      body,
    });

    // Audit mutations on success.
    if (res.status >= 200 && res.status < 300 && (op === 'create' || op === 'update' || op === 'delete')) {
      await recordAuditEvent(c.env.DB, {
        action: `resource.${op}`,
        actor: { email: session.email, orgId: session.orgId, role: session.role },
        resourceId: resource.id,
        recordId: recordIdParam,
        connectionId: connection.id,
        ip: c.req.header('CF-Connecting-IP') ?? '',
      });
    }

    return res;
  };

  app.get('/api/resources/:id/list', (c) => handle(c, 'list', undefined));
  app.get('/api/resources/:id/detail/:recordId', (c) => handle(c, 'detail', c.req.param('recordId')));
  app.post('/api/resources/:id', (c) => handle(c, 'create', undefined));
  app.patch('/api/resources/:id/:recordId', (c) => handle(c, 'update', c.req.param('recordId')));
  app.delete('/api/resources/:id/:recordId', (c) => handle(c, 'delete', c.req.param('recordId')));
}
```

- [ ] **Step 11.2: Test — `src/worker/resources/routes.test.ts`**

```ts
import { env, SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import { createSession } from '../auth/session';

afterEach(async () => {
  await env.DB.prepare('DELETE FROM sessions').run();
  await env.DB.prepare('DELETE FROM connection_secrets').run();
  await env.DB.prepare('DELETE FROM audit_log').run();
});

async function cookieFor(email: string, role: string | null = null): Promise<string> {
  const s = await createSession(env.DB, { email, role: role ?? undefined });
  return `__Host-session=${s.token}`;
}

describe('GET /api/resources', () => {
  it('401 with no cookie', async () => {
    expect((await SELF.fetch('http://localhost/api/resources')).status).toBe(401);
  });

  it('200 with a valid session', async () => {
    const res = await SELF.fetch('http://localhost/api/resources', {
      headers: { Cookie: await cookieFor('user@example.com') },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });
});

describe('GET /api/resources/:id/list', () => {
  it('404 for unknown resource id', async () => {
    const res = await SELF.fetch('http://localhost/api/resources/does-not-exist/list', {
      headers: { Cookie: await cookieFor('user@example.com') },
    });
    expect(res.status).toBe(404);
  });
});

// Happy-path proxy tests are exercised in proxy.test.ts via the example
// resource shipped in Task 14, plus a smoke check in Task 13.
```

- [ ] **Step 11.3: NOTE — routes not mounted until Task 13.** Tests will fail until then.

- [ ] **Step 11.4: Typecheck + commit**

```bash
pnpm typecheck
git add src/worker/resources/routes.ts src/worker/resources/routes.test.ts
git commit -m "$(cat <<'EOF'
feat(resources): /api/resources + CRUD proxy endpoints

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Mount routes in the Worker entry

**Files:**
- Modify: `src/worker/index.ts`

- [ ] **Step 12.1: Update `src/worker/index.ts`**

```ts
import { Hono } from 'hono';
import { registerAuthRoutes } from './auth/routes';
import { registerConnectionRoutes } from './connections/routes';
import { registerResourceRoutes } from './resources/routes';

const app = new Hono<{ Bindings: Env }>();

registerAuthRoutes(app);
registerConnectionRoutes(app);
registerResourceRoutes(app);

app.get('/api/health', (c) => c.json({ ok: true }));

// Catch-all → static assets (the built SPA), but only for non-API routes.
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

- [ ] **Step 12.2: Run the full suite**

```bash
pnpm test
```

Expected: all tests pass. The 4 connection-route tests + 3 resource-route tests + 6 proxy tests now have routes to talk to.

If any test fails: route ordering issue OR a missing binding. Investigate.

- [ ] **Step 12.3: Typecheck + commit**

```bash
pnpm typecheck
git add src/worker/index.ts
git commit -m "$(cat <<'EOF'
feat(worker): mount /api/resources and /api/connections routes

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Example connection — JSONPlaceholder (no auth)

**Files:**
- Create: `src/connections/jsonplaceholder.ts`

The example uses JSONPlaceholder so the boilerplate works out of the box with zero external setup.

- [ ] **Step 13.1: Create the connection file**

```ts
// src/connections/jsonplaceholder.ts
import { defineConnection } from '../worker/connections/define';

export default defineConnection({
  id: 'jsonplaceholder',
  name: 'JSONPlaceholder (example)',
  baseUrl: 'https://jsonplaceholder.typicode.com',
  auth: { type: 'none' },
});
```

- [ ] **Step 13.2: Verify the registry picks it up via the existing tests**

```bash
pnpm test src/worker/connections/routes.test.ts
```

Expected: the empty-array assertion in `GET /api/connections` test now returns a single element — fix the test if it asserted length 0.

Actually re-read: the test asserts `Array.isArray(body)` and nothing about length. Should still pass.

- [ ] **Step 13.3: Commit**

```bash
git add src/connections/jsonplaceholder.ts
git commit -m "$(cat <<'EOF'
feat(example): JSONPlaceholder connection (no auth, works out of the box)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Example resource — JSONPlaceholder posts

**Files:**
- Create: `src/resources/jsonplaceholder-posts.ts`

- [ ] **Step 14.1: Create the resource**

```ts
// src/resources/jsonplaceholder-posts.ts
import { defineResource } from '../worker/resources/define';

export default defineResource({
  id: 'jsonplaceholder-posts',
  connection: 'jsonplaceholder',
  name: 'Posts',
  group: 'JSONPlaceholder',
  list:   { method: 'GET', path: '/posts' },
  detail: { method: 'GET', path: '/posts/:id' },
  // JSONPlaceholder accepts these but doesn't actually persist — fine for a demo.
  create: { method: 'POST',   path: '/posts',     enabled: true },
  update: { method: 'PATCH',  path: '/posts/:id', enabled: true },
  delete: { method: 'DELETE', path: '/posts/:id', enabled: true },
  fields: [
    { key: 'id',     label: 'ID',     type: 'integer', primary: true, readOnly: true, tableColumn: true },
    { key: 'userId', label: 'User',   type: 'integer', tableColumn: true, editable: true },
    { key: 'title',  label: 'Title',  type: 'string',  tableColumn: true, searchable: true, editable: true, required: true },
    { key: 'body',   label: 'Body',   type: 'text',    editable: true },
  ],
});
```

- [ ] **Step 14.2: Mark the `PUT /api/connections/:id` happy path test** — go back to `src/worker/connections/routes.test.ts` and add:

```ts
describe('PUT /api/connections/:id (happy path with example connection)', () => {
  it('sets a secret for jsonplaceholder (auth.type=none accepts {type:none})', async () => {
    const res = await SELF.fetch('http://localhost/api/connections/jsonplaceholder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: await adminCookie() },
      body: JSON.stringify({ type: 'none' }),
    });
    expect(res.status).toBe(200);

    // isConfigured flips to true.
    const listRes = await SELF.fetch('http://localhost/api/connections', {
      headers: { Cookie: await adminCookie() },
    });
    const list = (await listRes.json()) as Array<{ id: string; isConfigured: boolean }>;
    const jp = list.find((c) => c.id === 'jsonplaceholder');
    expect(jp?.isConfigured).toBe(true);

    // Audit log.
    const audit = await env.DB.prepare(`SELECT action FROM audit_log WHERE connection_id = ?`)
      .bind('jsonplaceholder').first<{ action: string }>();
    expect(audit?.action).toBe('connection.secret_set');
  });
});
```

- [ ] **Step 14.3: Add a resource happy-path proxy test** — append to `src/worker/resources/routes.test.ts`:

```ts
describe('GET /api/resources/:id/list (live proxy through to JSONPlaceholder)', () => {
  it('lists posts from JSONPlaceholder via the proxy', async () => {
    // jsonplaceholder is auth.type=none — but the proxy still requires
    // `isConfigured`, so we set the empty payload first.
    const adminCookieStr = await cookieFor('admin@example.com', 'admin');
    await SELF.fetch('http://localhost/api/connections/jsonplaceholder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookieStr },
      body: JSON.stringify({ type: 'none' }),
    });

    // Stub the outbound call with fetchMock.
    const { fetchMock } = await import('cloudflare:test');
    fetchMock.activate();
    fetchMock.disableNetConnect();
    fetchMock.get('https://jsonplaceholder.typicode.com').intercept({ path: '/posts' })
      .reply(200, [{ id: 1, userId: 1, title: 't', body: 'b' }]);

    const res = await SELF.fetch('http://localhost/api/resources/jsonplaceholder-posts/list', {
      headers: { Cookie: adminCookieStr },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body).toHaveLength(1);

    fetchMock.assertNoPendingInterceptors();
  });
});
```

- [ ] **Step 14.4: Run the full suite + typecheck**

```bash
pnpm test
pnpm typecheck
```

Expected: ~70 tests total (was ~59 from Plan 2; +11 here for connections/resources/proxy/templating + 2 example-driven happy-path tests).

- [ ] **Step 14.5: Commit**

```bash
git add src/resources/jsonplaceholder-posts.ts src/worker/connections/routes.test.ts src/worker/resources/routes.test.ts
git commit -m "$(cat <<'EOF'
feat(example): JSONPlaceholder posts resource + integration happy-paths

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Final pre-flight (automated)

- [ ] **Step 15.1: Full suite**

```bash
lsof -ti :8787 | xargs kill 2>/dev/null
pnpm test
```

Expected: all green.

- [ ] **Step 15.2: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 15.3: Clean build**

```bash
rm -rf dist .wrangler/dry-run node_modules/.vite
pnpm build
```

Expected: clean SPA build (Plan 1's 29KB JS; this plan adds no SPA code).

- [ ] **Step 15.4: Worker dry-run**

```bash
pnpm dlx wrangler deploy --dry-run --outdir .wrangler/dry-run 2>&1 | tail -15
ls -lh .wrangler/dry-run/
```

Expected: bundle ~150KB (Plan 2 was 76KB; this plan roughly doubles it with the connection/resource code paths).

- [ ] **Step 15.5: Manual smoke test** — STOP HERE, report to controller.

The controller will:
- `pnpm dev:all`
- Sign in (Plan 2 flow)
- Visit `http://localhost:8787/api/resources` directly — should list `jsonplaceholder-posts` with full schema
- Visit `http://localhost:8787/api/connections` directly — should list `jsonplaceholder` with `isConfigured: false`
- PUT `{type: 'none'}` to `/api/connections/jsonplaceholder` (with the session cookie) — should return `{ ok: true }`
- Visit `/api/resources/jsonplaceholder-posts/list` — should return 100 JSONPlaceholder posts
- Confirm `audit_log` has a `connection.secret_set` entry

---

### Task 16: Push branch + open PR

- [ ] **Step 16.1: Push**

```bash
git push -u origin feature/connections-resources
```

- [ ] **Step 16.2: Open PR**

```bash
gh pr create --base main --head feature/connections-resources \
  --title "Connections + Resources backend: typed registry, encrypted secrets, proxied CRUD" \
  --body "$(cat <<'EOF'
## Summary
- `defineConnection({...})` + `defineResource({...})` helpers — drop a typed file in `src/connections/` or `src/resources/` and the Worker auto-registers it at build time via \`import.meta.glob\`.
- Connection secrets stored encrypted in D1 using the AES-GCM helpers from Plan 1. Set/rotate via \`PUT /api/connections/:id\` (admin-only). Outbound auth headers built from the declared auth type + decrypted secret (bearer / header / basic / none).
- Resource proxy: \`GET /api/resources/:id/list\`, \`/detail/:recordId\`, \`POST\` (create), \`PATCH\` (update), \`DELETE\`. Each proxies the request to the configured connection, attaches auth headers, and (for list ops) extracts results via \`dataPath\`. All require a valid session.
- Path templating supports \`:session.<field>\`, \`:query.<field>\`, and \`:param\` — fork-level data scoping without writing a custom proxy.
- Mutations write to \`audit_log\` (\`resource.create\` / \`update\` / \`delete\`); connection secret changes write \`connection.secret_set\`.
- Example: \`jsonplaceholder\` connection + \`jsonplaceholder-posts\` resource ship in the repo. Zero external setup needed to verify the loop works.

## What's NOT in this PR
- \`/settings/access\`, \`/settings/users\`, \`/settings/connections\`, \`/settings/audit\` admin pages — Plan 4 (needs the AppShell + UI primitives).
- ResourceTable / ResourceDetail / ResourceForm Svelte components — Plan 4.
- OpenAPI / Swagger import, GraphQL connection type — phase 2.

## Test plan
- [x] \`pnpm test\` — ~70 tests pass (Plan 2 was 59; +11 here)
- [x] \`pnpm typecheck\` — no errors
- [x] \`pnpm build\` — clean
- [x] \`wrangler deploy --dry-run\` — clean
- [x] \`pnpm dev:all\` smoke test — \`GET /api/resources/jsonplaceholder-posts/list\` returns 100 posts after configuring the connection

## Notes for review
- The proxy treats upstream 5xx as 502 (so the SPA knows it wasn't a Worker bug) but passes through 4xx as-is (the upstream knows best — e.g. Stripe's 402 means "card declined", not "auth failed").
- The Connection list endpoint returns only \`auth.type\` (never \`headerName\` values) so leaked logs of the response can't reveal anything about secret shape.
- \`SECRETS_KEY\` is now a hard requirement for any resource read. The Worker returns 500 if it's missing. Production deploys MUST run \`wrangler secret put SECRETS_KEY\` before going live — README in Plan 5 will spell this out.
- \`import.meta.glob('../../connections/*.ts')\` paths are computed relative to the registry source file (\`src/worker/connections/registry.ts\`). Re-verify after any rename.

## Design
Spec: [\`docs/superpowers/specs/2026-05-13-admin-boilerplate-design.md\`](docs/superpowers/specs/2026-05-13-admin-boilerplate-design.md) (§6 Connections, §7 Resources)
Plan: [\`docs/superpowers/plans/2026-05-13-03-connections-resources.md\`](docs/superpowers/plans/2026-05-13-03-connections-resources.md)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage** (against §6, §7 of the design spec):

- §6.1 Declarative connection definition — Task 2 ✓
- §6.2 Encrypted secrets in D1 — Task 4 ✓
- §6.2 Auth header types (none / bearer / header / basic) — Task 3 ✓
- §7 Resource definition shape — Task 7 ✓
- §7.2 Build-time registry via `import.meta.glob` — Tasks 5, 9 ✓
- §7.4 Mutations + proxy + audit — Tasks 10, 11 ✓
- §7.5 `:session.*` path templating — Task 8 ✓
- Worker endpoints from §4.2 (`/api/resources`, `/api/connections`) — Tasks 6, 11, 12 ✓

Not covered (deferred):
- Admin UIs for connections / audit log viewing — Plan 4.
- The four "shipping example" resources in the spec (Stripe, GitHub etc.) — we ship one (JSONPlaceholder) instead, sufficient to validate the loop.

**Placeholder scan** — no "TBD"/"TODO" left.

**Type consistency** — `ConnectionAuth` / `ConnectionSecret` discriminated unions are tested for both paired cases (bearer + bearer) and mismatch (the guard in `buildAuthHeaders`). `TemplateSession` shape matches the `Session` shape from Plan 2.

**Scope** — 16 tasks. Substantial but coherent. Each task ships either a new module with TDD or wires existing modules together. Single PR for full backend coherence.
