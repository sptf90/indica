import { assertConsumerUser, jsonError, requireUser } from "@/lib/auth";
import { setRequestHidden } from "@/lib/indications-service";

async function updateVisibility(params, hidden) {
  try {
    const user = assertConsumerUser(await requireUser());
    const id = Number((await params).requestId);
    if (!Number.isSafeInteger(id) || id < 1) return jsonError("Pedido inválido.");

    await setRequestHidden(user.id, id, hidden);
    return Response.json({ hidden });
  } catch (error) {
    return jsonError(error.message || "Não foi possível atualizar o pedido.", error.status || 500);
  }
}

export function PUT(_request, { params }) {
  return updateVisibility(params, true);
}

export function DELETE(_request, { params }) {
  return updateVisibility(params, false);
}
