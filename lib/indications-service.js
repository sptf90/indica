import { writeAudit } from "./audit";
import {
  COOLDOWN_HOURS,
  INDICATION_UI_STATUS,
  INVALID_REASONS,
  MAX_DESCRIPTION,
  MSG,
  REQUEST_STATUS_LABELS,
} from "./constants";
import { withTransaction } from "./db-tx";
import { getPool } from "./db";
import { notifyNewIndicationConsolidated } from "./notifications";
import { fromMysqlDatetime, toMysqlDatetime, utcNow } from "./time";

const INVALID_REASON_LABEL = Object.fromEntries(
  INVALID_REASONS.map((r) => [r.code, r.label])
);

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function isValidUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function ownerStatusLabel(row) {
  if (row.result === "valid" || row.status === "valid") return "Escolhida";
  if (row.result === "invalid" || row.status === "invalid") return "Não válida";
  if (row.result === "not_selected" || row.status === "not_selected") {
    return "Não escolhida";
  }
  return INDICATION_UI_STATUS[row.status] || row.status;
}

/**
 * Outcome da indicação para o indicador (pedido concluído / avaliado).
 * Usa status/result + avaliação + reputation_history + score_ledger.
 */
export function buildIndicationOutcome(row, extras = {}) {
  const status = row.status;
  const result = row.result;
  const evalOutcome = extras.evaluationOutcome || null;
  const wasChosen =
    Boolean(row.selected_at) ||
    status === "selected" ||
    status === "valid" ||
    status === "invalid" ||
    result === "valid" ||
    result === "invalid" ||
    Boolean(evalOutcome);

  const isValid =
    result === "valid" || status === "valid" || evalOutcome === "valid";
  const isInvalid =
    result === "invalid" || status === "invalid" || evalOutcome === "invalid";
  const isNotChosen =
    result === "not_selected" ||
    status === "not_selected" ||
    (!wasChosen &&
      ["completed", "closed_voluntary", "closed_no_valid", "closed_timeout"].includes(
        row.request_status
      ));

  let kind = "pending";
  if (isValid) kind = "chosen_valid";
  else if (isInvalid) kind = "chosen_invalid";
  else if (isNotChosen) kind = "not_chosen";
  else if (status === "closed_timeout") kind = "closed_timeout";
  else if (status === "closed_no_valid") kind = "closed_no_valid";
  else if (status === "selected" || status === "in_evaluation") kind = "in_evaluation";

  const reasonCode = row.invalid_reason_code || extras.reasonCode || null;
  const reasonText = row.invalid_reason_text || extras.reasonText || null;
  const invalidReasonLabel = reasonCode
    ? INVALID_REASON_LABEL[reasonCode] || reasonCode
    : null;

  let title = null;
  let subtitle = null;
  if (kind === "chosen_valid") {
    title = "Sua indicação foi escolhida!";
    subtitle =
      "O solicitante avaliou como válida. Parabéns — você ajudou a resolver o pedido.";
  } else if (kind === "chosen_invalid") {
    title = "Sua indicação foi escolhida, mas não foi válida";
    subtitle = invalidReasonLabel
      ? `Motivo: ${invalidReasonLabel}${
          reasonCode === "other" && reasonText ? ` — ${reasonText}` : ""
        }`
      : "O solicitante avaliou sua indicação como não válida.";
  } else if (kind === "not_chosen") {
    title = "Sua indicação não foi escolhida";
    subtitle =
      "Outra indicação resolveu o pedido. Sua reputação não muda quando você não é selecionado.";
  } else if (kind === "closed_timeout") {
    title = "Pedido encerrado por falta de avaliação";
    subtitle = "O prazo de avaliação expirou antes do solicitante concluir.";
  } else if (kind === "closed_no_valid") {
    title = "Pedido encerrado sem indicação válida";
    subtitle = "Nenhuma indicação deste ciclo foi confirmada como válida.";
  } else if (kind === "in_evaluation") {
    title = "Sua indicação está em avaliação";
    subtitle = "O solicitante está testando sua indicação.";
  }

  const reputation =
    extras.reputation &&
    extras.reputation.before != null &&
    extras.reputation.after != null
      ? {
          before: Number(extras.reputation.before) || 0,
          delta: Number(extras.reputation.delta) || 0,
          after: Number(extras.reputation.after) || 0,
        }
      : null;

  const pointsDelta =
    extras.pointsDelta != null && Number.isFinite(Number(extras.pointsDelta))
      ? Number(extras.pointsDelta)
      : null;

  return {
    kind,
    wasChosen,
    wasEvaluated: Boolean(evalOutcome) || isValid || isInvalid,
    evaluationOutcome: evalOutcome || (isValid ? "valid" : isInvalid ? "invalid" : null),
    title,
    subtitle,
    invalidReasonCode: reasonCode,
    invalidReasonLabel,
    invalidReasonText: reasonText,
    reputation,
    pointsDelta,
  };
}

