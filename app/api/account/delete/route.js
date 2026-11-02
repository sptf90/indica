import { deleteAccountImmediate } from "@/lib/account-deletion";
import { jsonError, requireUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { clearSessionCookie } from "@/lib/session";

/**
 * POST /api/account/delete
 * Body: { password: string }  — PIN numérico (mín. 6)
 * Opcional futuro: { googleToken } — GOOGLE_OAUTH_INTEGRATION_POINT
 */
export async function POST(request) {
  if (!getPool()) return jsonError("Banco não configurado.", 503);

  let user;
  try {
    user = await requireUser();
  } catch (err) {
    return jsonError(err.message || "Não autenticado", err.status || 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("JSON inválido.");
  }

  const password = body?.password != null ? String(body.password) : "";
  const googleToken =
    body?.googleToken != null ? String(body.googleToken) : undefined;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent") || null;

  try {
    const result = await deleteAccountImmediate(user.id, {
      password,
      googleToken,
      ip,
      userAgent,
    });
    await clearSessionCookie();
    return Response.json({
      ok: true,
      message: "Conta excluída definitivamente.",
      label: result.label,
      closedRequestsCount: result.closedRequestsCount,
      frozenRankingsCount: result.frozenRankingsCount,
    });
  } catch (err) {
    return jsonError(err.message || "Falha ao excluir conta.", err.status || 500);
  }
}
