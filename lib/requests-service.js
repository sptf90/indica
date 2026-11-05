import { writeAudit } from "./audit";
import {
  FIRST_SELECTION_HOURS,
  INVALID_REASONS,
  MAX_REOPENS,
  MAX_TITLE,
  NEXT_SELECTION_HOURS,
  REQUEST_STATUS_LABELS,
} from "./constants";

const INVALID_REASON_CODES = new Set(INVALID_REASONS.map((r) => r.code));
const INVALID_REASON_LABEL = Object.fromEntries(
  INVALID_REASONS.map((r) => [r.code, r.label])
);
const AWAITING_EVAL_STATUSES = new Set(["selected", "in_evaluation", "sent"]);

function normalizeEvalOutcome(raw) {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (
    value === "valid" ||
    value === "valida" ||
    value === "válida" ||
    value === "evaluate_valid"
  ) {
    return "valid";
  }
  if (
    value === "invalid" ||
    value === "invalida" ||
    value === "inválida" ||
    value === "nao_valida" ||
    value === "não_válida" ||
    value === "nao_válida" ||
    value === "não_valida" ||
    value === "evaluate_invalid"
  ) {
    return "invalid";
  }
  return null;
}

function normalizeReasonCode(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (INVALID_REASON_CODES.has(value)) return value;
  const lowered = value.toLowerCase().replace(/[\s-]+/g, "_");
  if (INVALID_REASON_CODES.has(lowered)) return lowered;
  return value;
}
import { withTransaction } from "./db-tx";
import { getPool } from "./db";
import {
  notifyIndicationResult,
  notifyIndicationSelected,
  notifyRoundAllInvalid,
  notifyScoreChangesStable,
} from "./notifications";
import {
  applyRankingDeltas,
  applyReputationOnEvaluate,
} from "./reputation";
import { addHours, toMysqlDatetime, utcNow } from "./time";

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/** Alinhado a updateRequest: só edita aberto sem participações. */
export function canEditRequestRow(row, participationCount = 0) {
  if (!row) return false;
  const status = row.status ?? row.request_status;
  return status === "open" && Number(participationCount) === 0;
}

export function mapRequestRow(row, { includeRequester = false } = {}) {
  if (!row) return null;
  const base = {
    id: row.id,
    title: row.title,
    details: row.details,
    photoUrl: row.photo_url || null,
    status: row.status,
    statusLabel: REQUEST_STATUS_LABELS[row.status] || row.status,
    cityId: row.city_id,
    cityName: row.city_name,
    cityState: row.city_state,
    reopenCount: row.reopen_count,
    cycleNumber: row.cycle_number,
    selectionCountInCycle: row.selection_count_in_cycle,
    comparisonOpenedAt: row.comparison_opened_at,
    selectedIndicationId: row.selected_indication_id,
    evaluationStartedAt: row.evaluation_started_at,
    evaluationDeadlineAt: row.evaluation_deadline_at,
    closedAt: row.closed_at,
    closeReason: row.close_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    serverNow: new Date().toISOString(),
  };
  if (includeRequester) {
    base.requesterId = row.requester_id;
  }
  if (row.indication_count != null) {
    base.indicationCount = Number(row.indication_count) || 0;
  }
  if (row.current_cycle_indication_count != null) {
    base.currentCycleIndicationCount =
      Number(row.current_cycle_indication_count) || 0;
  }
  if (row.participation_count != null) {
    base.participationCount = Number(row.participation_count) || 0;
    base.canEdit = canEditRequestRow(row, base.participationCount);
  }
  return base;
}

