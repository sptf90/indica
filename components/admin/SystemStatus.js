import { adminDate } from "@/lib/admin-catalog";

const integrations = [
  { key: "database", label: "Banco de dados", ok: "Conexão ativa", missing: "Conexão indisponível" },
  { key: "places", label: "Busca Google Places", ok: "Configurada", missing: "Não configurada" },
  { key: "googleMap", label: "Mapa Google", ok: "Configurado", missing: "Não configurado · mapa manual disponível" },
  { key: "cronProtected", label: "Proteção das rotinas agendadas", ok: "Configurada", missing: "Não configurada" },
];

export default function SystemStatus({ status, checkedAt }) {
  return (
    <section className="admin-record-panel" aria-labelledby="admin-integrations-heading">
      <h2 id="admin-integrations-heading">Integrações e configuração</h2>
      <dl className="admin-system-status">
        {integrations.map(item => <div key={item.key}><dt>{item.label}</dt><dd><span className={`admin-system-indicator${status[item.key] ? " is-configured" : ""}`} aria-hidden="true" />{status[item.key] ? item.ok : item.missing}</dd></div>)}
      </dl>
      <p className="admin-section-caption">Verificação em {adminDate(checkedAt)}. A presença de configuração não confirma a disponibilidade dos serviços externos nem a execução das rotinas.</p>
    </section>
  );
}
