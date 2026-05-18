import type { Hono } from 'hono';
import { customers, subscriptions, invoices, activity } from './data';

/**
 * Internal mock data routes for the design-system samples.
 * Forks remove this file + the `mock` connection when they have real data.
 */
export function registerMockRoutes(app: Hono<{ Bindings: Env }>): void {
  app.get('/_mock/customers', (c) => c.json(customers));
  app.get('/_mock/customers/:id', (c) => {
    const r = customers.find((x) => x.id === c.req.param('id'));
    return r ? c.json(r) : c.notFound();
  });

  app.get('/_mock/subscriptions', (c) => c.json(subscriptions));
  app.get('/_mock/subscriptions/:id', (c) => {
    const r = subscriptions.find((x) => x.id === c.req.param('id'));
    return r ? c.json(r) : c.notFound();
  });

  app.get('/_mock/invoices', (c) => c.json(invoices));
  app.get('/_mock/invoices/:id', (c) => {
    const r = invoices.find((x) => x.id === c.req.param('id'));
    return r ? c.json(r) : c.notFound();
  });

  app.get('/_mock/activity', (c) => c.json(activity));
  app.get('/_mock/activity/:id', (c) => {
    const r = activity.find((x) => x.id === c.req.param('id'));
    return r ? c.json(r) : c.notFound();
  });
}
