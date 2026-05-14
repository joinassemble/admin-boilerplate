import { connections } from '../../connections';
import type { Connection } from './types';

/**
 * Build the id→Connection map from the explicit list at `src/connections/index.ts`.
 *
 * We use an explicit list (not `import.meta.glob`) because the Worker is bundled
 * by esbuild in `wrangler dev` / `wrangler deploy`, and esbuild doesn't resolve
 * Vite's glob magic — the call falls through to runtime and `import.meta.glob` is
 * undefined, crashing the Worker on first request.
 */
const byId = new Map<string, Connection>();
for (const c of connections) {
  if (!c?.id) {
    throw new Error('Connection in src/connections/index.ts is missing an .id');
  }
  if (byId.has(c.id)) {
    throw new Error(`Duplicate connection id "${c.id}" in src/connections/index.ts`);
  }
  byId.set(c.id, c);
}

export function listConnections(): Connection[] {
  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export function getConnection(id: string): Connection | undefined {
  return byId.get(id);
}
