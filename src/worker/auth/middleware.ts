import type { Context, MiddlewareHandler } from 'hono';
import { revokeSession, validateSession, type Session } from './session';

declare module 'hono' {
  interface ContextVariableMap {
    session: Session;
  }
}

export function readSessionCookie(c: Context): string | null {
  const raw = c.req.header('Cookie');
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [name, value] = part.trim().split('=', 2);
    if (name === '__Host-session' && value) return value;
  }
  return null;
}

/** Reads the session cookie if present; attaches to context if valid. Never 401s. */
export const attachSession: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const token = readSessionCookie(c);
  if (token) {
    const session = await validateSession(c.env.DB, token);
    if (session) c.set('session', session);
  }
  await next();
};

/** Requires a valid session. 401 with no body otherwise. */
export const requireSession: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const session = c.get('session') as Session | undefined;
  if (!session) return new Response(null, { status: 401 });
  await next();
};

/** Helper to clear the session cookie. */
export function clearSessionCookie(): string {
  return [
    '__Host-session=',
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=0',
  ].join('; ');
}

export async function signOut(c: Context<{ Bindings: Env }>): Promise<Response> {
  const session = c.get('session') as Session | undefined;
  if (session) {
    await revokeSession(c.env.DB, session.token);
  }
  return new Response(null, {
    status: 200,
    headers: { 'Set-Cookie': clearSessionCookie() },
  });
}
