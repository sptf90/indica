/**
 * Central de notificações — §5.6 / R.5 / Fase 4.
 * Criação server-side; lista recente-primeiro; marcar lida / todas por categoria; sem excluir.
 */

import { INVALID_REASONS } from "./constants";
import { getPool } from "./db";
import { withTransaction } from "./db-tx";
import { RANKING_SORT_SQL } from "./share-links";
import { addHours, fromMysqlDatetime, toMysqlDatetime, utcNow } from "./time";

export const NOTIFICATION_CATEGORIES = ["indications", "rankings", "scoring"];

export const CATEGORY_LABELS = {
  indications: "Indicações",
  rankings: "Rankings",
  scoring: "Pontuação",
};

const REASON_LABEL = Object.fromEntries(
  INVALID_REASONS.map((r) => [r.code, r.label])
);

function reasonLabel(code) {
  return REASON_LABEL[code] || code || "Outro motivo";
}

function scoreReasonLabel(event, reasonCode) {
  if (event === "evaluate_valid" || event === "timeout") {
    return event === "timeout"
      ? "Prazo de avaliação esgotado"
      : "Indicação válida";
  }
  return reasonLabel(reasonCode);
}

export function mapNotificationRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    category: row.category,
    categoryLabel: CATEGORY_LABELS[row.category] || row.category,
    event: row.event,
    title: row.title,
    body: row.body,
    deeplink: row.deeplink,
    requestId: row.request_id || null,
    indicationId: row.indication_id || null,
    rankingId: row.ranking_id || null,
    evaluationId: row.evaluation_id || null,
    read: Boolean(row.read_at),
    readAt: row.read_at || null,
    createdAt: row.created_at,
  };
}

/**
 * Insere notificação. Se idempotencyKey já existir, no-op (retorna null).
 */