export function mapIndicationForOwner(row, extras = {}) {
  const outcome = buildIndicationOutcome(row, extras);
  return {
    id: row.id,
    requestId: row.request_id,
    description: row.description,
    status: row.status,
    statusLabel: ownerStatusLabel(row),
    result: row.result,
    invalidReasonCode: row.invalid_reason_code,
    invalidReasonText: row.invalid_reason_text,
    cycleNumber: row.cycle_number,
    lockedAt: row.locked_at,
    selectedAt: row.selected_at || null,
    evaluatedAt: row.evaluated_at || null,
    createdAt: row.created_at,
    requestTitle: row.request_title,
    requestStatus: row.request_status,
    requestStatusLabel: REQUEST_STATUS_LABELS[row.request_status] || row.request_status,
    cityName: row.city_name,
    cityState: row.city_state,
    canEdit: !row.locked_at && row.request_status === "open" && !row.request_deleted_at,
    outcome,
  };
}

export async function listEligibleRequests(user, { cityId, cursor, limit = 20 }) {
  const pool = getPool();
  const cid = Number(cityId || user.city_id);
  if (!cid) throw httpError("Cidade obrigatória.");

  const take = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const params = [user.id, cid, user.id];
  let cursorClause = "";
  if (cursor) {
    // Paginação ASC: ids maiores = mais novos (após created_at ASC, id ASC)
    cursorClause = " AND r.id > ?";
    params.push(Number(cursor));
  }
  params.push(take);

  const [rows] = await pool.query(
    `SELECT r.id, r.titulo, r.status, r.criado_em, c.nome AS city_name, c.estado AS city_state
     FROM pedidos r
     JOIN cidades c ON c.id = r.cidade_id
     WHERE r.excluido_em IS NULL
       AND r.solicitante_id <> ?
       AND r.status = 'open'
       AND r.cidade_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM pedido_participacoes p
         WHERE p.pedido_id = r.id AND p.usuario_id = ?
       )
       ${cursorClause}
     ORDER BY r.criado_em ASC, r.id ASC
     LIMIT ?`,
    params
  );

  // Privacy: never include requester identity or indication counts
  return {
    cityId: cid,
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      statusLabel: REQUEST_STATUS_LABELS[r.status] || r.status,
      cityName: r.city_name,
      cityState: r.city_state,
      createdAt: r.created_at,
    })),
    nextCursor: rows.length === take ? rows[rows.length - 1].id : null,
    emptyMessage: rows.length === 0 ? MSG.emptyList : null,
  };
}

