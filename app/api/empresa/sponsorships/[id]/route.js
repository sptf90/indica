import { jsonError, requireCompanyUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import {
  findCompanyByUserId,
  updateSponsorshipRequest,
} from "@/lib/company";

export async function PATCH(request, { params }) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = await requireCompanyUser();
    const company = await findCompanyByUserId(user.id);
    if (!company) return jsonError("Empresa não vinculada.", 404);

    const id = Number((await params).id);
    if (!id) return jsonError("ID inválido.", 400);

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError("JSON inválido.");
    }

    const item = await updateSponsorshipRequest(company, id, body);
    return Response.json({
      item,
      message:
        item.status === "approved"
          ? "Solicitação atualizada e campanha sincronizada no ranking."
          : "Solicitação atualizada.",
    });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
