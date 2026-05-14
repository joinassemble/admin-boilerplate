import { randomToken } from '../lib/tokens';

export interface SessionInput {
  email: string;
  orgId?: string;
  role?: string;
  ip?: string;
  userAgent?: string;
}

export interface Session {
  token: string;
  email: string;
  orgId: string | null;
  role: string | null;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
}

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

export async function createSession(db: D1Database, input: SessionInput): Promise<Session> {
  const token = randomToken();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + THIRTY_DAYS_SECONDS;

  await db
    .prepare(
      `INSERT INTO sessions
        (token, email, org_id, role, created_at, last_seen_at, expires_at, user_agent, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      token,
      input.email.toLowerCase(),
      input.orgId ?? null,
      input.role ?? null,
      now,
      now,
      expiresAt,
      input.userAgent ?? null,
      input.ip ?? null,
    )
    .run();

  return {
    token,
    email: input.email.toLowerCase(),
    orgId: input.orgId ?? null,
    role: input.role ?? null,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
  };
}

export async function validateSession(db: D1Database, token: string): Promise<Session | null> {
  const row = await db
    .prepare(
      'SELECT token, email, org_id, role, created_at, last_seen_at, expires_at FROM sessions WHERE token = ?',
    )
    .bind(token)
    .first<{
      token: string;
      email: string;
      org_id: string | null;
      role: string | null;
      created_at: number;
      last_seen_at: number;
      expires_at: number;
    }>();
  if (!row) return null;

  const now = Math.floor(Date.now() / 1000);
  if (row.expires_at <= now) {
    // Best-effort cleanup; ignore failure.
    await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run().catch(() => {});
    return null;
  }

  // Sliding expiry: bump if more than a minute since last_seen.
  if (now - row.last_seen_at > 60) {
    const newExpires = now + THIRTY_DAYS_SECONDS;
    await db
      .prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE token = ?')
      .bind(now, newExpires, token)
      .run();
    return {
      token: row.token,
      email: row.email,
      orgId: row.org_id,
      role: row.role,
      createdAt: row.created_at,
      lastSeenAt: now,
      expiresAt: newExpires,
    };
  }

  return {
    token: row.token,
    email: row.email,
    orgId: row.org_id,
    role: row.role,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
  };
}

export async function revokeSession(db: D1Database, token: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
}

export async function revokeAllForEmail(db: D1Database, email: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE email = ?').bind(email.toLowerCase()).run();
}
