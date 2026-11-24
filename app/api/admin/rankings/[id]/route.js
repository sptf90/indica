import { requireManagementAdmin } from "@/lib/admin-auth";
import { jsonError } from "@/lib/auth";
import { deleteRanking } from "@/lib/rankings";

export async function DELETE(_request, { params }) {
  try {
    const admin = await requireManagementAdmin();
    const rankingId = Number((await params).id);
    if (!Number.isSafeInteger(rankingId) || rankingId < 1) {
      return jsonError("Ranking inválido.", 400);
    }
    await deleteRanking(rankingId, admin.id);
    return Response.json({ message: "Ranking excluído." });
  } catch (error) {
    return jsonError(error.message || "Não foi possível excluir o ranking.", error.status || 500);
  }
}
