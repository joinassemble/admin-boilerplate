export interface AuditActor {
  email: string;
  orgId?: string | null;
  role?: string | null;
}

export interface AuditEvent {
  action: string;
  actor?: AuditActor;
  resourceId?: string;
  recordId?: string;
  connectionId?: string;
  detail?: unknown;
  ip?: string;
}

export async function recordAuditEvent(db: D1Database, event: AuditEvent): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_log
        (ts, actor_email, actor_org_id, actor_role, action, resource_id, record_id, connection_id, detail_json, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      Math.floor(Date.now() / 1000),
      event.actor?.email ?? null,
      event.actor?.orgId ?? null,
      event.actor?.role ?? null,
      event.action,
      event.resourceId ?? null,
      event.recordId ?? null,
      event.connectionId ?? null,
      event.detail !== undefined ? JSON.stringify(event.detail) : null,
      event.ip ?? null,
    )
    .run();
}
