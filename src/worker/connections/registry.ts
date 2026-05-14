import type { Connection } from './types';

// Eager glob — all matching files are imported at build time.
// The user-defined area is `src/connections/*.ts` (sibling of `src/worker/`).
// This file lives at `src/worker/connections/registry.ts`, so:
//   `..`    → src/worker/
//   `../..` → src/
// → `../../connections/*.ts` resolves to `src/connections/*.ts` ✓
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
