import { Hono } from 'hono';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) => c.json({ ok: true }));

// Catch-all → static assets (the built SPA), but only for non-API routes.
app.all('*', async (c) => {
  // Don't serve assets for /api/* routes (they should 404 if not explicitly defined above).
  if (c.req.path.startsWith('/api/')) {
    return c.notFound();
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
