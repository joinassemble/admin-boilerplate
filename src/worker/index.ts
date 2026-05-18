import { Hono } from 'hono';
import { registerAccessRoutes } from './access/routes';
import { registerAuditRoutes } from './audit/routes';
import { registerAuthRoutes } from './auth/routes';
import { registerConnectionRoutes } from './connections/routes';
import { registerMockRoutes } from './_mock/routes';
import { registerResourceRoutes } from './resources/routes';
import { registerUserRoutes } from './users/routes';

const app = new Hono<{ Bindings: Env }>();

registerAuthRoutes(app);
registerConnectionRoutes(app);
registerMockRoutes(app);
registerResourceRoutes(app);
registerAccessRoutes(app);
registerUserRoutes(app);
registerAuditRoutes(app);

app.get('/api/health', (c) => c.json({ ok: true }));

// Catch-all → static assets (the built SPA), but only for non-API routes.
app.all('*', async (c) => {
  if (c.req.path === '/api' || c.req.path.startsWith('/api/')) {
    return c.notFound();
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
