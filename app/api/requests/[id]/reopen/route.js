import { jsonError, requireUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { reopenRequest } from "@/lib/requests-service";

export async function POST(_request, { params }) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = await requireUser();
    const { id } = await params;
    const item = await reopenRequest(user, id);
    return Response.json({ item });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
