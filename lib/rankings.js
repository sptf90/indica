/**
 * Rankings orgânicos + superfície patrocinada (Fase 3A/3B / §R.4–R.5 / RF-SPON).
 * Fuso oficial dos períodos ainda TBD — janelas em UTC (seg–dom / mês-calendário).
 * 3B: marca “Patrocinado por”, posições premiadas, futuro oculto até início+ativo.
 * 3C: confirmação de resgate na área /empresa (lib/company.js).
 */

import { getPool } from "./db";
import { RANKING_SORT_SQL } from "./share-links";
import { toMysqlDatetime, utcNow, fromMysqlDatetime } from "./time";

export const MAX_WEEKLY_ENROLLMENTS = 2;
export const MAX_MONTHLY_ENROLLMENTS = 1;
/** Teto de posições premiadas (Top N) numa campanha de patrocínio. */
export const MAX_PRIZE_POSITION = 1000;
export const TALLYING_LABEL = "Em apuração - classificação ainda não é final";
export const SPONSORED_BY_LABEL = "Patrocinado por";
export const PRIZE_IN_BAND_MSG =
  "Você está entre os classificados para premiação!";
export const PRIZE_OUT_BAND_MSG =
  "Continue participando para alcançar as posições premiadas!";

const ACTIVE_RANKING_STATUSES = ["open", "tallying"];
const VISIBLE_STATUSES = ["open", "tallying", "final"];

export function currentWeekWindow(now = utcNow()) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const day = start.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + diff);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