export async function getEligibleRequestDetail(user, requestId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT r.id, r.titulo, r.detalhes, r.foto_url, r.status, r.cidade_id,
            r.solicitante_id, r.comparacao_aberta_em, r.criado_em,
            c.nome AS city_name, c.estado AS city_state
     FROM pedidos r
     JOIN cidades c ON c.id = r.cidade_id
     WHERE r.id = ? AND r.excluido_em IS NULL
     LIMIT 1`,
    [requestId]
  );
  const request = rows[0];
  if (!request) throw httpError("Pedido não encontrado.", 404);
  if (request.requester_id === user.id) {
    throw httpError("Use Meus pedidos para os seus pedidos.", 403);
  }

  // Never expose requester identity or indication totals
  const base = {
    id: request.id,
    title: request.title,
    details: request.details,
    photoUrl: request.photo_url || null,
    status: request.status,
    statusLabel: REQUEST_STATUS_LABELS[request.status] || request.status,
    cityId: request.city_id,
    cityName: request.city_name,
    cityState: request.city_state,
    createdAt: request.created_at || null,
  };

  if (request.status === "in_evaluation" || request.comparison_opened_at) {
    return {
      ...base,
      acceptsIndications: false,
      message: MSG.inEvaluation,
    };
  }

  if (request.status !== "open") {
    return {
      ...base,
      acceptsIndications: false,
      message: "Este pedido não aceita novas indicações.",
    };
  }

  const [parts] = await pool.query(
    `SELECT id FROM pedido_participacoes WHERE pedido_id = ? AND usuario_id = ? LIMIT 1`,
    [requestId, user.id]
  );
  if (parts[0]) {
    return {
      ...base,
      acceptsIndications: false,
      message: "Você já participou deste pedido.",
    };
  }

  const cooldown = await checkCooldown(user.id, request.requester_id, pool);
  return {
    ...base,
    acceptsIndications: cooldown.ok,
    cooldownBlocked: !cooldown.ok,
    message: cooldown.ok ? null : MSG.cooldown,
  };
}

async function checkCooldown(recommenderId, requesterId, db) {
  const [rows] = await db.query(
    `SELECT ultima_indicacao_em FROM solicitante_bloqueios
     WHERE indicador_id = ? AND solicitante_id = ?
     LIMIT 1`,
    [recommenderId, requesterId]
  );
  if (!rows[0]) return { ok: true };
  const last = fromMysqlDatetime(rows[0].last_indication_at);
  const elapsed = Date.now() - last.getTime();
  const windowMs = COOLDOWN_HOURS * 60 * 60 * 1000;
  if (elapsed < windowMs) {
    return { ok: false, retryAfterMs: windowMs - elapsed };
  }
  return { ok: true };
}

export async function createIndication(
  user,
  requestId,
  { description, links = [], place = null }
) {
  const desc = String(description || "").trim();
  if (!desc) throw httpError("Descrição obrigatória.");
  if (desc.length > MAX_DESCRIPTION) {
    throw httpError(`Descrição deve ter no máximo ${MAX_DESCRIPTION} caracteres.`);
  }
  const cleanLinks = Array.isArray(links)
    ? links.map((l) => String(l || "").trim()).filter(Boolean)
    : [];
  for (const url of cleanLinks) {
    if (!isValidUrl(url)) throw httpError(`Link inválido: ${url}`);
  }
  if (place) {
    if (!place.name || !place.address) {
      throw httpError("Local exige nome e endereço.");
    }
  }

  return withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT * FROM pedidos WHERE id = ? AND excluido_em IS NULL LIMIT 1 FOR UPDATE`,
      [requestId]
    );
    const request = rows[0];
    if (!request) throw httpError("Pedido não encontrado.", 404);
    if (request.requester_id === user.id) {
      throw httpError("Não é possível indicar no próprio pedido.");
    }
    if (request.status !== "open") {
      throw httpError(MSG.inEvaluation);
    }

    const [existingPart] = await conn.query(
      `SELECT id FROM pedido_participacoes
       WHERE pedido_id = ? AND usuario_id = ? LIMIT 1 FOR UPDATE`,
      [requestId, user.id]
    );
    if (existingPart[0]) {
      throw httpError("Você já participou deste pedido.");
    }

    const cooldown = await checkCooldown(user.id, request.requester_id, conn);
    if (!cooldown.ok) throw httpError(MSG.cooldown);

    const now = toMysqlDatetime(utcNow());
    let insertResult;
    try {
      [insertResult] = await conn.query(
        `INSERT INTO indicacoes
          (pedido_id, indicador_id, descricao, status, numero_ciclo)
         VALUES (?, ?, ?, 'sent', ?)`,
        [requestId, user.id, desc, request.cycle_number]
      );
    } catch (error) {
      if (error && error.code === "ER_DUP_ENTRY") {
        throw httpError("Você já participou deste pedido.");
      }
      throw error;
    }
    const indicationId = insertResult.insertId;

    await conn.query(
      `INSERT INTO pedido_participacoes (pedido_id, usuario_id, primeira_indicacao_em)
       VALUES (?, ?, ?)`,
      [requestId, user.id, now]
    );
    await conn.query(
      `INSERT INTO solicitante_bloqueios (indicador_id, solicitante_id, ultima_indicacao_em)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE ultima_indicacao_em = VALUES(ultima_indicacao_em)`,
      [user.id, request.requester_id, now]
    );

    for (let i = 0; i < cleanLinks.length; i += 1) {
      await conn.query(
        `INSERT INTO indicacao_links (indicacao_id, url, ordem) VALUES (?, ?, ?)`,
        [indicationId, cleanLinks[i], i]
      );
    }
    if (place) {
      await conn.query(
        `INSERT INTO indicacao_locais
          (indicacao_id, origem, place_id, nome, endereco, maps_url)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          indicationId,
          place.source === "google_maps" ? "google_maps" : "manual",
          place.placeId || null,
          String(place.name).trim(),
          String(place.address).trim(),
          place.mapsUrl || null,
        ]
      );
    }

    await writeAudit(conn, {
      entityType: "indication",
      entityId: indicationId,
      fromStatus: null,
      toStatus: "sent",
      actorType: "user",
      actorId: user.id,
      reason: "create",
      payload: { requestId },
    });

    // §5.6: consolidada por pedido, sem identidade/quantidade do indicador
    await notifyNewIndicationConsolidated(conn, {
      requesterId: request.requester_id,
      requestId,
      requestTitle: request.title,
    });

    return {
      id: indicationId,
      message: MSG.indicationOk,
    };
  });
}

export async function updateIndication(
  user,
  indicationId,
  { description, links = [], place = null }
) {
  const desc = String(description || "").trim();
  if (!desc) throw httpError("Descrição obrigatória.");
  if (desc.length > MAX_DESCRIPTION) {
    throw httpError(`Descrição deve ter no máximo ${MAX_DESCRIPTION} caracteres.`);
  }
  const cleanLinks = Array.isArray(links)
    ? links.map((l) => String(l || "").trim()).filter(Boolean)
    : [];
  for (const url of cleanLinks) {
    if (!isValidUrl(url)) throw httpError(`Link inválido: ${url}`);
  }

  return withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT i.*, r.status AS request_status, r.comparacao_aberta_em
       FROM indicacoes i
       JOIN pedidos r ON r.id = i.pedido_id
       WHERE i.id = ? AND i.excluido_em IS NULL AND r.excluido_em IS NULL
       LIMIT 1 FOR UPDATE`,
      [indicationId]
    );
    const indication = rows[0];
    if (!indication) throw httpError("Indicação não encontrada.", 404);
    if (indication.recommender_id !== user.id) throw httpError("Sem permissão.", 403);
    if (indication.locked_at || indication.request_status !== "open") {
      throw httpError("Não é possível editar após a abertura da comparação.");
    }

    await conn.query(`UPDATE indicacoes SET descricao = ? WHERE id = ?`, [
      desc,
      indicationId,
    ]);
    await conn.query(`DELETE FROM indicacao_links WHERE indicacao_id = ?`, [
      indicationId,
    ]);
    for (let i = 0; i < cleanLinks.length; i += 1) {
      await conn.query(
        `INSERT INTO indicacao_links (indicacao_id, url, ordem) VALUES (?, ?, ?)`,
        [indicationId, cleanLinks[i], i]
      );
    }
    await conn.query(`DELETE FROM indicacao_locais WHERE indicacao_id = ?`, [
      indicationId,
    ]);
    if (place && place.name && place.address) {
      await conn.query(
        `INSERT INTO indicacao_locais
          (indicacao_id, origem, place_id, nome, endereco, maps_url)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          indicationId,
          place.source === "google_maps" ? "google_maps" : "manual",
          place.placeId || null,
          String(place.name).trim(),
          String(place.address).trim(),
          place.mapsUrl || null,
        ]
      );
    }
    await writeAudit(conn, {
      entityType: "indication",
      entityId: indicationId,
      fromStatus: indication.status,
      toStatus: indication.status,
      actorType: "user",
      actorId: user.id,
      reason: "edit",
    });
    return { ok: true };
  });
}

export async function deleteIndication(user, indicationId) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT i.*, r.status AS request_status
       FROM indicacoes i
       JOIN pedidos r ON r.id = i.pedido_id
       WHERE i.id = ? AND i.excluido_em IS NULL AND r.excluido_em IS NULL
       LIMIT 1 FOR UPDATE`,
      [indicationId]
    );
    const indication = rows[0];
    if (!indication) throw httpError("Indicação não encontrada.", 404);
    if (indication.recommender_id !== user.id) throw httpError("Sem permissão.", 403);
    if (indication.locked_at || indication.request_status !== "open") {
      throw httpError("Não é possível excluir após a abertura da comparação.");
    }

    const now = toMysqlDatetime(utcNow());
    await conn.query(`UPDATE indicacoes SET excluido_em = ? WHERE id = ?`, [
      now,
      indicationId,
    ]);
    // Participação permanente permanece — não remove request_participations
    await writeAudit(conn, {
      entityType: "indication",
      entityId: indicationId,
      fromStatus: indication.status,
      toStatus: "deleted",
      actorType: "user",
      actorId: user.id,
      reason: "delete",
    });
    return { ok: true };
  });
}

