# Plan 7 — Design polish + sample pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the boilerplate's design system from "shape right, polish later" (Plan 4) to genuinely polished. Refine tokens, add the missing UI primitives (Tabs, Modal, Dropdown, Skeleton, EmptyState, StatCard, Toolbar), polish the existing resource components, add a Worker-internal mock data layer that exercises the design system against realistic shapes (currency, status enums, mixed field types), build a `/design` showcase route for designers/devs, and replace the placeholder dashboard with a real stat-card + recent-activity layout. Plus a small one-shot wrangler.toml hygiene fix (scrub real CF resource IDs back to placeholders so the public repo doesn't leak account-specific info).

**Architecture:** Same as before — Svelte 5 + Tailwind v4 + Hono. No new runtime deps. The mock data layer is just one new Worker route group (`/_mock/*`) serving canned JSON; forks delete it when they have real connections.

**Visual decisions:** Five tasks need a visual choice (skeleton treatment, stat-card layout, empty-state pattern, modal animation, dashboard layout). For each, the controller fires up the brainstorming visual companion + optionally Claude Design, presents 2–3 options, gets a click from the user, THEN dispatches the implementer with the chosen treatment baked into the prompt.

---

## Prerequisites

- Plan 6 merged to `main`. Local `main` synced.
- 122 Worker tests passing.
- The brainstorming visual companion is available (`scripts/start-server.sh` under the superpowers skill).

---

## Files Created / Modified by this Plan

```
wrangler.toml                                     # MODIFY: scrub real IDs back to placeholders
src/
├── client/
│   ├── app.css                                   # MODIFY: motion + elevation + refined focus tokens
│   ├── app.svelte                                # MODIFY: add /design route
│   ├── lib/
│   │   ├── ui/
│   │   │   ├── Button.svelte                     # MODIFY: polish hover/focus
│   │   │   ├── Input.svelte                      # MODIFY: focus ring, error state
│   │   │   ├── Pill.svelte                       # MODIFY: more tones, subtle border option
│   │   │   ├── Table.svelte                      # MODIFY: hover state, density variant
│   │   │   ├── Tabs.svelte                       # new
│   │   │   ├── Modal.svelte                      # new
│   │   │   ├── Dropdown.svelte                   # new
│   │   │   ├── Skeleton.svelte                   # new
│   │   │   ├── EmptyState.svelte                 # new
│   │   │   ├── StatCard.svelte                   # new
│   │   │   └── Toolbar.svelte                    # new
│   │   ├── resource/
│   │   │   ├── ResourceTable.svelte              # MODIFY: skeleton loading, sortable headers, better empty state
│   │   │   ├── ResourceDetail.svelte             # MODIFY: visual hierarchy, optional sections
│   │   │   └── ResourceForm.svelte               # MODIFY: visual hierarchy, optional field grouping
│   │   └── shell/
│   │       └── DefaultSidebar.svelte             # MODIFY: link to /design (admin-only)
│   └── routes/
│       ├── home.svelte                           # MODIFY: real dashboard, no auto-redirect
│       └── DesignShowcasePage.svelte             # new
├── worker/
│   ├── index.ts                                  # MODIFY: register _mock routes
│   └── _mock/
│       ├── routes.ts                             # new: serves fake CRM data
│       └── data.ts                               # new: the fake dataset (customers, subscriptions, invoices, activity)
├── connections/
│   ├── index.ts                                  # MODIFY: add mock to the array
│   └── mock.ts                                   # new
└── resources/
    ├── index.ts                                  # MODIFY: add 4 new sample resources
    ├── mock-customers.ts                         # new
    ├── mock-subscriptions.ts                     # new
    ├── mock-invoices.ts                          # new
    └── mock-activity.ts                          # new
```

---

## Tasks

### Task 1: Branch + plan commit + wrangler.toml hygiene

**Files:**
- Modify: `wrangler.toml`
- Commit: this plan doc

- [ ] **Step 1.1: Create branch**

```bash
git checkout main
git pull origin main
git checkout -b feature/design-polish-samples
```

- [ ] **Step 1.2: Scrub `wrangler.toml`**

Read the current `wrangler.toml`. Replace the real CF account-specific values with clear placeholders:

- `database_id = "<real-uuid>"` → `database_id = "REPLACE_WITH_YOUR_D1_DATABASE_ID"`
- Both KV `id = "<real>"` → `id = "REPLACE_WITH_YOUR_KV_NAMESPACE_ID"`

Add a top-of-file comment that makes the replacement obvious:

```toml
# After cloning, replace each REPLACE_WITH_... value with the real ID from
# `wrangler d1 create admin-boilerplate` and `wrangler kv namespace create ...`.
# See README.md → Setup for the full walkthrough.
```

**Important — this is just the committed version.** Your LOCAL working copy needs the real IDs to keep `pnpm dev:all` working. After committing the placeholder version, restore your local working copy with `git checkout HEAD~1 -- wrangler.toml` (or just paste the IDs back manually) and keep that local edit *uncommitted* going forward.

- [ ] **Step 1.3: Commit the scrub + the plan doc together**

```bash
git add wrangler.toml docs/superpowers/plans/2026-05-15-07-design-polish-samples.md
git commit -m "$(cat <<'EOF'
chore: scrub wrangler.toml IDs + add Plan 7 doc

Scrub the real D1 / KV resource IDs out of the committed wrangler.toml
back to placeholders. They were committed during the initial Plan 1 setup
walkthrough; they're not credentials but they do identify specific
resources on a CF account that shouldn't be in a public repo. Forks
generate their own via the README quickstart.

Plus: Plan 7 doc — design polish + sample pages.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 1.4: Restore local working copy**

After the commit, paste your real IDs back into `wrangler.toml` for local dev. Don't `git add` that file again. Verify with `git status`: `wrangler.toml` should appear as "modified" (your local diff vs the committed placeholder version) — that's correct and intended.

---

### Task 2: Token refinement (motion, focus, elevation)

**Files:**
- Modify: `src/client/app.css`

Add motion tokens, refined focus-ring tokens, and elevation tokens for modals/dropdowns. Plus a couple of refinements to the type scale.

- [ ] **Step 2.1: Append to the `@theme` block in `src/client/app.css`**

Read the current file. Inside the existing `@theme { ... }` block (preserve everything that's already there), add:

```css
  /* Motion */
  --motion-fast: 120ms;
  --motion-normal: 180ms;
  --motion-slow: 280ms;
  --motion-easing: cubic-bezier(0.16, 1, 0.3, 1);

  /* Focus rings */
  --focus-ring-color: #0a0a0a;
  --focus-ring-offset: 2px;
  --focus-ring-width: 2px;

  /* Elevation (used by Modal, Dropdown — sparingly) */
  --elevation-1: 0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.06);
  --elevation-2: 0 4px 6px rgba(0, 0, 0, 0.05), 0 10px 15px rgba(0, 0, 0, 0.08);
  --elevation-3: 0 10px 15px rgba(0, 0, 0, 0.08), 0 20px 25px rgba(0, 0, 0, 0.10);
```

And inside the existing `[data-theme="dark"]` block, add dark overrides:

```css
  --focus-ring-color: #fafafa;
  --elevation-1: 0 1px 2px rgba(0, 0, 0, 0.40), 0 1px 3px rgba(0, 0, 0, 0.60);
  --elevation-2: 0 4px 6px rgba(0, 0, 0, 0.40), 0 10px 15px rgba(0, 0, 0, 0.60);
  --elevation-3: 0 10px 15px rgba(0, 0, 0, 0.50), 0 20px 25px rgba(0, 0, 0, 0.70);
```

- [ ] **Step 2.2: Verify the build**

```bash
pnpm build 2>&1 | tail -6
```

Expected: clean build, slight CSS bundle growth.

- [ ] **Step 2.3: Commit**

```bash
git add src/client/app.css
git commit -m "$(cat <<'EOF'
feat(tokens): motion, focus-ring, elevation tokens (light + dark)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Polish existing primitives — Button, Input, Pill, Table