export function currentMonthWindow(now = utcNow()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

export function deltaForEvaluate(outcome, reasonCode) {
  if (outcome === "valid" || outcome === "evaluate_valid") return 10;
  if (reasonCode === "incorrect_insufficient") return -10;
  return -5;
}

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function parseJsonField(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function parsePrizePositions(raw) {
  const parsed = parseJsonField(raw, []);
  if (!Array.isArray(parsed)) return [];
  return [
    ...new Set(
      parsed
        .map((n) => Number(n))
        .filter(
          (n) =>
            Number.isInteger(n) && n >= 1 && n <= MAX_PRIZE_POSITION
        )
    ),
  ].sort((a, b) => a - b);
}

/** Gera [1, 2, …, n] com n ∈ [1, MAX_PRIZE_POSITION]. */
export function topNPositions(n) {
  const capped = Math.min(
    Math.max(Math.floor(Number(n) || 0), 0),
    MAX_PRIZE_POSITION
  );
  if (capped < 1) return [];
  return Array.from({ length: capped }, (_, i) => i + 1);
}

export function parsePrizeBenefits(raw) {
  const parsed = parseJsonField(raw, null);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  return parsed;
}

export function benefitForPosition(ranking, position) {
  if (!ranking || position == null) return null;
  const benefits = ranking.prizeBenefits;
  if (!benefits) return null;
  const mode = ranking.prizeBenefitMode || "equal";
  if (mode === "per_position") {
    const key = String(position);
    if (benefits[key] != null) return String(benefits[key]);
  }
  if (benefits.default != null) return String(benefits.default);
  const first = Object.values(benefits)[0];
  return first != null ? String(first) : null;
}

/**
 * RF-SPON-05/06: visível só após início do período e status ativo
 * (open/tallying no período; final publicado permanece consultável).
 */
export function isRankingVisibleToUsers(row, now = utcNow()) {
  if (!row) return false;
  const start = fromMysqlDatetime(row.period_start ?? row.periodStart);
  const end = fromMysqlDatetime(row.period_end ?? row.periodEnd);
  if (!start || !end) return false;
  const status = row.status;
  if (!VISIBLE_STATUSES.includes(status)) return false;
  if (now < start) return false;
  if (status === "final") return true;
  return now < end || status === "tallying";
}

function mapRankingRow(row, extras = {}) {
  if (!row) return null;
  const status = row.status;
  const prizePositions = parsePrizePositions(
    extras.prizePositions ?? row.prize_positions_json
  );
  const prizeBenefits = parsePrizeBenefits(
    extras.prizeBenefits ?? row.prize_benefits_json
  );
  const sponsorName =
    row.sponsor_display_name ||
    row.sponsor_name ||
    extras.sponsorName ||
    null;
  const sponsorLogoUrl =
    row.sponsor_logo_url ||
    row.company_logo_url ||
    extras.sponsorLogoUrl ||
    null;
  const sponsored = Boolean(row.sponsor_company_id && sponsorName);

  return {
    id: row.id,
    title: row.title,
    modality: row.modality,
    modalityLabel: row.modality === "weekly" ? "Semanal" : "Mensal",
    cityId: row.city_id ?? null,
    cityName: row.city_name || (row.city_id == null ? "Brasil" : null),
    cityState: row.city_state || null,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status,
    statusLabel:
      status === "tallying"
        ? TALLYING_LABEL
        : status === "final"
          ? "Finalizado"
          : "Ativo",
    sponsorCompanyId: row.sponsor_company_id || null,
    sponsorName,
    sponsorLogoUrl,
    sponsorBannerUrl: row.sponsor_banner_url || extras.sponsorBannerUrl || null,
    sponsored,
    sponsoredByLabel: sponsored ? SPONSORED_BY_LABEL : null,
    prizePositions,
    prizeBenefitMode: row.prize_benefit_mode || null,
    prizeBenefits,
    prizeRedemptionInstructions:
      row.prize_redemption_instructions || null,
    enrolled: Boolean(extras.enrolled ?? row.enrolled),
    myBalance:
      extras.myBalance != null
        ? extras.myBalance
        : row.my_balance != null
          ? Number(row.my_balance)
          : null,
    myValidCount:
      extras.myValidCount != null
        ? extras.myValidCount
        : row.my_valid_count != null
          ? Number(row.my_valid_count)
          : null,
    participantsCount:
      extras.participantsCount != null
        ? extras.participantsCount
        : row.participants_count != null
          ? Number(row.participants_count)
          : undefined,
  };
}

export async function countActiveEnrollmentsByModality(
  connOrPool,
  userId,
  modality
) {
  const db = connOrPool || getPool();
  const now = toMysqlDatetime(utcNow());
  const [rows] = await db.query(
    `SELECT COUNT(*) AS n
     FROM ranking_participations p
     INNER JOIN rankings r ON r.id = p.ranking_id
     WHERE p.user_id = ?
       AND r.modality = ?
       AND r.status IN ('open', 'tallying')
       AND r.period_start <= ?
       AND r.period_end > ?`,
    [userId, modality, now, now]
  );
  return Number(rows[0]?.n) || 0;
}

export async function sumPointsAcrossActiveEnrollments(userId, conn = null) {
  const db = conn || getPool();
  if (!db) return 0;
  const now = toMysqlDatetime(utcNow());
  const [rows] = await db.query(
    `SELECT COALESCE(SUM(p.balance), 0) AS total
     FROM ranking_participations p
     INNER JOIN rankings r ON r.id = p.ranking_id
     WHERE p.user_id = ?
       AND r.status IN ('open', 'tallying')
       AND r.period_start <= ?
       AND r.period_end > ?`,
    [userId, now, now]
  );
  return Number(rows[0]?.total) || 0;
}

const RANKING_SELECT = `
  r.*,
  c.name AS city_name, c.state AS city_state,
  co.legal_name AS sponsor_name, co.logo_url AS company_logo_url
`;

/**
 * Lista visível ao usuário: open → tallying → final (arquivo).
 * Ordem server-side (não CSS):
 * 1) status (Ativos → Em apuração → Arquivo)
 * 2) cidade do utilizador (preferCityId) primeiro; depois outras (nome)
 * 3) dentro da cidade: mensal → semanal
 * 4) período mais recente, título, id
 * Alinhado a isRankingVisibleToUsers (futuros ocultos; final consultável).
 */
export async function listActiveRankings(
  userId,
  { cityId, preferCityId, sponsorCompanyId } = {}
) {
  const pool = getPool();
  const now = toMysqlDatetime(utcNow());
  const prefer =
    preferCityId != null &&
    preferCityId !== "" &&
    !Number.isNaN(Number(preferCityId))
      ? Number(preferCityId)
      : null;
  const companyOnly =
    sponsorCompanyId != null &&
    sponsorCompanyId !== "" &&
    !Number.isNaN(Number(sponsorCompanyId));

  // JOIN participation usa userId primeiro.
  const params = [userId];
  let whereSql;
  if (companyOnly) {
    // Empresa: só a própria campanha, incluindo períodos ainda não iniciados.
    whereSql = `r.status IN ('open', 'tallying', 'final')
       AND r.sponsor_company_id = ?`;
    params.push(Number(sponsorCompanyId));
  } else {
    whereSql = `r.status IN ('open', 'tallying', 'final')
       AND r.period_start <= ?
       AND (
         r.status = 'final'
         OR r.status = 'tallying'
         OR r.period_end > ?
       )`;
    params.push(now, now);
    if (cityId != null && cityId !== "" && !Number.isNaN(Number(cityId))) {
      whereSql += " AND r.city_id = ?";
      params.push(Number(cityId));
    }
  }
  params.push(prefer, prefer);

  const [rows] = await pool.query(
    `SELECT ${RANKING_SELECT},
            (p.id IS NOT NULL) AS enrolled,
            p.balance AS my_balance,
            p.valid_count_in_period AS my_valid_count,
            (SELECT COUNT(*) FROM ranking_participations rp WHERE rp.ranking_id = r.id) AS participants_count
     FROM rankings r
     LEFT JOIN cities c ON c.id = r.city_id
     LEFT JOIN companies co ON co.id = r.sponsor_company_id
     LEFT JOIN ranking_participations p
       ON p.ranking_id = r.id AND p.user_id = ?
     WHERE ${whereSql}
     ORDER BY
       CASE r.status
         WHEN 'open' THEN 0
         WHEN 'tallying' THEN 1
         WHEN 'final' THEN 2
         ELSE 3
       END ASC,
       CASE
         WHEN ? IS NOT NULL AND r.city_id = ? THEN 0
         ELSE 1
       END ASC,
       COALESCE(c.name, 'Brasil') ASC,
       CASE r.modality
         WHEN 'monthly' THEN 0
         WHEN 'weekly' THEN 1
         ELSE 2
       END ASC,
       r.period_start DESC,
       r.title ASC,
       r.id ASC`,
    params
  );
  return rows.map((row) => mapRankingRow(row));
}

export async function getRankingById(rankingId, userId = null, { requireVisible = false } = {}) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT ${RANKING_SELECT},
            (p.id IS NOT NULL) AS enrolled,
            p.balance AS my_balance,
            p.valid_count_in_period AS my_valid_count,
            (SELECT COUNT(*) FROM ranking_participations rp WHERE rp.ranking_id = r.id) AS participants_count
     FROM rankings r
     LEFT JOIN cities c ON c.id = r.city_id
     LEFT JOIN companies co ON co.id = r.sponsor_company_id
     LEFT JOIN ranking_participations p
       ON p.ranking_id = r.id AND p.user_id = ?
     WHERE r.id = ?
     LIMIT 1`,
    [userId || 0, rankingId]
  );
  const row = rows[0];
  if (!row) return null;
  if (requireVisible && !isRankingVisibleToUsers(row)) {
    return null;
  }
  return mapRankingRow(row);
}

export function buildPrizeContext(ranking, myPosition) {
  const positions = ranking?.prizePositions || [];
  if (!positions.length) {
    return {
      hasPrizes: false,
      inPrizeBand: false,
      provisionalMessage: null,
      prizeBenefit: null,
    };
  }
  const inPrizeBand =
    myPosition != null && positions.includes(Number(myPosition));
  const isFinal = ranking.status === "final";
  let provisionalMessage = null;
  if (!isFinal && myPosition != null) {
    provisionalMessage = inPrizeBand ? PRIZE_IN_BAND_MSG : PRIZE_OUT_BAND_MSG;
  }
  const prizeBenefit =
    isFinal && inPrizeBand
      ? benefitForPosition(ranking, myPosition)
      : null;
  return {
    hasPrizes: true,
    inPrizeBand,
    provisionalMessage,
    prizeBenefit,
    redemptionInstructions:
      isFinal && inPrizeBand
        ? ranking.prizeRedemptionInstructions || null
        : null,
  };
}

export async function getStandings(rankingId, { limit = 100, userId = null } = {}) {
  const pool = getPool();
  const take = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const ranking = await getRankingById(rankingId, userId, {
    requireVisible: true,
  });
  if (!ranking) return null;

  const prizeSet = new Set(ranking.prizePositions || []);

  const orderSql =
    ranking.status === "final"
      ? "p.final_position ASC, p.id ASC"
      : RANKING_SORT_SQL;

  const [rows] = await pool.query(
    `SELECT p.id AS participation_id, p.user_id, p.balance, p.valid_count_in_period,
            p.enrolled_at, p.frozen_reputation, p.frozen_share_visit_count,
            p.final_position, p.status AS participation_status,
            u.username, u.photo_url, u.reputation, u.share_visit_count, u.deleted_at
     FROM ranking_participations p
     INNER JOIN users u ON u.id = p.user_id
     WHERE p.ranking_id = ?
     ORDER BY ${orderSql}
     LIMIT ?`,
    [rankingId, take]
  );

  const standings = rows.map((row, index) => {
    const position =
      ranking.status === "final" && row.final_position != null
        ? Number(row.final_position)
        : index + 1;
    const deleted = Boolean(row.deleted_at);
    const shareVisitCount =
      ranking.status === "final" && row.frozen_share_visit_count != null
        ? Number(row.frozen_share_visit_count)
        : Number(row.share_visit_count) || 0;
    return {
      position,
      userId: row.user_id,
      username: deleted ? "Usuário excluído" : row.username || "Usuário excluído",
      photoUrl: deleted ? null : row.photo_url || null,
      points: Number(row.balance) || 0,
      reputation:
        ranking.status === "final" && row.frozen_reputation != null
          ? Number(row.frozen_reputation)
          : row.frozen_reputation != null && deleted
            ? Number(row.frozen_reputation)
            : Number(row.reputation) || 0,
      validCount: Number(row.valid_count_in_period) || 0,
      shareVisitCount,
      profileClickable: false,
      isPrizePosition: prizeSet.has(position),
      accountDeleted: deleted,
    };
  });

  return { ranking, standings };
}

export async function enrollInRanking(userId, rankingId) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const nowDate = utcNow();
    const now = toMysqlDatetime(nowDate);

    const [rows] = await conn.query(
      `SELECT * FROM rankings WHERE id = ? LIMIT 1 FOR UPDATE`,
      [rankingId]
    );
    const ranking = rows[0];
    if (!ranking) throw httpError("Ranking não encontrado.", 404);
    if (!ACTIVE_RANKING_STATUSES.includes(ranking.status)) {
      throw httpError("Este ranking não aceita novas inscrições.");
    }
    if (!isRankingVisibleToUsers(ranking, nowDate)) {
      throw httpError("Este ranking ainda não está disponível.", 404);
    }
    const start = fromMysqlDatetime(ranking.period_start);
    const end = fromMysqlDatetime(ranking.period_end);
    if (!start || !end || nowDate < start || nowDate >= end) {
      throw httpError("Inscrições só no período ativo do ranking.");
    }

    const [existing] = await conn.query(
      `SELECT id FROM ranking_participations
       WHERE ranking_id = ? AND user_id = ? LIMIT 1`,
      [rankingId, userId]
    );
    if (existing[0]) {
      throw httpError("Você já está inscrito neste ranking.", 409);
    }

    const limit =
      ranking.modality === "weekly"
        ? MAX_WEEKLY_ENROLLMENTS
        : MAX_MONTHLY_ENROLLMENTS;
    const used = await countActiveEnrollmentsByModality(
      conn,
      userId,
      ranking.modality
    );
    if (used >= limit) {
      throw httpError(
        ranking.modality === "weekly"
          ? `Limite de ${MAX_WEEKLY_ENROLLMENTS} rankings semanais ativos atingido.`
          : `Limite de ${MAX_MONTHLY_ENROLLMENTS} ranking mensal ativo atingido.`
      );
    }

    const [ins] = await conn.query(
      `INSERT INTO ranking_participations
        (ranking_id, user_id, enrolled_at, balance, valid_count_in_period, status)
       VALUES (?, ?, ?, 0, 0, 'active')`,
      [rankingId, userId, now]
    );

    await conn.commit();
    return {
      participationId: ins.insertId,
      rankingId,
      enrolledAt: now,
      balance: 0,
      definitive: true,
    };
  } catch (error) {
    try {
      await conn.rollback();
    } catch {
      // ignore
    }
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Aplica deltas de pontuação nos rankings elegíveis do usuário.
 * Clamp: max(0, saldo + delta). Sem linha no ledger se não elegível.
 */
export async function applyRankingDeltas(conn, payload) {
  const {
    event,
    userId,
    requestId,
    indicationId,
    reasonCode,
    evaluationId,
  } = payload || {};

  if (!conn || !userId || !event) {
    return { applied: [] };
  }

  let delta =
    payload.delta != null
      ? Number(payload.delta)
      : event === "timeout"
        ? -10
        : event === "evaluate_valid"
          ? 10
          : deltaForEvaluate("invalid", reasonCode);

  if (!Number.isFinite(delta) || delta === 0) {
    return { applied: [] };
  }

  const now = utcNow();
  const nowSql = toMysqlDatetime(now);

  let requestCityId = null;
  let indicationCreatedAt = null;
  let indicationSelectedAt = null;

  if (requestId) {
    const [reqs] = await conn.query(
      `SELECT id, city_id FROM requests WHERE id = ? LIMIT 1`,
      [requestId]
    );
    requestCityId = reqs[0]?.city_id ?? null;
  }

  if (indicationId) {
    const [inds] = await conn.query(
      `SELECT id, created_at, selected_at FROM indications WHERE id = ? LIMIT 1`,
      [indicationId]
    );
    if (inds[0]) {
      indicationCreatedAt = fromMysqlDatetime(inds[0].created_at);
      indicationSelectedAt = fromMysqlDatetime(inds[0].selected_at);
    }
  }

  const [parts] = await conn.query(
    `SELECT p.id AS participation_id, p.balance, p.valid_count_in_period,
            p.enrolled_at, p.status AS participation_status,
            r.id AS ranking_id, r.city_id, r.modality, r.status AS ranking_status,
            r.period_start, r.period_end, r.title
     FROM ranking_participations p
     INNER JOIN rankings r ON r.id = p.ranking_id
     WHERE p.user_id = ?
       AND p.status = 'active'
       AND r.status IN ('open', 'tallying')
     FOR UPDATE`,
    [userId]
  );

  const applied = [];

  for (const part of parts) {
    const periodStart = fromMysqlDatetime(part.period_start);
    const periodEnd = fromMysqlDatetime(part.period_end);
    if (!periodStart || !periodEnd) continue;

    // Ranking da cidade do pedido (ou ranking Brasil global city_id NULL)
    if (part.city_id != null && requestCityId != null && part.city_id !== requestCityId) {
      continue;
    }

    if (event === "timeout") {
      // Solicitante elegível se inscrito no ranking ativo no momento do vencimento
      if (now < periodStart || now >= periodEnd) continue;
    } else {
      // evaluate_*: indicação após enrolled_at; selecionada até fim do período
      if (!indicationCreatedAt) continue;
      const enrolledAt = fromMysqlDatetime(part.enrolled_at);
      if (!enrolledAt || indicationCreatedAt < enrolledAt) continue;
      const selectedAt = indicationSelectedAt || now;
      if (selectedAt >= periodEnd) continue;
      // Avaliação pode cair na apuração; ranking precisa estar open ou tallying (já filtrado)
    }

    const idempotencyKey =
      event === "timeout"
        ? `timeout:req:${requestId}:ranking:${part.ranking_id}`
        : `eval:${evaluationId || "na"}:ranking:${part.ranking_id}`;

    const [dup] = await conn.query(
      `SELECT id FROM score_ledger WHERE idempotency_key = ? LIMIT 1`,
      [idempotencyKey]
    );
    if (dup[0]) continue;

    const oldBalance = Number(part.balance) || 0;
    const newBalance = Math.max(0, oldBalance + delta);
    const appliedDelta = newBalance - oldBalance;
    const ruleKey =
      event === "timeout"
        ? "timeout_requester"
        : event === "evaluate_valid"
          ? "evaluate_valid"
          : `evaluate_invalid_${reasonCode || "other"}`;

    await conn.query(
      `UPDATE ranking_participations
       SET balance = ?,
           valid_count_in_period = valid_count_in_period + ?
       WHERE id = ?`,
      [
        newBalance,
        event === "evaluate_valid" && appliedDelta > 0 ? 1 : 0,
        part.participation_id,
      ]
    );

    await conn.query(
      `INSERT INTO score_ledger
        (user_id, ranking_id, participation_id, event_type, reason_code, rule_key,
         delta, balance_after, evaluation_id, request_id, indication_id,
         idempotency_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        part.ranking_id,
        part.participation_id,
        event,
        reasonCode || null,
        ruleKey,
        appliedDelta,
        newBalance,
        evaluationId || null,
        requestId || null,
        indicationId || null,
        idempotencyKey,
        nowSql,
      ]
    );

    applied.push({
      rankingId: part.ranking_id,
      title: part.title,
      delta: appliedDelta,
      balanceAfter: newBalance,
    });
  }

  return { applied };
}
