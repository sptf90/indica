import { jsonError, requireAdminUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { approveSponsorshipRequest } from "@/lib/company";

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
    const item = await approveSponsorshipRequest(requestId, { note });
    return Response.json({
      item,
      message: "Solicitação aprovada. Campanha preparada no ranking (envio ≠ publicação).",
    });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
