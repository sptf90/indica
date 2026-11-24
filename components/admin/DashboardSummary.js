import Link from "next/link";
import NavIcon from "@/components/NavIcon";

const metrics = [
  { key: "users", label: "Usuários ativos", href: "/admin/usuarios", icon: "user" },
  { key: "requests", label: "Pedidos", href: "/admin/pedidos", icon: "orders" },
  { key: "indications", label: "Indicações", href: "/admin/indicacoes", icon: "sent" },
  { key: "activeRankings", label: "Rankings em andamento", href: "/admin/rankings", icon: "rank" },
];

export default function DashboardSummary({ counts }) {
  return (
    <section aria-label="Resumo da comunidade">
      <dl className="admin-summary-stats">
        {metrics.map(metric => {
          const count = Number(counts[metric.key] || 0).toLocaleString("pt-BR");
          return (
            <div key={metric.key}>
              <dt><span className="admin-overview-icon"><NavIcon name={metric.icon} /></span>{metric.label}</dt>
              <dd>
                <Link href={metric.href} aria-label={`${metric.label}: ${count}`}>
                  {count}
                  <span aria-hidden="true">↗</span>
                </Link>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
