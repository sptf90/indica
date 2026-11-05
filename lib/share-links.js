/**
 * Link de partilha por utilizador + visitas distintas (1º desempate do ranking).
 * Contagem vitalícia na conta; snapshot frozen_share_visit_count no finalize.
 */

import { randomBytes } from "node:crypto";
import { getPool } from "./db";
import { toMysqlDatetime, utcNow } from "./time";

export const VISITOR_COOKIE = "indica_vid";
export const SHARE_CODE_LENGTH = 8;
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

const ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789";

export function generateShareCode(length = SHARE_CODE_LENGTH) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export function sharePathForCode(code) {
  return `/r/${encodeURIComponent(String(code || "").trim())}`;
}

export async function ensureUserShareCode(userId, conn = null) {
  const db = conn || getPool();
  if (!db || !userId) return null;
  const [rows] = await db.query(
    `SELECT id, codigo_compartilhamento, contagem_visitas_compartilhamento FROM usuarios
     WHERE id = ? AND excluido_em IS NULL LIMIT 1`,
    [userId]
  );
  const user = rows[0];
  if (!user) return null;
  if (user.share_code) {
    return {
      shareCode: user.share_code,
      shareVisitCount: Number(user.share_visit_count) || 0,
    };
  }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateShareCode();
    try {
      await db.query(`UPDATE usuarios SET codigo_compartilhamento = ? WHERE id = ? AND codigo_compartilhamento IS NULL`, [
        code,
        userId,
      ]);
      const [again] = await db.query(
        `SELECT codigo_compartilhamento, contagem_visitas_compartilhamento FROM usuarios WHERE id = ? LIMIT 1`,
        [userId]
      );
      return {
        shareCode: again[0]?.share_code || code,
        shareVisitCount: Number(again[0]?.share_visit_count) || 0,
      };
    } catch (error) {
      if (error && error.code === "ER_DUP_ENTRY") continue;
      throw error;
    }
  }
  throw new Error("Não foi possível gerar código de partilha.");
}

export async function findOwnerByShareCode(code) {
  const pool = getPool();
  if (!pool) return null;
  const normalized = String(code || "")
    .trim()
    .toLowerCase();
  if (!normalized || normalized.length > 16) return null;
  const [rows] = await pool.query(
    `SELECT id, nome_usuario, codigo_compartilhamento, contagem_visitas_compartilhamento, excluido_em
     FROM usuarios WHERE codigo_compartilhamento = ? LIMIT 1`,
    [normalized]
  );
  const owner = rows[0];
  if (!owner || owner.deleted_at) return null;
  return owner;
}

function visitorKeyFor({ visitorUserId, visitorId }) {
  if (visitorUserId) return `u:${Number(visitorUserId)}`;
  return `a:${String(visitorId)}`;
}

/**
 * Regista acesso distinto ao link do dono.
 * Não conta o próprio dono. Preferência: user_id autenticado; senão cookie visitor.
 * @returns {{ counted: boolean, shareVisitCount: number }}
 */
export async function recordShareVisit({
  ownerUserId,
  visitorUserId = null,
  visitorId,
}) {
  const pool = getPool();
  if (!pool) return { counted: false, shareVisitCount: 0 };

  const ownerId = Number(ownerUserId);
  if (!ownerId) return { counted: false, shareVisitCount: 0 };

  if (visitorUserId && Number(visitorUserId) === ownerId) {
    const [own] = await pool.query(
      `SELECT contagem_visitas_compartilhamento FROM usuarios WHERE id = ? LIMIT 1`,
      [ownerId]
    );
    return {
      counted: false,
      shareVisitCount: Number(own[0]?.share_visit_count) || 0,
    };
  }

  const key = visitorKeyFor({ visitorUserId, visitorId });
  if (!key || key === "a:" || key === "u:NaN") {
    return { counted: false, shareVisitCount: 0 };
  }

  const now = toMysqlDatetime(utcNow());
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.query(
      `SELECT id FROM visitas_compartilhamento
       WHERE dono_usuario_id = ? AND chave_visitante = ?
       LIMIT 1 FOR UPDATE`,
      [ownerId, key]
    );

    let counted = false;
    if (existing[0]) {
      await conn.query(
        `UPDATE visitas_compartilhamento
         SET ultimo_acesso_em = ?,
             visitante_usuario_id = COALESCE(?, visitante_usuario_id)
         WHERE id = ?`,
        [now, visitorUserId ? Number(visitorUserId) : null, existing[0].id]
      );
    } else {
      await conn.query(
        `INSERT INTO visitas_compartilhamento
          (dono_usuario_id, visitante_usuario_id, chave_visitante, primeiro_acesso_em, ultimo_acesso_em)
         VALUES (?, ?, ?, ?, ?)`,
        [
          ownerId,
          visitorUserId ? Number(visitorUserId) : null,
          key,
          now,
          now,
        ]
      );
      await conn.query(
        `UPDATE usuarios SET contagem_visitas_compartilhamento = contagem_visitas_compartilhamento + 1 WHERE id = ?`,
        [ownerId]
      );
      counted = true;
    }

    const [rows] = await conn.query(
      `SELECT contagem_visitas_compartilhamento FROM usuarios WHERE id = ? LIMIT 1`,
      [ownerId]
    );
    await conn.commit();
    return {
      counted,
      shareVisitCount: Number(rows[0]?.share_visit_count) || 0,
    };
  } catch (error) {
    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    // Corrida: unique duplicado → já contado
    if (error && error.code === "ER_DUP_ENTRY") {
      const [rows] = await pool.query(
        `SELECT contagem_visitas_compartilhamento FROM usuarios WHERE id = ? LIMIT 1`,
        [ownerId]
      );
      return {
        counted: false,
        shareVisitCount: Number(rows[0]?.share_visit_count) || 0,
      };
    }
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Lê visitor id do Request; se faltar, gera um e devolve opções para Set-Cookie.
 * Preferir request.cookies (Route Handler) — cookies() + redirect falha a fixar o id.
 */
export function resolveVisitorId(request) {
  const existing = request?.cookies?.get?.(VISITOR_COOKIE)?.value;
  if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) {
    return { visitorId: existing, isNew: false, setCookie: null };
  }
  const visitorId = randomBytes(16).toString("base64url");
  return {
    visitorId,
    isNew: true,
    setCookie: {
      name: VISITOR_COOKIE,
      value: visitorId,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: VISITOR_COOKIE_MAX_AGE,
    },
  };
}

export function applyVisitorCookie(response, setCookie) {
  if (!response || !setCookie) return response;
  response.cookies.set(setCookie);
  return response;
}

/** Ordem de classificação (live e final) — documentada no progress. */
export const RANKING_SORT_SQL = `
  p.contagem_validas_periodo DESC,
  p.saldo DESC,
  COALESCE(p.contagem_visitas_compartilhamento_congelada, u.contagem_visitas_compartilhamento) DESC,
  COALESCE(p.reputacao_congelada, u.reputacao) DESC,
  p.inscrito_em ASC,
  p.id ASC
`;
