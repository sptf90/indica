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
    `INSERT INTO eventos_auditoria
      (tipo_entidade, entidade_id, status_anterior, status_novo, tipo_ator, ator_id, motivo, payload_json)
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
