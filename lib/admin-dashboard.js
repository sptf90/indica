import { getPool } from "./db";
import { fromMysqlDatetime } from "./time";
import { isPlacesConfigured } from "./google-places";

function pool() {
  const db = getPool();
  if (!db) throw Object.assign(new Error("Banco não configurado."), { status: 503 });
  return db;
}

function iso(value) {
  return value ? fromMysqlDatetime(value).toISOString() : null;
}

export async function adminOverview() {
  const db = pool();
  const [[counts], [recent]] = await Promise.all([
    db.query(`SELECT
      (SELECT COUNT(*) FROM usuarios WHERE excluido_em IS NULL) AS users,
      (SELECT COUNT(*) FROM usuarios WHERE eh_admin=1 AND tipo_conta='user' AND excluido_em IS NULL) AS admins,
      (SELECT COUNT(*) FROM empresas) AS companies,
      (SELECT COUNT(*) FROM pedidos WHERE excluido_em IS NULL) AS requests,
      (SELECT COUNT(*) FROM pedidos WHERE status='open' AND excluido_em IS NULL) AS openRequests,
      (SELECT COUNT(*) FROM pedidos WHERE status='in_evaluation' AND excluido_em IS NULL) AS evaluatingRequests,
      (SELECT COUNT(*) FROM pedidos WHERE status='in_evaluation' AND avaliacao_prazo_em<UTC_TIMESTAMP() AND excluido_em IS NULL) AS overdueEvaluations,
      (SELECT COUNT(*) FROM indicacoes WHERE excluido_em IS NULL) AS indications,
      (SELECT COUNT(*) FROM indicacoes WHERE status='valid' AND excluido_em IS NULL) AS validIndications,
      (SELECT COUNT(*) FROM solicitacoes_patrocinio WHERE status IN ('submitted','under_review','awaiting_correction')) AS pendingSponsorships,
      (SELECT COUNT(*) FROM ranking_premios WHERE status='pending' AND expira_em>UTC_TIMESTAMP()) AS pendingRewards,
      (SELECT COUNT(*) FROM rankings WHERE status='open' AND periodo_inicio<=UTC_TIMESTAMP() AND periodo_fim>UTC_TIMESTAMP()) AS activeRankings,
      (SELECT COUNT(*) FROM cidades) AS cities`),
    db.query("SELECT a.id,a.tipo_entidade AS entityType,a.entidade_id AS entityId,a.motivo AS reason,DATE_FORMAT(a.criado_em,'%Y-%m-%dT%H:%i:%sZ') AS createdAt,COALESCE(u.nome_usuario,'Sistema') AS username FROM eventos_auditoria a LEFT JOIN usuarios u ON u.id=a.ator_id ORDER BY a.criado_em DESC,a.id DESC LIMIT 8"),
  ]);
  return { counts: Object.fromEntries(Object.entries(counts[0]).map(([key, value]) => [key, Number(value)])), recent: recent.map(row => ({ ...row, createdAt: iso(row.createdAt) })), checkedAt: new Date().toISOString() };
}

export async function adminSystemStatus() {
  await pool().query("SELECT 1");
  return {
    integrations: {
      database: true,
      places: isPlacesConfigured(),
      googleMap: Boolean(process.env.GOOGLE_MAPS_BROWSER_API_KEY?.trim()),
      cronProtected: Boolean(process.env.CRON_SECRET?.trim()),
    },
    checkedAt: new Date().toISOString(),
  };
}
