import { jsonError, requireUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import {
  deleteIndication,
  getMyIndicationDetail,
  updateIndication,
} from "@/lib/indications-service";

export async function GET(_request, { params }) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = await requireUser();
    const { id } = await params;
    const item = await getMyIndicationDetail(user.id, id);
    return Response.json({ item });
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
    await updateIndication(user, id, body);
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}

export async function DELETE(_request, { params }) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = await requireUser();
    const { id } = await params;
    await deleteIndication(user, id);
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
