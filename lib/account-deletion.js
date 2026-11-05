/**
 * Exclusão definitiva de conta (§5.7 / AC-15…AC-17).
 *
 * Reauth atual: PIN numérico (senha já em uso).
 * Google OAuth: ponto de integração marcado abaixo — não bloqueia exclusão.
 */

import { writeAudit } from "./audit";
import { verifyPassword } from "./auth";
import { MSG } from "./constants";
import { withTransaction } from "./db-tx";
import { getPool } from "./db";
import { toMysqlDatetime, utcNow } from "./time";

export const DELETED_USER_LABEL = MSG.userDeleted;

/** Sentinel com ponto — fora do padrão de cadastro (letras/números/_). */
export function anonymizedUsername(userId) {
  return `deleted.${Number(userId)}`;
}

export function anonymizedEmail(userId) {
  return `deleted.${Number(userId)}@invalid.invalid`;
}

export function isDeletedUser(userOrRow) {
  if (!userOrRow) return false;
  return Boolean(userOrRow.deleted_at ?? userOrRow.deletedAt);
}

export function displayUsername(userOrRow) {
  if (!userOrRow) return DELETED_USER_LABEL;
  if (isDeletedUser(userOrRow)) return DELETED_USER_LABEL;
  return userOrRow.username || DELETED_USER_LABEL;
}

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * GOOGLE_OAUTH_INTEGRATION_POINT
 * Quando Auth Google existir: validar idToken/código OAuth aqui (mesmo e-mail
 * da conta) e retornar { ok: true, method: 'google' }. Até lá, só PIN.
 */
export async function verifyReauthForDeletion(userRow, { password, googleToken }) {
  // --- Google (stub) -------------------------------------------------------
  if (googleToken != null && String(googleToken).trim() !== "") {
    // TODO(google-oauth): trocar por verificação real do token Google.
    // Não inventar OAuth completo; exclusão segue com PIN.
    throw httpError(
      "Reautenticação Google ainda não disponível. Confirme com sua senha numérica.",
      400
    );
  }

  const pin = String(password || "");
  if (!pin || pin.length < 6 || !/^\d+$/.test(pin)) {
    throw httpError("Informe a senha numérica (mínimo 6 dígitos) para confirmar.");
  }
  if (!(await verifyPassword(pin, userRow.password_hash))) {
    throw httpError("Senha incorreta.", 401);
  }
  return { ok: true, method: "password" };
}

async function closeOwnOpenRequests(conn, userId, now) {
  const [rows] = await conn.query(
    `SELECT id, status FROM pedidos
     WHERE solicitante_id = ? AND excluido_em IS NULL
       AND status IN ('open', 'in_evaluation')
     FOR UPDATE`,
    [userId]
  );

  for (const req of rows) {
    await conn.query(
      `UPDATE pedidos
       SET status = 'closed_voluntary',
           fechado_em = ?,
           motivo_fechamento = 'account_deleted',
           avaliacao_prazo_em = NULL,
           indicacao_selecionada_id = NULL
       WHERE id = ?`,
      [now, req.id]
    );
    await conn.query(
      `UPDATE indicacoes
       SET status = 'not_selected'
       WHERE pedido_id = ? AND excluido_em IS NULL
         AND status NOT IN (
           'valid', 'invalid', 'not_selected',
           'closed_timeout', 'closed_no_valid'
         )`,
      [req.id]
    );
    await writeAudit(conn, {
      entityType: "request",
      entityId: req.id,
      fromStatus: req.status,
      toStatus: "closed_voluntary",
      actorType: "user",
      actorId: userId,
      reason: "account_deleted",
    });
  }

  return rows.length;
}

async function freezeActiveRankings(conn, userId, reputation, now) {
  const [active] = await conn.query(
    `SELECT id FROM ranking_participacoes
     WHERE usuario_id = ? AND status = 'active'
     FOR UPDATE`,
    [userId]
  );
  if (!active.length) return 0;

  await conn.query(
    `UPDATE ranking_participacoes
     SET status = 'frozen',
         reputacao_congelada = COALESCE(reputacao_congelada, ?),
         atualizado_em = ?
     WHERE usuario_id = ? AND status = 'active'`,
    [reputation, now, userId]
  );
  return active.length;
}

/**
 * Exclui a conta imediatamente após reauth válida.
 * Preserva indicações a terceiros; anonimiza autor; libera username/e-mail.
 */
export async function deleteAccountImmediate(userId, { password, googleToken, ip, userAgent }) {
  const pool = getPool();
  if (!pool) throw httpError("Banco não configurado.", 503);

  const [authRows] = await pool.query(
    `SELECT id, nome_usuario, email, senha_hash, reputacao, excluido_em
     FROM usuarios WHERE id = ? LIMIT 1`,
    [userId]
  );
  const userRow = authRows[0];
  if (!userRow) throw httpError("Usuário não encontrado.", 404);
  if (userRow.deleted_at) throw httpError("Conta já excluída.", 410);

  const reauth = await verifyReauthForDeletion(userRow, { password, googleToken });

  return withTransaction(async (conn) => {
    const [locked] = await conn.query(
      `SELECT id, nome_usuario, email, reputacao, excluido_em
       FROM usuarios WHERE id = ? LIMIT 1 FOR UPDATE`,
      [userId]
    );
    const user = locked[0];
    if (!user) throw httpError("Usuário não encontrado.", 404);
    if (user.deleted_at) throw httpError("Conta já excluída.", 410);

    const now = toMysqlDatetime(utcNow());
    const previousUsername = user.username;
    const previousEmail = user.email;
    const reputation = Number(user.reputation) || 0;

    const closedRequestsCount = await closeOwnOpenRequests(conn, userId, now);
    const frozenRankingsCount = await freezeActiveRankings(
      conn,
      userId,
      reputation,
      now
    );

    await conn.query(
      `UPDATE usuarios
       SET nome_usuario = ?,
           email = ?,
           senha_hash = ?,
           foto_url = NULL,
           cidade_id = NULL,
           excluido_em = ?,
           atualizado_em = ?
       WHERE id = ?`,
      [
        anonymizedUsername(userId),
        anonymizedEmail(userId),
        "!", // hash inválido — login impossível
        now,
        now,
        userId,
      ]
    );

    await conn.query(
      `INSERT INTO exclusoes_conta
        (usuario_id, nome_usuario_anterior, email_anterior, metodo_reautenticacao,
         contagem_pedidos_fechados, contagem_rankings_congelados, ip, user_agent, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        previousUsername,
        previousEmail,
        reauth.method,
        closedRequestsCount,
        frozenRankingsCount,
        ip ? String(ip).slice(0, 64) : null,
        userAgent ? String(userAgent).slice(0, 500) : null,
        now,
      ]
    );

    await writeAudit(conn, {
      entityType: "user",
      entityId: userId,
      fromStatus: "active",
      toStatus: "deleted",
      actorType: "user",
      actorId: userId,
      reason: "account_deleted",
      payload: {
        previousUsername,
        closedRequestsCount,
        frozenRankingsCount,
        reauthMethod: reauth.method,
      },
    });

    return {
      deleted: true,
      label: DELETED_USER_LABEL,
      closedRequestsCount,
      frozenRankingsCount,
      previousUsername,
    };
  });
}
