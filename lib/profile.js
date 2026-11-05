import { getPool } from "./db";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,40}$/;
const PHOTO_URL_RE = /^(https?:\/\/|\/uploads\/).+/i;

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function validateProfilePatch({ username, photoUrl, cityId }) {
  const errors = [];
  if (username !== undefined) {
    const handle = String(username || "").trim();
    if (!USERNAME_RE.test(handle)) {
      errors.push(
        "Nome de usuário inválido (3–40 caracteres: letras, números e _)."
      );
    }
  }
  if (photoUrl !== undefined && photoUrl !== null && photoUrl !== "") {
    const url = String(photoUrl).trim();
    if (url.length > 500) {
      errors.push("URL da foto muito longa (máximo 500 caracteres).");
    } else if (!PHOTO_URL_RE.test(url) && !url.startsWith("/")) {
      errors.push(
        "Foto inválida. Use uma URL http(s) ou um caminho /uploads/…"
      );
    }
  }
  if (cityId !== undefined && cityId !== null && cityId !== "") {
    if (Number.isNaN(Number(cityId)) || Number(cityId) <= 0) {
      errors.push("Cidade inválida.");
    }
  }
  return errors;
}

/**
 * O perfil público só pode ser aberto em contexto autorizado:
 * o visualizador é solicitante de um pedido cuja indicação selecionada
 * pertence ao usuário-alvo (identidade já revelada na comparação).
 * O próprio usuário acessa via /perfil (não este endpoint).
 */
export async function canViewPublicProfile(viewerId, targetUserId) {
  if (!viewerId || !targetUserId) return false;
  if (Number(viewerId) === Number(targetUserId)) return true;

  const pool = getPool();
  // Já houve escolha revelando a identidade do indicador neste pedido.
  const [rows] = await pool.query(
    `SELECT 1 AS ok
     FROM indicacoes i
     INNER JOIN pedidos r ON r.id = i.pedido_id AND r.excluido_em IS NULL
     WHERE r.solicitante_id = ?
       AND i.indicador_id = ?
       AND i.selecionada_em IS NOT NULL
       AND i.excluido_em IS NULL
     LIMIT 1`,
    [viewerId, targetUserId]
  );
  return Boolean(rows[0]);
}

export async function updateOwnProfile(userId, payload) {
  const pool = getPool();
  const username =
    payload.username !== undefined
      ? String(payload.username).trim()
      : undefined;
  const photoProvided =
    Object.prototype.hasOwnProperty.call(payload, "photoUrl") &&
    payload.photoUrl !== undefined;
  let photoUrl;
  if (photoProvided) {
    if (payload.photoUrl === null || payload.photoUrl === "") {
      photoUrl = null;
    } else {
      photoUrl = String(payload.photoUrl).trim();
    }
  }
  const cityProvided = Object.prototype.hasOwnProperty.call(payload, "cityId");
  const cityId = cityProvided
    ? payload.cityId === null || payload.cityId === ""
      ? null
      : Number(payload.cityId)
    : undefined;

  const errors = validateProfilePatch({
    username,
    photoUrl: photoProvided ? photoUrl || "" : undefined,
    cityId: cityProvided ? cityId : undefined,
  });
  if (errors.length) throw httpError(errors[0]);

  if (cityId != null) {
    const [cities] = await pool.query(
      `SELECT id FROM cidades WHERE id = ? LIMIT 1`,
      [cityId]
    );
    if (!cities[0]) throw httpError("Cidade inválida.");
  }

  const sets = [];
  const params = [];
  if (username !== undefined) {
    sets.push("nome_usuario = ?");
    params.push(username);
  }
  if (photoProvided) {
    sets.push("foto_url = ?");
    params.push(photoUrl);
  }
  if (cityProvided) {
    sets.push("cidade_id = ?");
    params.push(cityId);
  }

  if (!sets.length) {
    throw httpError("Nenhum campo para atualizar.");
  }

  params.push(userId);

  try {
    const [result] = await pool.query(
      `UPDATE usuarios SET ${sets.join(", ")} WHERE id = ?`,
      params
    );
    if (result.affectedRows === 0) {
      throw httpError("Usuário não encontrado.", 404);
    }
  } catch (error) {
    if (error && error.code === "ER_DUP_ENTRY") {
      throw httpError("Este nome de usuário já está em uso.", 409);
    }
    throw error;
  }
}