export async function getRequestById(id, conn) {
  const db = conn || getPool();
  const [rows] = await db.query(
    `SELECT r.*, c.nome AS city_name, c.estado AS city_state,
            (
              SELECT COUNT(*)
              FROM indicacoes i
              WHERE i.pedido_id = r.id AND i.excluido_em IS NULL
            ) AS indication_count,
            (
              SELECT COUNT(*)
              FROM indicacoes i
              WHERE i.pedido_id = r.id
                AND i.numero_ciclo = r.numero_ciclo
                AND i.excluido_em IS NULL
            ) AS current_cycle_indication_count,
            (
              SELECT COUNT(*)
              FROM pedido_participacoes p
              WHERE p.pedido_id = r.id
            ) AS participation_count
     FROM pedidos r
     JOIN cidades c ON c.id = r.cidade_id
     WHERE r.id = ? AND r.excluido_em IS NULL
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

/** Indicações que o solicitante já escolheu e/ou avaliou (todos os ciclos). */
export async function listRequesterChosenIndications(requestId, conn) {
  const db = conn || getPool();
  const [rows] = await db.query(
    `SELECT i.id, i.descricao, i.status, i.resultado, i.numero_ciclo,
            i.selecionada_em, i.avaliada_em, i.motivo_invalido_codigo, i.motivo_invalido_texto,
            i.indicador_id, u.nome_usuario, u.foto_url, u.excluido_em AS user_deleted_at
     FROM indicacoes i
     JOIN usuarios u ON u.id = i.indicador_id
     WHERE i.pedido_id = ? AND i.excluido_em IS NULL
       AND (
         i.selecionada_em IS NOT NULL
         OR i.resultado IN ('valid', 'invalid')
         OR i.status IN ('valid', 'invalid', 'selected')
       )
     ORDER BY COALESCE(i.avaliada_em, i.selecionada_em, i.criado_em) DESC, i.id DESC`,
    [requestId]
  );
  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const [links] = await db.query(
    `SELECT indicacao_id, url, ordem
     FROM indicacao_links
     WHERE indicacao_id IN (?)
     ORDER BY ordem ASC, id ASC`,
    [ids]
  );
  const [places] = await db.query(
    `SELECT indicacao_id, origem, place_id, nome, endereco, maps_url
     FROM indicacao_locais
     WHERE indicacao_id IN (?)`,
    [ids]
  );
  const [evals] = await db.query(
    `SELECT e.indicacao_id, e.resultado, e.motivo_codigo, e.motivo_texto, e.avaliada_em
     FROM avaliacoes e
     INNER JOIN (
       SELECT indicacao_id, MAX(id) AS max_id
       FROM avaliacoes
       WHERE indicacao_id IN (?)
       GROUP BY indicacao_id
     ) latest ON latest.max_id = e.id`,
    [ids]
  );

  const linksBy = new Map();
  for (const l of links) {
    if (!linksBy.has(l.indication_id)) linksBy.set(l.indication_id, []);
    linksBy.get(l.indication_id).push(l.url);
  }
  const placesBy = new Map();
  for (const p of places) placesBy.set(p.indication_id, p);
  const evalBy = new Map();
  for (const e of evals) evalBy.set(e.indication_id, e);

  return rows.map((row) => {
    const place = placesBy.get(row.id) || null;
    const evaluation = evalBy.get(row.id) || null;
    const outcome =
      evaluation?.outcome ||
      (row.result === "valid" || row.status === "valid"
        ? "valid"
        : row.result === "invalid" || row.status === "invalid"
          ? "invalid"
          : null);
    const reasonCode =
      evaluation?.reason_code || row.invalid_reason_code || null;
    return {
      id: row.id,
      description: row.description,
      status: row.status,
      result: row.result,
      cycleNumber: row.cycle_number,
      selectedAt: row.selected_at,
      evaluatedAt: evaluation?.evaluated_at || row.evaluated_at || null,
      outcome,
      outcomeLabel:
        outcome === "valid"
          ? "Válida"
          : outcome === "invalid"
            ? "Não válida"
            : row.status === "selected"
              ? "Em avaliação"
              : null,
      reasonCode,
      reasonLabel: reasonCode
        ? INVALID_REASON_LABEL[reasonCode] || reasonCode
        : null,
      reasonText:
        evaluation?.reason_text || row.invalid_reason_text || null,
      links: linksBy.get(row.id) || [],
      place: place
        ? {
            name: place.name,
            address: place.address,
            mapsUrl: place.maps_url,
            source: place.source,
            placeId: place.place_id,
          }
        : null,
      recommender: row.user_deleted_at
        ? null
        : {
            id: row.recommender_id,
            username: row.username,
            photoUrl: row.photo_url,
          },
    };
  });
}

export async function listMyRequests(userId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT r.*, c.nome AS city_name, c.estado AS city_state,
            (
              SELECT COUNT(*)
              FROM indicacoes i
              WHERE i.pedido_id = r.id AND i.excluido_em IS NULL
            ) AS indication_count,
            (
              SELECT COUNT(*)
              FROM pedido_participacoes p
              WHERE p.pedido_id = r.id
            ) AS participation_count
     FROM pedidos r
     JOIN cidades c ON c.id = r.cidade_id
     WHERE r.solicitante_id = ? AND r.excluido_em IS NULL
     ORDER BY r.criado_em DESC`,
    [userId]
  );
  return rows.map((r) => mapRequestRow(r, { includeRequester: true }));
}

export async function createRequest(user, { title, details, cityId }) {
  const trimmedTitle = String(title || "").trim();
  if (!trimmedTitle) throw httpError("Título obrigatório.");
  if (trimmedTitle.length > MAX_TITLE) {
    throw httpError(`Título deve ter no máximo ${MAX_TITLE} caracteres.`);
  }
  const cid = Number(cityId);
  if (!cid) throw httpError("Cidade obrigatória.");

  return withTransaction(async (conn) => {
    const [cities] = await conn.query(`SELECT id FROM cidades WHERE id = ? LIMIT 1`, [
      cid,
    ]);
    if (!cities[0]) throw httpError("Cidade inválida.");

    const [result] = await conn.query(
      `INSERT INTO pedidos (solicitante_id, cidade_id, titulo, detalhes, status)
       VALUES (?, ?, ?, ?, 'open')`,
      [user.id, cid, trimmedTitle, details ? String(details).trim() : null]
    );
    const id = result.insertId;
    await writeAudit(conn, {
      entityType: "request",
      entityId: id,
      fromStatus: null,
      toStatus: "open",
      actorType: "user",
      actorId: user.id,
      reason: "create",
    });
    const row = await getRequestById(id, conn);
    return mapRequestRow(row, { includeRequester: true });
  });
}

