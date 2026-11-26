import { assertConsumerUser, jsonError, requireUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { REQUEST_ACCEPTS_RESPONSES_SQL, REQUEST_VIEWER_INDICATED_SQL } from "@/lib/request-visibility";

export async function GET(_request, { params }) {
  try {
    const pool = getPool();
    if (!pool) return jsonError("Banco não configurado.", 503);
    const user = assertConsumerUser(await requireUser());
    const id = Number((await params).id);
    if (!Number.isSafeInteger(id) || id < 1) return jsonError("Pedido inválido.");

    const [[photo]] = await pool.query(
      `SELECT f.tipo, f.conteudo FROM pedido_fotos f
       JOIN pedidos r ON r.id = f.pedido_id
       WHERE r.id = ? AND r.excluido_em IS NULL
         AND (r.solicitante_id = ? OR (${REQUEST_ACCEPTS_RESPONSES_SQL}) OR ${REQUEST_VIEWER_INDICATED_SQL})`,
      [id, user.id, user.id]
    );
    if (!photo) return jsonError("Foto não encontrada.", 404);

    return new Response(photo.conteudo, {
      headers: {
        "Content-Type": photo.tipo,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return jsonError(error.message || "Não foi possível abrir a foto.", error.status || 500);
  }
}
