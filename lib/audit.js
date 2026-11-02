export async function writeAudit(conn, {
  entityType,
  entityId,
  fromStatus = null,
  toStatus = null,
  actorType,
  actorId = null,
  reason = null,
  payload = null,
}) {
  await conn.query(
    `INSERT INTO audit_events
      (entity_type, entity_id, from_status, to_status, actor_type, actor_id, reason, payload_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entityType,
      entityId,
      fromStatus,
      toStatus,
      actorType,
      actorId,
      reason,
      payload ? JSON.stringify(payload) : null,
    ]
  );
}
