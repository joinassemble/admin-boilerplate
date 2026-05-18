import { defineConnection } from '../worker/connections/define';

/**
 * Internal mock connection — points at this Worker's own /_mock/* routes.
 * Used by the boilerplate's sample resources (customers, subscriptions,
 * invoices, activity) to exercise the design system against realistic data.
 *
 * !! DELETE BEFORE DEPLOYING TO PRODUCTION !!
 *
 * Forks MUST delete the following before going live:
 *   - this file (src/connections/mock.ts)
 *   - src/worker/_mock/ (the dev-only mock routes)
 *   - src/resources/mock-*.ts (the four sample resources)
 *   - the `mock` import in src/connections/index.ts
 *
 * Why this matters: `baseUrl` is hardcoded to http://localhost:8787 because
 * the /_mock/ paths live on the same Worker — fine in local dev, fatal in
 * production. A deployed Worker that still references this connection will
 * try to fetch http://localhost:8787/_mock/* from inside Cloudflare's edge
 * and hang / 502. The proxy includes an extra safety net that returns a
 * loud 503 with `error: "dev_connection_in_production"` if this connection
 * (or any localhost baseUrl) is ever invoked when ENV === "production", so
 * you'll see a clear actionable error rather than a confusing failure mode
 * — but the right answer is to delete this file before deploy.
 *
 * To make this connection appear configured (auth.type=none has no secret),
 * run this once in the browser DevTools console after signing in:
 *
 *   await fetch('/api/connections/mock', {
 *     method: 'PUT',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ type: 'none' }),
 *   }).then(r => r.json())
 */
export default defineConnection({
  id: 'mock',
  name: 'Mock (sample data)',
  baseUrl: 'http://localhost:8787',
  auth: { type: 'none' },
});
