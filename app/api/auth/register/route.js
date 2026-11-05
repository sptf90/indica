import { getPool } from "@/lib/db";
import {
  hashPassword,
  jsonError,
  publicUser,
  validateRegisterInput,
  findUserById,
} from "@/lib/auth";
import { ensureCity } from "@/lib/cities";
import { setSessionCookie } from "@/lib/session";
import { generateShareCode } from "@/lib/share-links";

export async function POST(request) {
  if (!getPool()) return jsonError("Banco não configurado.", 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("JSON inválido.");
  }

  const username = String(body.username || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const cityName = String(body.cityName || "").trim();
  const state = String(body.state || "")
    .trim()
    .toUpperCase();
  let cityId =
    body.cityId != null && body.cityId !== "" ? Number(body.cityId) : null;

  const errors = validateRegisterInput({
    username,
    email,
    password,
    cityId,
    cityName,
    state,
  });
  if (errors.length) return jsonError(errors[0], 400, { errors });

  const pool = getPool();

  try {
    if (cityName && state) {
      cityId = await ensureCity(pool, { name: cityName, state });
    } else {
      const [cities] = await pool.query(
        `SELECT id FROM cidades WHERE id = ? LIMIT 1`,
        [cityId]
      );
      if (!cities[0]) return jsonError("Cidade inválida.");
      cityId = Number(cities[0].id);
    }
  } catch (error) {
    return jsonError(error.message || "Cidade inválida.", error.status || 400);
  }

  const passwordHash = await hashPassword(password);
  try {
    let insertId = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const shareCode = generateShareCode();
      try {
        const [result] = await pool.query(
          `INSERT INTO usuarios (nome_usuario, email, senha_hash, cidade_id, codigo_compartilhamento)
           VALUES (?, ?, ?, ?, ?)`,
          [username, email, passwordHash, cityId, shareCode]
        );
        insertId = result.insertId;
        break;
      } catch (error) {
        if (error && error.code === "ER_DUP_ENTRY") {
          if (String(error.message || "").includes("codigo_compartilhamento")) continue;
          return jsonError("Username ou e-mail já cadastrado.", 409);
        }
        throw error;
      }
    }
    if (!insertId) return jsonError("Falha ao criar conta.", 500);
    await setSessionCookie(insertId);
    const user = await findUserById(insertId);
    return Response.json({ user: publicUser(user) }, { status: 201 });
  } catch (error) {
    if (error && error.code === "ER_DUP_ENTRY") {
      return jsonError("Username ou e-mail já cadastrado.", 409);
    }
    throw error;
  }
}
