"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { ADMIN_GROUPS, ADMIN_MODULES, adminDate } from "@/lib/admin-catalog";
import { AdminFrame, AdminFeedback, useAdminResource } from "@/components/AdminWorkspace";

const management = [
  { group: "Premiações", href: "/admin/patrocinios", title: "Patrocínios", description: "Analisar, aprovar, rejeitar e ativar campanhas." },
  { group: "Premiações", href: "/admin/rankings/mensal", title: "Rankings mensais", description: "Períodos, cidades, campanhas e resultados mensais." },
  { group: "Premiações", href: "/admin/rankings/semanal", title: "Rankings semanais", description: "Períodos, cidades, campanhas e resultados semanais." },
];
const activityLabels = { admin_user_update: "Cadastro de usuário alterado", admin_company_update: "Cadastro de empresa alterado", create: "Registro criado", evaluate_valid: "Indicação avaliada como válida", evaluate_invalid: "Indicação avaliada como não válida", select: "Indicação selecionada", close_voluntary: "Pedido encerrado", reopen: "Pedido reaberto" };
export default function AdminDashboard() {
  const router = useRouter(), resource = useAdminResource("/api/admin/overview");
  const [previewError, setPreviewError] = useState(""), [previewLoading, setPreviewLoading] = useState("");
  async function enterPreview(mode) {
    setPreviewError(""); setPreviewLoading(mode);
    try {
      const result = await api("/api/admin/view-as", { method: "POST", body: JSON.stringify({ mode }) });
      window.dispatchEvent(new Event("goindica:auth-changed")); router.push(result.redirectTo || (mode === "company" ? "/empresa" : "/")); router.refresh();
    } catch (err) { setPreviewError(err.message); setPreviewLoading(""); }
  }
  const data = resource.data, counts = data?.counts || {};
  const modules = [...Object.entries(ADMIN_MODULES).map(([key, item]) => ({ ...item, href: `/admin/${key}` })), ...management];
  return <AdminFrame title="Visão geral" description="Administre cadastros, acompanhe a comunidade e consulte o histórico do sistema." action={<button type="button" className="pill-outline" disabled={resource.loading} onClick={resource.reload}>Atualizar dados</button>}>
    <AdminFeedback loading={resource.loading} error={resource.error} reload={resource.reload} />
    {!resource.loading && !resource.error && data ? <>
      <dl className="admin-summary-stats">{[
        ["Usuários ativos", counts.users, "/admin/usuarios"], ["Administradores", counts.admins, "/admin/usuarios?status=admin"], ["Empresas", counts.companies, "/admin/empresas"], ["Pedidos", counts.requests, "/admin/pedidos"], ["Indicações", counts.indications, "/admin/indicacoes"], ["Rankings em andamento", counts.activeRankings, "/admin/rankings"],
      ].map(([label, number, href]) => <div key={label}><dt>{label}</dt><dd><Link href={href}>{Number(number || 0).toLocaleString("pt-BR")}</Link></dd></div>)}</dl>
      <section className="admin-record-panel"><h2>Acompanhamento da operação</h2><div className="admin-attention-grid">{[
        [counts.pendingSponsorships, "Patrocínios para análise", "/admin/patrocinios"], [counts.evaluatingRequests, "Pedidos em avaliação", "/admin/pedidos?status=in_evaluation"], [counts.pendingRewards, "Prêmios aguardando resgate", "/admin/resgates?status=pending"], [counts.overdueEvaluations, "Avaliações com prazo esgotado", "/admin/pedidos?status=in_evaluation&overdue=1"],
      ].map(([number, label, href]) => <Link key={label} href={href}><strong>{Number(number || 0).toLocaleString("pt-BR")}</strong><span>{label}</span></Link>)}</div></section>
      <div className="admin-module-groups">{ADMIN_GROUPS.map(group => <section key={group} className="admin-record-panel"><h2>{group}</h2><ul className="admin-module-links">{modules.filter(item => item.group === group).map(item => <li key={item.href}><Link href={item.href}><strong>{item.title}</strong><span>{item.description}</span></Link></li>)}</ul></section>)}</div>
      <div className="admin-dashboard-bottom"><section className="admin-record-panel"><div className="admin-record-list-head"><h2>Atividade recente</h2><Link href="/admin/auditoria">Ver auditoria</Link></div>{data.recent?.length ? <ol className="admin-activity-list">{data.recent.map(item => <li key={item.id}><Link href={`/admin/auditoria/${item.id}`}><strong>{activityLabels[item.reason] || item.reason || "Operação do sistema"}</strong><span>{item.username} · {item.entityType} #{item.entityId}</span><time dateTime={item.createdAt}>{adminDate(item.createdAt)}</time></Link></li>)}</ol> : <p className="muted">Nenhuma operação registrada até o momento.</p>}</section>
        <section className="admin-record-panel"><h2>Integrações e configuração</h2><dl className="admin-integration-list"><div><dt>Banco de dados</dt><dd>Conexão ativa</dd></div><div><dt>Busca Google Places</dt><dd>{data.integrations?.places ? "Configurada" : "Não configurada"}</dd></div><div><dt>Mapa Google</dt><dd>{data.integrations?.googleMap ? "Configurado" : "Não configurado · mapa manual disponível"}</dd></div><div><dt>Proteção das rotinas agendadas</dt><dd>{data.integrations?.cronProtected ? "Configurada" : "Não configurada"}</dd></div></dl><p className="muted">Verificação em {adminDate(data.checkedAt)}. A configuração não confirma a execução das rotinas nem a disponibilidade dos serviços externos.</p></section></div>
      <section className="admin-record-panel admin-preview-section"><h2>Visualizar como outro perfil</h2><p className="muted">Veja somente as telas de usuário ou empresa e use o botão do cabeçalho para voltar à gestão completa.</p>{previewError ? <p className="error-box" role="alert">{previewError}</p> : null}<div className="admin-inline-actions"><button type="button" className="pill-outline" disabled={Boolean(previewLoading)} onClick={() => enterPreview("user")}>{previewLoading === "user" ? "Abrindo…" : "Ver como usuário"}</button><button type="button" className="pill-outline" disabled={Boolean(previewLoading)} onClick={() => enterPreview("company")}>{previewLoading === "company" ? "Abrindo…" : "Ver como empresa"}</button></div></section>
    </> : null}
  </AdminFrame>;
}
