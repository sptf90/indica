"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminModule, adminDate } from "@/lib/admin-catalog";
import { AdminFrame, AdminFeedback, useAdminResource } from "@/components/AdminWorkspace";

export default function AdminRecords({ section, initialFilters = {} }) {
  const meta = adminModule(section), router = useRouter();
  const params = new URLSearchParams(Object.entries(initialFilters).filter(([, value]) => typeof value === "string"));
  const { data, loading, error, reload } = useAdminResource(`/api/admin/data/${section}?${params}`);
  const [query, setQuery] = useState(params.get("q") || "");
  const [status, setStatus] = useState(params.get("status") || "all");
  const [from, setFrom] = useState(params.get("from") || ""), [to, setTo] = useState(params.get("to") || "");
  const overdue = params.get("overdue") === "1";
  const relational = [...params.keys()].some(key => /Id$|^entityType$/.test(key));
  function submit(event) {
    event.preventDefault(); const next = new URLSearchParams(params);
    for (const [key, value] of [["q", query.trim()], ["status", status === "all" ? "" : status], ["from", from], ["to", to]]) { if (value) next.set(key, value); else next.delete(key); }
    next.delete("page"); router.push(`/admin/${section}?${next}`);
  }
  function pageLink(page) { const next = new URLSearchParams(params); next.set("page", String(page)); return `/admin/${section}?${next}`; }
  return <AdminFrame title={meta.title} description={meta.description}>
    <form className="admin-record-filters" onSubmit={submit} aria-label={`Filtros de ${meta.title.toLowerCase()}`}>
      <label className="admin-record-search">Buscar<input type="search" value={query} maxLength={160} onChange={event => setQuery(event.target.value)} placeholder={meta.search} /></label>
      {meta.statuses.length > 1 ? <label>Situação<select value={status} onChange={event => setStatus(event.target.value)}>{meta.statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : null}
      <label>De<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
      <label>Até<input type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} /></label>
      <div className="admin-filter-actions"><button type="submit" className="pill-cta">Filtrar</button><Link href={`/admin/${section}`} className="ghost-link">Limpar filtros</Link></div>
    </form>
    <p className="admin-period-note">Filtros de data e horários no fuso de Brasília.</p>
    {relational || overdue ? <p className="admin-context-notice">{overdue ? "Mostrando avaliações com prazo esgotado." : "Mostrando registros vinculados ao cadastro de origem."} <Link href={`/admin/${section}`}>Ver todos os registros</Link></p> : null}
    <AdminFeedback loading={loading} error={error} reload={reload} />
    {!loading && !error && data ? <section className="admin-record-list" aria-label={`Lista de ${meta.title.toLowerCase()}`}>
      <div className="admin-record-list-head"><p role="status"><strong>{data.pagination.total.toLocaleString("pt-BR")}</strong> registro{data.pagination.total === 1 ? "" : "s"} encontrado{data.pagination.total === 1 ? "" : "s"}</p><button type="button" className="ghost-link" onClick={reload}>Atualizar</button></div>
      {data.items.length ? <><p className="admin-table-hint">Deslize a tabela para ver as demais colunas.</p><div className="admin-table-scroll" tabIndex={0} role="region" aria-label="Tabela com rolagem horizontal quando necessário"><table className="admin-data-table"><caption className="sr-only">{meta.title} — página {data.pagination.page}</caption><thead><tr>{meta.columns.map(([key, label]) => <th key={key} scope="col">{label}</th>)}<th scope="col">Ações</th></tr></thead><tbody>{data.items.map(row => <tr key={row.id}>{meta.columns.map(([key, label, format], index) => <td key={key} data-label={label}>{index === 0 ? <><Link href={`/admin/${section}/${row.id}`}>{String(row[key] ?? "—")}</Link><small>#{row.id}{row.subtitle ? ` · ${row.subtitle}` : ""}</small></> : format === "date" ? adminDate(row[key]) : key === "statusLabel" ? <span className="admin-status">{row[key]}</span> : String(row[key] ?? "—")}</td>)}<td><Link href={`/admin/${section}/${row.id}`} className="ghost-link">Detalhes<span className="sr-only"> de {meta.singular.toLowerCase()} #{row.id}</span></Link></td></tr>)}</tbody></table></div></> : <div className="admin-console-state"><h2>Nenhum registro encontrado</h2><p>{data.pagination.total > 0 ? "Esta página não tem registros. Volte à primeira página." : "Altere os filtros ou volte a esta área quando houver novos registros."}</p><Link href={pageLink(1)} className="ghost-link">Primeira página</Link></div>}
      <nav className="admin-pagination" aria-label="Paginação"><span>Página {data.pagination.page} de {data.pagination.totalPages} · {data.pagination.pageSize} por página</span><div>{data.pagination.page > 1 ? <Link className="pill-outline" href={pageLink(data.pagination.page - 1)}>Anterior</Link> : null}{data.pagination.page < data.pagination.totalPages ? <Link className="pill-outline" href={pageLink(data.pagination.page + 1)}>Próxima</Link> : null}</div></nav>
    </section> : null}
  </AdminFrame>;
}
