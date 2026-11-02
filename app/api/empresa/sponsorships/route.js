import { jsonError, requireCompanyUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import {
  createSponsorshipRequest,
  findCompanyByUserId,
  listSponsorshipRequests,
} from "@/lib/company";

export async function GET() {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = await requireCompanyUser();
    const company = await findCompanyByUserId(user.id);
    if (!company) return jsonError("Empresa não vinculada.", 404);
    const items = await listSponsorshipRequests(company.id);
    return Response.json({ items });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}

export async function POST(request) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = await requireCompanyUser();
    const company = await findCompanyByUserId(user.id);
    if (!company) return jsonError("Empresa não vinculada.", 404);
    const body = await request.json();
    const item = await createSponsorshipRequest(company, body);
    return Response.json(
      {
        item,
        message:
          "Solicitação enviada para análise. O envio não publica o ranking.",
      },
      { status: 201 }
    );
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
