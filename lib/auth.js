import bcrypt from "bcryptjs";
import { readAdminViewCookie } from "./admin-view";
import { getPool } from "./db";
import { readSession } from "./session";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,40}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_DIGITS_RE = /^\d+$/;

export function validateRegisterInput({
  username,
  email,
  password,
  cityId,
  cityName,
  state,
}) {
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
  const hasCityId = cityId != null && cityId !== "" && !Number.isNaN(Number(cityId));
  const hasCityName =
    Boolean(String(cityName || "").trim()) &&
    /^[A-Za-z]{2}$/.test(String(state || "").trim());
  if (!hasCityId && !hasCityName) {
    errors.push("Selecione o estado e a cidade.");
  }
  return errors;
}

export function validateCompanyRegisterInput({
  email,
  password,
  cnpj,
  legalName,
  cityId,
  /** true = converte conta pessoa logada (sem e-mail/senha novos). */
  convertExisting = false,
}) {
  const errors = [];
  if (!convertExisting) {
    if (!email || !EMAIL_RE.test(email) || email.length > 255) {
      errors.push("E-mail inválido.");
    }
    if (!password || password.length < 6 || password.length > 128) {
      errors.push("Senha deve ter entre 6 e 128 dígitos.");
    } else if (!PASSWORD_DIGITS_RE.test(password)) {
      errors.push("A senha deve conter apenas números.");
    }
  }
  const name = String(legalName || "").trim();
  if (!name || name.length < 2) {
    errors.push("Razão social obrigatória.");
  } else if (name.length > 255) {
    errors.push("Razão social deve ter no máximo 255 caracteres.");
  }
  if (!cnpj) {
    errors.push("CNPJ obrigatório.");
  }
  if (!cityId || Number.isNaN(Number(cityId))) {
    errors.push("Cidade obrigatória (onde a empresa está instalada).");
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
    `SELECT u.id, u.nome_usuario, u.email, u.foto_url, u.cidade_id, u.reputacao,
            u.contagem_indicacoes_validas, u.contagem_selecionadas_avaliadas,
            u.codigo_compartilhamento, u.contagem_visitas_compartilhamento, u.tutorial_concluido_em,
            u.tipo_conta, u.eh_admin, u.excluido_em,
            c.nome AS city_name, c.estado AS city_state
     FROM usuarios u
     LEFT JOIN cidades c ON c.id = u.cidade_id
     WHERE u.id = ? AND u.excluido_em IS NULL
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

/** Admin real no banco (independente do modo de visualização). */
export function isRealAdminAccount(user) {
  return Boolean(
    user &&
      Number(user.is_admin) === 1 &&
      user.account_type !== "company"
  );
}

/** Modo efetivo do admin: admin | user | company. Null se não for admin. */
export function getAdminViewAs(user) {
  if (!isRealAdminAccount(user)) return null;
  const mode = user?._adminView;
  return mode === "user" || mode === "company" ? mode : "admin";
}

export function isCompanyAccount(user) {
  if (!user) return false;
  if (user.account_type === "company") return true;
  return isRealAdminAccount(user) && getAdminViewAs(user) === "company";
}

/**
 * UI/nav de admin: só no modo gestão.
 * requireAdminUser usa isRealAdminAccount (sempre pode voltar/gerir).
 */
export function isAdminAccount(user) {
  return isRealAdminAccount(user) && getAdminViewAs(user) === "admin";
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

/** Gestão admin pode abrir a área empresarial sem ativar uma prévia. */
export function canAccessCompanyArea(user) {
  return isCompanyAccount(user) || isAdminAccount(user);
}

export async function requireCompanyUser() {
  const user = await requireUser();
  if (!canAccessCompanyArea(user)) {
    const err = new Error("Acesso restrito a conta empresarial.");
    err.status = 403;
    throw err;
  }
  return user;
}

export async function requireAdminUser() {
  const user = await requireUser();
  if (!isRealAdminAccount(user)) {
    const err = new Error("Acesso restrito a administradores.");
    err.status = 403;
    throw err;
  }
  return user;
}

/** Anexa o cookie de visualização do admin ao row do usuário. */
export async function withAdminView(user) {
  if (!user) return null;
  if (isRealAdminAccount(user)) {
    user._adminView = await readAdminViewCookie();
  }
  return user;
}

export async function getCurrentUser() {
  const session = await readSession();
  if (!session) return null;
  return withAdminView(await findUserById(session.userId));
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
  const isRealAdmin = isRealAdminAccount(user);
  const viewAs = getAdminViewAs(user);
  const isCompany = isCompanyAccount(user);
  const accountType = isCompany ? "company" : "user";
  const shareCode = user.share_code || null;
  const isAdmin = isAdminAccount(user);
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    accountType,
    isCompany,
    isAdmin,
    isRealAdmin,
    viewAs,
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
