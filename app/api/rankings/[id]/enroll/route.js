import { assertConsumerUser, requireUser, jsonError } from "@/lib/auth";
import { enrollInRanking, getRankingById } from "@/lib/rankings";

export async function POST(_request, { params }) {
  try {
    const user = assertConsumerUser(await requireUser());
    const rankingId = Number((await params).id);
    if (!rankingId) return jsonError("Ranking inválido.", 400);

    const result = await enrollInRanking(user.id, rankingId);
    const ranking = await getRankingById(rankingId, user.id);

    return Response.json({
      ok: true,
      enrollment: result,
      ranking,
      message: "Inscrição confirmada. É definitiva neste período.",
    });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
