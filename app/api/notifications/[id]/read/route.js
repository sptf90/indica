import { requireUser, jsonError } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { markNotificationRead } from "@/lib/notifications";

export async function POST(_request, { params }) {
  try {
    const user = await requireUser();
    if (!getPool()) return jsonError("Banco não configurado.", 503);

    const { id } = await params;
    const notificationId = Number(id);
    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      return jsonError("Notificação inválida.", 400);
    }

    const result = await markNotificationRead(user.id, notificationId);
    if (!result.ok) return jsonError("Notificação não encontrada.", 404);
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
