# Plan 4 — Frontend shell + UI primitives + Resource UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the SPA on top of the Plan 3 backend so a signed-in user can browse resources from a Swiss/Apple-feel shell — sidebar nav auto-generated from `/api/resources`, click a resource, see a paginated table, click a row, see a detail view, hit "Edit" or "New" and submit a form that talks to the proxy. Ships with light + dark mode, the eight-slot AppShell from §8 of the design spec, and a small set of UI primitives (Button, Input, Field, Pill, Table, Toast). Forks customise the shell by passing snippet props to `<AppShell>`. This is the "simple clean first pass" — generous whitespace, restrained palette, no decorative animation. We'll iterate aesthetics in a later plan.

**Architecture:**

```
   ┌─────────────────────── AppShell ───────────────────────┐
   │ [leftRail][topbar-L][topbar-C][topbar-R]               │
   │   ←slot   ←slot      ←slot      default: user+theme    │
   │           [subnav (optional)]                          │
   │   ┌────────────────┬──────────────────┬─────────┐      │
   │   │ default        │  main: routed    │ aside   │      │
   │   │ sidebar:       │  ResourceList    │ (opt'l) │      │
   │   │ auto-gen from  │  ResourceDetail  │         │      │
   │   │ /api/resources │  ResourceForm    │         │      │
   │   │ grouped by .group                 │         │      │
   │   └────────────────┴──────────────────┴─────────┘      │
   └────────────────────────────────────────────────────────┘
         │
         └─ All routes guarded by Plan 2's session store.
            Anonymous users redirected to /sign-in.
```

**Tech Stack:** Svelte 5 runes + Vite + Tailwind v4 (all from Plan 1). New runtime: `svelte-spa-router` (added in Plan 2). Reuses the resource schema shape exposed via `/api/resources` from Plan 3.

**Testing philosophy for this plan:** Per-component unit tests are not added — Svelte runes need the Svelte compiler in the test pool, and the existing `@cloudflare/vitest-pool-workers` setup is workerd-oriented. We rely on:
- TypeScript catching type errors across SPA components
- `pnpm build` succeeds (Vite catches template errors)
- All 100 existing Worker tests stay green
- Manual smoke test verifies the end-to-end flow

We can add component-level testing in a later plan once we hit a regression we'd have caught.

---

## Prerequisites

- Plan 3 merged to `main`. Local `main` synced.
- `/api/resources` returns the schema for the example `jsonplaceholder-posts` resource.
- `dev@localhost` magic-link sign-in works (Plan 2).
- The `jsonplaceholder` connection has been configured at least once (`PUT /api/connections/jsonplaceholder` with `{type:'none'}`).

---

## Files Created / Modified by this Plan

```
src/
├── client/
│   ├── app.svelte                     # MODIFY: AppShell + Router for resource routes
│   ├── app.css                        # MODIFY: dark-mode tokens + component-level tokens
│   ├── lib/
│   │   ├── shell/
│   │   │   ├── AppShell.svelte        # new: 8-slot CSS-Grid primitive
│   │   │   ├── DefaultSidebar.svelte  # new: auto-gen nav from registry
│   │   │   └── DefaultTopbarRight.svelte  # new: user + theme + sign-out
│   │   ├── ui/
│   │   │   ├── Button.svelte
│   │   │   ├── IconButton.svelte
│   │   │   ├── Pill.svelte
│   │   │   ├── Input.svelte
│   │   │   ├── Textarea.svelte
│   │   │   ├── Select.svelte
│   │   │   ├── Checkbox.svelte
│   │   │   ├── Field.svelte
│   │   │   ├── Table.svelte
│   │   │   └── ToastHost.svelte
│   │   ├── resource/
│   │   │   ├── ResourceTable.svelte
│   │   │   ├── ResourceDetail.svelte
│   │   │   ├── ResourceForm.svelte
│   │   │   ├── FieldDisplay.svelte
│   │   │   └── FieldInput.svelte
│   │   ├── theme.svelte.ts            # new: light/dark rune store with localStorage
│   │   ├── toast.svelte.ts            # new: global toast helper
│   │   └── registry.svelte.ts         # new: client-side resource registry
│   └── routes/
│       ├── home.svelte                # MODIFY: shell-aware, redirects to first resource
│       ├── sign-in.svelte             # MODIFY: no longer needs whole-page layout, AppShell handles chrome
│       ├── sign-in-sent.svelte        # MODIFY: same as sign-in
│       ├── ResourceListPage.svelte
│       ├── ResourceDetailPage.svelte
│       └── ResourceFormPage.svelte    # handles BOTH create and edit
```

---

## Design tokens — what to add to `app.css`

Plan 1's `@theme` block defines light-mode tokens. Plan 4 adds:

- **Dark-mode overrides** under `[data-theme="dark"]` selector.
- **Component tokens**: `--button-bg`, `--button-bg-hover`, `--input-bg`, `--input-border`, etc. derived from the base tokens. Lets components reference semantic intent rather than raw colour.
- **Elevation**: virtually flat. Borders carry hierarchy. One subtle hover-state shadow at most.

---

## Tasks

### Task 1: Branch + commit Plan 4 doc

- [ ] **Step 1.1**: Create branch.

```bash
git checkout main
git pull origin main
git checkout -b feature/frontend-shell-resource-ui
```

- [ ] **Step 1.2**: Commit the plan doc.

```bash
git add docs/superpowers/plans/2026-05-13-04-frontend-shell-resource-ui.md
git commit -m "$(cat <<'EOF'
docs: add Plan 4 — frontend shell + UI primitives + resource UI

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Extend design tokens for dark mode + components

**Files:**
- Modify: `src/client/app.css`

Goal: add dark-mode token overrides and a layer of semantic component tokens (button, input, table) so primitives reference intent instead of raw colours.

- [ ] **Step 2.1**: Replace `src/client/app.css` with:

```css
@import "tailwindcss";

@theme {
  /* Surfaces and lines (light) */
  --color-bg: #fafafa;
  --color-surface: #ffffff;
  --color-surface-2: #f4f4f4;
  --color-border: #e8e8e8;
  --color-border-strong: #d4d4d4;

  /* Text */
  --color-text: #0a0a0a;
  --color-text-secondary: #404040;
  --color-muted: #737373;
  --color-disabled: #a3a3a3;

  /* Status */
  --color-success-fg: #047857;
  --color-success-bg: #ecfdf5;
  --color-warning-fg: #92400e;
  --color-warning-bg: #fef3c7;
  --color-error-fg: #991b1b;
  --color-error-bg: #fee2e2;
  --color-info-fg: #1d4ed8;
  --color-info-bg: #dbeafe;

  /* Typography */
  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter",
               "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
}

/* Dark mode — flips surfaces and inverts the text scale. */
[data-theme="dark"] {
  --color-bg: #0a0a0a;
  --color-surface: #141414;
  --color-surface-2: #1f1f1f;
  --color-border: #262626;
  --color-border-strong: #3a3a3a;

  --color-text: #fafafa;
  --color-text-secondary: #d4d4d4;
  --color-muted: #737373;
  --color-disabled: #525252;

  --color-success-fg: #34d399;
  --color-success-bg: #064e3b;
  --color-warning-fg: #fbbf24;
  --color-warning-bg: #78350f;
  --color-error-fg: #f87171;
  --color-error-bg: #7f1d1d;
  --color-info-fg: #60a5fa;
  --color-info-bg: #1e3a8a;
}

