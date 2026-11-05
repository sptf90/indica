/**
 * Conta empresarial + solicitação de patrocínio + resgates (Fase 3C).
 * RF-EMP-01…05 / RF-SPON-01…13. Sem cobrança.
 * Admin MVP (Fase 4): aprovar / rejeitar / activar via approve+seed.
 */

import { getAdminViewAs, isRealAdminAccount } from "./auth";
import { getPool } from "./db";
import { formatCnpj } from "./cnpj";
import {
  currentMonthWindow,
  currentWeekWindow,
  MAX_PRIZE_POSITION,
  parsePrizeBenefits,
  parsePrizePositions,
  benefitForPosition,
} from "./rankings";
import { fromMysqlDatetime, toMysqlDatetime, utcNow } from "./time";

export {
  normalizeCnpj,
  formatCnpj,
  validateCnpj,
  companyUsernameFromCnpj,
  maskCnpjInput,
} from "./cnpj";

export const REWARD_STATUS_LABELS = {
  pending: "Pendente",
  redeemed: "Resgatado",
  expired: "Expirado",
};

export const SPONSORSHIP_STATUS_LABELS = {
  submitted: "Enviada",
  under_review: "Em análise",
  approved: "Aprovada",
  rejected: "Rejeitada",
  awaiting_correction: "Aguardando correção",
};

const OPEN_REQUEST_STATUSES = ["submitted", "under_review", "approved"];

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/** Normaliza site/URL do patrocinador (http/https). Aceita domínio sem protocolo. */
export function normalizeSponsorSiteUrl(raw) {
  let value = String(raw || "").trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw httpError("Site/URL inválido — use um endereço http(s) completo.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw httpError("Site/URL inválido — use http ou https.");
  }
  if (!parsed.hostname || !parsed.hostname.includes(".")) {
    throw httpError("Site/URL inválido — informe um domínio válido.");
  }
  return parsed.toString();
}

/** RF-SPON-03: prazo ~3 dias corridos antes do início (corte 23h59 UTC). */
export function requestDeadlineForPeriod(periodStart) {
  const start = periodStart instanceof Date ? periodStart : fromMysqlDatetime(periodStart);
  if (!start) return null;
  const deadline = new Date(start);
  deadline.setUTCDate(deadline.getUTCDate() - 3);
  deadline.setUTCHours(23, 59, 59, 999);
  return deadline;
}

export function isRequestWindowOpen(periodStart, now = utcNow()) {
  const deadline = requestDeadlineForPeriod(periodStart);
  if (!deadline) return false;
  return now <= deadline && now < (periodStart instanceof Date ? periodStart : fromMysqlDatetime(periodStart));
}

