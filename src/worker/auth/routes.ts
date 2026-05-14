import type { Hono } from 'hono';
import { magicLinkCallback, requestMagicLink } from './magic-link';
import { attachSession, requireSession, signOut } from './middleware';
import type { Session } from './session';

export function registerAuthRoutes(app: Hono<{ Bindings: Env }>): void {
  app.use('*', attachSession);

  app.post('/auth/request', requestMagicLink);
  app.get('/auth/callback', magicLinkCallback);
  app.post('/auth/sign-out', signOut);

  app.get('/api/me', requireSession, (c) => {
    const session = c.get('session') as Session;
    return c.json({
      email: session.email,
      orgId: session.orgId,
      role: session.role,
    });
  });
}