**Files:**
- Modify: `src/client/lib/ui/Button.svelte`
- Modify: `src/client/lib/ui/Input.svelte`
- Modify: `src/client/lib/ui/Pill.svelte`
- Modify: `src/client/lib/ui/Table.svelte`

Targeted polish, not rewrites. Same APIs, better visual treatment.

- [ ] **Step 3.1: Button — add motion-token-based transitions + visible focus ring**

Read current `Button.svelte`. Update the `base` class to use the new motion tokens and a visible focus ring built from focus-ring tokens. Key changes:

```svelte
const base = 'inline-flex items-center justify-center font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring-color)]';
```

Plus an inline style for transition duration: `style:transition-duration={'var(--motion-fast)'}` is too fiddly — instead, set transition globally via a class. Simplest:

```svelte
const base = 'inline-flex items-center justify-center font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
// + on the button element:
//   style:outline-color="var(--focus-ring-color)"
//   style:transition="background-color var(--motion-fast) var(--motion-easing), color var(--motion-fast) var(--motion-easing)"
```

Preserve the existing variants and sizes.

- [ ] **Step 3.2: Input — add focus ring + optional error state**

Add an `error?: boolean` prop. When `error === true`, swap the border color to `var(--color-error-fg)` and outline-color on focus to error. Plus motion-token-based transition.

```svelte
<script lang="ts">
  interface Props {
    // ... existing props
    error?: boolean;
  }
  let { /* existing */, error = false, ... }: Props = $props();
</script>

<input
  {/* existing bindings */}
  class="w-full rounded-md border bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 {error ? 'border-[var(--color-error-fg)]' : 'border-[var(--color-border)]'}"
  style:outline-color={error ? 'var(--color-error-fg)' : 'var(--focus-ring-color)'}
  style:transition="border-color var(--motion-fast) var(--motion-easing)"
/>
```

`Field.svelte`'s existing `error` prop should now propagate to `Input` (read `Field.svelte`, if it takes `error: string` it can pass `error={!!error}` to Input).

- [ ] **Step 3.3: Pill — add an optional subtle-border variant**

Add a `border?: boolean` prop. When `border === true`, add `border border-[var(--color-border)]` for a thin definitional outline. Useful for pills that need to read as containers rather than soft chips.

- [ ] **Step 3.4: Table — add a density variant and softer hover**

Add a `density?: 'comfortable' | 'compact'` prop, default `'comfortable'`. Compact tightens cell padding from `10px 14px` to `6px 10px`. Update the `:global(table tbody tr:hover)` rule to use `transition: background var(--motion-fast)` for smoother hover.

Read the current `Table.svelte`. The `density` prop should affect inner `<td>` / `<th>` padding via a class on the wrapping `<table>` (e.g. `table.compact td { padding: 6px 10px }`).

- [ ] **Step 3.5: Build + typecheck + commit**

```bash
pnpm build && pnpm typecheck
git add src/client/lib/ui/Button.svelte src/client/lib/ui/Input.svelte src/client/lib/ui/Pill.svelte src/client/lib/ui/Table.svelte
git commit -m "$(cat <<'EOF'
feat(ui): polish existing primitives — focus rings, motion, density, error state

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Tabs primitive

**Files:**
- Create: `src/client/lib/ui/Tabs.svelte`

Simple controlled tabs. Used by ResourceDetail (Task 9) and DesignShowcasePage (Task 13).

- [ ] **Step 4.1: Create `src/client/lib/ui/Tabs.svelte`**

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Tab {
    key: string;
    label: string;
    content: Snippet;
  }

  interface Props {
    tabs: Tab[];
    activeKey?: string;
  }

  let { tabs, activeKey = $bindable(tabs[0]?.key ?? '') }: Props = $props();

  const activeTab = $derived(tabs.find((t) => t.key === activeKey) ?? tabs[0]);
</script>

<div class="space-y-4">
  <div class="border-b border-[var(--color-border)] flex gap-4" role="tablist">
    {#each tabs as t}
      <button
        type="button"
        role="tab"
        aria-selected={t.key === activeKey}
        onclick={() => (activeKey = t.key)}
        class="pb-2 px-1 text-sm border-b-2 transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 {t.key === activeKey ? 'border-[var(--color-text)] text-[var(--color-text)] font-medium' : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'}"
        style:outline-color="var(--focus-ring-color)"
        style:transition-duration="var(--motion-fast)"
      >
        {t.label}
      </button>
    {/each}
  </div>
  {#if activeTab}
    {@render activeTab.content()}
  {/if}
</div>
```

- [ ] **Step 4.2: Build + commit**

```bash
pnpm build && pnpm typecheck
git add src/client/lib/ui/Tabs.svelte
git commit -m "$(cat <<'EOF'
feat(ui): Tabs primitive

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Modal/Dialog primitive 🎨 (visual decision)

**🎨 Controller visual-decision step first:** before dispatching this task, the controller fires up the visual companion and mocks three modal-open animations: fade, slide-up, scale. User picks one. THEN dispatch the implementer with the chosen animation baked into the spec below.

**Files:**
- Create: `src/client/lib/ui/Modal.svelte`

- [ ] **Step 5.1: Create `src/client/lib/ui/Modal.svelte`**

(Implementer: use the animation treatment the controller selected. Default below is `fade + scale` — replace if controller chose differently.)

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    open: boolean;
    onclose?: () => void;
    title?: string;
    children: Snippet;
    footer?: Snippet;
  }

  let { open = $bindable(), onclose, title, children, footer }: Props = $props();

  function close(): void {
    if (onclose) onclose();
    else open = false;
  }

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) close();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div
    class="fixed inset-0 z-40 grid place-items-center bg-black/40 p-6"
    onclick={handleBackdropClick}
    role="presentation"
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto"
      style:box-shadow="var(--elevation-3)"
      style:animation="modal-in var(--motion-normal) var(--motion-easing)"
    >
      {#if title}
        <header class="px-5 py-4 border-b border-[var(--color-border)]">
          <h2 id="modal-title" class="text-base font-semibold tracking-tight">{title}</h2>
        </header>
      {/if}
      <div class="px-5 py-4">
        {@render children()}
      </div>
      {#if footer}
        <footer class="px-5 py-3 border-t border-[var(--color-border)] flex justify-end gap-2">
          {@render footer()}
        </footer>
      {/if}
    </div>
  </div>
{/if}

<style>
  @keyframes modal-in {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: scale(1); }
  }
</style>
```

- [ ] **Step 5.2: Build + commit**

```bash
pnpm build && pnpm typecheck
git add src/client/lib/ui/Modal.svelte
git commit -m "$(cat <<'EOF'
feat(ui): Modal primitive with backdrop + escape + animation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Dropdown menu primitive

**Files:**
- Create: `src/client/lib/ui/Dropdown.svelte`

Click-to-open. Closes on outside-click, escape, or item-click.

- [ ] **Step 6.1: Create `src/client/lib/ui/Dropdown.svelte`**

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';

  interface Props {
    trigger: Snippet<[{ toggle: () => void; isOpen: boolean }]>;
    children: Snippet<[{ close: () => void }]>;
    align?: 'left' | 'right';
  }

  let { trigger, children, align = 'left' }: Props = $props();

  let isOpen = $state(false);
  let rootEl: HTMLDivElement | undefined;

  function toggle(): void { isOpen = !isOpen; }
  function close(): void { isOpen = false; }

  function handleDocumentClick(e: MouseEvent): void {
    if (rootEl && !rootEl.contains(e.target as Node)) close();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }

  onMount(() => {
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div bind:this={rootEl} class="relative inline-block">
  {@render trigger({ toggle, isOpen })}
  {#if isOpen}
    <div
      role="menu"
      class="absolute top-full mt-1 min-w-[10rem] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md py-1 z-30 {align === 'right' ? 'right-0' : 'left-0'}"
      style:box-shadow="var(--elevation-2)"
    >
      {@render children({ close })}
    </div>
  {/if}
</div>
```