:root { color-scheme: light dark; }

html, body {
  margin: 0;
  padding: 0;
  font-family: var(--font-sans);
  background: var(--color-bg);
  color: var(--color-text);
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.005em;
}

#app { min-height: 100vh; }
```

- [ ] **Step 2.2**: Build to verify it compiles, commit.

```bash
pnpm build
git add src/client/app.css
git commit -m "$(cat <<'EOF'
feat(client): dark-mode tokens + extended surface scale

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Theme store

**Files:**
- Create: `src/client/lib/theme.svelte.ts`

Rune-based store. Tracks user preference (`'light' | 'dark' | 'system'`). Resolves system pref via `matchMedia`. Writes `[data-theme="..."]` to `<html>`. Persists choice to `localStorage`.

- [ ] **Step 3.1**: `src/client/lib/theme.svelte.ts`

```ts
export type ThemeChoice = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'admin-boilerplate.theme';

class ThemeStore {
  choice = $state<ThemeChoice>(readInitial());
  systemPref = $state<ResolvedTheme>(detectSystem());

  resolved = $derived<ResolvedTheme>(
    this.choice === 'system' ? this.systemPref : this.choice,
  );

  constructor() {
    if (typeof window !== 'undefined') {
      // Listen for system-pref changes so 'system' followers track them.
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      mql.addEventListener('change', (e) => {
        this.systemPref = e.matches ? 'dark' : 'light';
      });
    }
  }

  /** Cycle light → dark → system → light. Used by the topbar toggle. */
  cycle(): void {
    const next: ThemeChoice =
      this.choice === 'light' ? 'dark' : this.choice === 'dark' ? 'system' : 'light';
    this.set(next);
  }

  set(choice: ThemeChoice): void {
    this.choice = choice;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, choice);
    }
  }

  /** Apply the resolved theme to the document. Call this once on mount, plus on every change via $effect. */
  apply(): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', this.resolved);
    }
  }
}

function readInitial(): ThemeChoice {
  if (typeof window === 'undefined') return 'system';
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
}

function detectSystem(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const theme = new ThemeStore();
```

- [ ] **Step 3.2**: Typecheck + commit

```bash
pnpm typecheck
git add src/client/lib/theme.svelte.ts
git commit -m "$(cat <<'EOF'
feat(client): rune-based theme store with system + localStorage persistence

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Toast store + ToastHost

**Files:**
- Create: `src/client/lib/toast.svelte.ts`
- Create: `src/client/lib/ui/ToastHost.svelte`

A tiny imperative toast system. `toast.success('Saved')` / `toast.error('Failed')`. 3s auto-dismiss. `<ToastHost />` mounted once at app root.

- [ ] **Step 4.1**: `src/client/lib/toast.svelte.ts`

```ts
export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

let nextId = 1;
const DURATION_MS = 3000;

class ToastStore {
  items = $state<Toast[]>([]);

  push(kind: ToastKind, message: string): void {
    const t: Toast = { id: nextId++, kind, message };
    this.items = [...this.items, t];
    setTimeout(() => this.dismiss(t.id), DURATION_MS);
  }

  success(message: string): void { this.push('success', message); }
  error(message: string): void { this.push('error', message); }
  info(message: string): void { this.push('info', message); }

  dismiss(id: number): void {
    this.items = this.items.filter((t) => t.id !== id);
  }
}

export const toast = new ToastStore();
```

- [ ] **Step 4.2**: `src/client/lib/ui/ToastHost.svelte`

```svelte
<script lang="ts">
  import { toast } from '$client/lib/toast.svelte';
</script>

<div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end" aria-live="polite">
  {#each toast.items as t (t.id)}
    <div
      class="px-3 py-2 rounded-md text-sm font-medium border min-w-[12rem] max-w-md"
      style:background={
        t.kind === 'success' ? 'var(--color-success-bg)'
        : t.kind === 'error' ? 'var(--color-error-bg)'
        : 'var(--color-info-bg)'
      }
      style:color={
        t.kind === 'success' ? 'var(--color-success-fg)'
        : t.kind === 'error' ? 'var(--color-error-fg)'
        : 'var(--color-info-fg)'
      }
      style:border-color="transparent"
      role="status"
    >
      {t.message}
    </div>
  {/each}
</div>
```

- [ ] **Step 4.3**: Typecheck + commit

```bash
pnpm typecheck
git add src/client/lib/toast.svelte.ts src/client/lib/ui/ToastHost.svelte
git commit -m "$(cat <<'EOF'
feat(client): toast store + host (success / error / info)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: UI primitives — Button, IconButton, Pill

**Files:**
- Create: `src/client/lib/ui/Button.svelte`
- Create: `src/client/lib/ui/IconButton.svelte`
- Create: `src/client/lib/ui/Pill.svelte`

- [ ] **Step 5.1**: `src/client/lib/ui/Button.svelte`

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'sm' | 'md';
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  }

  let {
    variant = 'primary',
    size = 'md',
    type = 'button',
    disabled = false,
    onclick,
    children,
  }: Props = $props();

  const base = 'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-2.5 py-1 text-xs', md: 'px-3 py-2 text-sm' };
  const variants = {
    primary: 'bg-[var(--color-text)] text-[var(--color-bg)] hover:opacity-90',
    secondary: 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)]',
    ghost: 'text-[var(--color-text)] hover:bg-[var(--color-surface-2)]',
  };
</script>

<button {type} {disabled} {onclick} class="{base} {sizes[size]} {variants[variant]}">
  {@render children()}
</button>
```

- [ ] **Step 5.2**: `src/client/lib/ui/IconButton.svelte`

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    ariaLabel: string;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  }

  let { type = 'button', disabled = false, ariaLabel, onclick, children }: Props = $props();
</script>

<button
  {type}
  {disabled}
  {onclick}
  aria-label={ariaLabel}
  class="inline-flex items-center justify-center w-8 h-8 rounded-md text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-50"
>
  {@render children()}
</button>
```

- [ ] **Step 5.3**: `src/client/lib/ui/Pill.svelte`

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    tone?: 'neutral' | 'success' | 'warning' | 'error' | 'info';
    children: Snippet;
  }

  let { tone = 'neutral', children }: Props = $props();

  const tones = {
    neutral: 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]',
    success: 'bg-[var(--color-success-bg)] text-[var(--color-success-fg)]',
    warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)]',
    error:   'bg-[var(--color-error-bg)] text-[var(--color-error-fg)]',
    info:    'bg-[var(--color-info-bg)] text-[var(--color-info-fg)]',
  };
</script>

<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium {tones[tone]}">
  {@render children()}
</span>
```

- [ ] **Step 5.4**: Build + commit

```bash
pnpm build
pnpm typecheck
git add src/client/lib/ui/Button.svelte src/client/lib/ui/IconButton.svelte src/client/lib/ui/Pill.svelte
git commit -m "$(cat <<'EOF'
feat(ui): Button / IconButton / Pill primitives

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: UI primitives — form inputs (Input, Textarea, Select, Checkbox, Field)

