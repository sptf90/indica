import { isCompanyAccount, requireUser, jsonError } from "@/lib/auth";
import { findCompanyByUserId } from "@/lib/company";
import {
  buildPrizeContext,
  getRankingById,
  getStandings,
} from "@/lib/rankings";

export async function GET(_request, { params }) {
  try {
    const user = await requireUser();
    const rankingId = Number((await params).id);
    if (!rankingId) return jsonError("Ranking inválido.", 400);

    const data = await getStandings(rankingId, { userId: user.id });
    if (!data) return jsonError("Ranking não encontrado.", 404);

    const company = isCompanyAccount(user)
      ? await findCompanyByUserId(user.id)
      : null;

    const ranking = await getRankingById(rankingId, user.id, {
      // Empresa pode ver a própria campanha antes do início do período.
      requireVisible: !company,
    });
    if (!ranking) return jsonError("Ranking não encontrado.", 404);

    if (company) {
      if (Number(ranking.sponsorCompanyId) !== Number(company.id)) {
        return jsonError(
          "Conta empresarial só acessa o ranking da própria campanha.",
          403
        );
      }
    }

    const myRow = data.standings.find((s) => s.userId === user.id) || null;
    const prize = buildPrizeContext(
      ranking,
      myRow ? myRow.position : null
    );

    return Response.json({
      ranking: {
        ...ranking,
        myPosition: myRow ? myRow.position : null,
        prize,
      },
      standings: data.standings,
      me: myRow
        ? {
            ...myRow,
            inPrizeBand: prize.inPrizeBand,
            provisionalMessage: prize.provisionalMessage,
            prizeBenefit: prize.prizeBenefit,
            redemptionInstructions: prize.redemptionInstructions,
          }
        : null,
      prize,
    });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
