import { jsonError, requireCompanyUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { findCompanyByUserId, listAvailableSponsorshipSlots } from "@/lib/company";

export async function GET() {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = await requireCompanyUser();
    const company = await findCompanyByUserId(user.id);
    if (!company) return jsonError("Empresa não vinculada.", 404);
    const items = await listAvailableSponsorshipSlots({
      companyId: company.id,
    });
    return Response.json({ items });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
