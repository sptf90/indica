import { assertConsumerUser, jsonError, requireUser } from "@/lib/auth";
import { getPool } from "@/lib/db";

export async function GET(_request, { params }) {
  try {
    const pool = getPool();
    if (!pool) return jsonError("Banco não configurado.", 503);
    await requireUser().then(assertConsumerUser);
    const id = Number((await params).id);
    if (!Number.isSafeInteger(id) || id < 1) return jsonError("Pedido inválido.");

    const [[photo]] = await pool.query(
      `SELECT f.tipo, f.conteudo FROM pedido_fotos f
       JOIN pedidos p ON p.id = f.pedido_id
       WHERE p.id = ? AND p.excluido_em IS NULL`,
      [id]
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