function nextWeekWindow(now = utcNow()) {
  const current = currentWeekWindow(now);
  const start = new Date(current.end);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

function nextMonthWindow(now = utcNow()) {
  const current = currentMonthWindow(now);
  const start = new Date(current.end);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return { start, end };
}

function weekAfter(window) {
  const start = new Date(window.end);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

function monthAfter(window) {
  const start = new Date(window.end);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return { start, end };
}

function titleFor(cityName, state, modality) {
  const place = cityName ? `${cityName}${state ? `/${state}` : ""}` : "Brasil";
  return modality === "weekly" ? `${place} — Semanal` : `${place} — Mensal`;
}

export function mapCompany(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    cnpj: row.cnpj,
    cnpjFormatted: formatCnpj(row.cnpj),
    legalName: row.legal_name || null,
    logoUrl: row.logo_url || null,
    cityId: row.city_id ?? null,
    cityName: row.city_name || null,
    cityState: row.city_state || null,
    createdAt: row.created_at,
  };
}

/** Editável se ainda não começou o período (aprovada/em análise/correção). */
export function isSponsorshipEditable(row, now = utcNow()) {
  if (!row) return false;
  const status = row.status;
  if (
    !["submitted", "under_review", "awaiting_correction", "approved"].includes(
      status
    )
  ) {
    return false;
  }
  const start =
    row.period_start instanceof Date
      ? row.period_start
      : fromMysqlDatetime(row.period_start);
  if (!start) return false;
  return now < start;
}

export function mapSponsorshipRequest(row) {
  if (!row) return null;
  const positions = parsePrizePositions(row.prize_positions_json);
  const benefits = parsePrizeBenefits(row.prize_benefits_json);
  const editable = isSponsorshipEditable(row);
  return {
    id: row.id,
    companyId: row.company_id,
    companyLegalName: row.company_legal_name || null,
    companyCnpj: row.company_cnpj || null,
    companyCnpjFormatted: row.company_cnpj
      ? formatCnpj(row.company_cnpj)
      : null,
    cityId: row.city_id ?? null,
    cityName: row.city_name || null,
    cityState: row.city_state || null,
    modality: row.modality,
    modalityLabel: row.modality === "weekly" ? "Semanal" : "Mensal",
    periodStart: row.period_start,
    periodEnd: row.period_end,
    displayName: row.display_name,
    logoUrl: row.logo_url || null,
    bannerUrl: row.banner_url || null,
    siteUrl: row.site_url || null,
    regulationText: row.regulation_text,
    prizePositions: positions,
    prizeBenefitMode: row.prize_benefit_mode,
    prizeBenefits: benefits,
    prizeRedemptionInstructions: row.prize_redemption_instructions,
    redemptionDeadlineDays: Number(row.redemption_deadline_days) || 30,
    status: row.status,
    statusLabel: SPONSORSHIP_STATUS_LABELS[row.status] || row.status,
    rankingId: row.ranking_id || null,
    reviewNote: row.review_note || null,
    reviewedAt: row.reviewed_at || null,
    createdAt: row.created_at,
    editable,
  };
}

export function mapReward(row) {
  if (!row) return null;
  const deleted = Boolean(row.deleted_at);
  return {
    id: row.id,
    rankingId: row.ranking_id,
    rankingTitle: row.ranking_title || null,
    companyId: row.company_id,
    userId: row.user_id,
    username: deleted ? "Usuário excluído" : row.username || null,
    participationId: row.participation_id,
    finalPosition: Number(row.final_position),
    benefitText: row.benefit_text,
    status: row.status,
    statusLabel: REWARD_STATUS_LABELS[row.status] || row.status,
    expiresAt: row.expires_at,
    redeemedAt: row.redeemed_at || null,
    remindersStoppedAt: row.reminders_stopped_at || null,
    createdAt: row.created_at,
    accountDeleted: deleted,
  };
}

export async function findCompanyByUserId(userId) {
  const pool = getPool();
  if (!pool || !userId) return null;
  const [rows] = await pool.query(
    `SELECT co.*, c.nome AS city_name, c.estado AS city_state
     FROM empresas co
     LEFT JOIN cidades c ON c.id = co.cidade_id
     WHERE co.usuario_id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

function canAccessCompanyContext(user) {
  if (!user) return false;
  if (user.account_type === "company") return true;
  return isRealAdminAccount(user) && getAdminViewAs(user) === "company";
}

export async function getCompanyContextForUser(user) {
  if (!canAccessCompanyContext(user)) return null;
  const row = await findCompanyByUserId(user.id);
  return mapCompany(row);
}

/**
 * Garante uma empresa vinculada ao admin para prévia (sem alterar tipo_conta/eh_admin).
 */
export async function ensureAdminPreviewCompany(user) {
  if (!isRealAdminAccount(user)) {
    throw httpError("Acesso restrito a administradores.", 403);
  }

  const existing = await findCompanyByUserId(user.id);
  if (existing) return mapCompany(existing);

  const pool = getPool();
  if (!pool) throw httpError("Banco não configurado.", 503);

  let cityId = user.city_id ? Number(user.city_id) : null;
  if (!cityId) {
    const [cities] = await pool.query(
      `SELECT id FROM cidades ORDER BY id ASC LIMIT 1`
    );
    cityId = cities[0]?.id ? Number(cities[0].id) : null;
  }
  if (!cityId) {
    throw httpError(
      "Cadastre ao menos uma cidade (IBGE) antes de pré-visualizar como empresa.",
      400
    );
  }

  const cnpj = `9${String(user.id).padStart(13, "0")}`.slice(0, 14);
  const legalName = `Prévia Admin @${user.username || user.id}`;

  try {
    await pool.query(
      `INSERT INTO empresas (usuario_id, cnpj, razao_social, logo_url, cidade_id)
       VALUES (?, ?, ?, NULL, ?)`,
      [user.id, cnpj, legalName, cityId]
    );
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      const again = await findCompanyByUserId(user.id);
      if (again) return mapCompany(again);
      throw httpError("Não foi possível criar empresa de prévia (CNPJ em uso).", 409);
    }
    throw error;
  }

  const created = await findCompanyByUserId(user.id);
  return mapCompany(created);
}

/**
 * Converte conta pessoa → empresa na mesma linha de users
 * (mesmo id, username, e-mail e senha). Não cria user novo.
 */
export async function convertUserToCompany(
  conn,
  { userId, cnpj, legalName, logoUrl = null, cityId }
) {
  const [existing] = await conn.query(
    `SELECT id, tipo_conta FROM usuarios
     WHERE id = ? AND excluido_em IS NULL LIMIT 1`,
    [userId]
  );
  if (!existing[0]) {
    throw httpError("Conta não encontrada.", 404);
  }
  if (existing[0].account_type === "company") {
    throw httpError("Esta conta já é empresarial.", 409);
  }

  const [dupCompany] = await conn.query(
    `SELECT id FROM empresas WHERE usuario_id = ? LIMIT 1`,
    [userId]
  );
  if (dupCompany[0]) {
    throw httpError("Já existe perfil empresarial nesta conta.", 409);
  }

  await conn.query(
    `UPDATE usuarios SET tipo_conta = 'company', eh_admin = 0 WHERE id = ?`,
    [userId]
  );

  try {
    await conn.query(
      `INSERT INTO empresas (usuario_id, cnpj, razao_social, logo_url, cidade_id)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, cnpj, legalName, logoUrl, cityId]
    );
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      throw httpError("CNPJ já cadastrado.", 409);
    }
    throw error;
  }

  const [rows] = await conn.query(
    `SELECT co.*, c.nome AS city_name, c.estado AS city_state
     FROM empresas co
     LEFT JOIN cidades c ON c.id = co.cidade_id
     WHERE co.usuario_id = ?
     LIMIT 1`,
    [userId]
  );
  return mapCompany(rows[0]);
}

