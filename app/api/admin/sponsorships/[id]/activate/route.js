import { jsonError, requireAdminUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { activateSponsorshipRequest } from "@/lib/company";

export async function POST(request, { params }) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    await requireAdminUser();
    const { id } = await params;
    const requestId = Number(id);
    if (!requestId) return jsonError("ID inválido.");
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const note = body.note != null ? String(body.note) : undefined;
    const item = await activateSponsorshipRequest(requestId, { note });
    return Response.json({
      item,
      message:
        "Campanha activada no ranking (reutiliza seed de approve; futuro permanece oculto até o período).",
    });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
