import { getPool } from "@/lib/db";
import { findUserById, jsonError, publicUser, verifyPassword } from "@/lib/auth";
import { setSessionCookie } from "@/lib/session";

export async function POST(request) {
  if (!getPool()) return jsonError("Banco não configurado.", 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("JSON inválido.");
  }

  const login = String(body.login || body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!login || !password) return jsonError("Informe e-mail/username e senha.");

  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, password_hash, deleted_at FROM users
     WHERE (email = ? OR LOWER(username) = ?) AND deleted_at IS NULL
     LIMIT 1`,
    [login, login]
  );
  const row = rows[0];
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return jsonError("Credenciais inválidas.", 401);
  }

  await setSessionCookie(row.id);
  const user = await findUserById(row.id);
  return Response.json({ user: publicUser(user) });
}
