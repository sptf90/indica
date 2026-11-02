import { getPool } from "@/lib/db";
import {
  hashPassword,
  jsonError,
  publicUser,
  validateRegisterInput,
  findUserById,
} from "@/lib/auth";
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
  const cityId = Number(body.cityId);

  const errors = validateRegisterInput({ username, email, password, cityId });
  if (errors.length) return jsonError(errors[0], 400, { errors });

  const pool = getPool();
  const [cities] = await pool.query(`SELECT id FROM cities WHERE id = ? LIMIT 1`, [
    cityId,
  ]);
  if (!cities[0]) return jsonError("Cidade inválida.");

  const passwordHash = await hashPassword(password);
  try {
    let insertId = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const shareCode = generateShareCode();
      try {
        const [result] = await pool.query(
          `INSERT INTO users (username, email, password_hash, city_id, share_code)
           VALUES (?, ?, ?, ?, ?)`,
          [username, email, passwordHash, cityId, shareCode]
        );
        insertId = result.insertId;
        break;
      } catch (error) {
        if (error && error.code === "ER_DUP_ENTRY") {
          if (String(error.message || "").includes("share_code")) continue;
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