Usage pattern (for showcase + ResourceTable row actions):

```svelte
<Dropdown>
  {#snippet trigger({ toggle })}
    <IconButton ariaLabel="Actions" onclick={toggle}>⋯</IconButton>
  {/snippet}
  {#snippet children({ close })}
    <button class="w-full text-left px-3 py-1.5 hover:bg-[var(--color-surface-2)]" onclick={() => { /* action */; close(); }}>Edit</button>
    <button class="w-full text-left px-3 py-1.5 hover:bg-[var(--color-surface-2)]" onclick={() => { /* action */; close(); }}>Delete</button>
  {/snippet}
</Dropdown>
```

- [ ] **Step 6.2: Build + commit**

```bash
pnpm build && pnpm typecheck
git add src/client/lib/ui/Dropdown.svelte
git commit -m "$(cat <<'EOF'
feat(ui): Dropdown menu primitive with outside-click + escape

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Skeleton + EmptyState + StatCard + Toolbar batch 🎨 (two visual decisions)

**🎨 Controller visual-decision steps first:**
1. **Skeleton treatment** — mock 3 options: static grey, pulse animation, shimmer animation. User picks one.
2. **Empty state pattern** — mock 3 options: text-only, icon + text, illustration + text. User picks one.

Then dispatch with the chosen treatments baked into the spec.

**Files:**
- Create: `src/client/lib/ui/Skeleton.svelte`
- Create: `src/client/lib/ui/EmptyState.svelte`
- Create: `src/client/lib/ui/StatCard.svelte`
- Create: `src/client/lib/ui/Toolbar.svelte`

- [ ] **Step 7.1: `src/client/lib/ui/Skeleton.svelte`**

(Default below is pulse — swap to shimmer/static per controller choice.)

```svelte
<script lang="ts">
  interface Props {
    width?: string;
    height?: string;
    rounded?: 'sm' | 'md' | 'full';
  }
  let { width = '100%', height = '1em', rounded = 'sm' }: Props = $props();
  const radius = rounded === 'full' ? '999px' : rounded === 'md' ? 'var(--radius-md)' : 'var(--radius-sm)';
</script>

<span
  class="inline-block bg-[var(--color-surface-2)] animate-pulse"
  style:width
  style:height
  style:border-radius={radius}
></span>

