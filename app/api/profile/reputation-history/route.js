import { jsonError, requireUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { listReputationHistory } from "@/lib/reputation";

/** Histórico privado de reputação — só o dono. */
export async function GET(request) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");
    const items = await listReputationHistory(user.id, {
      limit: limit ? Number(limit) : 50,
    });
    return Response.json({ items });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