/**
 * Períodos disponibilizados pelo sistema (RF-SPON-02/03):
 * próximas janelas semanal/mensal ainda dentro do prazo de solicitação,
 * sem patrocinador e sem solicitação aberta concorrente.
 * Só na cidade onde a empresa está instalada (companies.city_id).
 */
export async function listAvailableSponsorshipSlots({ companyId } = {}) {
  const pool = getPool();
  const now = utcNow();

  let companyCityId = null;
  if (companyId) {
    const [cos] = await pool.query(
      `SELECT cidade_id FROM empresas WHERE id = ? LIMIT 1`,
      [companyId]
    );
    companyCityId = cos[0]?.city_id ?? null;
  }
  if (companyCityId == null) {
    return [];
  }

  const [cities] = await pool.query(
    `SELECT id, nome, estado FROM cidades WHERE id = ? LIMIT 1`,
    [companyCityId]
  );
  if (!cities.length) return [];

  const candidates = [];
  let week = nextWeekWindow(now);
  let month = nextMonthWindow(now);
  for (let i = 0; i < 3; i += 1) {
    for (const city of cities) {
      candidates.push({
        cityId: city.id,
        cityName: city.name,
        cityState: city.state,
        modality: "weekly",
        ...week,
      });
      candidates.push({
        cityId: city.id,
        cityName: city.name,
        cityState: city.state,
        modality: "monthly",
        ...month,
      });
    }
    week = weekAfter(week);
    month = monthAfter(month);
  }

  const open = [];
  for (const slot of candidates) {
    if (!isRequestWindowOpen(slot.start, now)) continue;

    const [ranked] = await pool.query(
      `SELECT id, patrocinador_empresa_id FROM rankings
       WHERE modalidade = ?
         AND periodo_inicio = ?
         AND ${slot.cityId == null ? "cidade_id IS NULL" : "cidade_id = ?"}
       LIMIT 1`,
      slot.cityId == null
        ? [slot.modality, toMysqlDatetime(slot.start)]
        : [slot.modality, toMysqlDatetime(slot.start), slot.cityId]
    );
    const ranking = ranked[0];
    if (ranking?.sponsor_company_id) continue;

    const [busy] = await pool.query(
      `SELECT id FROM solicitacoes_patrocinio
       WHERE modalidade = ?
         AND periodo_inicio = ?
         AND status IN ('submitted', 'under_review', 'approved')
         AND ${slot.cityId == null ? "cidade_id IS NULL" : "cidade_id = ?"}
         ${companyId ? "AND empresa_id <> ?" : ""}
       LIMIT 1`,
      (() => {
        const params = [slot.modality, toMysqlDatetime(slot.start)];
        if (slot.cityId != null) params.push(slot.cityId);
        if (companyId) params.push(companyId);
        return params;
      })()
    );
    if (busy[0]) continue;

    const [mine] = companyId
      ? await pool.query(
          `SELECT id, status FROM solicitacoes_patrocinio
           WHERE empresa_id = ?
             AND modalidade = ?
             AND periodo_inicio = ?
             AND ${slot.cityId == null ? "cidade_id IS NULL" : "cidade_id = ?"}
           LIMIT 1`,
          slot.cityId == null
            ? [companyId, slot.modality, toMysqlDatetime(slot.start)]
            : [companyId, slot.modality, toMysqlDatetime(slot.start), slot.cityId]
        )
      : [[]];

    open.push({
      key: `${slot.modality}:${slot.cityId}:${toMysqlDatetime(slot.start)}`,
      cityId: slot.cityId,
      cityName: slot.cityName,
      cityState: slot.cityState,
      modality: slot.modality,
      modalityLabel: slot.modality === "weekly" ? "Semanal" : "Mensal",
      periodStart: toMysqlDatetime(slot.start),
      periodEnd: toMysqlDatetime(slot.end),
      requestDeadline: toMysqlDatetime(requestDeadlineForPeriod(slot.start)),
      rankingId: ranking?.id || null,
      title: titleFor(slot.cityName, slot.cityState, slot.modality),
      alreadyRequested: Boolean(mine[0]),
      myRequestStatus: mine[0]?.status || null,
    });
  }

  return open;
}

