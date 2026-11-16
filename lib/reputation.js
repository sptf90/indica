/**
 * Reputação (§R) — fórmula, histórico e hook de pontuação de ranking.
 *
 * Fórmula: Math.round(valid / (selected_and_evaluated + equivalent_valid) * 100) ∈ [0, 100]
 * Conta nova / sem avaliações: 0 + UI "Reputação 0/100 - Sem avaliações"
 * Timeout NÃO altera reputação do indicador.
 */

import { getPool } from "./db";
import { toMysqlDatetime, utcNow } from "./time";

export const REPUTATION_NO_EVALS_LABEL = "Reputação 0/100 - Sem avaliações";

/** A restrição também existe no banco; configurações inválidas abortam a transação. */
export async function getReputationScoring(conn) {
  const [rows] = await conn.query("SELECT pontos_principal, pontos_equivalencia FROM configuracao_reputacao WHERE id = 1");
  const principal = Number(rows[0]?.pontos_principal);
  const equivalent = Number(rows[0]?.pontos_equivalencia);
  if (!Number.isSafeInteger(principal) || !Number.isSafeInteger(equivalent) || equivalent <= 0 || principal <= equivalent) {
    throw new Error("Configuração de pontuação inválida: equivalência deve ser positiva e inferior à principal.");
  }
  return { principal, equivalent };
}

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
    indicationId,
    validationType = "chosen",
    sourceIndicationId = null,
    points = 0,
  }
) {
  const [rows] = await conn.query(
    `SELECT id, reputacao, contagem_indicacoes_validas, contagem_selecionadas_avaliadas,
            contagem_validas_equivalentes, contagem_validas_escolhidas, excluido_em
     FROM usuarios WHERE id = ? LIMIT 1 FOR UPDATE`,
    [recommenderId]
  );
  const user = rows[0];
  // Conta excluída: sem novas alterações de reputação (§5.7 / R.2.3)
  if (!user || user.deleted_at) {
    return null;
  }

  const recognitionKey = outcome === "valid" ? `valid:${requestId}:${recommenderId}` : `evaluation:${evaluationId}`;
  const [existing] = await conn.query(
    "SELECT id FROM historico_reputacao WHERE chave_reconhecimento = ? OR avaliacao_id = ? LIMIT 1",
    [recognitionKey, evaluationId]
  );
  if (existing[0]) return null;
  const equivalent = outcome === "valid" && validationType === "equivalent";
  const before = Number(user.reputation) || 0;
  let valid = Number(user.valid_indication_count) || 0;
  let total = Number(user.selected_and_evaluated_count) || 0;

  let equivalentCount = Number(user.equivalent_valid_count) || 0;
  let chosenValidCount = Number(user.chosen_valid_count) || 0;
  if (equivalent) equivalentCount += 1;
  else total += 1;
  if (outcome === "valid") {
    valid += 1;
    if (!equivalent) chosenValidCount += 1;
  }

  const after = computeReputation(valid, total + equivalentCount);
  const delta = after - before;
  const now = toMysqlDatetime(utcNow());

  await conn.query(
    `UPDATE usuarios
     SET reputacao = ?,
         contagem_indicacoes_validas = ?,
         contagem_selecionadas_avaliadas = ?,
         contagem_validas_equivalentes = ?, contagem_validas_escolhidas = ?,
         pontuacao_acumulada = pontuacao_acumulada + ?
     WHERE id = ?`,
    [after, valid, total, equivalentCount, chosenValidCount, points, recommenderId]
  );

  await conn.query(
    `INSERT INTO historico_reputacao
      (usuario_id, avaliacao_id, pedido_id, titulo_pedido_snapshot, resultado,
       reputacao_antes, delta, reputacao_depois, criado_em,
       indicacao_id, tipo_validacao, indicacao_origem_id, pontos_atribuidos, chave_reconhecimento)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      indicationId,
      outcome === "valid" ? validationType : null,
      sourceIndicationId,
      points,
      recognitionKey,
    ]
  );

  return {
    before,
    after,
    delta,
    validIndicationCount: valid,
    selectedAndEvaluatedCount: total,
    equivalentValidCount: equivalentCount,
    chosenValidCount,
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
    `SELECT id, pedido_id, titulo_pedido_snapshot, resultado,
            reputacao_antes, delta, reputacao_depois, criado_em,
            indicacao_id, tipo_validacao, indicacao_origem_id, pontos_atribuidos
     FROM historico_reputacao
     WHERE usuario_id = ?
     ORDER BY criado_em DESC, id DESC
     LIMIT ?`,
    [userId, take]
  );
  return rows.map((r) => ({
    id: r.id,
    requestId: r.request_id,
    indicationId: r.indication_id,
    validationType: r.validation_type,
    sourceIndicationId: r.source_indication_id,
    points: r.awarded_points == null ? null : Number(r.awarded_points),
    requestTitle: r.request_title_snapshot,
    outcome: r.outcome,
    reputationBefore: r.reputation_before,
    delta: r.delta,
    reputationAfter: r.reputation_after,
    createdAt: r.created_at,
  }));
}
