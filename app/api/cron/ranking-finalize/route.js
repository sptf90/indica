import { jsonError } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { processRankingLifecycleNotifications } from "@/lib/notifications";

/**
 * open→tallying ao fim do período; tallying→final após 36h de apuração.
 * Notifica inscritos na classificação final (§5.6).
 */
export async function POST(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return jsonError("CRON_SECRET não configurado.", 503);

  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const headerSecret = request.headers.get("x-cron-secret") || "";
  if (token !== secret && headerSecret !== secret) {
    return jsonError("Não autorizado.", 401);
  }

  if (!getPool()) return jsonError("Banco não configurado.", 503);

  const result = await processRankingLifecycleNotifications();
  return Response.json({ ok: true, ...result });
}