export async function updateRequest(user, requestId, { title, details, cityId }) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT * FROM pedidos WHERE id = ? AND excluido_em IS NULL LIMIT 1 FOR UPDATE`,
      [requestId]
    );
    const request = rows[0];
    if (!request) throw httpError("Pedido não encontrado.", 404);
    if (request.requester_id !== user.id) throw httpError("Sem permissão.", 403);
    if (request.status !== "open") {
      throw httpError("Só é possível editar pedidos abertos.");
    }

    const [parts] = await conn.query(
      `SELECT COUNT(*) AS n FROM pedido_participacoes WHERE pedido_id = ?`,
      [requestId]
    );
    if (Number(parts[0].n) > 0) {
      throw httpError("Não é possível editar após a primeira indicação.");
    }

    const trimmedTitle = String(title ?? request.title).trim();
    if (!trimmedTitle) throw httpError("Título obrigatório.");
    if (trimmedTitle.length > MAX_TITLE) {
      throw httpError(`Título deve ter no máximo ${MAX_TITLE} caracteres.`);
    }
    const cid = Number(cityId ?? request.city_id);
    const [cities] = await conn.query(`SELECT id FROM cidades WHERE id = ? LIMIT 1`, [
      cid,
    ]);
    if (!cities[0]) throw httpError("Cidade inválida.");

    await conn.query(
      `UPDATE pedidos SET titulo = ?, detalhes = ?, cidade_id = ? WHERE id = ?`,
      [
        trimmedTitle,
        details !== undefined
          ? details
            ? String(details).trim()
            : null
          : request.details,
        cid,
        requestId,
      ]
    );
    await writeAudit(conn, {
      entityType: "request",
      entityId: requestId,
      fromStatus: request.status,
      toStatus: request.status,
      actorType: "user",
      actorId: user.id,
      reason: "edit",
    });
    return mapRequestRow(await getRequestById(requestId, conn), {
      includeRequester: true,
    });
  });
}

export async function deleteRequest(user, requestId) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT * FROM pedidos WHERE id = ? AND excluido_em IS NULL LIMIT 1 FOR UPDATE`,
      [requestId]
    );
    const request = rows[0];
    if (!request) throw httpError("Pedido não encontrado.", 404);
    if (request.requester_id !== user.id) throw httpError("Sem permissão.", 403);
    if (request.comparison_opened_at) {
      throw httpError("Não é possível excluir após abrir a comparação.");
    }

    const now = toMysqlDatetime(utcNow());
    await conn.query(`UPDATE pedidos SET excluido_em = ? WHERE id = ?`, [
      now,
      requestId,
    ]);
    await writeAudit(conn, {
      entityType: "request",
      entityId: requestId,
      fromStatus: request.status,
      toStatus: "deleted",
      actorType: "user",
      actorId: user.id,
      reason: "delete",
    });
    return { ok: true };
  });
}

