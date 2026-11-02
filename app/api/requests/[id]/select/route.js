import { jsonError, requireUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { selectIndication } from "@/lib/requests-service";

export async function POST(request, { params }) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json();
    const result = await selectIndication(user, id, body.indicationId);
    return Response.json(result);
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
