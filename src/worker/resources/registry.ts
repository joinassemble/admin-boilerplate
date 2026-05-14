import { resources } from '../../resources';
import type { Resource } from './types';

/**
 * Build the id→Resource map from the explicit list at `src/resources/index.ts`.
 *
 * We use an explicit list (not `import.meta.glob`) because the Worker is bundled
 * by esbuild in `wrangler dev` / `wrangler deploy`, and esbuild doesn't resolve
 * Vite's glob magic — the call falls through to runtime and `import.meta.glob` is
 * undefined, crashing the Worker on first request.
 */
const byId = new Map<string, Resource>();
for (const r of resources) {
  if (!r?.id) {
    throw new Error('Resource in src/resources/index.ts is missing an .id');
  }
  if (byId.has(r.id)) {
    throw new Error(`Duplicate resource id "${r.id}" in src/resources/index.ts`);
  }
  byId.set(r.id, r);
}

export function listResources(): Resource[] {
  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export function getResource(id: string): Resource | undefined {
  return byId.get(id);
}
