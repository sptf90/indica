"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client-api";

const PHASE_FILTERS = [
  { value: "finalizados", label: "Finalizados" },
  { value: "ativos", label: "Ativos" },
  { value: "agendados", label: "Agendados" },
  { value: "pendentes", label: "Solicitações pendentes" },
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
  if (status === "approved" || status === "open" || status === "final") {
    return "admin-status admin-status-ok";
  }
  if (status === "rejected") return "admin-status admin-status-bad";
  if (status === "tallying") return "admin-status admin-status-pending";
  return "admin-status";
}

function phaseClass(phase) {
  if (phase === "finalizados") return "admin-status admin-status-ok";
  if (phase === "agendados") return "admin-status admin-status-pending";
  return "admin-status admin-phase-active";
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
  const daysLabel = days == null || days === "" ? "—" : `${days} dias`;
  const instructions = item.prizeRedemptionInstructions?.trim();
  return instructions ? `${daysLabel} · ${instructions}` : daysLabel;
}

/**
 * @param {{ modality: "monthly" | "weekly"; title: string }} props
 */
export default function AdminRankingsGestao({ modality, title }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [rankings, setRankings] = useState([]);
  const [pending, setPending] = useState([]);
  const [counts, setCounts] = useState({
    finalizados: 0,
    ativos: 0,
    agendados: 0,
    pendentes: 0,
  });
  const [phase, setPhase] = useState("ativos");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [notes, setNotes] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    const data = await api(
      `/api/admin/rankings?modality=${encodeURIComponent(modality)}`
    );
    setRankings(data.rankings || []);
    setPending(data.pending || []);
    setCounts(
      data.counts || {
        finalizados: 0,
        ativos: 0,
        agendados: 0,
        pendentes: 0,
      }
    );
  }, [modality]);

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
            router.replace(
              `/login?next=/admin/rankings/${modality === "weekly" ? "semanal" : "mensal"}`
            );
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
  }, [load, modality, router]);

  const [phaseSeeded, setPhaseSeeded] = useState(false);

  useEffect(() => {
    setPhase("ativos");
    setPhaseSeeded(false);
  }, [modality]);

  useEffect(() => {
    if (!ready || denied || phaseSeeded) return;
    const order = ["ativos", "agendados", "pendentes", "finalizados"];
    const pick = order.find((key) => (counts[key] || 0) > 0);
    if (pick) setPhase(pick);
    setPhaseSeeded(true);
  }, [ready, denied, phaseSeeded, counts]);

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

  const visibleRankings = useMemo(() => {
    if (phase === "pendentes") return [];
    return rankings.filter((r) => r.phase === phase);
  }, [rankings, phase]);

  const totalTracked =
    (counts.finalizados || 0) +
    (counts.ativos || 0) +
    (counts.agendados || 0) +
    (counts.pendentes || 0);

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
            Só administradores acedem a esta área.
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
    <main className="page page-admin page-admin-gestao">
      <section className="admin-hero">
        <div className="admin-hero-main">
          <p className="eyebrow">Admin · Rankings</p>
          <h1>Gestão {title}</h1>
          <p className="lead admin-lead">
            Acompanhar períodos finalizados, ativos e agendados; decidir
            solicitações de patrocínio desta modalidade.
          </p>
        </div>
        <div className="admin-hero-meta">
          <span className="admin-count-badge">
            <strong>{totalTracked}</strong> itens
          </span>
          <div className="admin-modality-switch" role="navigation" aria-label="Modalidade">
            <Link
              href="/admin/rankings/mensal"
              className={`admin-mod-link${modality === "monthly" ? " is-active" : ""}`}
            >
              Mensal
            </Link>
            <Link
              href="/admin/rankings/semanal"
              className={`admin-mod-link${modality === "weekly" ? " is-active" : ""}`}
            >
              Semanal
            </Link>
          </div>
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

      <div className="admin-filters" role="tablist" aria-label="Fase do ranking">
        {PHASE_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={phase === f.value}
            className={`admin-filter${phase === f.value ? " is-active" : ""}`}
            onClick={() => setPhase(f.value)}
          >
            {f.label}
            <span className="admin-filter-count">{counts[f.value] ?? 0}</span>
          </button>
        ))}
      </div>

      <section className="admin-panel">
        {phase === "pendentes" ? (
          !pending.length ? (
            <p className="muted admin-empty">
              Nenhuma solicitação pendente nesta modalidade.
            </p>
          ) : (
            <ul className="admin-list admin-list-dense">
              {pending.map((item) => {
                const open = expandedId === item.id;
                const busy = busyId === item.id;
                const positions = Array.isArray(item.prizePositions)
                  ? item.prizePositions.join(", ")
                  : "—";
                const decide = canDecide(item.status);
                const activate = canActivate(item.status);

                return (
                  <li
                    key={`p-${item.id}`}
                    className={`admin-card admin-card-dense${open ? " is-open" : ""}`}
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
                      <span>
                        {formatPeriod(item.periodStart, item.periodEnd)}
                      </span>
                    </p>

                    <dl className="admin-summary admin-summary-compact">
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
                        onClick={() =>
                          setExpandedId(open ? null : item.id)
                        }
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
          )
        ) : !visibleRankings.length ? (
          <p className="muted admin-empty">Nenhum ranking nesta fase.</p>
        ) : (
          <ul className="admin-rank-table" role="list">
            {visibleRankings.map((item) => (
              <li key={item.id} className="admin-rank-row">
                <div className="admin-rank-main">
                  <div className="admin-rank-title-line">
                    <strong>{item.title}</strong>
                    <span className={phaseClass(item.phase)}>
                      {item.phaseLabel}
                    </span>
                    {item.sponsored ? (
                      <span className="admin-rank-sponsor-chip">
                        Patrocinado
                      </span>
                    ) : (
                      <span className="admin-rank-organic-chip">Orgânico</span>
                    )}
                  </div>
                  <p className="muted admin-card-meta">
                    <span>#{item.id}</span>
                    <span className="admin-meta-sep" aria-hidden>
                      ·
                    </span>
                    <span>
                      {item.cityName || "Brasil"}
                      {item.cityState ? `/${item.cityState}` : ""}
                    </span>
                    <span className="admin-meta-sep" aria-hidden>
                      ·
                    </span>
                    <span>
                      {formatPeriod(item.periodStart, item.periodEnd)}
                    </span>
                    {item.sponsorName ? (
                      <>
                        <span className="admin-meta-sep" aria-hidden>
                          ·
                        </span>
                        <span>{item.sponsorName}</span>
                      </>
                    ) : null}
                    <span className="admin-meta-sep" aria-hidden>
                      ·
                    </span>
                    <span>
                      {item.participantsCount ?? 0} participante
                      {(item.participantsCount ?? 0) === 1 ? "" : "s"}
                    </span>
                  </p>
                </div>
                <div className="admin-rank-actions">
                  <Link
                    href={`/rankings/${item.id}`}
                    className="ghost-link admin-btn-ghost"
                  >
                    Abrir
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
