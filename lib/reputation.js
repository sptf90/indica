/**
 * Reputação (§R) — fórmula, histórico e hook de pontuação de ranking.
 *
 * Fórmula: Math.round(valid / selected_and_evaluated * 100) ∈ [0, 100]
 * Conta nova / sem avaliações: 0 + UI "Reputação 0/100 - Sem avaliações"
 * Timeout NÃO altera reputação do indicador.
 */

import { getPool } from "./db";
import { toMysqlDatetime, utcNow } from "./time";

export const REPUTATION_NO_EVALS_LABEL = "Reputação 0/100 - Sem avaliações";

/** Half-up via Math.round para positivos (AC-10 / R.9). */
export function computeReputation(validCount, selectedAndEvaluatedCount) {
  const valid = Math.max(0, Number(validCount) || 0);
  const total = Math.max(0, Number(selectedAndEvaluatedCount) || 0);
  if (total === 0) return 0;
  const raw = Math.round((valid / total) * 100);
  return Math.min(100, Math.max(0, raw));
}

export function formatReputationLabel(reputation, selectedAndEvaluatedCount) {
  const total = Number(selectedAndEvaluatedCount) || 0;
  if (total === 0) return REPUTATION_NO_EVALS_LABEL;
  const n = Number(reputation) || 0;
  return `Reputação ${n}/100`;
}

/**
 * Atualiza contadores + reputation + reputation_history na mesma conexão/transação.
 * Chamar após INSERT em evaluations (precisa de evaluationId).
 *
 * @returns {{ before, after, delta, validIndicationCount, selectedAndEvaluatedCount }}
 */
export async function applyReputationOnEvaluate(
  conn,
  {
    recommenderId,
    evaluationId,
    requestId,
    requestTitle,
    outcome,
  }
) {
  const [rows] = await conn.query(
    `SELECT id, reputation, valid_indication_count, selected_and_evaluated_count,
            deleted_at
     FROM users WHERE id = ? LIMIT 1 FOR UPDATE`,
    [recommenderId]
  );
  const user = rows[0];
  // Conta excluída: sem novas alterações de reputação (§5.7 / R.2.3)
  if (!user || user.deleted_at) {
    return null;
  }

  const before = Number(user.reputation) || 0;
  let valid = Number(user.valid_indication_count) || 0;
  let total = Number(user.selected_and_evaluated_count) || 0;

  total += 1;
  if (outcome === "valid") {
    valid += 1;
  }

  const after = computeReputation(valid, total);
  const delta = after - before;
  const now = toMysqlDatetime(utcNow());

  await conn.query(
    `UPDATE users
     SET reputation = ?,
         valid_indication_count = ?,
         selected_and_evaluated_count = ?
     WHERE id = ?`,
    [after, valid, total, recommenderId]
  );

  await conn.query(
    `INSERT INTO reputation_history
      (user_id, evaluation_id, request_id, request_title_snapshot, outcome,
       reputation_before, delta, reputation_after, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      recommenderId,
      evaluationId,
      requestId,
      String(requestTitle || "").slice(0, 200),
      outcome,
      before,
      delta,
      after,
      now,
    ]
  );

  return {
    before,
    after,
    delta,
    validIndicationCount: valid,
    selectedAndEvaluatedCount: total,
  };
}

/**
 * Pontuação por ranking (Fase 3A). Reexporta implementação em lib/rankings.js.
 * Call sites: evaluate válida/inválida; timeout (−10 solicitante).
 */
export { applyRankingDeltas } from "./rankings";

export async function listReputationHistory(userId, { limit = 50 } = {}) {
  const pool = getPool();
  const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const [rows] = await pool.query(
    `SELECT id, request_id, request_title_snapshot, outcome,
            reputation_before, delta, reputation_after, created_at
     FROM reputation_history
     WHERE user_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    [userId, take]
  );
  return rows.map((r) => ({
    id: r.id,
    requestId: r.request_id,
    requestTitle: r.request_title_snapshot,
    outcome: r.outcome,
    reputationBefore: r.reputation_before,
    delta: r.delta,
    reputationAfter: r.reputation_after,
    createdAt: r.created_at,
  }));
}
