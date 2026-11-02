import { requireUser, jsonError } from "@/lib/auth";
import { getPool } from "@/lib/db";
import {
  markAllNotificationsRead,
  NOTIFICATION_CATEGORIES,
} from "@/lib/notifications";

export async function POST(request) {
  try {
    const user = await requireUser();
    if (!getPool()) return jsonError("Banco não configurado.", 503);

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const category = body.category || null;
    if (category && !NOTIFICATION_CATEGORIES.includes(category)) {
      return jsonError("Categoria inválida.", 400);
    }

    const result = await markAllNotificationsRead(user.id, category);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