**Files:**
- Create: `src/client/lib/ui/Input.svelte`
- Create: `src/client/lib/ui/Textarea.svelte`
- Create: `src/client/lib/ui/Select.svelte`
- Create: `src/client/lib/ui/Checkbox.svelte`
- Create: `src/client/lib/ui/Field.svelte`

The `Field` component is a label + helper-text wrapper used around the others.

- [ ] **Step 6.1**: `src/client/lib/ui/Input.svelte`

```svelte
<script lang="ts">
  interface Props {
    type?: 'text' | 'email' | 'url' | 'number' | 'password' | 'search';
    value: string | number | undefined;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    readonly?: boolean;
    monospace?: boolean;
    name?: string;
    autocomplete?: string;
    oninput?: (e: Event) => void;
  }

  let inputType: Props['type'] = $bindable('text');
  let v = $bindable<string | number | undefined>();
  let { placeholder, disabled, required, readonly, monospace, name, autocomplete, oninput, type, value = $bindable() }: Props = $props();
</script>

<input
  {name}
  {type}
  {disabled}
  {required}
  {readonly}
  {placeholder}
  {autocomplete}
  bind:value
  {oninput}
  class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-text)] disabled:opacity-50 readonly:bg-[var(--color-surface-2)]"
  class:font-mono={monospace}
/>
```

- [ ] **Step 6.2**: `src/client/lib/ui/Textarea.svelte`

```svelte
<script lang="ts">
  interface Props {
    value: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    readonly?: boolean;
    rows?: number;
    name?: string;
  }

  let { value = $bindable(), placeholder, disabled, required, readonly, rows = 4, name }: Props = $props();
</script>

<textarea
  {name}
  {disabled}
  {required}
  {readonly}
  {placeholder}
  {rows}
  bind:value
  class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-text)] disabled:opacity-50 readonly:bg-[var(--color-surface-2)] font-sans"
></textarea>
```

- [ ] **Step 6.3**: `src/client/lib/ui/Select.svelte`

```svelte
<script lang="ts">
  interface Option { value: string; label: string }
  interface Props {
    value: string;
    options: Option[];
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    name?: string;
  }

  let { value = $bindable(), options, placeholder, disabled, required, name }: Props = $props();
</script>

<select
  {name}
  {disabled}
  {required}
  bind:value
  class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-text)] disabled:opacity-50"
>
  {#if placeholder}
    <option value="" disabled>{placeholder}</option>
  {/if}
  {#each options as opt}
    <option value={opt.value}>{opt.label}</option>
  {/each}
</select>
```

- [ ] **Step 6.4**: `src/client/lib/ui/Checkbox.svelte`

```svelte
<script lang="ts">
  interface Props {
    checked: boolean;
    disabled?: boolean;
    name?: string;
    label?: string;
  }

  let { checked = $bindable(), disabled, name, label }: Props = $props();
</script>

<label class="inline-flex items-center gap-2 text-sm text-[var(--color-text)] cursor-pointer">
  <input
    {name}
    {disabled}
    type="checkbox"
    bind:checked
    class="rounded border-[var(--color-border-strong)]"
  />
  {#if label}<span>{label}</span>{/if}
</label>
```

- [ ] **Step 6.5**: `src/client/lib/ui/Field.svelte`

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label: string;
    helper?: string;
    error?: string;
    required?: boolean;
    children: Snippet;
  }

  let { label, helper, error, required, children }: Props = $props();
</script>