export async function createNotification(connOrNull, payload) {
  const {
    userId,
    category,
    event,
    title,
    body,
    deeplink,
    requestId = null,
    indicationId = null,
    rankingId = null,
    evaluationId = null,
    idempotencyKey = null,
    createdAt = null,
  } = payload || {};

  if (!userId || !category || !event || !title || !body || !deeplink) {
    return null;
  }

  const db = connOrNull || getPool();
  if (!db) return null;

  const nowSql = toMysqlDatetime(createdAt || utcNow());
  try {
    const [result] = await db.query(
      `INSERT INTO notificacoes
        (usuario_id, categoria, evento, titulo, corpo, deeplink,
         pedido_id, indicacao_id, ranking_id, avaliacao_id,
         criado_em, chave_idempotencia)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        category,
        event,
        String(title).slice(0, 200),
        String(body),
        String(deeplink).slice(0, 500),
        requestId,
        indicationId,
        rankingId,
        evaluationId,
        nowSql,
        idempotencyKey,
      ]
    );
    return result.insertId || null;
  } catch (error) {
    if (error && error.code === "ER_DUP_ENTRY") return null;
    throw error;
  }
}

/**
 * Nova indicação consolidada por pedido: 1 não-lida por pedido, sem identidade/quantidade.
 * Atualiza timestamp se já existir não-lida; senão cria.
 */
export async function notifyNewIndicationConsolidated(
  conn,
  { requesterId, requestId, requestTitle }
) {
  if (!conn || !requesterId || !requestId) return null;
  const title = "Nova indicação no seu pedido";
  const body = `Seu pedido «${requestTitle || "Pedido"}» recebeu uma nova indicação.`;
  const deeplink = `/pedir/${requestId}`;
  const nowSql = toMysqlDatetime(utcNow());

  const [existing] = await conn.query(
    `SELECT id FROM notificacoes
     WHERE usuario_id = ? AND evento = 'new_indication' AND pedido_id = ?
       AND lida_em IS NULL
     ORDER BY id DESC LIMIT 1 FOR UPDATE`,
    [requesterId, requestId]
  );

  if (existing[0]) {
    await conn.query(
      `UPDATE notificacoes
       SET titulo = ?, corpo = ?, deeplink = ?, criado_em = ?, atualizado_em = ?
       WHERE id = ?`,
      [title, body, deeplink, nowSql, nowSql, existing[0].id]
    );
    return existing[0].id;
  }

  // Sem chave fixa: após marcar lida, nova indicação gera nova notificação consolidável.
  return createNotification(conn, {
    userId: requesterId,
    category: "indications",
    event: "new_indication",
    title,
    body,
    deeplink,
    requestId,
    idempotencyKey: null,
  });
}

export async function notifyIndicationSelected(
  conn,
  { recommenderId, indicationId, requestId, requestTitle }
) {
  return createNotification(conn, {
    userId: recommenderId,
    category: "indications",
    event: "selected",
    title: "Sua indicação foi selecionada para avaliação",
    body: `O solicitante vai testar sua indicação no pedido «${requestTitle || "Pedido"}».`,
    deeplink: `/minhas-indicacoes/${indicationId}`,
    requestId,
    indicationId,
    idempotencyKey: `selected:indication:${indicationId}`,
  });
}

export async function notifyIndicationResult(
  conn,
  {
    recommenderId,
    indicationId,
    requestId,
    requestTitle,
    outcome,
    reasonCode,
    reasonText,
    evaluationId,
    equivalent = false,
  }
) {
  const valid = outcome === "valid";
  const title = "Resultado da sua indicação";
  let body;
  if (valid) {
    body = equivalent ? `Sua indicação no pedido «${requestTitle || "Pedido"}» também foi válida: você indicou o mesmo local ou WhatsApp da escolhida.` : `Sua indicação no pedido «${requestTitle || "Pedido"}» foi válida.`;
  } else {
    const reason = reasonLabel(reasonCode);
    const extra =
      reasonCode === "other" && reasonText
        ? ` — ${String(reasonText).trim().slice(0, 120)}`
        : "";
    body = `Indicação não válida — ${reason}${extra}. Pedido «${requestTitle || "Pedido"}».`;
  }
  return createNotification(conn, {
    userId: recommenderId,
    category: "indications",
    event: valid ? "result_valid" : "result_invalid",
    title,
    body,
    deeplink: `/minhas-indicacoes/${indicationId}`,
    requestId,
    indicationId,
    evaluationId,
    idempotencyKey: `result:eval:${evaluationId}`,
  });
}

export async function notifyRoundAllInvalid(
  conn,
  { requesterId, requestId, requestTitle, cycleNumber }
) {
  return createNotification(conn, {
    userId: requesterId,
    category: "indications",
    event: "round_all_invalid",
    title: "Rodada sem indicação válida",
    body: `Todas as indicações desta rodada do pedido «${requestTitle || "Pedido"}» foram invalidadas. Você pode reabrir ou encerrar.`,
    deeplink: `/pedir/${requestId}`,
    requestId,
    idempotencyKey: `round_all_invalid:req:${requestId}:cycle:${cycleNumber ?? 0}`,
  });
}

/**
 * Notifica alteração de pontos com chave estável ligada ao ledger (1 por ranking).
 */
export async function notifyScoreChangesStable(
  conn,
  { userId, applied, event, reasonCode, evaluationId, requestId }
) {
  if (!conn || !userId || !Array.isArray(applied) || !applied.length) {
    return [];
  }
  const ids = [];
  for (const item of applied) {
    const delta = Number(item.delta) || 0;
    const sign = delta > 0 ? "+" : "";
    const motivo = scoreReasonLabel(event, reasonCode);
    const stableKey =
      event === "timeout"
        ? `score:timeout:req:${requestId}:ranking:${item.rankingId}`
        : `score:eval:${evaluationId}:ranking:${item.rankingId}`;
    const id = await createNotification(conn, {
      userId,
      category: "scoring",
      event: "score_change",
      title: "Pontuação atualizada",
      body: `${item.title || "Ranking"}: ${sign}${delta} pts (${motivo}). Pontuação atual: ${item.balanceAfter}.`,
      deeplink: `/rankings/${item.rankingId}`,
      rankingId: item.rankingId,
      evaluationId: evaluationId || null,
      requestId: requestId || null,
      idempotencyKey: stableKey,
    });
    if (id) ids.push(id);
  }
  return ids;
}

export async function notifyRankingFinal(conn, { userId, rankingId, rankingTitle }) {
  return createNotification(conn, {
    userId,
    category: "rankings",
    event: "ranking_final",
    title: "Classificação final publicada",
    body: `A classificação final de «${rankingTitle || "Ranking"}» já está disponível.`,
    deeplink: `/rankings/${rankingId}`,
    rankingId,
    idempotencyKey: `ranking_final:ranking:${rankingId}:user:${userId}`,
  });
}

/** Lembrete 1h antes do deadline — solicitante. */
export async function sendDeadlineReminders(connOrNull = null) {
  const db = connOrNull || getPool();
  if (!db) return { sent: 0 };

  const now = utcNow();
  const inOneHour = addHours(now, 1);
  const nowSql = toMysqlDatetime(now);
  const untilSql = toMysqlDatetime(inOneHour);

  const [due] = await db.query(
    `SELECT id, solicitante_id, titulo, avaliacao_prazo_em
     FROM pedidos
     WHERE status = 'in_evaluation'
       AND excluido_em IS NULL
       AND avaliacao_prazo_em IS NOT NULL
       AND avaliacao_prazo_em > ?
       AND avaliacao_prazo_em <= ?
     LIMIT 200`,
    [nowSql, untilSql]
  );

  let sent = 0;
  for (const row of due) {
    const deadline = fromMysqlDatetime(row.evaluation_deadline_at);
    const key = `reminder_1h:req:${row.id}:deadline:${toMysqlDatetime(deadline)}`;
    const id = await createNotification(db, {
      userId: row.requester_id,
      category: "indications",
      event: "reminder_1h",
      title: "Lembrete: falta 1 hora",
      body: `O prazo para avaliar a indicação do pedido «${row.title}» termina em cerca de 1 hora.`,
      deeplink: `/pedir/${row.id}`,
      requestId: row.id,
      idempotencyKey: key,
    });
    if (id) sent += 1;
  }
  return { sent, checkedAt: nowSql };
}

export async function listNotifications(
  userId,
  { category = null, limit = 50, unreadOnly = false } = {}
) {
  const pool = getPool();
  if (!pool) return { items: [], unreadTotal: 0, unreadByCategory: {} };

  const lim = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const params = [userId];
  let where = `usuario_id = ?`;
  if (category && NOTIFICATION_CATEGORIES.includes(category)) {
    where += ` AND categoria = ?`;
    params.push(category);
  }
  if (unreadOnly) {
    where += ` AND lida_em IS NULL`;
  }

  const [rows] = await pool.query(
    `SELECT * FROM notificacoes
     WHERE ${where}
     ORDER BY criado_em DESC, id DESC
     LIMIT ${lim}`,
    params
  );

  const [counts] = await pool.query(
    `SELECT categoria, COUNT(*) AS n
     FROM notificacoes
     WHERE usuario_id = ? AND lida_em IS NULL
     GROUP BY categoria`,
    [userId]
  );

  const unreadByCategory = { indications: 0, rankings: 0, scoring: 0 };
  let unreadTotal = 0;
  for (const c of counts) {
    unreadByCategory[c.category] = Number(c.n) || 0;
    unreadTotal += Number(c.n) || 0;
  }

  return {
    items: rows.map(mapNotificationRow),
    unreadTotal,
    unreadByCategory,
  };
}

export async function markNotificationRead(userId, notificationId) {
  const pool = getPool();
  if (!pool) return { ok: false };
  const nowSql = toMysqlDatetime(utcNow());
  const [result] = await pool.query(
    `UPDATE notificacoes
     SET lida_em = COALESCE(lida_em, ?)
     WHERE id = ? AND usuario_id = ?`,
    [nowSql, notificationId, userId]
  );
  return { ok: result.affectedRows > 0 };
}

export async function markAllNotificationsRead(userId, category = null) {
  const pool = getPool();
  if (!pool) return { updated: 0 };
  if (category && !NOTIFICATION_CATEGORIES.includes(category)) {
    const err = new Error("Categoria inválida.");
    err.status = 400;
    throw err;
  }
  const nowSql = toMysqlDatetime(utcNow());
  const params = [nowSql, userId];
  let sql = `UPDATE notificacoes SET lida_em = ? WHERE usuario_id = ? AND lida_em IS NULL`;
  if (category) {
    sql += ` AND categoria = ?`;
    params.push(category);
  }
  const [result] = await pool.query(sql, params);
  return { updated: result.affectedRows || 0 };
}

/**
 * Após período: open → tallying; após janela de apuração 36h: tallying → final + notifica inscritos.
 */
export async function processRankingLifecycleNotifications(connOrNull = null) {
  const run = async (conn) => {
    const now = utcNow();
    const nowSql = toMysqlDatetime(now);
    let toTallying = 0;
    let finalized = 0;
    let notified = 0;

    const [openDue] = await conn.query(
      `SELECT id, titulo FROM rankings
       WHERE status = 'open' AND periodo_fim <= ?
       FOR UPDATE`,
      [nowSql]
    );
    for (const r of openDue) {
      await conn.query(
        `UPDATE rankings SET status = 'tallying', atualizado_em = ? WHERE id = ? AND status = 'open'`,
        [nowSql, r.id]
      );
      toTallying += 1;
    }

    const tallyCutoff = toMysqlDatetime(addHours(now, -36));
    const [tallyDue] = await conn.query(
      `SELECT id, titulo FROM rankings
       WHERE status = 'tallying' AND periodo_fim <= ?
       FOR UPDATE`,
      [tallyCutoff]
    );

    for (const ranking of tallyDue) {
      const [parts] = await conn.query(
        `SELECT p.id, p.usuario_id, p.saldo, p.contagem_validas_periodo,
                u.reputacao, u.contagem_visitas_compartilhamento
         FROM ranking_participacoes p
         INNER JOIN usuarios u ON u.id = p.usuario_id
         WHERE p.ranking_id = ?
         ORDER BY ${RANKING_SORT_SQL}
         FOR UPDATE`,
        [ranking.id]
      );

      let position = 0;
      for (const part of parts) {
        position += 1;
        await conn.query(
          `UPDATE ranking_participacoes
           SET posicao_final = ?, reputacao_congelada = ?,
               contagem_visitas_compartilhamento_congelada = ?, status = 'final', atualizado_em = ?
           WHERE id = ?`,
          [
            position,
            Number(part.reputation) || 0,
            Number(part.share_visit_count) || 0,
            nowSql,
            part.id,
          ]
        );
        const nid = await notifyRankingFinal(conn, {
          userId: part.user_id,
          rankingId: ranking.id,
          rankingTitle: ranking.title,
        });
        if (nid) notified += 1;
      }

      await conn.query(
        `UPDATE rankings SET status = 'final', atualizado_em = ? WHERE id = ? AND status = 'tallying'`,
        [nowSql, ranking.id]
      );
      finalized += 1;
    }

    return { toTallying, finalized, notified, checkedAt: nowSql };
  };

  if (connOrNull) return run(connOrNull);
  return withTransaction(run);
}
