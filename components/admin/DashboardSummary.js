import Link from "next/link";

const metrics = [
  { key: "users", label: "Usuários ativos", href: "/admin/usuarios", detail: "Cadastros da comunidade" },
  { key: "requests", label: "Pedidos", href: "/admin/pedidos", detail: "Pedidos não excluídos" },
  { key: "indications", label: "Indicações", href: "/admin/indicacoes", detail: "Contribuições recebidas" },
  { key: "activeRankings", label: "Rankings em andamento", href: "/admin/rankings", detail: "Períodos abertos agora" },
];

export default function DashboardSummary({ counts }) {
  return (
    <section aria-label="Resumo da comunidade">
      <dl className="admin-summary-stats">
        {metrics.map(metric => (
          <div key={metric.key}>
            <dt>{metric.label}</dt>
            <dd><Link href={metric.href} aria-label={`${metric.label}: ${Number(counts[metric.key] || 0).toLocaleString("pt-BR")}`}>{Number(counts[metric.key] || 0).toLocaleString("pt-BR")}</Link></dd>
            <dd className="admin-metric-detail">{metric.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
