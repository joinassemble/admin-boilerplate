import { decryptJson, encryptJson } from '../lib/crypto';
import type { ConnectionSecret } from './types';

interface SecretRow {
  ciphertext: ArrayBuffer;
  iv: ArrayBuffer;
}

export async function setConnectionSecret(
  db: D1Database,
  connectionId: string,
  secret: ConnectionSecret,
  rootKey: string,
  actorEmail: string,
): Promise<void> {
  const encrypted = await encryptJson(secret, rootKey, connectionId);
  const now = Math.floor(Date.now() / 1000);
  // Use INSERT ... ON CONFLICT to upsert.
  await db
    .prepare(
      `INSERT INTO connection_secrets (connection_id, ciphertext, iv, last_rotated_at, last_rotated_by)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(connection_id) DO UPDATE SET
         ciphertext = excluded.ciphertext,
         iv = excluded.iv,
         last_rotated_at = excluded.last_rotated_at,
         last_rotated_by = excluded.last_rotated_by`,
    )
    .bind(connectionId, encrypted.ciphertext, encrypted.iv, now, actorEmail)
    .run();
}

export async function getConnectionSecret(
  db: D1Database,
  connectionId: string,
  rootKey: string,
): Promise<ConnectionSecret | null> {
  const row = await db
    .prepare('SELECT ciphertext, iv FROM connection_secrets WHERE connection_id = ?')
    .bind(connectionId)
    .first<SecretRow>();
  if (!row) return null;
  // D1 BLOBs come back as ArrayBuffer; crypto helpers expect Uint8Array.
  return decryptJson<ConnectionSecret>(
    { ciphertext: new Uint8Array(row.ciphertext), iv: new Uint8Array(row.iv) },
    rootKey,
    connectionId,
  );
}

export async function isConnectionConfigured(db: D1Database, connectionId: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 FROM connection_secrets WHERE connection_id = ? LIMIT 1')
    .bind(connectionId)
    .first<{ '1': number }>();
  return row !== null;
}

export async function deleteConnectionSecret(db: D1Database, connectionId: string): Promise<void> {
  await db.prepare('DELETE FROM connection_secrets WHERE connection_id = ?').bind(connectionId).run();
}
