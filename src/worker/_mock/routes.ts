import { Hono } from 'hono';
import { customers, subscriptions, invoices, activity } from './data';

/**
 * Internal mock data routes for the design-system samples.
 * Forks remove this file + the `mock` connection when they have real data.
 *
 * Safe-by-default: every route is gated by a single middleware that returns
 * 404 when `c.env.ENV === 'production'`. A 404 (rather than 403) makes the
 * routes appear unimplemented to anyone probing a deployed Worker. Forks
 * should still delete src/worker/_mock/ before going live, but a slip won't
 * leak the sample dataset.
 */
export function registerMockRoutes(app: Hono<{ Bindings: Env }>): void {
  const mock = new Hono<{ Bindings: Env }>();

  // Single guard on the whole group: routes are dev-only.
  mock.use('*', async (c, next) => {
    if (c.env.ENV === 'production') return c.notFound();
    return next();
  });

  mock.get('/customers', (c) => c.json(customers));
  mock.get('/customers/:id', (c) => {
    const r = customers.find((x) => x.id === c.req.param('id'));
    return r ? c.json(r) : c.notFound();
  });

  mock.get('/subscriptions', (c) => c.json(subscriptions));
  mock.get('/subscriptions/:id', (c) => {
    const r = subscriptions.find((x) => x.id === c.req.param('id'));
    return r ? c.json(r) : c.notFound();
  });

  mock.get('/invoices', (c) => c.json(invoices));
  mock.get('/invoices/:id', (c) => {
    const r = invoices.find((x) => x.id === c.req.param('id'));
    return r ? c.json(r) : c.notFound();
  });

  mock.get('/activity', (c) => c.json(activity));
  mock.get('/activity/:id', (c) => {
    const r = activity.find((x) => x.id === c.req.param('id'));
    return r ? c.json(r) : c.notFound();
  });

  app.route('/_mock', mock);
}
