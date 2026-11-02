import { jsonError, publicProfile, requireUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { canViewPublicProfile } from "@/lib/profile";

/**
 * Perfil contextual público: reputação atual, sem histórico.
 * Sem diretório/busca — só lookup com autorização de origem (RF-PER-08/10).
 */
export async function GET(_request, { params }) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const viewer = await requireUser();
    const { username } = await params;
    const handle = String(username || "").trim();
    if (!handle) return jsonError("Username obrigatório.", 400);

    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.photo_url, u.city_id, u.reputation,
              u.valid_indication_count, u.selected_and_evaluated_count,
              c.name AS city_name, c.state AS city_state
       FROM users u
       LEFT JOIN cities c ON c.id = u.city_id
       WHERE u.username = ? AND u.deleted_at IS NULL
       LIMIT 1`,
      [handle]
    );
    if (!rows[0]) return jsonError("Usuário não encontrado.", 404);

    const target = rows[0];
    const allowed = await canViewPublicProfile(viewer.id, target.id);
    if (!allowed) {
      return jsonError(
        "Você não tem permissão para ver este perfil. O acesso é só a partir de uma interação autorizada.",
        403
      );
    }

    return Response.json({ profile: publicProfile(target) });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
