import { setAdminViewCookie } from "@/lib/admin-view";
import { getPool } from "@/lib/db";
import {
  findUserById,
  isRealAdminAccount,
  jsonError,
  publicUser,
  verifyPassword,
  withAdminView,
} from "@/lib/auth";
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
    `SELECT id, senha_hash, excluido_em FROM usuarios
     WHERE (email = ? OR LOWER(nome_usuario) = ?) AND excluido_em IS NULL
     LIMIT 1`,
    [login, login]
  );
  const row = rows[0];
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return jsonError("Credenciais inválidas.", 401);
  }

  await setSessionCookie(row.id);
  const user = await findUserById(row.id);
  if (isRealAdminAccount(user)) {
    await setAdminViewCookie("admin");
  }
  return Response.json({ user: publicUser(await withAdminView(user)) });
}
