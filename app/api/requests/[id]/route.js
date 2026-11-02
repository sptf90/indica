import { jsonError, requireUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import {
  deleteRequest,
  getRequestById,
  listRequesterChosenIndications,
  mapRequestRow,
  updateRequest,
} from "@/lib/requests-service";

export async function GET(_request, { params }) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = await requireUser();
    const { id } = await params;
    const row = await getRequestById(id);
    if (!row) return jsonError("Pedido não encontrado.", 404);
    if (row.requester_id !== user.id) return jsonError("Sem permissão.", 403);
    const chosenIndications = await listRequesterChosenIndications(id);
    return Response.json({
      item: mapRequestRow(row, { includeRequester: true }),
      chosenIndications,
    });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}

export async function PATCH(request, { params }) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json();
    const item = await updateRequest(user, id, body);
    return Response.json({ item });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}

export async function DELETE(_request, { params }) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = await requireUser();
    const { id } = await params;
    await deleteRequest(user, id);
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
