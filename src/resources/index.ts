/**
 * Explicit registry of all declared resources.
 *
 * When you add a new resource at `src/resources/<id>.ts`, also add
 * its default export to this array. We use an explicit list rather than
 * `import.meta.glob` because `wrangler dev` / `wrangler deploy` bundle
 * the Worker with esbuild, which doesn't understand Vite's glob magic.
 */

import type { Resource } from '../worker/resources/types';
import jsonplaceholderPosts from './jsonplaceholder-posts';

export const resources: Resource[] = [jsonplaceholderPosts];
