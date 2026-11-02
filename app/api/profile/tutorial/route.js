import {
  findUserById,
  isCompanyAccount,
  jsonError,
  publicUser,
  requireUser,
} from "@/lib/auth";
import { getPool } from "@/lib/db";

export async function PATCH(request) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    return jsonError(err.message || "Não autenticado.", err.status || 401);
  }

  if (isCompanyAccount(user)) {
    return jsonError("Tutorial disponível só para contas pessoais.", 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("JSON inválido.");
  }

  const completed = Boolean(body?.completed);
  const pool = getPool();
  if (!pool) return jsonError("Base de dados indisponível.", 503);

  try {
    if (completed) {
      await pool.query(
        `UPDATE users
         SET tutorial_completed_at = UTC_TIMESTAMP()
         WHERE id = ? AND deleted_at IS NULL`,
        [user.id]
      );
    } else {
      await pool.query(
        `UPDATE users
         SET tutorial_completed_at = NULL
         WHERE id = ? AND deleted_at IS NULL`,
        [user.id]
      );
    }
  } catch (err) {
    if (err && err.code === "ER_BAD_FIELD_ERROR") {
      return jsonError(
        "Coluna tutorial_completed_at em falta. Corra npm run db:migrate-tutorial.",
        503
      );
    }
    throw err;
  }

  const fresh = (await findUserById(user.id)) || user;
  return Response.json({
    ok: true,
    tutorialCompleted: Boolean(fresh.tutorial_completed_at),
    user: publicUser(fresh),
  });
}