export async function openComparison(user, requestId) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT * FROM pedidos WHERE id = ? AND excluido_em IS NULL LIMIT 1 FOR UPDATE`,
      [requestId]
    );
    const request = rows[0];
    if (!request) throw httpError("Pedido não encontrado.", 404);
    if (request.requester_id !== user.id) throw httpError("Sem permissão.", 403);
    if (request.status === "in_evaluation" && request.comparison_opened_at) {
      return mapRequestRow(await getRequestById(requestId, conn), {
        includeRequester: true,
      });
    }
    if (request.status !== "open") {
      throw httpError("Só é possível abrir comparação de pedidos abertos.");
    }

    const [inds] = await conn.query(
      `SELECT id FROM indicacoes
       WHERE pedido_id = ? AND numero_ciclo = ? AND excluido_em IS NULL
       FOR UPDATE`,
      [requestId, request.cycle_number]
    );
    if (!inds.length) {
      throw httpError("Não há indicações para comparar neste ciclo.");
    }

    const now = toMysqlDatetime(utcNow());
    await conn.query(
      `UPDATE pedidos
       SET status = 'in_evaluation', comparacao_aberta_em = ?, indicacao_selecionada_id = NULL,
           avaliacao_iniciada_em = NULL, avaliacao_prazo_em = NULL
       WHERE id = ?`,
      [now, requestId]
    );

    // Freeze reputation + válidas + sort_key (empate variado) no lock
    const [cycleInds] = await conn.query(
      `SELECT i.id, u.reputacao, u.contagem_indicacoes_validas
       FROM indicacoes i
       JOIN usuarios u ON u.id = i.indicador_id
       WHERE i.pedido_id = ? AND i.numero_ciclo = ? AND i.excluido_em IS NULL
       FOR UPDATE`,
      [requestId, request.cycle_number]
    );
    const shuffled = [...cycleInds];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    for (let idx = 0; idx < shuffled.length; idx += 1) {
      const row = shuffled[idx];
      await conn.query(
        `UPDATE indicacoes
         SET status = 'in_evaluation', bloqueada_em = ?,
             reputacao_congelada = ?, contagem_validas_congelada = ?,
             chave_ordenacao_comparacao = ?
         WHERE id = ?`,
        [
          now,
          Number(row.reputation) || 0,
          Number(row.valid_indication_count) || 0,
          idx,
          row.id,
        ]
      );
    }

    await writeAudit(conn, {
      entityType: "request",
      entityId: requestId,
      fromStatus: "open",
      toStatus: "in_evaluation",
      actorType: "user",
      actorId: user.id,
      reason: "open_comparison",
    });
    return mapRequestRow(await getRequestById(requestId, conn), {
      includeRequester: true,
    });
  });
}

export async function listComparisonIndications(user, requestId) {
  const pool = getPool();
  const request = await getRequestById(requestId);
  if (!request) throw httpError("Pedido não encontrado.", 404);
  if (request.requester_id !== user.id) throw httpError("Sem permissão.", 403);
  if (!request.comparison_opened_at) {
    throw httpError("Comparação ainda não foi aberta.");
  }

  const selectedId = request.selected_indication_id
    ? Number(request.selected_indication_id)
    : null;

  const [rows] = await pool.query(
    `SELECT i.id, i.descricao, i.status, i.resultado, i.numero_ciclo,
            i.motivo_invalido_codigo, i.motivo_invalido_texto,
            i.reputacao_congelada, i.contagem_validas_congelada, i.chave_ordenacao_comparacao,
            i.indicador_id, u.nome_usuario, u.foto_url, u.excluido_em
     FROM indicacoes i
     JOIN usuarios u ON u.id = i.indicador_id
     WHERE i.pedido_id = ? AND i.numero_ciclo = ? AND i.excluido_em IS NULL`,
    [requestId, request.cycle_number]
  );

  const [links] = await pool.query(
    `SELECT l.indicacao_id, l.url, l.ordem
     FROM indicacao_links l
     JOIN indicacoes i ON i.id = l.indicacao_id
     WHERE i.pedido_id = ? AND i.numero_ciclo = ? AND i.excluido_em IS NULL
     ORDER BY l.ordem ASC, l.id ASC`,
    [requestId, request.cycle_number]
  );
  const [places] = await pool.query(
    `SELECT p.indicacao_id, p.origem, p.place_id, p.nome, p.endereco, p.maps_url
     FROM indicacao_locais p
     JOIN indicacoes i ON i.id = p.indicacao_id
     WHERE i.pedido_id = ? AND i.numero_ciclo = ? AND i.excluido_em IS NULL`,
    [requestId, request.cycle_number]
  );

  const linksBy = new Map();
  for (const l of links) {
    if (!linksBy.has(l.indication_id)) linksBy.set(l.indication_id, []);
    linksBy.get(l.indication_id).push(l.url);
  }
  const placesBy = new Map();
  for (const p of places) placesBy.set(p.indication_id, p);

  const revealIdentity = Boolean(selectedId);
  const items = rows
    .map((row) => {
      const isSelected = selectedId === Number(row.id);
      const hideOthers = revealIdentity && !isSelected;
      if (hideOthers) {
        return {
          id: row.id,
          hidden: true,
          status: row.status,
          result: row.result,
        };
      }
      const item = {
        id: row.id,
        description: row.description,
        status: row.status,
        result: row.result,
        // Só valores congelados na abertura — nunca identidade pré-escolha
        reputation: Number(row.frozen_reputation) || 0,
        validIndicationCount: Number(row.frozen_valid_count) || 0,
        _sortKey:
          row.comparison_sort_key == null
            ? Number(row.id)
            : Number(row.comparison_sort_key),
        links: linksBy.get(row.id) || [],
        place: placesBy.get(row.id)
          ? {
              source: placesBy.get(row.id).source,
              name: placesBy.get(row.id).name,
              address: placesBy.get(row.id).address,
              mapsUrl: placesBy.get(row.id).maps_url,
              placeId: placesBy.get(row.id).place_id,
            }
          : null,
        selected: isSelected,
        invalidReasonCode: row.invalid_reason_code,
        invalidReasonText: row.invalid_reason_text,
      };
      if (revealIdentity && isSelected) {
        const deleted = Boolean(row.deleted_at);
        item.recommender = {
          id: row.recommender_id,
          username: deleted ? "Usuário excluído" : row.username,
          photoUrl: deleted ? null : row.photo_url || null,
          accountDeleted: deleted,
        };
      }
      return item;
    })
    .sort((a, b) => {
      if (a.hidden && !b.hidden) return 1;
      if (!a.hidden && b.hidden) return -1;
      const ra = Number(a.reputation) || 0;
      const rb = Number(b.reputation) || 0;
      if (rb !== ra) return rb - ra;
      const va = Number(a.validIndicationCount) || 0;
      const vb = Number(b.validIndicationCount) || 0;
      if (vb !== va) return vb - va;
      const sa = Number(a._sortKey) || 0;
      const sb = Number(b._sortKey) || 0;
      if (sa !== sb) return sa - sb;
      return Number(a.id) - Number(b.id);
    })
    .map(({ _sortKey, ...rest }) => rest);

  return {
    request: mapRequestRow(request, { includeRequester: true }),
    indications: items,
  };
}

export async function selectIndication(user, requestId, indicationId) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT * FROM pedidos WHERE id = ? AND excluido_em IS NULL LIMIT 1 FOR UPDATE`,
      [requestId]
    );
    const request = rows[0];
    if (!request) throw httpError("Pedido não encontrado.", 404);
    if (request.requester_id !== user.id) throw httpError("Sem permissão.", 403);
    if (request.status !== "in_evaluation" || !request.comparison_opened_at) {
      throw httpError("Abra a comparação antes de escolher.");
    }
    if (request.selected_indication_id) {
      throw httpError("Já existe uma indicação selecionada. Avalie-a primeiro.");
    }

    const [inds] = await conn.query(
      `SELECT * FROM indicacoes
       WHERE id = ? AND pedido_id = ? AND numero_ciclo = ? AND excluido_em IS NULL
       LIMIT 1 FOR UPDATE`,
      [indicationId, requestId, request.cycle_number]
    );
    const indication = inds[0];
    if (!indication) throw httpError("Indicação inválida para este ciclo.");
    if (
      indication.status === "invalid" ||
      indication.status === "valid" ||
      indication.result === "invalid" ||
      indication.result === "valid"
    ) {
      throw httpError("Esta indicação já foi avaliada.");
    }
    if (
      indication.status !== "in_evaluation" &&
      indication.status !== "sent" &&
      indication.status !== "selected"
    ) {
      throw httpError("Indicação inválida para este ciclo.");
    }

    const nextCount = Number(request.selection_count_in_cycle) + 1;
    const hours =
      nextCount === 1 ? FIRST_SELECTION_HOURS : NEXT_SELECTION_HOURS;
    const now = utcNow();
    const started = toMysqlDatetime(now);
    const deadline = toMysqlDatetime(addHours(now, hours));

    await conn.query(
      `UPDATE pedidos
       SET indicacao_selecionada_id = ?, avaliacao_iniciada_em = ?,
           avaliacao_prazo_em = ?, contagem_selecoes_ciclo = ?
       WHERE id = ?`,
      [indicationId, started, deadline, nextCount, requestId]
    );
    await conn.query(
      `UPDATE indicacoes SET status = 'selected', selecionada_em = ? WHERE id = ?`,
      [started, indicationId]
    );
    await writeAudit(conn, {
      entityType: "request",
      entityId: requestId,
      fromStatus: "in_evaluation",
      toStatus: "in_evaluation",
      actorType: "user",
      actorId: user.id,
      reason: "select_indication",
      payload: { indicationId, hours, deadline },
    });

    await notifyIndicationSelected(conn, {
      recommenderId: indication.recommender_id,
      indicationId,
      requestId,
      requestTitle: request.title,
    });

    return {
      request: mapRequestRow(await getRequestById(requestId, conn), {
        includeRequester: true,
      }),
      deadlineHours: hours,
    };
  });
}