<style>
  @keyframes pulse { 50% { opacity: 0.5; } }
  .animate-pulse { animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
</style>
```

- [ ] **Step 7.2: `src/client/lib/ui/EmptyState.svelte`**

(Default below is icon + text — swap per controller choice.)

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  interface Props {
    title: string;
    description?: string;
    icon?: string;       // emoji or symbol; default ⌀
    action?: Snippet;    // optional CTA button(s)
  }
  let { title, description, icon = '⌀', action }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center py-12 text-center">
  <div class="text-3xl text-[var(--color-muted)] mb-3" aria-hidden="true">{icon}</div>
  <h3 class="text-base font-semibold tracking-tight">{title}</h3>
  {#if description}
    <p class="text-sm text-[var(--color-muted)] mt-1 max-w-md">{description}</p>
  {/if}
  {#if action}
    <div class="mt-4">{@render action()}</div>
  {/if}
</div>
```

- [ ] **Step 7.3: `src/client/lib/ui/StatCard.svelte`**

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  interface Props {
    label: string;
    value: string | number;
    delta?: string;
    tone?: 'neutral' | 'positive' | 'negative';
    children?: Snippet;   // optional sub-line
  }
  let { label, value, delta, tone = 'neutral', children }: Props = $props();

  const tones = {
    neutral:  'text-[var(--color-muted)]',
    positive: 'text-[var(--color-success-fg)]',
    negative: 'text-[var(--color-error-fg)]',
  };
</script>

<div class="border border-[var(--color-border)] rounded-md bg-[var(--color-surface)] p-4">
  <p class="text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)] font-medium">{label}</p>
  <p class="text-2xl font-semibold tracking-tight mt-1">{value}</p>
  {#if delta}
    <p class="text-xs mt-1 {tones[tone]}">{delta}</p>
  {/if}
  {#if children}
    <div class="mt-2 text-xs text-[var(--color-muted)]">{@render children()}</div>
  {/if}
</div>
```

- [ ] **Step 7.4: `src/client/lib/ui/Toolbar.svelte`**

A horizontal bar with slots for left content (title / search) and right content (actions). Used above ResourceTable.

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  interface Props {
    left?: Snippet;
    right?: Snippet;
  }
  let { left, right }: Props = $props();
</script>

<div class="flex items-center justify-between gap-4 py-2">
  <div class="flex items-center gap-3 flex-1 min-w-0">
    {#if left}{@render left()}{/if}
  </div>
  <div class="flex items-center gap-2">
    {#if right}{@render right()}{/if}
  </div>
</div>
```

- [ ] **Step 7.5: Build + commit**

```bash
pnpm build && pnpm typecheck
git add src/client/lib/ui/Skeleton.svelte src/client/lib/ui/EmptyState.svelte src/client/lib/ui/StatCard.svelte src/client/lib/ui/Toolbar.svelte
git commit -m "$(cat <<'EOF'
feat(ui): Skeleton + EmptyState + StatCard + Toolbar primitives

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: ResourceTable polish

**Files:**
- Modify: `src/client/lib/resource/ResourceTable.svelte`

Improvements:
1. Replace `"Loading…"` text with skeleton rows (5 rows matching the column count).
2. Replace `"No records."` text with `<EmptyState>`.
3. Add client-side sortable columns: click a column header to sort. Up/down arrow indicator. Doesn't paginate server-side; works on the current page only.
4. Add a `Toolbar` above the table with the title on the left and the New button on the right (where applicable).

- [ ] **Step 8.1: Read the current file.** Note the existing structure (rows, loading, errorMsg, columns derived from fields, primary field, openRow, next, hasMore, cursor).

- [ ] **Step 8.2: Refactor**

Top-level changes:

```ts
import EmptyState from '$client/lib/ui/EmptyState.svelte';
import Skeleton from '$client/lib/ui/Skeleton.svelte';
import Toolbar from '$client/lib/ui/Toolbar.svelte';

// Sorting state
let sortKey = $state<string | null>(null);
let sortDir = $state<'asc' | 'desc'>('asc');

function toggleSort(key: string): void {
  if (sortKey === key) {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey = key;
    sortDir = 'asc';
  }
}

const sortedRows = $derived.by(() => {
  if (!sortKey) return rows;
  const key = sortKey;
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return -dir;
    if (bv == null) return dir;
    if (av < bv) return -dir;
    if (av > bv) return dir;
    return 0;
  });
});
```

Template — replace the existing rendering:

```svelte
<div class="space-y-4">
  <Toolbar>
    {#snippet left()}
      <div>
        <h1 class="text-xl font-semibold tracking-tight">{resource.name}</h1>
        {#if resource.group}
          <p class="text-xs text-[var(--color-muted)]">{resource.group}</p>
        {/if}
      </div>
    {/snippet}
    {#snippet right()}
      {#if resource.create?.enabled}
        <Button onclick={() => push(`/r/${resource.id}/new`)}>New</Button>
      {/if}
    {/snippet}
  </Toolbar>

  {#if loading}
    <Table>
      <thead>
        <tr>
          {#each columns as col}
            <th>{col.label}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each Array(5) as _}
          <tr>
            {#each columns as _col}
              <td><Skeleton width="60%" /></td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </Table>
  {:else if errorMsg}
    <EmptyState
      title="Couldn't load records"
      description={errorMsg.includes('412')
        ? `The "${resource.connection}" connection isn't configured yet.`
        : errorMsg}
    />
  {:else if sortedRows.length === 0}
    <EmptyState
      title="No records"
      description={resource.create?.enabled ? 'Click New to add the first one.' : 'Nothing to show yet.'}
    />
  {:else}
    <Table>
      <thead>
        <tr>
          {#each columns as col}
            <th>
              <button
                type="button"
                class="inline-flex items-center gap-1 hover:text-[var(--color-text)] transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style:outline-color="var(--focus-ring-color)"
                onclick={() => toggleSort(col.key)}
              >
                {col.label}
                {#if sortKey === col.key}
                  <span class="text-[10px]" aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </button>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each sortedRows as row}
          <tr class="clickable" onclick={() => openRow(row)}>
            {#each columns as col}
              <td><FieldDisplay field={col} value={row[col.key]} /></td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </Table>

    {#if hasMore}
      <div class="flex justify-end pt-2">
        <Button variant="secondary" onclick={next}>Next →</Button>
      </div>
    {/if}
  {/if}
</div>
```

- [ ] **Step 8.3: Build + commit**

```bash
pnpm build && pnpm typecheck
git add src/client/lib/resource/ResourceTable.svelte
git commit -m "$(cat <<'EOF'
feat(resource): ResourceTable polish — skeleton loading, sortable headers, EmptyState, Toolbar

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: ResourceDetail + ResourceForm polish

**Files:**
- Modify: `src/client/lib/resource/ResourceDetail.svelte`
- Modify: `src/client/lib/resource/ResourceForm.svelte`

ResourceDetail polish:
- Skeleton placeholders while loading
- Visual hierarchy: section headers, optional field grouping
- Replace inline breadcrumb with a styled toolbar

ResourceForm polish:
- Skeleton on load
- Section headers if a resource declares groups
- Better save/cancel button placement (right-aligned)

- [ ] **Step 9.1: ResourceDetail polish**

Read the current file. Replace loading state with skeletons. Add a Toolbar at the top with breadcrumb on left and Edit button on right.

Key changes:

```svelte
<script lang="ts">
  // ... existing imports
  import Skeleton from '$client/lib/ui/Skeleton.svelte';
  import Toolbar from '$client/lib/ui/Toolbar.svelte';
  import EmptyState from '$client/lib/ui/EmptyState.svelte';
</script>

<div class="space-y-4">
  <Toolbar>
    {#snippet left()}
      <nav class="text-xs text-[var(--color-muted)]">
        <a href={`#/r/${resource.id}`} class="hover:text-[var(--color-text)]">{resource.name}</a>
        <span> · </span>
        <span class="font-mono">{recordId}</span>
      </nav>
    {/snippet}
    {#snippet right()}
      {#if !loading && record && resource.update?.enabled}
        <Button variant="secondary" onclick={() => push(`/r/${resource.id}/${recordId}/edit`)}>Edit</Button>
      {/if}
    {/snippet}
  </Toolbar>

  {#if loading}
    <dl class="grid grid-cols-[160px_1fr] gap-y-2 text-sm">
      {#each Array(6) as _}
        <dt class="text-[var(--color-muted)] text-xs pt-1"><Skeleton width="80%" /></dt>
        <dd><Skeleton width="40%" /></dd>
      {/each}
    </dl>
  {:else if errorMsg}
    <EmptyState title="Couldn't load record" description={errorMsg} />
  {:else if record}
    <header>
      <h1 class="text-xl font-semibold tracking-tight">{resource.name}</h1>
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

- [ ] **Step 9.2: ResourceForm polish**

Add Skeleton during the load-existing case. Right-align save/cancel.

```svelte
<!-- inside the {#if loading} branch, replace the loading text with: -->
<div class="space-y-4 max-w-xl">
  {#each Array(4) as _}
    <div class="space-y-1">
      <Skeleton width="20%" height="12px" />
      <Skeleton width="100%" height="36px" rounded="md" />
    </div>
  {/each}
</div>
```

Right-align the button row at the bottom:

```svelte
<div class="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
  <Button type="button" variant="ghost" onclick={() => push(recordId ? `/r/${resource.id}/${recordId}` : `/r/${resource.id}`)}>
    Cancel
  </Button>
  <Button type="submit" disabled={saving}>{saving ? 'Saving…' : recordId ? 'Save' : 'Create'}</Button>
</div>
```

- [ ] **Step 9.3: Build + commit**

```bash
pnpm build && pnpm typecheck
git add src/client/lib/resource/ResourceDetail.svelte src/client/lib/resource/ResourceForm.svelte
git commit -m "$(cat <<'EOF'
feat(resource): ResourceDetail + ResourceForm polish — skeletons, toolbar, right-aligned actions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Mock data — Worker `_mock` routes + fake CRM dataset

**Files:**
- Create: `src/worker/_mock/data.ts`
- Create: `src/worker/_mock/routes.ts`
- Modify: `src/worker/index.ts` (mount the routes)

The mock data is a small fake CRM: ~30 customers, ~50 subscriptions, ~80 invoices, ~100 activity entries. Deterministic generation so the data is stable across requests. Read endpoints only (no mutations) — the design system polish doesn't require write paths for samples.

- [ ] **Step 10.1: Create `src/worker/_mock/data.ts`**

```ts
/**
 * Deterministic fake CRM dataset for the design-system samples.
 *
 * Generated at module load time (no per-request cost beyond array indexing).
 * Deterministic seed so the data is stable — list views render the same
 * order on every request.
 */

const FIRST = ['Ada', 'Alan', 'Grace', 'Edsger', 'Barbara', 'Donald', 'Linus', 'Margaret', 'John', 'Anita', 'Tony', 'Brian', 'Dennis', 'Ken', 'Niklaus', 'Bjarne', 'Guido', 'Yukihiro', 'James', 'Brendan'];
const LAST = ['Lovelace', 'Turing', 'Hopper', 'Dijkstra', 'Liskov', 'Knuth', 'Torvalds', 'Hamilton', 'Backus', 'Borg', 'Hoare', 'Kernighan', 'Ritchie', 'Thompson', 'Wirth', 'Stroustrup', 'Rossum', 'Matsumoto', 'Gosling', 'Eich'];
const CITIES = ['London', 'Berlin', 'Tokyo', 'New York', 'Paris', 'Sydney', 'Toronto', 'Amsterdam', 'Singapore', 'Stockholm'];
const PLANS = ['Pro', 'Team', 'Business', 'Enterprise'];
const STATUSES = ['active', 'past_due', 'canceled', 'trialing'] as const;

function det(seed: number, i: number, mod: number): number {
  // Simple deterministic pseudo-random.
  return Math.abs(Math.sin(seed * 9301 + i * 49297) * 233280) % mod;
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  city: string;
  plan: string;
  mrr_cents: number;
  status: typeof STATUSES[number];
  created_at: number;
}

export interface Subscription {
  id: string;
  customer_id: string;
  plan: string;
  status: typeof STATUSES[number];
  amount_cents: number;
  current_period_end: number;
  created_at: number;
}

export interface Invoice {
  id: string;
  customer_id: string;
  amount_cents: number;
  status: 'paid' | 'open' | 'void' | 'uncollectible';
  due_at: number;
  paid_at: number | null;
}

export interface Activity {
  id: string;
  customer_id: string;
  action: string;
  detail: string;
  ts: number;
}

const NOW = 1726000000; // Stable epoch for deterministic dates.

export const customers: Customer[] = Array.from({ length: 30 }, (_, i) => {
  const first = FIRST[Math.floor(det(1, i, FIRST.length))]!;
  const last = LAST[Math.floor(det(2, i, LAST.length))]!;
  const plan = PLANS[Math.floor(det(3, i, PLANS.length))]!;
  return {
    id: `cus_${(i + 1).toString().padStart(4, '0')}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
    name: `${first} ${last}`,
    city: CITIES[Math.floor(det(4, i, CITIES.length))]!,
    plan,
    mrr_cents: Math.floor(det(5, i, 100)) * 100 + 2900,
    status: STATUSES[Math.floor(det(6, i, STATUSES.length))]!,
    created_at: NOW - Math.floor(det(7, i, 365 * 86400)),
  };
});

export const subscriptions: Subscription[] = Array.from({ length: 50 }, (_, i) => {
  const c = customers[Math.floor(det(10, i, customers.length))]!;
  return {
    id: `sub_${(i + 1).toString().padStart(4, '0')}`,
    customer_id: c.id,
    plan: c.plan,
    status: STATUSES[Math.floor(det(11, i, STATUSES.length))]!,
    amount_cents: c.mrr_cents,
    current_period_end: NOW + Math.floor(det(12, i, 30 * 86400)),
    created_at: c.created_at,
  };
});

export const invoices: Invoice[] = Array.from({ length: 80 }, (_, i) => {
  const c = customers[Math.floor(det(20, i, customers.length))]!;
  const status = (['paid', 'paid', 'paid', 'open', 'void'] as const)[Math.floor(det(21, i, 5))]!;
  const due = NOW - Math.floor(det(22, i, 60 * 86400));
  return {
    id: `inv_${(i + 1).toString().padStart(4, '0')}`,
    customer_id: c.id,
    amount_cents: c.mrr_cents,
    status,
    due_at: due,
    paid_at: status === 'paid' ? due - 86400 * 2 : null,
  };
});

const ACTIONS = ['signed_in', 'updated_card', 'plan_upgraded', 'plan_downgraded', 'invoice_paid', 'invoice_failed', 'created_team', 'invited_member'];
export const activity: Activity[] = Array.from({ length: 100 }, (_, i) => {
  const c = customers[Math.floor(det(30, i, customers.length))]!;
  const action = ACTIONS[Math.floor(det(31, i, ACTIONS.length))]!;
  return {
    id: `act_${(i + 1).toString().padStart(5, '0')}`,
    customer_id: c.id,
    action,
    detail: `${c.email} · ${action}`,
    ts: NOW - Math.floor(det(32, i, 7 * 86400)),
  };
}).sort((a, b) => b.ts - a.ts); // recent-first
```

- [ ] **Step 10.2: Create `src/worker/_mock/routes.ts`**

```ts
import type { Hono } from 'hono';
import { customers, subscriptions, invoices, activity } from './data';

/**
 * Internal mock data routes for the design-system samples.
 * Forks remove this file + the `mock` connection when they have real data.
 */
export function registerMockRoutes(app: Hono<{ Bindings: Env }>): void {
  app.get('/_mock/customers', (c) => c.json(customers));
  app.get('/_mock/customers/:id', (c) => {
    const r = customers.find((x) => x.id === c.req.param('id'));
    return r ? c.json(r) : c.notFound();
  });

  app.get('/_mock/subscriptions', (c) => c.json(subscriptions));
  app.get('/_mock/subscriptions/:id', (c) => {
    const r = subscriptions.find((x) => x.id === c.req.param('id'));
    return r ? c.json(r) : c.notFound();
  });

  app.get('/_mock/invoices', (c) => c.json(invoices));
  app.get('/_mock/invoices/:id', (c) => {
    const r = invoices.find((x) => x.id === c.req.param('id'));
    return r ? c.json(r) : c.notFound();
  });

  app.get('/_mock/activity', (c) => c.json(activity));
  app.get('/_mock/activity/:id', (c) => {
    const r = activity.find((x) => x.id === c.req.param('id'));
    return r ? c.json(r) : c.notFound();
  });
}
```

- [ ] **Step 10.3: Modify `src/worker/index.ts`**

Add the import + register call near the other route registrations:

```ts
import { registerMockRoutes } from './_mock/routes';
// ...
registerMockRoutes(app);
```

- [ ] **Step 10.4: Verify**

```bash
pnpm test 2>&1 | tail -5
pnpm typecheck
```

Expected: 122 tests still pass (we haven't added tests for the mock routes — they're throwaway demo code).

- [ ] **Step 10.5: Commit**

```bash
git add src/worker/_mock/ src/worker/index.ts
git commit -m "$(cat <<'EOF'
feat(mock): internal _mock routes + deterministic fake CRM dataset

For the design-system samples (Plan 7). Forks delete src/worker/_mock/ +
the mock connection when they wire real data.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Mock connection + 4 sample resources

**Files:**
- Create: `src/connections/mock.ts`
- Create: `src/resources/mock-customers.ts`
- Create: `src/resources/mock-subscriptions.ts`
- Create: `src/resources/mock-invoices.ts`
- Create: `src/resources/mock-activity.ts`
- Modify: `src/connections/index.ts`
- Modify: `src/resources/index.ts`

- [ ] **Step 11.1: `src/connections/mock.ts`**

The mock connection points at the Worker's own origin. In dev that's `http://localhost:8787`; in prod it's the deployed URL. The simplest portable approach: use a relative-style placeholder that resolves at runtime.

Actually for our proxy, we need an absolute `baseUrl`. Use empty string + handle the relative case in the proxy — wait, simpler: just hardcode the dev URL and document the swap.

Actually simplest of all: use `http://localhost:8787` as the baseUrl. The proxy will be running on the same Worker — but Workers fetching their own origin works fine in dev. In prod with the deployed worker, you'd swap this to the deployed origin. Each fork sorts this out when they replace the mock connection with real ones.

Even cleaner option: use the `PUBLIC_URL` env var. But that's not available at module-load time for the connection definition.

Pragmatic choice: hardcode `http://localhost:8787` for the boilerplate's local dev. Document that the mock connection is dev-only:

```ts
// src/connections/mock.ts
import { defineConnection } from '../worker/connections/define';

/**
 * Internal mock connection — points at this Worker's own /_mock/* routes.
 * Used by the boilerplate's sample resources (customers, subscriptions,
 * invoices, activity) to exercise the design system against realistic data.
 *
 * Forks: delete this file (and the four mock-* resource files) once you
 * have real connections wired up. Also delete src/worker/_mock/.
 *
 * baseUrl is hardcoded for local dev. The /_mock/ paths live on the same
 * Worker; in production you'd point this at your own deployed URL OR just
 * remove the mock entirely.
 */
export default defineConnection({
  id: 'mock',
  name: 'Mock (sample data)',
  baseUrl: 'http://localhost:8787',
  auth: { type: 'none' },
});
```

- [ ] **Step 11.2: `src/resources/mock-customers.ts`**

```ts
import { defineResource } from '../worker/resources/define';

export default defineResource({
  id: 'mock-customers',
  connection: 'mock',
  name: 'Customers',
  group: 'Mock CRM',
  list:   { method: 'GET', path: '/_mock/customers' },
  detail: { method: 'GET', path: '/_mock/customers/:id' },
  fields: [
    { key: 'id',         label: 'ID',      type: 'string', primary: true, monospace: true, tableColumn: true },
    { key: 'email',      label: 'Email',   type: 'email',  tableColumn: true, searchable: true },
    { key: 'name',       label: 'Name',    type: 'string', tableColumn: true },
    { key: 'city',       label: 'City',    type: 'string', tableColumn: true },
    { key: 'plan',       label: 'Plan',    type: 'string', tableColumn: true },
    { key: 'mrr_cents',  label: 'MRR',     type: 'currency', tableColumn: true },
    { key: 'status',     label: 'Status',  type: 'enum',   tableColumn: true,
      enumOptions: [
        { value: 'active',    label: 'Active' },
        { value: 'past_due',  label: 'Past due' },
        { value: 'canceled',  label: 'Canceled' },
        { value: 'trialing',  label: 'Trialing' },
      ] },
    { key: 'created_at', label: 'Joined',  type: 'unix-ts', tableColumn: true },
  ],
});
```

- [ ] **Step 11.3: `src/resources/mock-subscriptions.ts`**

```ts
import { defineResource } from '../worker/resources/define';

export default defineResource({
  id: 'mock-subscriptions',
  connection: 'mock',
  name: 'Subscriptions',
  group: 'Mock CRM',
  list:   { method: 'GET', path: '/_mock/subscriptions' },
  detail: { method: 'GET', path: '/_mock/subscriptions/:id' },
  fields: [
    { key: 'id',                   label: 'ID',        type: 'string', primary: true, monospace: true, tableColumn: true },
    { key: 'customer_id',          label: 'Customer',  type: 'string', tableColumn: true, monospace: true },
    { key: 'plan',                 label: 'Plan',      type: 'string', tableColumn: true },
    { key: 'status',               label: 'Status',    type: 'string', tableColumn: true },
    { key: 'amount_cents',         label: 'Amount',    type: 'currency', tableColumn: true },
    { key: 'current_period_end',   label: 'Renews',    type: 'unix-ts', tableColumn: true },
    { key: 'created_at',           label: 'Started',   type: 'unix-ts' },
  ],
});
```

- [ ] **Step 11.4: `src/resources/mock-invoices.ts`**

```ts
import { defineResource } from '../worker/resources/define';

export default defineResource({
  id: 'mock-invoices',
  connection: 'mock',
  name: 'Invoices',
  group: 'Mock CRM',
  list:   { method: 'GET', path: '/_mock/invoices' },
  detail: { method: 'GET', path: '/_mock/invoices/:id' },
  fields: [
    { key: 'id',           label: 'ID',        type: 'string', primary: true, monospace: true, tableColumn: true },
    { key: 'customer_id',  label: 'Customer',  type: 'string', tableColumn: true, monospace: true },
    { key: 'amount_cents', label: 'Amount',    type: 'currency', tableColumn: true },
    { key: 'status',       label: 'Status',    type: 'string', tableColumn: true },
    { key: 'due_at',       label: 'Due',       type: 'unix-ts', tableColumn: true },
    { key: 'paid_at',      label: 'Paid',      type: 'unix-ts', tableColumn: true },
  ],
});
```

- [ ] **Step 11.5: `src/resources/mock-activity.ts`**

```ts
import { defineResource } from '../worker/resources/define';

export default defineResource({
  id: 'mock-activity',
  connection: 'mock',
  name: 'Activity',
  group: 'Mock CRM',
  list:   { method: 'GET', path: '/_mock/activity' },
  detail: { method: 'GET', path: '/_mock/activity/:id' },
  fields: [
    { key: 'id',           label: 'ID',        type: 'string', primary: true, monospace: true, tableColumn: true },
    { key: 'ts',           label: 'When',      type: 'unix-ts', tableColumn: true },
    { key: 'customer_id',  label: 'Customer',  type: 'string', tableColumn: true, monospace: true },
    { key: 'action',       label: 'Action',    type: 'string', tableColumn: true },
    { key: 'detail',       label: 'Detail',    type: 'string', tableColumn: true },
  ],
});
```

- [ ] **Step 11.6: Update `src/connections/index.ts`**

Read it. Add `import mock from './mock';` and add `mock` to the `connections` array.

- [ ] **Step 11.7: Update `src/resources/index.ts`**

Read it. Add the four imports and append them to the `resources` array.

- [ ] **Step 11.8: Build + smoke test**

```bash
pnpm build && pnpm typecheck
```

Then briefly: `pnpm dev:all`, open the browser, sign in, see "Mock CRM" group in the sidebar with 4 resources. Click "Customers" — the page should render but the table will show "connection_not_configured" because the mock connection hasn't been set up.

- [ ] **Step 11.9: Configure the mock connection automatically (or document it)**

The mock connection has `auth.type=none`. To make it just work out of the box, in the browser DevTools console:

```js
await fetch('/api/connections/mock', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'none' }) }).then(r => r.json())
```

Document this in a comment in `src/connections/mock.ts` so users see it.

Or better, automatically configure the mock connection on first sign-in. **That's scope creep** — leave it as a one-time DevTools step, documented.

- [ ] **Step 11.10: Commit**

```bash
git add src/connections/ src/resources/
git commit -m "$(cat <<'EOF'
feat(samples): mock connection + 4 rich sample resources (CRM dataset)

Customers / Subscriptions / Invoices / Activity. Exercises the design
system against realistic shapes: currency, enums, dates, monospace IDs.
Configure once via DevTools console:
  await fetch('/api/connections/mock', {method:'PUT',headers:{'Content-Type':'application/json'},body:'{"type":"none"}'})

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: `/design` showcase page

**Files:**
- Create: `src/client/routes/DesignShowcasePage.svelte`
- Modify: `src/client/app.svelte` (add `/design` route)
- Modify: `src/client/lib/shell/DefaultSidebar.svelte` (add link)

A one-page tour through every primitive — useful as designer reference and dogfooding.

- [ ] **Step 12.1: Create `src/client/routes/DesignShowcasePage.svelte`**

```svelte
<script lang="ts">
  import Button from '$client/lib/ui/Button.svelte';
  import IconButton from '$client/lib/ui/IconButton.svelte';
  import Pill from '$client/lib/ui/Pill.svelte';
  import Input from '$client/lib/ui/Input.svelte';
  import Textarea from '$client/lib/ui/Textarea.svelte';
  import Select from '$client/lib/ui/Select.svelte';
  import Checkbox from '$client/lib/ui/Checkbox.svelte';
  import Field from '$client/lib/ui/Field.svelte';
  import Table from '$client/lib/ui/Table.svelte';
  import Skeleton from '$client/lib/ui/Skeleton.svelte';
  import EmptyState from '$client/lib/ui/EmptyState.svelte';
  import StatCard from '$client/lib/ui/StatCard.svelte';
  import Toolbar from '$client/lib/ui/Toolbar.svelte';
  import Tabs from '$client/lib/ui/Tabs.svelte';
  import Modal from '$client/lib/ui/Modal.svelte';
  import Dropdown from '$client/lib/ui/Dropdown.svelte';
  import { toast } from '$client/lib/toast.svelte';

  let textValue = $state('Example input');
  let textareaValue = $state('Multi-line text\nwith linebreaks');
  let selectValue = $state('a');
  let checked = $state(true);
  let activeTab = $state('overview');
  let modalOpen = $state(false);
</script>

<div class="space-y-12 max-w-4xl">
  <header>
    <h1 class="text-2xl font-semibold tracking-tight">Design system</h1>
    <p class="text-sm text-[var(--color-muted)]">Every primitive, in one place.</p>
  </header>

  <section class="space-y-3">
    <h2 class="text-sm uppercase tracking-[0.08em] font-medium text-[var(--color-muted)]">Buttons</h2>
    <div class="flex flex-wrap gap-2">
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button size="sm">Small</Button>
      <Button disabled>Disabled</Button>
      <IconButton ariaLabel="Settings">⚙</IconButton>
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="text-sm uppercase tracking-[0.08em] font-medium text-[var(--color-muted)]">Pills</h2>
    <div class="flex flex-wrap gap-2">
      <Pill tone="neutral">neutral</Pill>
      <Pill tone="success">success</Pill>
      <Pill tone="warning">warning</Pill>
      <Pill tone="error">error</Pill>
      <Pill tone="info">info</Pill>
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="text-sm uppercase tracking-[0.08em] font-medium text-[var(--color-muted)]">Form inputs</h2>
    <div class="grid grid-cols-2 gap-4 max-w-xl">
      <Field label="Text input"><Input type="text" bind:value={textValue} /></Field>
      <Field label="Email" required><Input type="email" bind:value={textValue} /></Field>
      <Field label="Select"><Select bind:value={selectValue} options={[{value:'a',label:'Option A'},{value:'b',label:'Option B'}]} /></Field>
      <Field label="Checkbox"><Checkbox bind:checked label="Active" /></Field>
      <div class="col-span-2"><Field label="Textarea"><Textarea bind:value={textareaValue} /></Field></div>
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="text-sm uppercase tracking-[0.08em] font-medium text-[var(--color-muted)]">Stat cards</h2>
    <div class="grid grid-cols-4 gap-3">
      <StatCard label="MRR" value="$12,830" delta="+12% vs last month" tone="positive" />
      <StatCard label="Active users" value="2,481" delta="+38 today" tone="positive" />
      <StatCard label="Failed payments" value="3" delta="-2 vs last week" tone="negative" />
      <StatCard label="Churn rate" value="2.4%" />
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="text-sm uppercase tracking-[0.08em] font-medium text-[var(--color-muted)]">Skeleton</h2>
    <div class="space-y-2 max-w-md">
      <Skeleton width="60%" height="14px" />
      <Skeleton width="80%" height="14px" />
      <Skeleton width="40%" height="14px" />
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="text-sm uppercase tracking-[0.08em] font-medium text-[var(--color-muted)]">Empty state</h2>
    <div class="border border-[var(--color-border)] rounded-md">
      <EmptyState title="No records" description="Click New to add the first one." />
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="text-sm uppercase tracking-[0.08em] font-medium text-[var(--color-muted)]">Toolbar</h2>
    <div class="border border-[var(--color-border)] rounded-md px-4">
      <Toolbar>
        {#snippet left()}<span class="text-sm font-medium">Customers</span>{/snippet}
        {#snippet right()}
          <Button variant="secondary" size="sm">Filter</Button>
          <Button size="sm">New</Button>
        {/snippet}
      </Toolbar>
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="text-sm uppercase tracking-[0.08em] font-medium text-[var(--color-muted)]">Tabs</h2>
    <Tabs
      bind:activeKey={activeTab}
      tabs={[
        { key: 'overview', label: 'Overview', content: contentOverview },
        { key: 'history',  label: 'History',  content: contentHistory },
        { key: 'raw',      label: 'Raw JSON', content: contentRaw },
      ]}
    />
    {#snippet contentOverview()}<p class="text-sm">Overview content goes here.</p>{/snippet}
    {#snippet contentHistory()}<p class="text-sm">History content goes here.</p>{/snippet}
    {#snippet contentRaw()}<pre class="text-xs font-mono bg-[var(--color-surface-2)] p-3 rounded">{`{ "id": "cus_001" }`}</pre>{/snippet}
  </section>

  <section class="space-y-3">
    <h2 class="text-sm uppercase tracking-[0.08em] font-medium text-[var(--color-muted)]">Modal + Dropdown</h2>
    <div class="flex gap-2">
      <Button onclick={() => (modalOpen = true)}>Open modal</Button>
      <Dropdown>
        {#snippet trigger({ toggle })}
          <Button variant="secondary" onclick={toggle}>Actions ▾</Button>
        {/snippet}
        {#snippet children({ close })}
          <button class="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]" onclick={() => { toast.info('Edit'); close(); }}>Edit</button>
          <button class="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]" onclick={() => { toast.info('Duplicate'); close(); }}>Duplicate</button>
          <hr class="border-[var(--color-border)] my-1" />
          <button class="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)] text-[var(--color-error-fg)]" onclick={() => { toast.error('Deleted'); close(); }}>Delete</button>
        {/snippet}
      </Dropdown>
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="text-sm uppercase tracking-[0.08em] font-medium text-[var(--color-muted)]">Toasts</h2>
    <div class="flex gap-2">
      <Button variant="secondary" size="sm" onclick={() => toast.success('Saved')}>Success</Button>
      <Button variant="secondary" size="sm" onclick={() => toast.info('Heads up')}>Info</Button>
      <Button variant="secondary" size="sm" onclick={() => toast.error('Something went wrong')}>Error</Button>
    </div>
  </section>
</div>

<Modal bind:open={modalOpen} title="Confirm action">
  <p class="text-sm">Are you sure you want to do the thing? This action can't be undone.</p>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (modalOpen = false)}>Cancel</Button>
    <Button onclick={() => { toast.success('Done'); modalOpen = false; }}>Confirm</Button>
  {/snippet}
</Modal>
```

- [ ] **Step 12.2: Add `/design` route in `src/client/app.svelte`**

Add the import and the route entry:

```ts
import DesignShowcasePage from './routes/DesignShowcasePage.svelte';
// in authedRoutes:
'/design': DesignShowcasePage,
```

- [ ] **Step 12.3: Add a link in `DefaultSidebar.svelte`**

In the Settings group (admin-only), add a new item or add a separate "Tools" group with a `/design` link. Simplest: add `{ href: '/design', label: 'Design system' }` to the existing `settingsItems` array — it's admin-only and tool-like.

- [ ] **Step 12.4: Build + commit**

```bash
pnpm build && pnpm typecheck
git add src/client/routes/DesignShowcasePage.svelte src/client/app.svelte src/client/lib/shell/DefaultSidebar.svelte
git commit -m "$(cat <<'EOF'
feat(showcase): /design route demonstrating every primitive

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Dashboard at `/` 🎨 (visual decision)

**🎨 Controller visual-decision step first:** mock 2–3 dashboard layouts: A) 4 stat cards across the top + recent activity table below, B) hero-style headline metric + supporting stats + activity, C) 3-column grid (stats / activity / shortcuts). User picks one.

**Files:**
- Modify: `src/client/routes/home.svelte`

The current `home.svelte` auto-redirects to the first resource. Replace with a real dashboard:
- Stat cards summarizing the mock CRM (customers count, MRR, etc.)
- Recent activity list

If no resources are registered (a freshly-cloned boilerplate with `jsonplaceholder-posts` removed), show an EmptyState pointing at the README.

- [ ] **Step 13.1: Rewrite `src/client/routes/home.svelte`**

(Default layout below assumes option A — 4 stats above, recent activity below. Swap to whichever the controller picked.)

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$client/lib/api';
  import { registry } from '$client/lib/registry.svelte';
  import StatCard from '$client/lib/ui/StatCard.svelte';
  import Skeleton from '$client/lib/ui/Skeleton.svelte';
  import EmptyState from '$client/lib/ui/EmptyState.svelte';
  import Pill from '$client/lib/ui/Pill.svelte';
  import Table from '$client/lib/ui/Table.svelte';

  interface Customer { id: string; status: string; mrr_cents: number }
  interface Activity { id: string; ts: number; action: string; detail: string }

  let customers = $state<Customer[] | null>(null);
  let activity = $state<Activity[] | null>(null);
  let loading = $state(true);

  async function load() {
    loading = true;
    try {
      const [cs, ay] = await Promise.all([
        api<Customer[]>('/api/resources/mock-customers/list').catch(() => []),
        api<Activity[]>('/api/resources/mock-activity/list').catch(() => []),
      ]);
      customers = cs;
      activity = ay;
    } finally {
      loading = false;
    }
  }
  onMount(load);

  const stats = $derived.by(() => {
    if (!customers) return null;
    const total = customers.length;
    const active = customers.filter((c) => c.status === 'active').length;
    const mrr = customers.reduce((sum, c) => sum + c.mrr_cents, 0);
    const pastDue = customers.filter((c) => c.status === 'past_due').length;
    return { total, active, mrr, pastDue };
  });

  function fmtTs(ts: number): string {
    const seconds = Math.floor(Date.now() / 1000 - ts);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
  function fmtCurrency(cents: number): string {
    return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
</script>

<div class="space-y-6">
  <header>
    <h1 class="text-2xl font-semibold tracking-tight">Overview</h1>
    <p class="text-sm text-[var(--color-muted)]">A snapshot of the last 7 days.</p>
  </header>

  {#if loading}
    <div class="grid grid-cols-4 gap-3">
      {#each Array(4) as _}
        <div class="border border-[var(--color-border)] rounded-md bg-[var(--color-surface)] p-4 space-y-2">
          <Skeleton width="40%" height="12px" />
          <Skeleton width="60%" height="24px" />
          <Skeleton width="50%" height="12px" />
        </div>
      {/each}
    </div>
  {:else if !stats || registry.items.length === 0}
    <EmptyState
      title="No resources yet"
      description="Add a resource in src/resources/ and register it in src/resources/index.ts. See docs/adding-a-resource.md."
    />
  {:else}
    <div class="grid grid-cols-4 gap-3">
      <StatCard label="Total customers" value={stats.total} />
      <StatCard label="Active" value={stats.active} delta={`${Math.round((stats.active / stats.total) * 100)}% of total`} />
      <StatCard label="MRR" value={fmtCurrency(stats.mrr)} tone="positive" delta="from active subscriptions" />
      <StatCard label="Past due" value={stats.pastDue} tone={stats.pastDue > 0 ? 'negative' : 'neutral'} delta={stats.pastDue > 0 ? 'Need attention' : 'All clear'} />
    </div>

    {#if activity && activity.length > 0}
      <section class="space-y-3">
        <h2 class="text-sm uppercase tracking-[0.08em] font-medium text-[var(--color-muted)]">Recent activity</h2>
        <Table density="compact">
          <thead>
            <tr><th>When</th><th>Event</th></tr>
          </thead>
          <tbody>
            {#each activity.slice(0, 10) as a}
              <tr>
                <td class="text-xs font-mono text-[var(--color-muted)]" style:width="100px">{fmtTs(a.ts)}</td>
                <td><Pill tone="neutral">{a.action}</Pill> <span class="text-xs text-[var(--color-muted)] ml-2 font-mono">{a.detail}</span></td>
              </tr>
            {/each}
          </tbody>
        </Table>
      </section>
    {/if}
  {/if}
</div>
```

- [ ] **Step 13.2: Build + commit**

```bash
pnpm build && pnpm typecheck
git add src/client/routes/home.svelte
git commit -m "$(cat <<'EOF'
feat(home): real dashboard with stat cards + recent activity

Replaces the placeholder auto-redirect with an actual overview that
demonstrates the design system against the mock CRM data.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Pre-flight + smoke test

- [ ] **Step 14.1: Automated checks (controller runs)**

```bash
lsof -ti :8787 | xargs kill 2>/dev/null
pnpm test 2>&1 | tail -5
pnpm typecheck
rm -rf dist .wrangler/dry-run node_modules/.vite
pnpm build 2>&1 | tail -6
pnpm dlx wrangler deploy --dry-run --outdir .wrangler/dry-run 2>&1 | tail -10
```

Expected: 122 tests still pass (no Worker test additions). SPA bundle grows ~15–25 KB (new primitives + showcase + dashboard). Worker bundle grows ~5 KB (mock data + routes).

- [ ] **Step 14.2: Manual smoke test (controller)**

1. `pnpm dev:all`, sign in.
2. Configure the mock connection once via DevTools console (per `src/connections/mock.ts` instructions).
3. Verify each:
   - **`/` (home)** — dashboard with stat cards loads, recent activity table populated.
   - **Mock CRM resources** — sidebar shows Customers / Subscriptions / Invoices / Activity. Click Customers → table with realistic data, sortable headers, density, hover.
   - **Detail / Edit / New** — open a customer, edit, save (writes go to JSONPlaceholder's posts mock or fail gracefully — mock connection is read-only).
   - **`/design`** — every primitive rendered. Modal opens with animation. Dropdown opens/closes. Toasts fire.
   - **Theme toggle** — light → dark cycles all primitives cleanly.
   - **Sign out** — returns to /sign-in.

If anything's off, report and we fix before PR.

---

### Task 15: Push + open PR

- [ ] **Step 15.1: Push**

```bash
git push -u origin feature/design-polish-samples
```

- [ ] **Step 15.2: PR**

```bash
gh pr create --base main --head feature/design-polish-samples \
  --title "Design polish + sample pages" \
  --body "$(cat <<'EOF'
## Summary
Takes the boilerplate's design system from "shape right, polish later" (Plan 4) to genuinely polished.

- **Token refinement**: motion (durations + easing), focus-ring tokens, elevation tokens (light + dark).
- **Polished existing primitives**: Button (motion-based transitions, visible focus ring), Input (focus ring, error state), Pill (more tones, optional border), Table (hover transition, density variant).
- **New primitives**: Tabs, Modal/Dialog (with animation), Dropdown menu (with outside-click + escape), Skeleton, EmptyState, StatCard, Toolbar.
- **Polished resource components**: ResourceTable now uses skeleton loaders, EmptyState, Toolbar, and client-side sortable columns. ResourceDetail / ResourceForm get skeleton loaders, Toolbar, right-aligned action buttons.
- **Mock data layer**: new \`_mock/*\` Worker routes serving a deterministic fake CRM dataset (customers, subscriptions, invoices, activity). New \`mock\` connection + 4 sample resources that exercise the design system against realistic field shapes — currency, enums, dates, monospace IDs.
- **\`/design\` showcase route** — every primitive in one page, admin-only, useful as designer reference.
- **Real dashboard at \`/\`** — replaces the placeholder auto-redirect. Stat cards (total customers, active, MRR, past due) + recent activity table.
- **wrangler.toml hygiene**: scrubbed real CF resource IDs back to placeholders. They were committed during Plan 1's initial walkthrough — not credentials, but identifying info that shouldn't be in a public repo. Forks fill in their own per the README.

## What's NOT in this PR
- No new tests. The visual + interactive surface is verified by manual smoke + the existing 122 Worker tests still pass. Adding component tests is a separate plan (Svelte runes need a Svelte-aware test pool).
- Server-side sort on ResourceTable. The new sortable headers are client-side only — they reorder the current page. Real server-side sort is phase 2.
- Audit log filters. Carryover from earlier plans, still deferred.

## Test plan
- [x] \`pnpm test\` — 122 tests pass (unchanged)
- [x] \`pnpm typecheck\` — clean
- [x] \`pnpm build\` — clean (~110 KB JS gzip)
- [x] \`wrangler deploy --dry-run\` — clean
- [x] \`pnpm dev:all\` smoke test — dashboard loads, mock CRM resources render with realistic data, sortable headers work, /design page demos every primitive, modal animates, dropdown closes on outside click, theme toggle cycles cleanly.

## Notes for review
- **Mock data is dev-only.** \`src/connections/mock.ts\` points at \`http://localhost:8787\`. Forks that deploy will either swap that URL to their deployed origin OR (more likely) delete the mock entirely once they have real connections wired up. The deletion is clean: remove \`src/worker/_mock/\`, \`src/connections/mock.ts\`, the four \`src/resources/mock-*.ts\` files, the corresponding entries in \`src/connections/index.ts\` and \`src/resources/index.ts\`, and the \`registerMockRoutes(app)\` line in \`src/worker/index.ts\`.
- **Configure the mock connection once via DevTools console** to make it appear configured (\`auth.type=none\` so the payload is \`{type:'none'}\`). Documented in \`src/connections/mock.ts\`.
- **Visual decisions made during execution** (skeleton, empty state, modal animation, dashboard layout) — see commits for which treatments landed.
- **wrangler.toml**: the committed version has placeholders. Your local working copy needs the real IDs to keep \`pnpm dev:all\` working. After merging, fresh clones go through the README quickstart.

## Design
Spec: [\`docs/superpowers/specs/2026-05-13-admin-boilerplate-design.md\`](docs/superpowers/specs/2026-05-13-admin-boilerplate-design.md) (§9 Visual)
Plan: [\`docs/superpowers/plans/2026-05-15-07-design-polish-samples.md\`](docs/superpowers/plans/2026-05-15-07-design-polish-samples.md)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Scope coverage**:
- Token refinement (motion, focus, elevation) — Task 2 ✓
- Polish existing primitives (Button, Input, Pill, Table) — Task 3 ✓
- New primitives (Tabs, Modal, Dropdown, Skeleton, EmptyState, StatCard, Toolbar) — Tasks 4–7 ✓
- Polish resource UI (ResourceTable, ResourceDetail, ResourceForm) — Tasks 8–9 ✓
- Worker-internal mock data layer — Tasks 10–11 ✓
- Design showcase route — Task 12 ✓
- Real dashboard — Task 13 ✓
- wrangler.toml hygiene — Task 1 ✓

Deferred to follow-up plans:
- Component tests (Svelte runes need their own pool)
- Server-side sort
- Filter bars / search
- Audit log filters

**Visual-decision checkpoints** flagged in the plan with 🎨 (Tasks 5, 7 ×2, 13).

**Scope**: 15 tasks, comparable to Plan 5. Each visual-decision task adds a controller visual-companion step that runs before the implementer dispatch.