export async function listSponsorshipRequests(companyId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT sr.*, c.nome AS city_name, c.estado AS city_state
     FROM solicitacoes_patrocinio sr
     LEFT JOIN cidades c ON c.id = sr.cidade_id
     WHERE sr.empresa_id = ?
     ORDER BY sr.criado_em DESC`,
    [companyId]
  );
  return rows.map(mapSponsorshipRequest);
}

/** Lista global para admin (análise de patrocínio). */
export async function listAllSponsorshipRequests({ status } = {}) {
  const pool = getPool();
  const params = [];
  let statusClause = "";
  if (status && status !== "all") {
    statusClause = "WHERE sr.status = ?";
    params.push(status);
  }
  const [rows] = await pool.query(
    `SELECT sr.*,
            c.nome AS city_name, c.estado AS city_state,
            co.razao_social AS company_legal_name, co.cnpj AS company_cnpj
     FROM solicitacoes_patrocinio sr
     LEFT JOIN cidades c ON c.id = sr.cidade_id
     LEFT JOIN empresas co ON co.id = sr.empresa_id
     ${statusClause}
     ORDER BY
       FIELD(sr.status, 'submitted', 'under_review', 'awaiting_correction', 'approved', 'rejected'),
       sr.criado_em DESC`,
    params
  );
  return rows.map(mapSponsorshipRequest);
}

async function fetchSponsorshipRequestMapped(requestId) {
  const pool = getPool();
  const [out] = await pool.query(
    `SELECT sr.*,
            c.nome AS city_name, c.estado AS city_state,
            co.razao_social AS company_legal_name, co.cnpj AS company_cnpj
     FROM solicitacoes_patrocinio sr
     LEFT JOIN cidades c ON c.id = sr.cidade_id
     LEFT JOIN empresas co ON co.id = sr.empresa_id
     WHERE sr.id = ? LIMIT 1`,
    [requestId]
  );
  return mapSponsorshipRequest(out[0]);
}

export async function createSponsorshipRequest(company, body) {
  const pool = getPool();
  const cityId = Number(body.cityId);
  const modality = body.modality === "monthly" ? "monthly" : "weekly";
  const periodStart = fromMysqlDatetime(body.periodStart);
  const periodEnd = fromMysqlDatetime(body.periodEnd);
  if (!cityId || !periodStart || !periodEnd) {
    throw httpError("Cidade e período são obrigatórios.");
  }
  const companyCityId = Number(company.city_id);
  if (!companyCityId) {
    throw httpError(
      "Defina a cidade da empresa (onde está instalada) antes de solicitar patrocínio."
    );
  }
  if (companyCityId !== cityId) {
    throw httpError(
      "Só é possível patrocinar rankings na cidade onde a empresa está instalada.",
      403
    );
  }
  if (!isRequestWindowOpen(periodStart)) {
    throw httpError(
      "Prazo de solicitação encerrado para este período (corte 3 dias / 23h59).",
      403
    );
  }

  const displayName = String(body.displayName || company.legal_name || "").trim();
  const regulationText = String(body.regulationText || "").trim();
  const instructions = String(body.prizeRedemptionInstructions || "").trim();
  const logoUrl = String(body.logoUrl || company.logo_url || "").trim() || null;
  const bannerUrl = String(body.bannerUrl || "").trim() || null;
  const siteUrl = normalizeSponsorSiteUrl(body.siteUrl);
  if (!bannerUrl) {
    throw httpError(
      "Banner do ranking obrigatório (envie a arte 1200×240 px, ratio 5:1)."
    );
  }
  if (
    !bannerUrl.startsWith("/api/uploads/") &&
    !bannerUrl.startsWith("/uploads/")
  ) {
    throw httpError("Banner inválido — use o carregamento da área da empresa.");
  }
  const mode =
    body.prizeBenefitMode === "per_position" ? "per_position" : "equal";
  const rawPositions = Array.isArray(body.prizePositions)
    ? body.prizePositions
    : [];
  if (rawPositions.length > MAX_PRIZE_POSITION) {
    throw httpError(
      `No máximo ${MAX_PRIZE_POSITION} posições premiadas (Top ${MAX_PRIZE_POSITION}).`
    );
  }
  const invalidPos = rawPositions
    .map((n) => Number(n))
    .find(
      (n) =>
        !Number.isInteger(n) || n < 1 || n > MAX_PRIZE_POSITION
    );
  if (rawPositions.length && invalidPos != null) {
    throw httpError(
      `Posições premiadas devem ser inteiros entre 1 e ${MAX_PRIZE_POSITION}.`
    );
  }
  const positions = parsePrizePositions(body.prizePositions);
  if (!displayName) throw httpError("Nome de exibição obrigatório.");
  if (!siteUrl) throw httpError("Site/URL obrigatório (botão Conhecer).");
  if (!regulationText) throw httpError("Regulamento obrigatório.");
  if (!instructions) throw httpError("Instruções de resgate obrigatórias.");
  if (!positions.length) {
    throw httpError(
      `Informe ao menos uma posição premiada (Top N, 1–${MAX_PRIZE_POSITION}).`
    );
  }

  let benefits;
  if (mode === "per_position") {
    const def = String(body.prizeBenefits?.default || "").trim();
    benefits = {};
    if (def) benefits.default = def;
    for (const pos of positions) {
      const text = String(body.prizeBenefits?.[String(pos)] || "").trim();
      if (text) benefits[String(pos)] = text;
    }
    const missing = positions.filter((pos) => !benefits[String(pos)]);
    // Listas grandes: default cobre as posições sem override.
    if (missing.length && !benefits.default) {
      if (missing.length === positions.length) {
        throw httpError(
          "Informe o benefício padrão ou o texto de cada posição."
        );
      }
      throw httpError(
        `Benefício em falta para: ${missing
          .slice(0, 8)
          .map((p) => `${p}º`)
          .join(", ")}${missing.length > 8 ? "…" : ""}. Use um texto padrão ou preencha cada posição.`
      );
    }
  } else {
    const def = String(
      body.prizeBenefits?.default || body.benefitEqual || body.benefit || ""
    ).trim();
    if (!def) throw httpError("Benefício obrigatório.");
    benefits = { default: def };
  }

  const days = Math.min(
    Math.max(Number(body.redemptionDeadlineDays) || 30, 1),
    365
  );

  const slots = await listAvailableSponsorshipSlots({ companyId: company.id });
  const slotKey = `${modality}:${cityId}:${toMysqlDatetime(periodStart)}`;
  const slot = slots.find((s) => s.key === slotKey);
  if (!slot) {
    throw httpError(
      "Período indisponível (já patrocinado, solicitado ou fora do prazo).",
      409
    );
  }
  if (slot.alreadyRequested) {
    throw httpError("Você já solicitou este período.", 409);
  }

  // RF-SPON-01: bloquear 2ª empresa no mesmo ranking/slot
  const [taken] = await pool.query(
    `SELECT id FROM solicitacoes_patrocinio
     WHERE modalidade = ? AND periodo_inicio = ? AND cidade_id = ?
       AND status IN ('submitted', 'under_review', 'approved')
     LIMIT 1`,
    [modality, toMysqlDatetime(periodStart), cityId]
  );
  if (taken[0]) {
    throw httpError("Já existe solicitação para este ranking (1 empresa).", 409);
  }

  const [ranked] = await pool.query(
    `SELECT id, patrocinador_empresa_id FROM rankings
     WHERE modalidade = ? AND periodo_inicio = ? AND cidade_id = ?
     LIMIT 1`,
    [modality, toMysqlDatetime(periodStart), cityId]
  );
  if (ranked[0]?.sponsor_company_id) {
    throw httpError("Ranking já possui patrocinador.", 409);
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO solicitacoes_patrocinio
        (empresa_id, cidade_id, modalidade, periodo_inicio, periodo_fim,
         nome_exibicao, logo_url, banner_url, site_url, texto_regulamento,
         premio_posicoes_json, premio_modo_beneficio, premio_beneficios_json,
         premio_instrucoes_resgate, prazo_resgate_dias,
         status, ranking_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)`,
      [
        company.id,
        cityId,
        modality,
        toMysqlDatetime(periodStart),
        toMysqlDatetime(periodEnd),
        displayName,
        logoUrl,
        bannerUrl,
        siteUrl,
        regulationText,
        JSON.stringify(positions),
        mode,
        JSON.stringify(benefits),
        instructions,
        days,
        ranked[0]?.id || null,
      ]
    );
    const [rows] = await pool.query(
      `SELECT sr.*, c.nome AS city_name, c.estado AS city_state
       FROM solicitacoes_patrocinio sr
       LEFT JOIN cidades c ON c.id = sr.cidade_id
       WHERE sr.id = ? LIMIT 1`,
      [result.insertId]
    );
    return mapSponsorshipRequest(rows[0]);
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      throw httpError("Solicitação duplicada.", 409);
    }
    throw error;
  }
}