export async function evaluateIndication(
  user,
  requestId,
  body = {}
) {
  const outcome = normalizeEvalOutcome(
    body.outcome ?? body.result ?? body.evaluationOutcome
  );
  const reasonCode = normalizeReasonCode(
    body.reasonCode ?? body.reason_code ?? body.invalidReasonCode
  );
  const reasonText = body.reasonText ?? body.reason_text ?? body.invalidReasonText;

  if (!outcome) {
    throw httpError("Outcome inválido.");
  }
  if (outcome === "invalid" && !reasonCode) {
    throw httpError("Motivo obrigatório para indicação inválida.");
  }
  if (outcome === "invalid" && !INVALID_REASON_CODES.has(reasonCode)) {
    throw httpError("Motivo de avaliação inválido.");
  }

  return withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT * FROM pedidos WHERE id = ? AND excluido_em IS NULL LIMIT 1 FOR UPDATE`,
      [requestId]
    );
    const request = rows[0];
    if (!request) throw httpError("Pedido não encontrado.", 404);
    if (request.requester_id !== user.id) throw httpError("Sem permissão.", 403);
    if (request.status !== "in_evaluation" || !request.selected_indication_id) {
      throw httpError("Nenhuma indicação selecionada para avaliar.");
    }

    const indicationId = Number(request.selected_indication_id);
    const [inds] = await conn.query(
      `SELECT * FROM indicacoes WHERE id = ? LIMIT 1 FOR UPDATE`,
      [indicationId]
    );
    const indication = inds[0];
    if (!indication || Number(indication.request_id) !== Number(requestId)) {
      throw httpError("Indicação selecionada inválida.");
    }
    if (
      indication.status === "valid" ||
      indication.status === "invalid" ||
      indication.result === "valid" ||
      indication.result === "invalid"
    ) {
      throw httpError("Esta indicação já foi avaliada.");
    }
    // Fonte de verdade: request.selected_indication_id. Aceita estados
    // pré-avaliação e repara status se ficou inconsistente (ex. sent).
    if (!AWAITING_EVAL_STATUSES.has(indication.status)) {
      throw httpError("Indicação selecionada inválida.");
    }
    if (indication.status !== "selected") {
      await conn.query(
        `UPDATE indicacoes
         SET status = 'selected',
             selecionada_em = COALESCE(selecionada_em, ?)
         WHERE id = ?`,
        [toMysqlDatetime(utcNow()), indicationId]
      );
      indication.status = "selected";
    }

    const now = toMysqlDatetime(utcNow());
    const [evalResult] = await conn.query(
      `INSERT INTO avaliacoes
        (pedido_id, indicacao_id, avaliador_id, resultado, motivo_codigo, motivo_texto, avaliada_em)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        requestId,
        indicationId,
        user.id,
        outcome,
        outcome === "invalid" ? reasonCode : null,
        reasonText ? String(reasonText).trim() : null,
        now,
      ]
    );
    const evaluationId = evalResult.insertId;

    const reputationUpdate = await applyReputationOnEvaluate(conn, {
      recommenderId: indication.recommender_id,
      evaluationId,
      requestId,
      requestTitle: request.title,
      outcome,
    });

    const scoreEvent =
      outcome === "valid" ? "evaluate_valid" : "evaluate_invalid";
    const scoreApplied = await applyRankingDeltas(conn, {
      event: scoreEvent,
      userId: indication.recommender_id,
      requestId,
      indicationId,
      evaluationId,
      reasonCode: outcome === "invalid" ? reasonCode : undefined,
      delta:
        outcome === "valid"
          ? 10
          : reasonCode === "incorrect_insufficient"
            ? -10
            : -5,
    });

    await notifyIndicationResult(conn, {
      recommenderId: indication.recommender_id,
      indicationId,
      requestId,
      requestTitle: request.title,
      outcome,
      reasonCode: outcome === "invalid" ? reasonCode : null,
      reasonText: reasonText || null,
      evaluationId,
    });

    await notifyScoreChangesStable(conn, {
      userId: indication.recommender_id,
      applied: scoreApplied.applied || [],
      event: scoreEvent,
      reasonCode: outcome === "invalid" ? reasonCode : null,
      evaluationId,
      requestId,
    });

    if (outcome === "valid") {
      await conn.query(
        `UPDATE indicacoes
         SET status = 'valid', resultado = 'valid', avaliada_em = ?,
             motivo_invalido_codigo = NULL, motivo_invalido_texto = NULL
         WHERE id = ?`,
        [now, indicationId]
      );
      await conn.query(
        `UPDATE indicacoes
         SET status = 'not_selected', resultado = 'not_selected'
         WHERE pedido_id = ? AND numero_ciclo = ? AND id <> ? AND excluido_em IS NULL
           AND (resultado IS NULL OR resultado = 'not_selected')
           AND status <> 'invalid'`,
        [requestId, request.cycle_number, indicationId]
      );
      await conn.query(
        `UPDATE pedidos
         SET status = 'completed', fechado_em = ?, motivo_fechamento = 'valid',
             avaliacao_prazo_em = NULL
         WHERE id = ?`,
        [now, requestId]
      );
      await writeAudit(conn, {
        entityType: "request",
        entityId: requestId,
        fromStatus: "in_evaluation",
        toStatus: "completed",
        actorType: "user",
        actorId: user.id,
        reason: "evaluate_valid",
        payload: { indicationId, reputation: reputationUpdate },
      });

      return {
        request: mapRequestRow(await getRequestById(requestId, conn), {
          includeRequester: true,
        }),
        hasRemaining: false,
        roundExhausted: false,
        reputation: reputationUpdate,
      };
    }

    await conn.query(
      `UPDATE indicacoes
       SET status = 'invalid', resultado = 'invalid', avaliada_em = ?,
           motivo_invalido_codigo = ?, motivo_invalido_texto = ?
       WHERE id = ?`,
      [
        now,
        reasonCode,
        reasonText ? String(reasonText).trim() : null,
        indicationId,
      ]
    );
    await conn.query(
      `UPDATE pedidos
       SET indicacao_selecionada_id = NULL, avaliacao_iniciada_em = NULL,
           avaliacao_prazo_em = NULL
       WHERE id = ?`,
      [requestId]
    );

    const [remaining] = await conn.query(
      `SELECT COUNT(*) AS n FROM indicacoes
       WHERE pedido_id = ? AND numero_ciclo = ? AND excluido_em IS NULL
         AND (resultado IS NULL OR resultado NOT IN ('invalid'))
         AND status <> 'invalid'`,
      [requestId, request.cycle_number]
    );
    const hasRemaining = Number(remaining[0].n) > 0;

    await writeAudit(conn, {
      entityType: "request",
      entityId: requestId,
      fromStatus: "in_evaluation",
      toStatus: "in_evaluation",
      actorType: "user",
      actorId: user.id,
      reason: "evaluate_invalid",
      payload: { indicationId, hasRemaining, reasonCode, reputation: reputationUpdate },
    });

    if (!hasRemaining) {
      await notifyRoundAllInvalid(conn, {
        requesterId: request.requester_id,
        requestId,
        requestTitle: request.title,
        cycleNumber: request.cycle_number,
      });
    }

    return {
      request: mapRequestRow(await getRequestById(requestId, conn), {
        includeRequester: true,
      }),
      hasRemaining,
      roundExhausted: !hasRemaining,
      reputation: reputationUpdate,
    };
  });
}

