import type { Resource } from './types';

// Eager glob — all matching files are imported at build time.
// The user-defined area is `src/resources/*.ts` (sibling of `src/worker/`).
// This file lives at `src/worker/resources/registry.ts`, so:
//   `..`    → src/worker/
//   `../..` → src/
// → `../../resources/*.ts` resolves to `src/resources/*.ts` ✓
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