export async function listMyIndications(userId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT i.*, r.titulo AS request_title, r.status AS request_status,
            r.excluido_em AS request_deleted_at, c.nome AS city_name, c.estado AS city_state
     FROM indicacoes i
     JOIN pedidos r ON r.id = i.pedido_id
     JOIN cidades c ON c.id = r.cidade_id
     WHERE i.indicador_id = ? AND i.excluido_em IS NULL AND r.excluido_em IS NULL
     ORDER BY i.criado_em DESC`,
    [userId]
  );
  return rows.map(mapIndicationForOwner);
}

export async function getMyIndicationDetail(userId, indicationId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT i.*, r.titulo AS request_title, r.detalhes AS request_details,
            r.status AS request_status, r.excluido_em AS request_deleted_at,
            c.nome AS city_name, c.estado AS city_state
     FROM indicacoes i
     JOIN pedidos r ON r.id = i.pedido_id
     JOIN cidades c ON c.id = r.cidade_id
     WHERE i.id = ? AND i.indicador_id = ? AND i.excluido_em IS NULL AND r.excluido_em IS NULL
     LIMIT 1`,
    [indicationId, userId]
  );
  const row = rows[0];
  if (!row) throw httpError("Indicação não encontrada.", 404);

  const [links] = await pool.query(
    `SELECT url FROM indicacao_links WHERE indicacao_id = ? ORDER BY ordem, id`,
    [indicationId]
  );
  const [places] = await pool.query(
    `SELECT origem, place_id, nome, endereco, maps_url
     FROM indicacao_locais WHERE indicacao_id = ? LIMIT 1`,
    [indicationId]
  );

  const [evals] = await pool.query(
    `SELECT id, resultado, motivo_codigo, motivo_texto, avaliada_em
     FROM avaliacoes
     WHERE indicacao_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [indicationId]
  );
  const evaluation = evals[0] || null;

  let reputation = null;
  if (evaluation) {
    const [hist] = await pool.query(
      `SELECT reputacao_antes, delta, reputacao_depois
       FROM historico_reputacao
       WHERE avaliacao_id = ? AND usuario_id = ?
       LIMIT 1`,
      [evaluation.id, userId]
    );
    if (hist[0]) {
      reputation = {
        before: hist[0].reputation_before,
        delta: hist[0].delta,
        after: hist[0].reputation_after,
      };
    }
  }

  let pointsDelta = null;
  try {
    const [scores] = await pool.query(
      `SELECT COALESCE(SUM(delta), 0) AS points_delta
       FROM ledger_pontuacao
       WHERE indicacao_id = ? AND usuario_id = ?`,
      [indicationId, userId]
    );
    if (scores[0] && Number(scores[0].points_delta) !== 0) {
      pointsDelta = Number(scores[0].points_delta);
    } else if (scores[0] && evaluation) {
      // Avaliada e inscrita sem delta aplicado → null (não inventar pontos)
      pointsDelta = null;
    }
  } catch {
    // score_ledger pode não existir em ambientes antigos
    pointsDelta = null;
  }

  return {
    ...mapIndicationForOwner(row, {
      evaluationOutcome: evaluation?.outcome || null,
      reasonCode: evaluation?.reason_code || row.invalid_reason_code,
      reasonText: evaluation?.reason_text || row.invalid_reason_text,
      reputation,
      pointsDelta,
    }),
    requestDetails: row.request_details,
    links: links.map((l) => l.url),
    place: places[0]
      ? {
          source: places[0].source,
          placeId: places[0].place_id,
          name: places[0].name,
          address: places[0].address,
          mapsUrl: places[0].maps_url,
        }
      : null,
    evaluation: evaluation
      ? {
          id: evaluation.id,
          outcome: evaluation.outcome,
          reasonCode: evaluation.reason_code,
          reasonText: evaluation.reason_text,
          evaluatedAt: evaluation.evaluated_at,
        }
      : null,
  };
}