export async function reopenRequest(user, requestId) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT * FROM pedidos WHERE id = ? AND excluido_em IS NULL LIMIT 1 FOR UPDATE`,
      [requestId]
    );
    const request = rows[0];
    if (!request) throw httpError("Pedido não encontrado.", 404);
    if (request.requester_id !== user.id) throw httpError("Sem permissão.", 403);
    if (request.status !== "in_evaluation") {
      throw httpError("Só é possível reabrir após esgotar a rodada em avaliação.");
    }
    if (request.selected_indication_id) {
      throw httpError("Avalie a indicação selecionada antes de reabrir.");
    }

    const [remaining] = await conn.query(
      `SELECT COUNT(*) AS n FROM indicacoes
       WHERE pedido_id = ? AND numero_ciclo = ? AND excluido_em IS NULL
         AND (resultado IS NULL OR resultado NOT IN ('invalid'))
         AND status <> 'invalid'`,
      [requestId, request.cycle_number]
    );
    if (Number(remaining[0].n) > 0) {
      throw httpError("Ainda há indicações disponíveis nesta rodada.");
    }
    if (Number(request.reopen_count) >= MAX_REOPENS) {
      throw httpError("Limite de reaberturas atingido.");
    }

    const now = toMysqlDatetime(utcNow());
    const nextCycle = Number(request.cycle_number) + 1;
    const nextReopen = Number(request.reopen_count) + 1;

    await conn.query(
      `UPDATE pedidos
       SET status = 'open', contagem_reaberturas = ?, numero_ciclo = ?,
           contagem_selecoes_ciclo = 0, comparacao_aberta_em = NULL,
           indicacao_selecionada_id = NULL, avaliacao_iniciada_em = NULL,
           avaliacao_prazo_em = NULL
       WHERE id = ?`,
      [nextReopen, nextCycle, requestId]
    );
    await writeAudit(conn, {
      entityType: "request",
      entityId: requestId,
      fromStatus: "in_evaluation",
      toStatus: "open",
      actorType: "user",
      actorId: user.id,
      reason: "reopen",
      payload: { reopenCount: nextReopen, cycleNumber: nextCycle },
    });

    return mapRequestRow(await getRequestById(requestId, conn), {
      includeRequester: true,
    });
  });
}

export async function closeRequestVoluntary(user, requestId) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT * FROM pedidos WHERE id = ? AND excluido_em IS NULL LIMIT 1 FOR UPDATE`,
      [requestId]
    );
    const request = rows[0];
    if (!request) throw httpError("Pedido não encontrado.", 404);
    if (request.requester_id !== user.id) throw httpError("Sem permissão.", 403);
    if (request.status !== "in_evaluation") {
      throw httpError("Encerramento voluntário só após esgotar a rodada.");
    }
    if (request.selected_indication_id) {
      throw httpError("Avalie a indicação selecionada antes de encerrar.");
    }
    const [remaining] = await conn.query(
      `SELECT COUNT(*) AS n FROM indicacoes
       WHERE pedido_id = ? AND numero_ciclo = ? AND excluido_em IS NULL
         AND (resultado IS NULL OR resultado NOT IN ('invalid'))
         AND status <> 'invalid'`,
      [requestId, request.cycle_number]
    );
    if (Number(remaining[0].n) > 0) {
      throw httpError("Ainda há indicações disponíveis nesta rodada.");
    }

    const now = toMysqlDatetime(utcNow());
    const reopenCount = Number(request.reopen_count);
    const status =
      reopenCount >= MAX_REOPENS ? "closed_no_valid" : "closed_voluntary";
    const closeReason =
      reopenCount >= MAX_REOPENS ? "no_valid" : "voluntary";

    await conn.query(
      `UPDATE pedidos
       SET status = ?, fechado_em = ?, motivo_fechamento = ?, avaliacao_prazo_em = NULL
       WHERE id = ?`,
      [status, now, closeReason, requestId]
    );
    await conn.query(
      `UPDATE indicacoes
       SET status = ?
       WHERE pedido_id = ? AND excluido_em IS NULL
         AND status NOT IN ('valid', 'invalid')`,
      [status === "closed_no_valid" ? "closed_no_valid" : "not_selected", requestId]
    );
    await writeAudit(conn, {
      entityType: "request",
      entityId: requestId,
      fromStatus: "in_evaluation",
      toStatus: status,
      actorType: "user",
      actorId: user.id,
      reason: "close_voluntary",
    });

    return mapRequestRow(await getRequestById(requestId, conn), {
      includeRequester: true,
    });
  });
}

