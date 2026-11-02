import { jsonError, requireUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { listComparisonIndications } from "@/lib/requests-service";

export async function GET(_request, { params }) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = await requireUser();
    const { id } = await params;
    const data = await listComparisonIndications(user, id);
    return Response.json(data);
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