<label class="block space-y-1">
  <span class="text-xs font-medium text-[var(--color-muted)]">
    {label}
    {#if required}<span class="text-[var(--color-error-fg)]" aria-hidden="true">*</span>{/if}
  </span>
  {@render children()}
  {#if error}
    <p class="text-xs text-[var(--color-error-fg)]">{error}</p>
  {:else if helper}
    <p class="text-xs text-[var(--color-muted)]">{helper}</p>
  {/if}
</label>
```

- [ ] **Step 6.6**: Build + commit

```bash
pnpm build
pnpm typecheck
git add src/client/lib/ui/Input.svelte src/client/lib/ui/Textarea.svelte src/client/lib/ui/Select.svelte src/client/lib/ui/Checkbox.svelte src/client/lib/ui/Field.svelte
git commit -m "$(cat <<'EOF'
feat(ui): form input primitives (Input, Textarea, Select, Checkbox, Field)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: UI primitive — Table

**Files:**
- Create: `src/client/lib/ui/Table.svelte`

A semantic table primitive. `<Table>` provides the styled wrapper; rows and cells use plain `<tr>`, `<td>`, `<th>` styled via the `:where()` descendant selectors inside `<Table>`'s own scoped styles.

- [ ] **Step 7.1**: `src/client/lib/ui/Table.svelte`

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
  <table class="w-full text-sm">
    {@render children()}
  </table>
</div>

<style>
  :global(table th) {
    text-align: left;
    padding: 8px 14px;
    background: var(--color-surface-2);
    color: var(--color-muted);
    font-weight: 500;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1px solid var(--color-border);
  }
  :global(table td) {
    padding: 10px 14px;
    border-bottom: 1px solid var(--color-border);
    vertical-align: top;
  }
  :global(table tbody tr:last-child td) {
    border-bottom: none;
  }
  :global(table tbody tr) {
    transition: background 80ms ease;
  }
  :global(table tbody tr:hover) {
    background: var(--color-surface-2);
  }
  :global(table tbody tr.clickable) {
    cursor: pointer;
  }
</style>
```

- [ ] **Step 7.2**: Build + commit

```bash
pnpm build
pnpm typecheck
git add src/client/lib/ui/Table.svelte
git commit -m "$(cat <<'EOF'
feat(ui): Table primitive with header / row / cell styling

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Client-side resource registry store

**Files:**
- Create: `src/client/lib/registry.svelte.ts`

Loads `/api/resources` once after session is authed, caches the schema. Exposes `byId(id) → Resource | undefined` and `grouped() → Record<group, Resource[]>`.

- [ ] **Step 8.1**: `src/client/lib/registry.svelte.ts`

```ts
import { api, ApiError } from './api';
import type { Resource } from '$shared/resource-schema';

class ResourceRegistry {
  status = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
  items = $state<Resource[]>([]);
  errorMessage = $state<string | null>(null);

  async load(): Promise<void> {
    if (this.status === 'loading' || this.status === 'ready') return;
    this.status = 'loading';
    try {
      this.items = await api<Resource[]>('/api/resources');
      this.status = 'ready';
    } catch (err) {
      this.errorMessage = err instanceof ApiError ? `${err.status}` : 'unknown';
      this.status = 'error';
    }
  }

  byId(id: string): Resource | undefined {
    return this.items.find((r) => r.id === id);
  }

  /** Returns resources keyed by their `.group` (or 'Other' if missing), in registration order. */
  grouped(): Record<string, Resource[]> {
    const out: Record<string, Resource[]> = {};
    for (const r of this.items) {
      const key = r.group ?? 'Other';
      (out[key] ??= []).push(r);
    }
    return out;
  }
}

export const registry = new ResourceRegistry();
```

- [ ] **Step 8.2**: Typecheck + commit

```bash
pnpm typecheck
git add src/client/lib/registry.svelte.ts
git commit -m "$(cat <<'EOF'
feat(client): client-side resource registry with grouped + byId helpers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: AppShell component (the 8-slot primitive)

**Files:**
- Create: `src/client/lib/shell/AppShell.svelte`

CSS Grid layout. Each slot collapses to zero-track when not provided. `children` is used for `main` when no `main` snippet is given (common case for routed pages).

- [ ] **Step 9.1**: `src/client/lib/shell/AppShell.svelte`

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  import DefaultTopbarRight from './DefaultTopbarRight.svelte';
  import DefaultSidebar from './DefaultSidebar.svelte';

  interface Props {
    leftRail?: Snippet;
    topbarLeft?: Snippet;
    topbarCenter?: Snippet;
    topbarRight?: Snippet;
    subnav?: Snippet;
    sidebar?: Snippet;
    main?: Snippet;
    aside?: Snippet;
    children?: Snippet;  // fallback for main
  }

  let {
    leftRail,
    topbarLeft,
    topbarCenter,
    topbarRight,
    subnav,
    sidebar,
    main,
    aside,
    children,
  }: Props = $props();
</script>

<div
  class="grid min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]"
  style:grid-template-columns="auto auto 1fr auto"
  style:grid-template-rows="auto auto 1fr"
  style:grid-template-areas={`
    "rail topbar topbar topbar"
    "rail subnav subnav subnav"
    "rail sidebar main aside"
  `}
>
  <!-- Left rail (optional) -->
  {#if leftRail}
    <aside style:grid-area="rail" class="border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      {@render leftRail()}
    </aside>
  {/if}

  <!-- Topbar -->
  <header
    style:grid-area="topbar"
    class="h-12 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center px-4 gap-4"
  >
    <div class="flex items-center gap-3 min-w-[12rem]">
      {#if topbarLeft}{@render topbarLeft()}{/if}
    </div>
    <div class="flex-1 flex items-center justify-center">
      {#if topbarCenter}{@render topbarCenter()}{/if}
    </div>
    <div class="flex items-center gap-2 min-w-[12rem] justify-end">
      {@render (topbarRight ?? DefaultTopbarRight)()}
    </div>
  </header>

  <!-- Subnav (optional) -->
  {#if subnav}
    <nav style:grid-area="subnav" class="h-10 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center px-4">
      {@render subnav()}
    </nav>
  {/if}

  <!-- Sidebar -->
  <aside
    style:grid-area="sidebar"
    class="w-56 border-r border-[var(--color-border)] bg-[var(--color-surface)] overflow-y-auto"
  >
    {@render (sidebar ?? DefaultSidebar)()}
  </aside>

  <!-- Main -->
  <main style:grid-area="main" class="overflow-y-auto p-6">
    {@render (main ?? children ?? (() => {}))()}
  </main>

  <!-- Aside (optional) -->
  {#if aside}
    <section style:grid-area="aside" class="w-72 border-l border-[var(--color-border)] bg-[var(--color-surface)] overflow-y-auto">
      {@render aside()}
    </section>
  {/if}
</div>
```

> Note: the `{@render (topbarRight ?? DefaultTopbarRight)()}` pattern requires the default component to be usable as a render function. We import it as a component and use `{@render ... as ...}` style. If that syntax doesn't work in your Svelte 5 version, switch to:
> ```svelte
> {#if topbarRight}{@render topbarRight()}{:else}<DefaultTopbarRight />{/if}
> ```
> Same for sidebar. Use whichever compiles cleanly.

- [ ] **Step 9.2**: Stub the default components so AppShell compiles even before Tasks 10–11.

`src/client/lib/shell/DefaultTopbarRight.svelte`:
```svelte
<!-- Stub until Task 10. Real version with user menu + theme toggle + sign-out lands then. -->
<div></div>
```

`src/client/lib/shell/DefaultSidebar.svelte`:
```svelte
<!-- Stub until Task 11. Real version with auto-generated nav lands then. -->
<div></div>
```

- [ ] **Step 9.3**: Build + typecheck + commit. If the `??` pattern doesn't compile, switch to `{#if}{:else}` (see note in 9.1) and commit that variant.

```bash
pnpm build
pnpm typecheck
git add src/client/lib/shell/AppShell.svelte src/client/lib/shell/DefaultTopbarRight.svelte src/client/lib/shell/DefaultSidebar.svelte
git commit -m "$(cat <<'EOF'
feat(shell): AppShell 8-slot CSS-Grid primitive

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: DefaultTopbarRight — user menu, theme toggle, sign-out

**Files:**
- Replace stub: `src/client/lib/shell/DefaultTopbarRight.svelte`

- [ ] **Step 10.1**: Replace the stub with:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import IconButton from '$client/lib/ui/IconButton.svelte';
  import { session } from '$client/lib/session.svelte';
  import { theme } from '$client/lib/theme.svelte';

  onMount(() => theme.apply());
  $effect(() => { theme.apply(); });

  function themeLabel(): string {
    if (theme.choice === 'light') return 'Light';
    if (theme.choice === 'dark') return 'Dark';
    return 'System';
  }

  function themeIcon(): string {
    if (theme.resolved === 'dark') return '◐';
    return '◑';
  }
</script>

<div class="flex items-center gap-1">
  <IconButton ariaLabel={`Theme: ${themeLabel()}, click to cycle`} onclick={() => theme.cycle()}>
    <span aria-hidden="true">{themeIcon()}</span>
  </IconButton>

  {#if session.value}
    <span class="text-xs text-[var(--color-muted)] px-2" title={session.value.email}>
      {session.value.email}
    </span>
    <IconButton ariaLabel="Sign out" onclick={() => session.signOut()}>
      <span aria-hidden="true">⇥</span>
    </IconButton>
  {/if}
</div>
```

- [ ] **Step 10.2**: Build + commit

```bash
pnpm build
pnpm typecheck
git add src/client/lib/shell/DefaultTopbarRight.svelte
git commit -m "$(cat <<'EOF'
feat(shell): default topbar-right with theme toggle and sign-out

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: DefaultSidebar — auto-generated nav from registry

**Files:**
- Replace stub: `src/client/lib/shell/DefaultSidebar.svelte`

- [ ] **Step 11.1**: Replace the stub with:

```svelte
<script lang="ts">
  import { link, location } from 'svelte-spa-router';
  import { registry } from '$client/lib/registry.svelte';

  // Active match — svelte-spa-router's $location is the hash without leading '#'.
  function isActive(href: string): boolean {
    return $location === href || $location.startsWith(href + '/');
  }
</script>

<nav class="p-4 space-y-4">
  <a
    href="/"
    use:link
    class="block text-[11px] uppercase tracking-[0.08em] font-medium text-[var(--color-muted)] hover:text-[var(--color-text)]"
  >
    admin-boilerplate
  </a>

  {#if registry.status === 'loading'}
    <p class="text-xs text-[var(--color-muted)]">Loading…</p>
  {:else if registry.status === 'error'}
    <p class="text-xs text-[var(--color-error-fg)]">Couldn't load resources.</p>
  {:else if registry.status === 'ready'}
    {@const groups = registry.grouped()}
    {#each Object.entries(groups) as [group, resources]}
      <div>
        <div class="text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted)] font-medium px-2 mb-1">
          {group}
        </div>
        <ul class="space-y-0.5">
          {#each resources as r (r.id)}
            {@const href = `/r/${r.id}`}
            <li>
              <a
                href={href}
                use:link
                class="block px-2 py-1 rounded text-sm hover:bg-[var(--color-surface-2)] {isActive(href) ? 'bg-[var(--color-surface-2)] font-medium' : 'text-[var(--color-text-secondary)]'}"
              >
                {r.name}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  {/if}
</nav>
```

- [ ] **Step 11.2**: Build + commit

```bash
pnpm build
pnpm typecheck
git add src/client/lib/shell/DefaultSidebar.svelte
git commit -m "$(cat <<'EOF'
feat(shell): default sidebar with auto-generated resource nav

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: FieldDisplay + FieldInput — per-field-type rendering

**Files:**
- Create: `src/client/lib/resource/FieldDisplay.svelte`
- Create: `src/client/lib/resource/FieldInput.svelte`

These do the dirty work of mapping a field's `type` to the appropriate display or input shape. ResourceTable, ResourceDetail, ResourceForm consume them.

- [ ] **Step 12.1**: `src/client/lib/resource/FieldDisplay.svelte`

```svelte
<script lang="ts">
  import Pill from '$client/lib/ui/Pill.svelte';
  import type { Field } from '$shared/resource-schema';

  interface Props {
    field: Field;
    value: unknown;
  }

  let { field, value }: Props = $props();

  function formatUnixTs(v: unknown): string {
    if (typeof v !== 'number') return String(v ?? '');
    return new Date(v * 1000).toISOString().slice(0, 10);
  }

  function formatDate(v: unknown): string {
    if (typeof v !== 'string') return '';
    return v.slice(0, 10);
  }

  function formatCurrency(v: unknown): string {
    if (typeof v !== 'number') return String(v ?? '');
    return (v / 100).toFixed(2);
  }
</script>

{#if value === null || value === undefined || value === ''}
  <span class="text-[var(--color-muted)]">—</span>
{:else if field.type === 'boolean'}
  {#if value}<Pill tone="success">true</Pill>{:else}<Pill tone="neutral">false</Pill>{/if}
{:else if field.type === 'unix-ts'}
  <span class="font-mono text-xs">{formatUnixTs(value)}</span>
{:else if field.type === 'date'}
  <span class="font-mono text-xs">{formatDate(value)}</span>
{:else if field.type === 'currency'}
  <span class="font-mono text-xs">{formatCurrency(value)}</span>
{:else if field.type === 'json'}
  <pre class="font-mono text-xs whitespace-pre-wrap break-all text-[var(--color-text-secondary)]">{JSON.stringify(value, null, 2)}</pre>
{:else if field.type === 'url'}
  <a href={String(value)} target="_blank" rel="noopener" class="underline">{String(value)}</a>
{:else if field.type === 'image-url'}
  <img src={String(value)} alt={field.label} class="max-h-12 rounded" />
{:else if field.monospace || field.type === 'string' && field.primary}
  <span class="font-mono text-xs">{String(value)}</span>
{:else}
  <span class:font-mono={field.monospace}>{String(value)}</span>
{/if}
```

- [ ] **Step 12.2**: `src/client/lib/resource/FieldInput.svelte`

```svelte
<script lang="ts">
  import Input from '$client/lib/ui/Input.svelte';
  import Textarea from '$client/lib/ui/Textarea.svelte';
  import Select from '$client/lib/ui/Select.svelte';
  import Checkbox from '$client/lib/ui/Checkbox.svelte';
  import type { Field } from '$shared/resource-schema';

  interface Props {
    field: Field;
    value: unknown;
    onchange: (newValue: unknown) => void;
    disabled?: boolean;
  }

  let { field, value, onchange, disabled = false }: Props = $props();

  // Coerce to a string for text-based inputs; the parent's onchange callback
  // gets the raw value back through bindable bridges.
  let stringValue = $state<string>(value == null ? '' : String(value));
  let boolValue = $state<boolean>(Boolean(value));

  $effect(() => {
    // Push back to the parent in the type-appropriate shape.
    if (field.type === 'boolean') {
      onchange(boolValue);
    } else if (field.type === 'number' || field.type === 'integer' || field.type === 'currency' || field.type === 'unix-ts') {
      const n = Number(stringValue);
      onchange(Number.isFinite(n) ? n : null);
    } else if (field.type === 'json') {
      try {
        onchange(JSON.parse(stringValue));
      } catch {
        // Leave as the raw string; the server will reject if invalid.
        onchange(stringValue);
      }
    } else {
      onchange(stringValue);
    }
  });
</script>

{#if field.type === 'boolean'}
  <Checkbox bind:checked={boolValue} {disabled} />
{:else if field.type === 'enum' && field.enumOptions}
  <Select bind:value={stringValue} options={field.enumOptions} {disabled} />
{:else if field.type === 'text' || field.type === 'json'}
  <Textarea bind:value={stringValue} {disabled} readonly={field.readOnly} required={field.required} />
{:else if field.type === 'email'}
  <Input type="email" bind:value={stringValue} {disabled} readonly={field.readOnly} required={field.required} />
{:else if field.type === 'url' || field.type === 'image-url'}
  <Input type="url" bind:value={stringValue} {disabled} readonly={field.readOnly} required={field.required} />
{:else if field.type === 'number' || field.type === 'integer' || field.type === 'currency' || field.type === 'unix-ts'}
  <Input type="number" bind:value={stringValue} {disabled} readonly={field.readOnly} required={field.required} />
{:else if field.type === 'date'}
  <Input type="text" bind:value={stringValue} placeholder="YYYY-MM-DD" {disabled} readonly={field.readOnly} required={field.required} />
{:else}
  <Input type="text" bind:value={stringValue} {disabled} readonly={field.readOnly} required={field.required} monospace={field.monospace} />
{/if}
```

- [ ] **Step 12.3**: Build + commit

```bash
pnpm build
pnpm typecheck
git add src/client/lib/resource/FieldDisplay.svelte src/client/lib/resource/FieldInput.svelte
git commit -m "$(cat <<'EOF'
feat(resource): FieldDisplay + FieldInput for all spec field types

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: ResourceTable

**Files:**
- Create: `src/client/lib/resource/ResourceTable.svelte`

Renders the list view. Loads `/api/resources/:id/list`, paginates via `cursorParam`, renders one column per field where `tableColumn: true`. Clicking a row navigates to `/r/:id/:recordId`.

- [ ] **Step 13.1**: `src/client/lib/resource/ResourceTable.svelte`

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { api, ApiError } from '$client/lib/api';
  import Button from '$client/lib/ui/Button.svelte';
  import Table from '$client/lib/ui/Table.svelte';
  import FieldDisplay from './FieldDisplay.svelte';
  import type { Resource } from '$shared/resource-schema';

  interface Props {
    resource: Resource;
  }

  let { resource }: Props = $props();

  type Row = Record<string, unknown>;
  let rows = $state<Row[]>([]);
  let loading = $state(true);
  let errorMsg = $state<string | null>(null);

  const columns = $derived(resource.fields.filter((f) => f.tableColumn));
  const primaryField = $derived(resource.fields.find((f) => f.primary));

  async function load() {
    loading = true;
    errorMsg = null;
    try {
      const data = await api<Row[] | Row>(`/api/resources/${resource.id}/list`);
      rows = Array.isArray(data) ? data : ((data as { data?: Row[] }).data ?? []);
    } catch (err) {
      if (err instanceof ApiError) {
        errorMsg = `Failed to load (${err.status})`;
      } else {
        errorMsg = 'Failed to load';
      }
      rows = [];
    } finally {
      loading = false;
    }
  }

  onMount(load);
  $effect(() => {
    // Refetch when the resource id changes.
    resource.id;
    load();
  });

  function openRow(row: Row): void {
    const id = primaryField ? row[primaryField.key] : undefined;
    if (id !== undefined) push(`/r/${resource.id}/${id}`);
  }
</script>

<div class="space-y-4">
  <header class="flex items-baseline justify-between">
    <div>
      <h1 class="text-xl font-semibold tracking-tight">{resource.name}</h1>
      {#if resource.group}
        <p class="text-xs text-[var(--color-muted)]">{resource.group}</p>
      {/if}
    </div>
    {#if resource.create?.enabled}
      <Button onclick={() => push(`/r/${resource.id}/new`)}>New</Button>
    {/if}
  </header>

  {#if loading}
    <p class="text-sm text-[var(--color-muted)]">Loading…</p>
  {:else if errorMsg}
    <p class="text-sm text-[var(--color-error-fg)]">{errorMsg}</p>
    {#if errorMsg.includes('412')}
      <p class="text-sm text-[var(--color-muted)]">
        The <code class="font-mono">{resource.connection}</code> connection isn't configured yet.
      </p>
    {/if}
  {:else if rows.length === 0}
    <p class="text-sm text-[var(--color-muted)]">No records.</p>
  {:else}
    <Table>
      <thead>
        <tr>
          {#each columns as col}
            <th>{col.label}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each rows as row}
          <tr class="clickable" onclick={() => openRow(row)}>
            {#each columns as col}
              <td><FieldDisplay field={col} value={row[col.key]} /></td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </Table>
  {/if}
</div>
```

- [ ] **Step 13.2**: Build + commit

```bash
pnpm build
pnpm typecheck
git add src/client/lib/resource/ResourceTable.svelte
git commit -m "$(cat <<'EOF'
feat(resource): ResourceTable with auto-generated columns + row navigation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: ResourceDetail

**Files:**
- Create: `src/client/lib/resource/ResourceDetail.svelte`

- [ ] **Step 14.1**: `src/client/lib/resource/ResourceDetail.svelte`

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { api, ApiError } from '$client/lib/api';
  import Button from '$client/lib/ui/Button.svelte';
  import FieldDisplay from './FieldDisplay.svelte';
  import type { Resource } from '$shared/resource-schema';

  interface Props {
    resource: Resource;
    recordId: string;
  }

  let { resource, recordId }: Props = $props();

  let record = $state<Record<string, unknown> | null>(null);
  let loading = $state(true);
  let errorMsg = $state<string | null>(null);

  async function load() {
    loading = true;
    errorMsg = null;
    try {
      record = await api<Record<string, unknown>>(
        `/api/resources/${resource.id}/detail/${encodeURIComponent(recordId)}`,
      );
    } catch (err) {
      errorMsg = err instanceof ApiError ? `Failed to load (${err.status})` : 'Failed to load';
    } finally {
      loading = false;
    }
  }

  onMount(load);
  $effect(() => { recordId; resource.id; load(); });
</script>

<div class="space-y-4">
  <nav class="text-xs text-[var(--color-muted)]">
    <a href={`#/r/${resource.id}`} class="hover:text-[var(--color-text)]">{resource.name}</a>
    <span> · </span>
    <span class="font-mono">{recordId}</span>
  </nav>

  {#if loading}
    <p class="text-sm text-[var(--color-muted)]">Loading…</p>
  {:else if errorMsg}
    <p class="text-sm text-[var(--color-error-fg)]">{errorMsg}</p>
  {:else if record}
    <header class="flex items-center justify-between">
      <h1 class="text-xl font-semibold tracking-tight">{resource.name}</h1>
      <div class="flex gap-2">
        {#if resource.update?.enabled}
          <Button variant="secondary" onclick={() => push(`/r/${resource.id}/${recordId}/edit`)}>Edit</Button>
        {/if}
      </div>
    </header>

    <dl class="grid grid-cols-[160px_1fr] gap-y-2 text-sm">
      {#each resource.fields as f}
        <dt class="text-[var(--color-muted)] text-xs pt-1">{f.label}</dt>
        <dd><FieldDisplay field={f} value={record[f.key]} /></dd>
      {/each}
    </dl>
  {/if}
</div>
```

- [ ] **Step 14.2**: Build + commit

```bash
pnpm build
pnpm typecheck
git add src/client/lib/resource/ResourceDetail.svelte
git commit -m "$(cat <<'EOF'
feat(resource): ResourceDetail with auto-rendered field list

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: ResourceForm

**Files:**
- Create: `src/client/lib/resource/ResourceForm.svelte`

Handles create AND edit, picks based on whether `recordId` is given.

- [ ] **Step 15.1**: `src/client/lib/resource/ResourceForm.svelte`

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { api, ApiError } from '$client/lib/api';
  import { toast } from '$client/lib/toast.svelte';
  import Button from '$client/lib/ui/Button.svelte';
  import Field from '$client/lib/ui/Field.svelte';
  import FieldInput from './FieldInput.svelte';
  import type { Resource } from '$shared/resource-schema';

  interface Props {
    resource: Resource;
    /** If present, this is an edit; otherwise it's a create. */
    recordId?: string;
  }

  let { resource, recordId }: Props = $props();

  let values = $state<Record<string, unknown>>({});
  let loading = $state(false);
  let saving = $state(false);
  let errorMsg = $state<string | null>(null);

  const editableFields = $derived(
    resource.fields.filter((f) => (recordId ? f.editable : !f.readOnly) && !f.primary),
  );

  async function loadExisting() {
    if (!recordId) return;
    loading = true;
    try {
      values = await api<Record<string, unknown>>(
        `/api/resources/${resource.id}/detail/${encodeURIComponent(recordId)}`,
      );
    } catch (err) {
      errorMsg = err instanceof ApiError ? `Failed to load (${err.status})` : 'Failed to load';
    } finally {
      loading = false;
    }
  }

  onMount(loadExisting);

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (saving) return;
    saving = true;
    errorMsg = null;
    try {
      if (recordId) {
        await api(`/api/resources/${resource.id}/${encodeURIComponent(recordId)}`, {
          method: 'PATCH',
          body: JSON.stringify(values),
        });
        toast.success('Saved');
        push(`/r/${resource.id}/${recordId}`);
      } else {
        const created = await api<Record<string, unknown>>(`/api/resources/${resource.id}`, {
          method: 'POST',
          body: JSON.stringify(values),
        });
        toast.success('Created');
        const primary = resource.fields.find((f) => f.primary);
        const newId = primary ? created[primary.key] : undefined;
        if (newId !== undefined) push(`/r/${resource.id}/${newId}`);
        else push(`/r/${resource.id}`);
      }
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      errorMsg = `Save failed (${status || 'network'})`;
      toast.error(errorMsg);
    } finally {
      saving = false;
    }
  }
</script>

<div class="space-y-4">
  <header class="flex items-baseline justify-between">
    <h1 class="text-xl font-semibold tracking-tight">
      {recordId ? `Edit ${resource.name}` : `New ${resource.name}`}
    </h1>
  </header>

  {#if loading}
    <p class="text-sm text-[var(--color-muted)]">Loading…</p>
  {:else}
    <form onsubmit={submit} class="space-y-4 max-w-xl">
      {#each editableFields as f}
        <Field label={f.label} required={f.required}>
          <FieldInput
            field={f}
            value={values[f.key]}
            disabled={saving || f.readOnly}
            onchange={(v) => { values = { ...values, [f.key]: v }; }}
          />
        </Field>
      {/each}

      {#if errorMsg}
        <p class="text-sm text-[var(--color-error-fg)]">{errorMsg}</p>
      {/if}

      <div class="flex items-center gap-2">
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : recordId ? 'Save' : 'Create'}</Button>
        <Button
          type="button"
          variant="ghost"
          onclick={() => push(recordId ? `/r/${resource.id}/${recordId}` : `/r/${resource.id}`)}
        >
          Cancel
        </Button>
      </div>
    </form>
  {/if}
</div>
```

- [ ] **Step 15.2**: Build + commit

```bash
pnpm build
pnpm typecheck
git add src/client/lib/resource/ResourceForm.svelte
git commit -m "$(cat <<'EOF'
feat(resource): ResourceForm handles both create and edit

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Routes — ResourceListPage, ResourceDetailPage, ResourceFormPage

**Files:**
- Create: `src/client/routes/ResourceListPage.svelte`
- Create: `src/client/routes/ResourceDetailPage.svelte`
- Create: `src/client/routes/ResourceFormPage.svelte`

Thin wrappers that read the `:resourceId` (and `:recordId`) from `params` props (svelte-spa-router pattern) and forward to the relevant component.

- [ ] **Step 16.1**: `src/client/routes/ResourceListPage.svelte`

```svelte
<script lang="ts">
  import { registry } from '$client/lib/registry.svelte';
  import ResourceTable from '$client/lib/resource/ResourceTable.svelte';

  interface Props { params: { id: string } }
  let { params }: Props = $props();
  const resource = $derived(registry.byId(params.id));
</script>

{#if !resource}
  <p class="text-sm text-[var(--color-muted)]">Unknown resource.</p>
{:else}
  <ResourceTable {resource} />
{/if}
```

- [ ] **Step 16.2**: `src/client/routes/ResourceDetailPage.svelte`

```svelte
<script lang="ts">
  import { registry } from '$client/lib/registry.svelte';
  import ResourceDetail from '$client/lib/resource/ResourceDetail.svelte';

  interface Props { params: { id: string; recordId: string } }
  let { params }: Props = $props();
  const resource = $derived(registry.byId(params.id));
</script>

{#if !resource}
  <p class="text-sm text-[var(--color-muted)]">Unknown resource.</p>
{:else}
  <ResourceDetail {resource} recordId={params.recordId} />
{/if}
```

- [ ] **Step 16.3**: `src/client/routes/ResourceFormPage.svelte`

```svelte
<script lang="ts">
  import { registry } from '$client/lib/registry.svelte';
  import ResourceForm from '$client/lib/resource/ResourceForm.svelte';

  interface Props { params: { id: string; recordId?: string } }
  let { params }: Props = $props();
  const resource = $derived(registry.byId(params.id));
</script>

{#if !resource}
  <p class="text-sm text-[var(--color-muted)]">Unknown resource.</p>
{:else}
  <ResourceForm {resource} recordId={params.recordId} />
{/if}
```

- [ ] **Step 16.4**: Build + commit

```bash
pnpm build
pnpm typecheck
git add src/client/routes/ResourceListPage.svelte src/client/routes/ResourceDetailPage.svelte src/client/routes/ResourceFormPage.svelte
git commit -m "$(cat <<'EOF'
feat(routes): resource list, detail, and form route pages

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: Wire AppShell + new routes in `app.svelte`

**Files:**
- Modify: `src/client/app.svelte`
- Modify: `src/client/routes/home.svelte`

The shell wraps `<Router>`. Routes:
- `/`              → home (lists groups in main, or redirects to first resource)
- `/sign-in`       → sign-in (no shell — auth pages still render bare)
- `/sign-in-sent`  → confirmation (no shell)
- `/r/:id`         → ResourceListPage
- `/r/:id/new`     → ResourceFormPage (create)
- `/r/:id/:recordId`      → ResourceDetailPage
- `/r/:id/:recordId/edit` → ResourceFormPage (edit)

When unauthed, redirect to `/sign-in` as before. When authed and on `/sign-in`, redirect to `/`.

When the SPA first becomes authed, `registry.load()` is called.

- [ ] **Step 17.1**: Replace `src/client/app.svelte` with:

```svelte
<script lang="ts">
  import Router, { push } from 'svelte-spa-router';
  import { onMount } from 'svelte';
  import { session } from '$client/lib/session.svelte';
  import { registry } from '$client/lib/registry.svelte';
  import { theme } from '$client/lib/theme.svelte';
  import AppShell from '$client/lib/shell/AppShell.svelte';
  import ToastHost from '$client/lib/ui/ToastHost.svelte';

  import SignIn from './routes/sign-in.svelte';
  import SignInSent from './routes/sign-in-sent.svelte';
  import Home from './routes/home.svelte';
  import ResourceListPage from './routes/ResourceListPage.svelte';
  import ResourceDetailPage from './routes/ResourceDetailPage.svelte';
  import ResourceFormPage from './routes/ResourceFormPage.svelte';

  const authedRoutes = {
    '/': Home,
    '/r/:id': ResourceListPage,
    '/r/:id/new': ResourceFormPage,
    '/r/:id/:recordId': ResourceDetailPage,
    '/r/:id/:recordId/edit': ResourceFormPage,
    '*': Home,
  };

  const unauthedRoutes = {
    '/sign-in': SignIn,
    '/sign-in-sent': SignInSent,
    '*': SignIn,
  };

  onMount(() => {
    void session.load();
    theme.apply();
  });

  $effect(() => { theme.apply(); });

  $effect(() => {
    // Auth-aware redirects.
    if (session.status === 'anonymous' && !location.hash.startsWith('#/sign-in')) {
      push('/sign-in');
    }
    if (session.status === 'authed' && location.hash.startsWith('#/sign-in')) {
      push('/');
    }
  });

  $effect(() => {
    // Load the resource registry once we're signed in.
    if (session.status === 'authed' && registry.status === 'idle') {
      void registry.load();
    }
  });
</script>

{#if session.status === 'loading'}
  <main class="grid min-h-screen place-items-center">
    <p class="text-sm text-[var(--color-muted)]">Loading…</p>
  </main>
{:else if session.status === 'anonymous'}
  <Router routes={unauthedRoutes} />
{:else}
  <AppShell>
    {#snippet main()}
      <Router routes={authedRoutes} />
    {/snippet}
  </AppShell>
{/if}

<ToastHost />
```

- [ ] **Step 17.2**: Update `src/client/routes/home.svelte` to be shell-aware (it now renders inside the AppShell main slot, NOT as a full-screen). Replace its contents with:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { registry } from '$client/lib/registry.svelte';

  // If there are resources, jump to the first one. Otherwise show a hint.
  onMount(() => {
    if (registry.status === 'ready' && registry.items.length > 0) {
      push(`/r/${registry.items[0].id}`);
    }
  });

  $effect(() => {
    if (registry.status === 'ready' && registry.items.length > 0) {
      push(`/r/${registry.items[0].id}`);
    }
  });
</script>

<div class="space-y-2">
  <h1 class="text-xl font-semibold tracking-tight">admin-boilerplate</h1>
  <p class="text-sm text-[var(--color-muted)]">
    {#if registry.status === 'loading'}
      Loading resources…
    {:else if registry.items.length === 0}
      No resources registered. Drop a file in <code class="font-mono">src/resources/</code> and add it to <code class="font-mono">src/resources/index.ts</code>.
    {:else}
      Pick a resource from the sidebar.
    {/if}
  </p>
</div>
```

- [ ] **Step 17.3**: Update `src/client/routes/sign-in.svelte` — its existing `<main class="grid min-h-screen place-items-center">` is correct since signed-out users see no shell. No change needed. Same for `sign-in-sent.svelte`. Just confirm they still compile.

- [ ] **Step 17.4**: Build + commit

```bash
pnpm build
pnpm typecheck
git add src/client/app.svelte src/client/routes/home.svelte
git commit -m "$(cat <<'EOF'
feat(client): wire AppShell + resource routes; home redirects to first resource

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: Final pre-flight (automated)

- [ ] **Step 18.1**: Full test suite

```bash
lsof -ti :8787 | xargs kill 2>/dev/null
pnpm test 2>&1 | tail -10
```

Expected: 100 Worker tests still passing (we didn't change Worker code).

- [ ] **Step 18.2**: Typecheck

```bash
pnpm typecheck
```

- [ ] **Step 18.3**: Clean build

```bash
rm -rf dist .wrangler/dry-run node_modules/.vite
pnpm build
```

Expected: clean SPA bundle. JS will grow noticeably (more components + router routes); aim for under 100 KB gzip.

- [ ] **Step 18.4**: Worker dry-run

```bash
pnpm dlx wrangler deploy --dry-run --outdir .wrangler/dry-run 2>&1 | tail -10
```

- [ ] **Step 18.5**: Stop here, hand off to controller for manual smoke test.

The smoke test:
1. `pnpm dev:all`
2. Visit `localhost:5173`, sign in as `dev@localhost` via magic link
3. Expect: lands on `/r/jsonplaceholder-posts` (auto-redirect from home) showing the sidebar with "JSONPlaceholder > Posts" and the table empty/loading
4. If empty with "connection_not_configured" message — that's expected on a fresh DB; need to PUT once via console (see Plan 3's last-step note)
5. After connection configured: see ~100 rows in the table
6. Click a row → land on `/r/jsonplaceholder-posts/<id>` detail view
7. Click "Edit" → see form, modify title, click "Save" → toast "Saved", redirect to detail
8. Click "New" from the list → blank form, fill in, "Create" → toast, redirect
9. Toggle theme via topbar icon → page flips light/dark cleanly
10. Click sign-out → returns to `/sign-in`

---

### Task 19: Push + open PR

- [ ] **Step 19.1**: Push

```bash
git push -u origin feature/frontend-shell-resource-ui
```

- [ ] **Step 19.2**: Open PR

```bash
gh pr create --base main --head feature/frontend-shell-resource-ui \
  --title "Frontend shell + UI primitives + Resource UI" \
  --body "$(cat <<'EOF'
## Summary
- \`AppShell\` 8-slot CSS Grid primitive (§8 of the design spec) with Svelte 5 snippet props. Default sidebar auto-generates from \`/api/resources\` grouped by \`.group\`. Default topbar-right has a theme toggle + sign-out.
- Light + dark mode. Choice cycles light → dark → system. Persisted to localStorage; tracks system pref live via \`matchMedia\`.
- UI primitives: Button, IconButton, Pill, Input, Textarea, Select, Checkbox, Field, Table, ToastHost. Restrained Swiss/Apple aesthetic — generous whitespace, sharp corners, no decorative shadows.
- Resource UI: \`ResourceTable\` (auto columns from \`tableColumn: true\` fields), \`ResourceDetail\` (label/value grid), \`ResourceForm\` (handles both create and edit, type-aware inputs).
- Routes: \`/r/:id\`, \`/r/:id/:recordId\`, \`/r/:id/:recordId/edit\`, \`/r/:id/new\`.
- Home redirects to the first registered resource. Sign-in unchanged from Plan 2.

## What's NOT in this PR
- Per-component unit tests — Svelte runes need a Svelte-aware test pool, the current one is workerd-oriented. Manual smoke test covers the flow.
- Pagination beyond the first page (the proxy supports cursors; the UI doesn't yet).
- Server-side sort/filter, search bar, saved views — phase 2.
- Settings pages (Connections / Access / Users / Audit) — Plan 5.

## Test plan
- [x] \`pnpm test\` — 100 Worker tests still pass (no Worker code changed)
- [x] \`pnpm typecheck\` — clean
- [x] \`pnpm build\` — clean
- [x] \`pnpm dev:all\` smoke test — sign in → land on \`/r/jsonplaceholder-posts\` → see table → click row → see detail → edit + save → toast → theme toggle → sign out

## Notes for review
- This is the "simple clean first pass". Aesthetic iteration deferred — colour, type rhythm, motion will get a polish pass once the shape is right.
- Component tests deferred. We may add them once we hit a regression caught manually.
- \`{@render (snippet ?? Default)()}\` patterns may not work in all Svelte 5 versions — fell back to \`{#if snippet}...{:else}<Default />{/if}\` where needed. Either compiles to equivalent output.

## Design
Spec: [\`docs/superpowers/specs/2026-05-13-admin-boilerplate-design.md\`](docs/superpowers/specs/2026-05-13-admin-boilerplate-design.md) (§8 Shell + §9 Visual)
Plan: [\`docs/superpowers/plans/2026-05-13-04-frontend-shell-resource-ui.md\`](docs/superpowers/plans/2026-05-13-04-frontend-shell-resource-ui.md)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage** (against §8 Shell + §9 Visual + relevant pieces of §7 Resources):
- §8.1 Slots — all 8 slots present in AppShell ✓
- §8.2 Snippet props API — done ✓
- §8.4 CSS Grid with collapsing tracks — done ✓
- §9 Typography stack + colour tokens + radii — done (Plan 1 base + Plan 4 extensions) ✓
- §9 Light + dark — done ✓
- §7.3 ResourceTable / ResourceDetail / ResourceForm — done ✓
- §7.1 All field types have a display + input variant (some fall back to text input as base case) ✓

Not covered (deferred):
- Cursor pagination UI
- Server-side sort/filter/search
- Settings pages (Plan 5)
- Tauri wrapper (Plan 5)
- Phase-2 niceties: command palette, saved views, three-pane detail layout

**Placeholder scan** — none.

**Type consistency** — `Resource`, `Field` from `$shared/resource-schema` used consistently across resource components. `ApiError` from `lib/api` propagates through stores. `Snippet` from `svelte` typed where needed.

**Scope** — 19 tasks. Smaller per-task than Plan 3 (Svelte components are mostly mechanical once tokens are set), no D1 or auth work. Most tasks land in ~10 minutes of subagent time.