export async function closeNoValidIfMaxReopens(user, requestId) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT * FROM pedidos WHERE id = ? AND excluido_em IS NULL LIMIT 1 FOR UPDATE`,
      [requestId]
    );
    const request = rows[0];
    if (!request) throw httpError("Pedido não encontrado.", 404);
    if (request.requester_id !== user.id) throw httpError("Sem permissão.", 403);
    if (Number(request.reopen_count) < MAX_REOPENS) {
      throw httpError("Ainda é possível reabrir.");
    }
    if (request.status !== "in_evaluation" || request.selected_indication_id) {
      throw httpError("Estado inválido para encerrar sem válida.");
    }
    const [remaining] = await conn.query(
      `SELECT COUNT(*) AS n FROM indicacoes
       WHERE pedido_id = ? AND numero_ciclo = ? AND excluido_em IS NULL
         AND (resultado IS NULL OR resultado NOT IN ('invalid'))
         AND status <> 'invalid'`,
      [requestId, request.cycle_number]
    );
    if (Number(remaining[0].n) > 0) {
      throw httpError("Ainda há indicações disponíveis nesta rodada.");
    }

    const now = toMysqlDatetime(utcNow());
    await conn.query(
      `UPDATE pedidos
       SET status = 'closed_no_valid', fechado_em = ?, motivo_fechamento = 'no_valid',
           avaliacao_prazo_em = NULL
       WHERE id = ?`,
      [now, requestId]
    );
    await conn.query(
      `UPDATE indicacoes
       SET status = 'closed_no_valid'
       WHERE pedido_id = ? AND excluido_em IS NULL
         AND status NOT IN ('valid', 'invalid')`,
      [requestId]
    );
    await writeAudit(conn, {
      entityType: "request",
      entityId: requestId,
      fromStatus: "in_evaluation",
      toStatus: "closed_no_valid",
      actorType: "user",
      actorId: user.id,
      reason: "close_no_valid",
    });
    return mapRequestRow(await getRequestById(requestId, conn), {
      includeRequester: true,
    });
  });
}

/** Job idempotente: fecha pedidos com prazo expirado. */
export async function closeExpiredRequests() {
  return withTransaction(async (conn) => {
    const now = toMysqlDatetime(utcNow());
    const [due] = await conn.query(
      `SELECT id, indicacao_selecionada_id, solicitante_id
       FROM pedidos
       WHERE status = 'in_evaluation'
         AND excluido_em IS NULL
         AND avaliacao_prazo_em IS NOT NULL
         AND avaliacao_prazo_em <= ?
       FOR UPDATE`,
      [now]
    );

    let closed = 0;
    for (const request of due) {
      await conn.query(
        `UPDATE pedidos
         SET status = 'closed_timeout', fechado_em = ?, motivo_fechamento = 'timeout',
             avaliacao_prazo_em = NULL
         WHERE id = ? AND status = 'in_evaluation'`,
        [now, request.id]
      );
      if (request.selected_indication_id) {
        await conn.query(
          `UPDATE indicacoes SET status = 'closed_timeout'
           WHERE id = ? AND status = 'selected'`,
          [request.selected_indication_id]
        );
      }
      // Timeout: NÃO altera reputação do indicador.
      // Pontos: −10 ao solicitante nos rankings elegíveis (saldo ≥ 0).
      // §5.6: sem notificação específica ao indicador em timeout.
      const timeoutScores = await applyRankingDeltas(conn, {
        event: "timeout",
        userId: request.requester_id,
        requestId: request.id,
        indicationId: request.selected_indication_id || undefined,
        delta: -10,
      });
      await notifyScoreChangesStable(conn, {
        userId: request.requester_id,
        applied: timeoutScores.applied || [],
        event: "timeout",
        reasonCode: null,
        requestId: request.id,
      });
      await conn.query(
        `UPDATE indicacoes
         SET status = 'closed_timeout'
         WHERE pedido_id = ? AND excluido_em IS NULL
           AND status NOT IN ('valid', 'invalid', 'closed_timeout')`,
        [request.id]
      );
      await writeAudit(conn, {
        entityType: "request",
        entityId: request.id,
        fromStatus: "in_evaluation",
        toStatus: "closed_timeout",
        actorType: "system",
        actorId: null,
        reason: "timeout",
      });
      closed += 1;
    }
    return { closed, checkedAt: now };
  });
}
