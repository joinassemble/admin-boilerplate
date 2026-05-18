/**
 * Explicit registry of all declared connections.
 *
 * When you add a new connection at `src/connections/<id>.ts`, also add
 * its default export to this array. We use an explicit list rather than
 * `import.meta.glob` because `wrangler dev` / `wrangler deploy` bundle
 * the Worker with esbuild, which doesn't understand Vite's glob magic.
 */

import type { Connection } from '../worker/connections/types';
import jsonplaceholder from './jsonplaceholder';
import mock from './mock';

export const connections: Connection[] = [jsonplaceholder, mock];