/**
 * Corrige campos + banner de uma solicitação ainda antes do período
 * (submitted / under_review / awaiting_correction / approved).
 * Se já aprovada, reaplica a campanha no ranking preparado.
 */
export async function updateSponsorshipRequest(company, requestId, body) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT * FROM solicitacoes_patrocinio WHERE id = ? LIMIT 1 FOR UPDATE`,
      [requestId]
    );
    const req = rows[0];
    if (!req) throw httpError("Solicitação não encontrada.", 404);
    if (Number(req.company_id) !== Number(company.id)) {
      throw httpError("Solicitação de outra empresa.", 403);
    }
    if (!isSponsorshipEditable(req)) {
      throw httpError(
        "Só é possível editar antes do início do período do ranking.",
        409
      );
    }

    const displayName = String(
      body.displayName || req.display_name || company.legal_name || ""
    ).trim();
    const regulationText = String(
      body.regulationText ?? req.regulation_text ?? ""
    ).trim();
    const instructions = String(
      body.prizeRedemptionInstructions ??
        req.prize_redemption_instructions ??
        ""
    ).trim();
    const logoUrl =
      String(body.logoUrl ?? req.logo_url ?? company.logo_url ?? "").trim() ||
      null;
    const bannerUrl =
      String(body.bannerUrl ?? req.banner_url ?? "").trim() || null;
    const siteUrl =
      body.siteUrl !== undefined
        ? normalizeSponsorSiteUrl(body.siteUrl)
        : normalizeSponsorSiteUrl(req.site_url);
    if (!bannerUrl) {
      throw httpError(
        "Banner do ranking obrigatório (envie a arte 1200×240 px, ratio 5:1)."
      );
    }
    if (
      !bannerUrl.startsWith("/api/uploads/") &&
      !bannerUrl.startsWith("/uploads/")
    ) {
      throw httpError(
        "Banner inválido — use o carregamento da área da empresa."
      );
    }
    if (!displayName) throw httpError("Nome de exibição obrigatório.");
    if (!siteUrl) throw httpError("Site/URL obrigatório (botão Conhecer).");
    if (!regulationText) throw httpError("Regulamento obrigatório.");
    if (!instructions) throw httpError("Instruções de resgate obrigatórias.");

    const mode =
      body.prizeBenefitMode === "per_position"
        ? "per_position"
        : body.prizeBenefitMode === "equal"
          ? "equal"
          : req.prize_benefit_mode === "per_position"
            ? "per_position"
            : "equal";
    const rawPositions = Array.isArray(body.prizePositions)
      ? body.prizePositions
      : parsePrizePositions(req.prize_positions_json);
    if (rawPositions.length > MAX_PRIZE_POSITION) {
      throw httpError(
        `No máximo ${MAX_PRIZE_POSITION} posições premiadas (Top ${MAX_PRIZE_POSITION}).`
      );
    }
    const positions = parsePrizePositions(rawPositions);
    if (!positions.length) {
      throw httpError(
        `Informe ao menos uma posição premiada (Top N, 1–${MAX_PRIZE_POSITION}).`
      );
    }

    let benefits;
    if (mode === "per_position") {
      const source = body.prizeBenefits || {};
      const def = String(source.default || "").trim();
      benefits = {};
      if (def) benefits.default = def;
      for (const pos of positions) {
        const text = String(source[String(pos)] || "").trim();
        if (text) benefits[String(pos)] = text;
      }
      const missing = positions.filter((pos) => !benefits[String(pos)]);
      if (missing.length && !benefits.default) {
        throw httpError(
          "Informe o benefício padrão ou o texto de cada posição."
        );
      }
    } else {
      const def = String(
        body.prizeBenefits?.default ||
          body.benefitEqual ||
          body.benefit ||
          ""
      ).trim();
      if (!def) throw httpError("Benefício obrigatório.");
      benefits = { default: def };
    }

    const days = Math.min(
      Math.max(
        Number(body.redemptionDeadlineDays) ||
          Number(req.redemption_deadline_days) ||
          30,
        1
      ),
      365
    );

    await conn.query(
      `UPDATE solicitacoes_patrocinio
       SET nome_exibicao = ?,
           logo_url = ?,
           banner_url = ?,
           site_url = ?,
           texto_regulamento = ?,
           premio_posicoes_json = ?,
           premio_modo_beneficio = ?,
           premio_beneficios_json = ?,
           premio_instrucoes_resgate = ?,
           prazo_resgate_dias = ?
       WHERE id = ?`,
      [
        displayName,
        logoUrl,
        bannerUrl,
        siteUrl,
        regulationText,
        JSON.stringify(positions),
        mode,
        JSON.stringify(benefits),
        instructions,
        days,
        requestId,
      ]
    );

    // Se já aprovada (campanha preparada), sincroniza o ranking.
    if (req.status === "approved") {
      const [fresh] = await conn.query(
        `SELECT * FROM solicitacoes_patrocinio WHERE id = ? LIMIT 1`,
        [requestId]
      );
      const rankingId = await applySponsorshipCampaignToRanking(conn, fresh[0]);
      await conn.query(
        `UPDATE solicitacoes_patrocinio SET ranking_id = ? WHERE id = ?`,
        [rankingId, requestId]
      );
    }

    await conn.commit();
    return fetchSponsorshipRequestMapped(requestId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/** Aplica campos da solicitação ao ranking (seed 3C). Retorna rankingId. */
async function applySponsorshipCampaignToRanking(conn, req) {
  const positions = parsePrizePositions(req.prize_positions_json);
  const benefits = parsePrizeBenefits(req.prize_benefits_json);
  const [cities] = await conn.query(
    `SELECT nome, estado FROM cidades WHERE id = ? LIMIT 1`,
    [req.city_id]
  );
  const city = cities[0];
  const baseTitle = titleFor(city?.name, city?.state, req.modality);
  const title = `${baseTitle} · ${req.display_name}`;

  let rankingId = req.ranking_id;
  if (rankingId) {
    const [rk] = await conn.query(
      `SELECT id, patrocinador_empresa_id FROM rankings WHERE id = ? LIMIT 1 FOR UPDATE`,
      [rankingId]
    );
    if (!rk[0]) rankingId = null;
    else if (rk[0].sponsor_company_id && rk[0].sponsor_company_id !== req.company_id) {
      throw httpError("Ranking já possui outro patrocinador.", 409);
    }
  }

  if (!rankingId) {
    const [ins] = await conn.query(
      `INSERT INTO rankings
        (cidade_id, modalidade, periodo_inicio, periodo_fim, status, titulo,
         patrocinador_empresa_id, patrocinador_nome_exibicao, patrocinador_logo_url,
         patrocinador_banner_url, patrocinador_site_url,
         premio_posicoes_json, premio_modo_beneficio, premio_beneficios_json,
         premio_instrucoes_resgate, premio_prazo_resgate_dias,
         texto_regulamento)
       VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [
        req.city_id,
        req.modality,
        req.period_start,
        req.period_end,
        title,
        req.company_id,
        req.display_name,
        req.logo_url,
        req.banner_url || null,
        req.site_url || null,
        JSON.stringify(positions),
        req.prize_benefit_mode,
        JSON.stringify(benefits),
        req.prize_redemption_instructions,
        req.redemption_deadline_days,
        req.regulation_text,
      ]
    );
    rankingId = ins.insertId;
    const [existing] = await conn.query(
      `SELECT id FROM rankings
       WHERE cidade_id = ? AND modalidade = ? AND periodo_inicio = ?
       LIMIT 1`,
      [req.city_id, req.modality, req.period_start]
    );
    rankingId = existing[0]?.id || rankingId;
  }

  await conn.query(
    `UPDATE rankings
     SET patrocinador_empresa_id = ?,
         patrocinador_nome_exibicao = ?,
         patrocinador_logo_url = ?,
         patrocinador_banner_url = ?,
         patrocinador_site_url = ?,
         premio_posicoes_json = ?,
         premio_modo_beneficio = ?,
         premio_beneficios_json = ?,
         premio_instrucoes_resgate = ?,
         premio_prazo_resgate_dias = ?,
         texto_regulamento = ?,
         titulo = ?
     WHERE id = ?`,
    [
      req.company_id,
      req.display_name,
      req.logo_url,
      req.banner_url || null,
      req.site_url || null,
      JSON.stringify(positions),
      req.prize_benefit_mode,
      JSON.stringify(benefits),
      req.prize_redemption_instructions,
      req.redemption_deadline_days,
      req.regulation_text,
      title,
      rankingId,
    ]
  );

  return rankingId;
}

