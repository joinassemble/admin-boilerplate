import type { Context } from 'hono';
import { recordAuditEvent } from '../audit/writer';
import { getEmailProvider } from '../email';
import { checkAndIncrement } from '../lib/rate-limit';
import { randomToken } from '../lib/tokens';
import { getAccessPolicy } from './policy';
import { createSession } from './session';

const MAGIC_TOKEN_TTL_SECONDS = 15 * 60; // 15 min
const REQUEST_LIMIT_PER_EMAIL_PER_HOUR = 5;
const REQUEST_LIMIT_PER_IP_PER_HOUR = 20;

interface MagicTokenPayload {
  email: string;
  expires: number;
}

export async function requestMagicLink(c: Context<{ Bindings: Env }>): Promise<Response> {
  const env = c.env;
  const ip = c.req.header('CF-Connecting-IP') ?? '';
  const userAgent = c.req.header('User-Agent') ?? '';

  let body: { email?: unknown };
  try {
    body = await c.req.json<{ email?: unknown }>();
  } catch {
    return c.json({ ok: false, error: 'invalid_json' }, 400);
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email) return c.json({ ok: false, error: 'missing_email' }, 400);

  // Always-success response to prevent enumeration.
  const success = c.json({ ok: true });

  // Per-email rate limit.
  const emailRl = await checkAndIncrement(
    env.RATE_LIMIT,
    `rl:magic:email:${email}`,
    REQUEST_LIMIT_PER_EMAIL_PER_HOUR,
    60 * 60,
  );
  if (!emailRl.allowed) return success;

  // Per-IP rate limit.
  if (ip) {
    const ipRl = await checkAndIncrement(
      env.RATE_LIMIT,
      `rl:magic:ip:${ip}`,
      REQUEST_LIMIT_PER_IP_PER_HOUR,
      60 * 60,
    );
    if (!ipRl.allowed) return success;
  }

  // Access policy check.
  const policy = getAccessPolicy(env);
  const decision = await policy.evaluate(email, { ip, userAgent });
  if (!decision.allowed) return success;

  // Issue + store the magic token.
  const token = randomToken();
  const payload: MagicTokenPayload = {
    email,
    expires: Math.floor(Date.now() / 1000) + MAGIC_TOKEN_TTL_SECONDS,
  };
  await env.MAGIC_TOKENS.put(`magic:${token}`, JSON.stringify(payload), {
    expirationTtl: MAGIC_TOKEN_TTL_SECONDS,
  });

  // Send the email. Prefer PUBLIC_URL (set by the operator) so emails always
  // point at the canonical origin even if the Worker is hit via a Cloudflare
  // preview URL or workers.dev subdomain. Fall back to the current request's
  // origin so dev (and forks that forgot to set PUBLIC_URL — or left it as
  // an empty string) still get a working callback rather than a hardcoded
  // localhost link landing in a production inbox. `||` (not `??`) so that
  // PUBLIC_URL='' is treated the same as unset.
  const provider = getEmailProvider(env);
  const baseUrl = env.PUBLIC_URL || new URL(c.req.url).origin;
  await provider.sendMagicLink({
    email,
    magicLinkUrl: `${baseUrl}/auth/callback?token=${token}`,
  });

  await recordAuditEvent(env.DB, {
    action: 'magic_link_requested',
    actor: { email },
    ip,
  });

  return success;
}

export async function magicLinkCallback(c: Context<{ Bindings: Env }>): Promise<Response> {
  const env = c.env;
  const token = c.req.query('token');
  if (!token) return c.text('Missing token', 400);

  // Single-use: read + delete.
  const raw = await env.MAGIC_TOKENS.get(`magic:${token}`);
  if (!raw) return c.text('Invalid or expired link', 400);
  await env.MAGIC_TOKENS.delete(`magic:${token}`);

  let payload: MagicTokenPayload;
  try {
    payload = JSON.parse(raw) as MagicTokenPayload;
  } catch {
    return c.text('Invalid token payload', 400);
  }
  if (payload.expires <= Math.floor(Date.now() / 1000)) {
    return c.text('Link expired', 400);
  }

  const ip = c.req.header('CF-Connecting-IP') ?? '';
  const userAgent = c.req.header('User-Agent') ?? '';

  const policy = getAccessPolicy(env);
  const decision = await policy.onSignIn(payload.email, { ip, userAgent });
  if (!decision.allowed) return c.text('Access revoked', 403);

  const session = await createSession(env.DB, {
    email: payload.email,
    orgId: decision.orgId,
    role: decision.role,
    ip,
    userAgent,
  });

  await recordAuditEvent(env.DB, {
    action: 'sign_in',
    actor: { email: payload.email, orgId: decision.orgId, role: decision.role },
    ip,
  });

  // Set the session cookie + redirect to the SPA root.
  const cookie = [
    `__Host-session=${session.token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${30 * 24 * 60 * 60}`,
  ].join('; ');

  return new Response(null, {
    status: 302,
    headers: {
      'Set-Cookie': cookie,
      Location: '/',
    },
  });
}
