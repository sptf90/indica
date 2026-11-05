import {
  normalizeAdminViewMode,
  setAdminViewCookie,
} from "@/lib/admin-view";
import {
  jsonError,
  publicUser,
  requireAdminUser,
  withAdminView,
  findUserById,
} from "@/lib/auth";
import { ensureAdminPreviewCompany } from "@/lib/company";
import { getPool } from "@/lib/db";

export async function POST(request) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = await requireAdminUser();

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError("JSON inválido.");
    }

    const mode = normalizeAdminViewMode(body.mode);
    if (mode === "company") {
      await ensureAdminPreviewCompany(user);
    }

    await setAdminViewCookie(mode);
    const fresh = await withAdminView(await findUserById(user.id));
    const pub = publicUser(fresh);
    const redirectTo =
      mode === "company" ? "/empresa" : mode === "user" ? "/" : "/admin";

    return Response.json({
      ok: true,
      user: pub,
      viewAs: pub.viewAs,
      redirectTo,
    });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