/**
 * Aprova solicitação e aplica campanha ao ranking (preparado/oculto até início).
 * Envio ≠ publicação (RF-SPON-04/05). Usado pelo seed e admin MVP.
 */
export async function approveSponsorshipRequest(requestId, { note } = {}) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT * FROM solicitacoes_patrocinio WHERE id = ? LIMIT 1 FOR UPDATE`,
      [requestId]
    );
    const req = rows[0];
    if (!req) throw httpError("Solicitação não encontrada.", 404);
    if (req.status === "approved") {
      await conn.commit();
      return fetchSponsorshipRequestMapped(requestId);
    }
    if (!["submitted", "under_review", "awaiting_correction"].includes(req.status)) {
      throw httpError("Solicitação não pode ser aprovada neste status.", 409);
    }

    const rankingId = await applySponsorshipCampaignToRanking(conn, req);

    await conn.query(
      `UPDATE solicitacoes_patrocinio
       SET status = 'approved',
           ranking_id = ?,
           nota_revisao = ?,
           revisado_em = ?
       WHERE id = ?`,
      [
        rankingId,
        note || "Aprovada",
        toMysqlDatetime(utcNow()),
        requestId,
      ]
    );

    await conn.commit();
    return fetchSponsorshipRequestMapped(requestId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Rejeita solicitação (motivo/nota opcional).
 * Status elegíveis: submitted | under_review | awaiting_correction.
 */
export async function rejectSponsorshipRequest(requestId, { note } = {}) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT * FROM solicitacoes_patrocinio WHERE id = ? LIMIT 1 FOR UPDATE`,
      [requestId]
    );
    const req = rows[0];
    if (!req) throw httpError("Solicitação não encontrada.", 404);
    if (req.status === "rejected") {
      await conn.commit();
      return fetchSponsorshipRequestMapped(requestId);
    }
    if (!["submitted", "under_review", "awaiting_correction"].includes(req.status)) {
      throw httpError("Solicitação não pode ser rejeitada neste status.", 409);
    }
    const reviewNote = String(note || "").trim() || "Rejeitada";
    await conn.query(
      `UPDATE solicitacoes_patrocinio
       SET status = 'rejected',
           nota_revisao = ?,
           revisado_em = ?
       WHERE id = ?`,
      [reviewNote.slice(0, 500), toMysqlDatetime(utcNow()), requestId]
    );
    await conn.commit();
    return fetchSponsorshipRequestMapped(requestId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Activa campanha no ranking reutilizando o seed de approve.
 * Pendentes → approveSponsorshipRequest; aprovadas → reaplica via helper.
 */
export async function activateSponsorshipRequest(requestId, { note } = {}) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT status FROM solicitacoes_patrocinio WHERE id = ? LIMIT 1`,
    [requestId]
  );
  const req = rows[0];
  if (!req) throw httpError("Solicitação não encontrada.", 404);

  if (["submitted", "under_review", "awaiting_correction"].includes(req.status)) {
    return approveSponsorshipRequest(requestId, {
      note: note || "Aprovada e activada no ranking",
    });
  }

  if (req.status !== "approved") {
    throw httpError("Só é possível activar solicitações aprovadas ou em análise.", 409);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [locked] = await conn.query(
      `SELECT * FROM solicitacoes_patrocinio WHERE id = ? LIMIT 1 FOR UPDATE`,
      [requestId]
    );
    const current = locked[0];
    if (!current || current.status !== "approved") {
      throw httpError("Solicitação não está aprovada.", 409);
    }

    const rankingId = await applySponsorshipCampaignToRanking(conn, current);
    await conn.query(
      `UPDATE solicitacoes_patrocinio
       SET ranking_id = ?,
           nota_revisao = COALESCE(?, nota_revisao),
           revisado_em = ?
       WHERE id = ?`,
      [
        rankingId,
        note ? String(note).trim().slice(0, 500) : null,
        toMysqlDatetime(utcNow()),
        requestId,
      ]
    );

    await conn.commit();
    return fetchSponsorshipRequestMapped(requestId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function expirePendingRewards(connOrPool = null) {
  const db = connOrPool || getPool();
  const now = toMysqlDatetime(utcNow());
  const [result] = await db.query(
    `UPDATE ranking_premios
     SET status = 'expired',
         lembretes_parados_em = COALESCE(lembretes_parados_em, ?)
     WHERE status = 'pending' AND expira_em < ?`,
    [now, now]
  );
  return result.affectedRows || 0;
}

export async function listCompanyRewards(companyId) {
  const pool = getPool();
  await expirePendingRewards(pool);
  const [rows] = await pool.query(
    `SELECT rw.*, u.nome_usuario, u.excluido_em, r.titulo AS ranking_title
     FROM ranking_premios rw
     INNER JOIN usuarios u ON u.id = rw.usuario_id
     INNER JOIN rankings r ON r.id = rw.ranking_id
     WHERE rw.empresa_id = ?
     ORDER BY
       FIELD(rw.status, 'pending', 'redeemed', 'expired'),
       rw.posicao_final ASC,
       rw.id ASC`,
    [companyId]
  );
  return rows.map(mapReward);
}

/** RF-SPON-11/12: só a empresa patrocinadora confirma → Resgatado + timestamp. */
export async function confirmRewardRedemption(companyId, rewardId) {
  const pool = getPool();
  await expirePendingRewards(pool);
  const now = toMysqlDatetime(utcNow());
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT * FROM ranking_premios WHERE id = ? LIMIT 1 FOR UPDATE`,
      [rewardId]
    );
    const reward = rows[0];
    if (!reward) throw httpError("Resgate não encontrado.", 404);
    if (Number(reward.company_id) !== Number(companyId)) {
      throw httpError("Resgate de outra campanha.", 403);
    }
    if (reward.status === "redeemed") {
      await conn.commit();
      return mapReward(reward);
    }
    if (reward.status === "expired") {
      throw httpError("Prazo de resgate expirado.", 409);
    }
    if (reward.status !== "pending") {
      throw httpError("Status inválido para confirmação.", 409);
    }
    await conn.query(
      `UPDATE ranking_premios
       SET status = 'redeemed',
           resgatado_em = ?,
           lembretes_parados_em = ?
       WHERE id = ?`,
      [now, now, rewardId]
    );
    await conn.commit();
    const [out] = await pool.query(
      `SELECT rw.*, u.nome_usuario, u.excluido_em, r.titulo AS ranking_title
       FROM ranking_premios rw
       INNER JOIN usuarios u ON u.id = rw.usuario_id
       INNER JOIN rankings r ON r.id = rw.ranking_id
       WHERE rw.id = ? LIMIT 1`,
      [rewardId]
    );
    return mapReward(out[0]);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Materializa resgates Pendente após ranking final (posições premiadas).
 */
