import { jsonError, requireCompanyUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import {
  confirmRewardRedemption,
  findAccessibleCompanyForUser,
} from "@/lib/company";

export async function POST(_request, { params }) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = await requireCompanyUser();
    const company = await findAccessibleCompanyForUser(user);
    if (!company) return jsonError("Empresa não vinculada.", 404);
    const id = Number((await params).id);
    if (!id) return jsonError("Resgate inválido.", 400);
    const item = await confirmRewardRedemption(company.id, id);
    return Response.json({
      item,
      message: "Resgate confirmado. Lembretes encerrados.",
    });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
