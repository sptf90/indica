import Link from "next/link";
import NavIcon from "@/components/NavIcon";
import { adminDate } from "@/lib/admin-catalog";

const activityLabels = {
  admin_ranking_delete: "Ranking excluído",
  admin_user_update: "Cadastro de usuário alterado", admin_company_update: "Cadastro de empresa alterado",
  create: "Registro criado", evaluate_valid: "Indicação válida", equivalent_valid: "Validação por equivalência",
  evaluate_invalid: "Indicação não válida", select: "Indicação selecionada", close_voluntary: "Pedido encerrado", reopen: "Pedido reaberto",
};
const entityLabels = { user: "Usuário", company: "Empresa", request: "Pedido", indication: "Indicação", ranking: "Ranking" };

export default function RecentActivity({ items = [] }) {
  return (
    <section className="admin-record-panel" aria-labelledby="admin-activity-heading">
      <div className="admin-record-list-head"><h2 id="admin-activity-heading">Atividade recente</h2><Link href="/admin/auditoria">Ver histórico</Link></div>
      {items.length ? (
        <ol className="admin-activity-list">
          {items.map(item => (
            <li key={item.id}>
              <Link href={`/admin/auditoria/${item.id}`}>
                <strong>{activityLabels[item.reason] || item.reason || "Operação do sistema"}</strong>
                <span>{item.username} · {entityLabels[item.entityType] || item.entityType} #{item.entityId}</span>
                <time dateTime={item.createdAt}>{adminDate(item.createdAt)}</time>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="admin-task-empty">
          <span className="admin-overview-icon"><NavIcon name="orders" /></span>
          <strong>Nenhuma atividade registrada</strong>
        </div>
      )}
    </section>
  );
}