export async function ensureRewardsForFinalRanking(rankingId, connOrPool = null) {
  const db = connOrPool || getPool();
  const [rows] = await db.query(
    `SELECT r.*, co.id AS company_ok
     FROM rankings r
     LEFT JOIN empresas co ON co.id = r.patrocinador_empresa_id
     WHERE r.id = ? LIMIT 1`,
    [rankingId]
  );
  const ranking = rows[0];
  if (!ranking || ranking.status !== "final" || !ranking.sponsor_company_id) {
    return { created: 0 };
  }
  const positions = parsePrizePositions(ranking.prize_positions_json);
  if (!positions.length) return { created: 0 };

  const days = Number(ranking.prize_redemption_deadline_days) || 30;
  const base = fromMysqlDatetime(ranking.updated_at) || utcNow();
  const expires = new Date(base);
  expires.setUTCDate(expires.getUTCDate() + days);

  const mapped = {
    prizeBenefits: parsePrizeBenefits(ranking.prize_benefits_json),
    prizeBenefitMode: ranking.prize_benefit_mode,
  };

  const [parts] = await db.query(
    `SELECT id, usuario_id, posicao_final
     FROM ranking_participacoes
     WHERE ranking_id = ?
       AND posicao_final IS NOT NULL
       AND posicao_final IN (${positions.map(() => "?").join(",")})`,
    [rankingId, ...positions]
  );

  let created = 0;
  for (const part of parts) {
    const benefit =
      benefitForPosition(mapped, part.final_position) ||
      ranking.prize_redemption_instructions ||
      "Benefício da campanha";
    try {
      const [ins] = await db.query(
        `INSERT IGNORE INTO ranking_premios
          (ranking_id, empresa_id, usuario_id, participacao_id,
           posicao_final, texto_beneficio, status, expira_em)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          rankingId,
          ranking.sponsor_company_id,
          part.user_id,
          part.id,
          part.final_position,
          String(benefit).slice(0, 500),
          toMysqlDatetime(expires),
        ]
      );
      if (ins.affectedRows) created += 1;
    } catch {
      /* ignore race */
    }
  }
  return { created };
}

export { OPEN_REQUEST_STATUSES };
