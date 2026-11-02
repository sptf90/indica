import { requireUser, jsonError } from "@/lib/auth";
import { getPool } from "@/lib/db";
import {
  CATEGORY_LABELS,
  listNotifications,
  NOTIFICATION_CATEGORIES,
} from "@/lib/notifications";

export async function GET(request) {
  try {
    const user = await requireUser();
    if (!getPool()) return jsonError("Banco não configurado.", 503);

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const unreadOnly = searchParams.get("unread") === "1";
    const limit = Number(searchParams.get("limit") || 50);

    if (category && !NOTIFICATION_CATEGORIES.includes(category)) {
      return jsonError("Categoria inválida.", 400);
    }

    const data = await listNotifications(user.id, {
      category: category || null,
      unreadOnly,
      limit,
    });

    return Response.json({
      ...data,
      categories: NOTIFICATION_CATEGORIES.map((id) => ({
        id,
        label: CATEGORY_LABELS[id],
        unread: data.unreadByCategory[id] || 0,
      })),
    });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
