import Link from "next/link";
import NavIcon from "@/components/NavIcon";

const queues = [
  { key: "overdueEvaluations", label: "Avaliações com prazo esgotado", description: "Consulte os pedidos cujo prazo de avaliação terminou.", href: "/admin/pedidos?status=in_evaluation&overdue=1", urgent: true },
  { key: "pendingSponsorships", label: "Patrocínios para análise", description: "Revise as solicitações de patrocínio.", href: "/admin/patrocinios" },
  { key: "evaluatingRequests", label: "Pedidos em avaliação", description: "Acompanhe as indicações que estão sendo testadas.", href: "/admin/pedidos?status=in_evaluation" },
  { key: "pendingRewards", label: "Prêmios aguardando resgate", description: "Consulte os benefícios disponíveis para os contemplados.", href: "/admin/resgates?status=pending" },
];

export default function DashboardTasks({ counts }) {
  const pending = queues.filter(queue => Number(counts[queue.key]) > 0);
  return (
    <section className="admin-record-panel" aria-labelledby="admin-tasks-heading">
      <div className="admin-record-list-head"><h2 id="admin-tasks-heading">Pendências da operação</h2></div>
      {pending.length ? (
        <ul className="admin-task-list">
          {pending.map(queue => (
            <li key={queue.key}>
              <Link href={queue.href} className={queue.key === "pendingSponsorships" ? "admin-task-sponsorship" : queue.urgent ? "admin-task-urgent" : undefined}>
                <span className="admin-task-description"><strong>{queue.label}</strong><span>{queue.description}</span></span>
                <span className="admin-task-count">{Number(counts[queue.key]).toLocaleString("pt-BR")}</span>
                {queue.key === "pendingSponsorships" ? (
                  <span className="admin-task-review">Revisar</span>
                ) : (
                  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><path d="m7 4 6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="admin-task-empty">
          <span className="admin-overview-icon"><NavIcon name="check" /></span>
          <div><strong>Nenhuma pendência no momento</strong><p><Link href="/admin/patrocinios">Consultar patrocínios</Link></p></div>
        </div>
      )}
    </section>
  );
}
