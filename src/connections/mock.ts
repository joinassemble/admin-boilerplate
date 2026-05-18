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
