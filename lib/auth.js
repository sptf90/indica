import bcrypt from "bcryptjs";
import { getPool } from "./db";
import { readSession } from "./session";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,40}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_DIGITS_RE = /^\d+$/;

export function validateRegisterInput({ username, email, password, cityId }) {
  const errors = [];
  if (!username || !USERNAME_RE.test(username)) {
    errors.push("Username inválido (3–40 caracteres: letras, números, _).");
  }
  if (!email || !EMAIL_RE.test(email) || email.length > 255) {
    errors.push("E-mail inválido.");
  }
  if (!password || password.length < 6 || password.length > 128) {
    errors.push("Senha deve ter entre 6 e 128 dígitos.");
  } else if (!PASSWORD_DIGITS_RE.test(password)) {
    errors.push("A senha deve conter apenas números.");
  }
  if (!cityId || Number.isNaN(Number(cityId))) {
    errors.push("Cidade obrigatória.");
  }
  return errors;
}

export function validateCompanyRegisterInput({ email, password, cnpj, legalName }) {
  const errors = [];
  if (!email || !EMAIL_RE.test(email) || email.length > 255) {
    errors.push("E-mail inválido.");
  }
  if (!password || password.length < 6 || password.length > 128) {
    errors.push("Senha deve ter entre 6 e 128 dígitos.");
  } else if (!PASSWORD_DIGITS_RE.test(password)) {
    errors.push("A senha deve conter apenas números.");
  }
  if (!legalName || String(legalName).trim().length < 2) {
    errors.push("Razão social obrigatória.");
  }
  if (!cnpj) {
    errors.push("CNPJ obrigatório.");
  }
  return errors;
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export async function findUserById(id) {
  const pool = getPool();
  if (!pool) return null;
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.email, u.photo_url, u.city_id, u.reputation,
            u.valid_indication_count, u.selected_and_evaluated_count,
            u.share_code, u.share_visit_count, u.tutorial_completed_at,
            u.account_type, u.is_admin, u.deleted_at,
            c.name AS city_name, c.state AS city_state
     FROM users u
     LEFT JOIN cities c ON c.id = u.city_id
     WHERE u.id = ? AND u.deleted_at IS NULL
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export function isCompanyAccount(user) {
  return Boolean(user && user.account_type === "company");
}

/** Admin = flag is_admin em conta user (empresa nunca tem poderes admin). */
export function isAdminAccount(user) {
  return Boolean(
    user &&
      Number(user.is_admin) === 1 &&
      user.account_type !== "company"
  );
}

/** RF-EMP-05 / RF-SPON-10: conta empresarial não pede nem indica. */
export function assertConsumerUser(user) {
  if (isCompanyAccount(user)) {
    const err = new Error(
      "Conta empresarial não pode pedir nem indicar. Use /empresa para patrocínio e resgates."
    );
    err.status = 403;
    throw err;
  }
  return user;
}

export async function requireCompanyUser() {
  const user = await requireUser();
  if (!isCompanyAccount(user)) {
    const err = new Error("Acesso restrito a conta empresarial.");
    err.status = 403;
    throw err;
  }
  return user;
}

export async function requireAdminUser() {
  const user = await requireUser();
  if (!isAdminAccount(user)) {
    const err = new Error("Acesso restrito a administradores.");
    err.status = 403;
    throw err;
  }
  return user;
}

export async function getCurrentUser() {
  const session = await readSession();
  if (!session) return null;
  return findUserById(session.userId);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    const err = new Error("Não autenticado");
    err.status = 401;
    throw err;
  }
  return user;
}

export function publicUser(user) {
  if (!user) return null;
  const reputation = Number(user.reputation) || 0;
  const selectedAndEvaluatedCount =
    Number(user.selected_and_evaluated_count) || 0;
  const accountType = user.account_type === "company" ? "company" : "user";
  const shareCode = user.share_code || null;
  const isAdmin = isAdminAccount(user);
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    accountType,
    isCompany: accountType === "company",
    isAdmin,
    photoUrl: user.photo_url || null,
    cityId: user.city_id,
    cityName: user.city_name || null,
    cityState: user.city_state || null,
    reputation,
    validIndicationCount: Number(user.valid_indication_count) || 0,
    selectedAndEvaluatedCount,
    hasEvaluations: selectedAndEvaluatedCount > 0,
    reputationLabel:
      selectedAndEvaluatedCount === 0
        ? "Reputação 0/100 - Sem avaliações"
        : `Reputação ${reputation}/100`,
    shareCode,
    sharePath: shareCode ? `/r/${shareCode}` : null,
    shareVisitCount: Number(user.share_visit_count) || 0,
    tutorialCompleted: Boolean(user.tutorial_completed_at),
  };
}

/** Perfil contextual público: sem e-mail, sem histórico. */
export function publicProfile(user) {
  if (!user) return null;
  const reputation = Number(user.reputation) || 0;
  const selectedAndEvaluatedCount =
    Number(user.selected_and_evaluated_count) || 0;
  return {
    username: user.username,
    photoUrl: user.photo_url || null,
    cityName: user.city_name || null,
    cityState: user.city_state || null,
    reputation,
    validIndicationCount: Number(user.valid_indication_count) || 0,
    hasEvaluations: selectedAndEvaluatedCount > 0,
    reputationLabel:
      selectedAndEvaluatedCount === 0
        ? "Reputação 0/100 - Sem avaliações"
        : `Reputação ${reputation}/100`,
  };
}

export function jsonError(message, status = 400, extra = {}) {
  return Response.json({ error: message, ...extra }, { status });
}
