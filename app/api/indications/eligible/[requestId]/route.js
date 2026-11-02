import { jsonError, requireUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { getEligibleRequestDetail } from "@/lib/indications-service";

export async function GET(_request, { params }) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = await requireUser();
    const { requestId } = await params;
    const item = await getEligibleRequestDetail(user, requestId);
    return Response.json({ item });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
