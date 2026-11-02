"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client-api";

const STATUS_FILTERS = [
  { value: "all", label: "Todas" },
  { value: "submitted", label: "Enviada" },
  { value: "under_review", label: "Em análise" },
  { value: "awaiting_correction", label: "Correção" },
  { value: "approved", label: "Aprovada" },
  { value: "rejected", label: "Rejeitada" },
];

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDay(value) {
  const d = parseDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatPeriod(start, end) {
  if (!start) return "—";
  const left = formatDay(start);
  if (!end) return left;
  return `${left} → ${formatDay(end)}`;
}

function statusClass(status) {
  if (
    status === "submitted" ||
    status === "under_review" ||
    status === "awaiting_correction"
  ) {
    return "admin-status admin-status-pending";
  }
  if (status === "approved") return "admin-status admin-status-ok";
  if (status === "rejected") return "admin-status admin-status-bad";
  return "admin-status";
}

function canDecide(status) {
  return ["submitted", "under_review", "awaiting_correction"].includes(status);
}

function canActivate(status) {
  return canDecide(status) || status === "approved";
}

function benefitSummary(item) {
  const mode =
    item.prizeBenefitMode === "per_position" ? "Distinto por posição" : "Igual";
  const text = item.prizeBenefits?.default?.trim();
  return text ? `${mode} — ${text}` : mode;
}

function redemptionSummary(item) {
  const days = item.redemptionDeadlineDays;
  const daysLabel =
    days == null || days === "" ? "—" : `${days} dias`;
  const instructions = item.prizeRedemptionInstructions?.trim();
  return instructions ? `${daysLabel} · ${instructions}` : daysLabel;
}

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [notes, setNotes] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    const data = await api("/api/admin/sponsorships");
    setItems(data.items || []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api("/api/auth/me");
        if (!me?.user?.isAdmin) {
          if (!cancelled) {
            setDenied(true);
            setReady(true);
          }
          return;
        }
        await load();
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) {
          if (err.status === 401) {
            router.replace("/login?next=/admin");
            return;
          }
          setDenied(true);
          setError(err.message || "Sem acesso");
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, router]);

  async function runAction(id, action) {
    setBusyId(id);
    setError("");
    setSuccess("");
    try {
      const note = notes[id] || undefined;
      const data = await api(`/api/admin/sponsorships/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ note: note || undefined }),
      });
      setSuccess(data.message || "OK");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(() => {
    const base = {
      all: items.length,
      submitted: 0,
      under_review: 0,
      awaiting_correction: 0,
      approved: 0,
      rejected: 0,
    };
    for (const item of items) {
      if (base[item.status] != null) base[item.status] += 1;
    }
    return base;
  }, [items]);

  const visible = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((item) => item.status === filter);
  }, [items, filter]);

  if (!ready) {
    return (
      <main className="page page-admin">
        <p className="muted">Carregando…</p>
      </main>
    );
  }

  if (denied) {
    return (
      <main className="page page-admin">
        <section className="admin-hero">
          <p className="eyebrow">Admin</p>
          <h1>Acesso restrito</h1>
          <p className="lead admin-lead">
            Só administradores acedem a esta área. Contas empresariais não têm
            poderes admin.
          </p>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="page page-admin">
      <section className="admin-hero">
        <div className="admin-hero-main">
          <p className="eyebrow">Admin · Patrocínio</p>
          <h1>Solicitações de patrocínio</h1>
          <p className="lead admin-lead">
            Analisar, aprovar, rejeitar ou activar campanhas no ranking. Sem
            cobrança nem moderação geral.
          </p>
        </div>
        <div className="admin-hero-meta">
          <span className="admin-count-badge">
            <strong>{items.length}</strong> no total
          </span>
        </div>
      </section>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="form-success" role="status">
          {success}
        </p>
      ) : null}

      <div className="admin-filters" role="tablist" aria-label="Filtrar por estado">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            className={`admin-filter${filter === f.value ? " is-active" : ""}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
            <span className="admin-filter-count">{counts[f.value] ?? 0}</span>
          </button>
        ))}
      </div>

      <section className="admin-panel">
        {!visible.length ? (
          <p className="muted admin-empty">Nenhuma solicitação neste filtro.</p>
        ) : (
          <ul className="admin-list">
            {visible.map((item) => {
              const open = expandedId === item.id;
              const busy = busyId === item.id;
              const positions = Array.isArray(item.prizePositions)
                ? item.prizePositions.join(", ")
                : "—";
              const decide = canDecide(item.status);
              const activate = canActivate(item.status);

              return (
                <li
                  key={item.id}
                  className={`admin-card${open ? " is-open" : ""}`}
                >
                  <header className="admin-card-head">
                    <div className="admin-card-title">
                      <strong>{item.displayName}</strong>
                      <span className={statusClass(item.status)}>
                        {item.statusLabel}
                      </span>
                    </div>
                  </header>

                  <p className="muted admin-card-meta">
                    <span>#{item.id}</span>
                    <span className="admin-meta-sep" aria-hidden>
                      ·
                    </span>
                    <span>{item.companyLegalName || "Empresa"}</span>
                    {item.companyCnpjFormatted ? (
                      <>
                        <span className="admin-meta-sep" aria-hidden>
                          ·
                        </span>
                        <span>{item.companyCnpjFormatted}</span>
                      </>
                    ) : null}
                    <span className="admin-meta-sep" aria-hidden>
                      ·
                    </span>
                    <span>
                      {item.cityName || "—"}
                      {item.cityState ? `/${item.cityState}` : ""}
                    </span>
                    <span className="admin-meta-sep" aria-hidden>
                      ·
                    </span>
                    <span>{item.modalityLabel}</span>
                    <span className="admin-meta-sep" aria-hidden>
                      ·
                    </span>
                    <span>
                      {formatPeriod(item.periodStart, item.periodEnd)}
                    </span>
                  </p>

                  <dl className="admin-summary">
                    <div>
                      <dt>Posições</dt>
                      <dd>Top: {positions || "—"}</dd>
                    </div>
                    <div>
                      <dt>Benefício</dt>
                      <dd>{benefitSummary(item)}</dd>
                    </div>
                    <div>
                      <dt>Resgate</dt>
                      <dd>{redemptionSummary(item)}</dd>
                    </div>
                  </dl>

                  {item.reviewNote ? (
                    <p className="admin-note-prev">Nota: {item.reviewNote}</p>
                  ) : null}

                  {open ? (
                    <div className="admin-detail">
                      <dl className="admin-dl">
                        <div>
                          <dt>Regulamento</dt>
                          <dd>{item.regulationText || "—"}</dd>
                        </div>
                        <div>
                          <dt>Ranking</dt>
                          <dd>
                            {item.rankingId ? `#${item.rankingId}` : "—"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ) : null}

                  {(decide || activate) && (
                    <label className="admin-note-field">
                      Motivo / nota (opcional)
                      <input
                        value={notes[item.id] || ""}
                        onChange={(e) =>
                          setNotes((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        maxLength={500}
                        placeholder="Ex.: materiais OK / falta logo"
                      />
                    </label>
                  )}

                  <div className="admin-card-actions">
                    <button
                      type="button"
                      className="ghost-link admin-btn-ghost"
                      onClick={() => setExpandedId(open ? null : item.id)}
                    >
                      {open ? "Fechar" : "Detalhe"}
                    </button>
                    {decide ? (
                      <button
                        type="button"
                        className="ghost-link admin-btn-bad"
                        disabled={busy}
                        onClick={() => runAction(item.id, "reject")}
                      >
                        Rejeitar
                      </button>
                    ) : null}
                    {activate ? (
                      <button
                        type="button"
                        className="pill-outline admin-btn-secondary"
                        disabled={busy}
                        onClick={() => runAction(item.id, "activate")}
                      >
                        Activar
                      </button>
                    ) : null}
                    {decide ? (
                      <button
                        type="button"
                        className="pill-cta admin-btn-primary"
                        disabled={busy}
                        onClick={() => runAction(item.id, "approve")}
                      >
                        Aprovar
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
