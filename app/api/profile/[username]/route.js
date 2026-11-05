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
      `SELECT u.id, u.nome_usuario, u.foto_url, u.cidade_id, u.reputacao,
              u.contagem_indicacoes_validas, u.contagem_selecionadas_avaliadas,
              c.nome AS city_name, c.estado AS city_state
       FROM usuarios u
       LEFT JOIN cidades c ON c.id = u.cidade_id
       WHERE u.nome_usuario = ? AND u.excluido_em IS NULL
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
