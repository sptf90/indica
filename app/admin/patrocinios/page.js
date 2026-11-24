"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminFrame } from "@/components/AdminWorkspace";
import NavIcon from "@/components/NavIcon";
import { SponsorHero, SponsorSupportCard } from "@/components/RankingSponsor";
import RankingDocument from "@/components/RankingDocument";
import { api } from "@/lib/client-api";

const STATUS_FILTERS = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Aguardam revisão" },
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

function benefitSummary(item) {
  const mode =
    item.prizeBenefitMode === "per_position" ? "Distinto por posição" : "Igual";
  const text = item.prizeBenefits?.default?.trim();
  return text ? `${mode} — ${text}` : mode;
}

function redemptionDeadline(item) {
  const days = item.redemptionDeadlineDays;
  return days ? `${days} ${Number(days) === 1 ? "dia" : "dias"}` : "—";
}

function formatPositions(positions) {
  if (!positions?.length) return "—";
  if (positions.length > 1 && positions.every((position, index) => position === index + 1)) {
    return `1º ao ${positions.length}º lugar`;
  }
  return positions.map(position => `${position}º`).join(", ");
}

function RankingPreview({ item, positions }) {
  const ranking = {
    sponsored: true,
    modality: item.modality,
    sponsorName: item.displayName,
    sponsorBannerUrl: item.bannerUrl,
    sponsorLogoUrl: item.logoUrl,
    sponsorSiteUrl: item.siteUrl,
  };
  return (
    <section className="admin-ranking-preview" aria-label="Prévia do ranking">
      <div className="rm-layout">
        <div className="rm-main">
          <SponsorHero ranking={ranking} preview />
          <div className="rm-meta-bar">
            <span className="ranking-status-badge ranking-status-badge--info">Prévia</span>
            <span>{item.modalityLabel}</span>
            <span>{formatPeriod(item.periodStart, item.periodEnd)}</span>
          </div>
          <section className="rm-preview-note">
            <h2>Premiação</h2>
            <p>Posições premiadas: {positions || "—"}</p>
            {item.prizeBenefitMode === "per_position" && item.prizePositions?.length ? (
              <ul>
                {item.prizePositions.map(position => (
                  <li key={position}>{position}º lugar · {item.prizeBenefits?.[position] || item.prizeBenefits?.default || "—"}</li>
                ))}
              </ul>
            ) : <p>{item.prizeBenefits?.default || "—"}</p>}
            <p>Prazo de resgate: {redemptionDeadline(item)}</p>
            <p>A classificação aparece quando o período do ranking começa.</p>
          </section>
        </div>
        <SponsorSupportCard ranking={ranking} />
      </div>
    </section>
  );
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
            router.replace("/login?next=/admin/patrocinios");
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
      pending: 0,
      submitted: 0,
      under_review: 0,
      awaiting_correction: 0,
      approved: 0,
      rejected: 0,
    };
    for (const item of items) {
      if (base[item.status] != null) base[item.status] += 1;
      if (canDecide(item.status)) base.pending += 1;
    }
    return base;
  }, [items]);

  const visible = useMemo(() => {
    if (filter === "all") return [...items].sort((a, b) => Number(canDecide(b.status)) - Number(canDecide(a.status)));
    if (filter === "pending") return items.filter((item) => canDecide(item.status));
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
    <AdminFrame className="admin-sponsorships" title="Solicitações de patrocínio"
      description="Revise as propostas de empresas para os rankings semanais e mensais."
      action={
        <button type="button" className="admin-sponsorship-queue" aria-pressed={filter === "pending"}
          onClick={() => setFilter(filter === "pending" ? "all" : "pending")}>
          <span className="admin-overview-icon"><NavIcon name="rank" /></span>
          <span><strong>{counts.pending}</strong> {counts.pending === 1 ? "aguarda revisão" : "aguardam revisão"}</span>
        </button>
      }>

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

      <div className="admin-filters" role="group" aria-label="Filtrar por status">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
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
              const positions = formatPositions(item.prizePositions);
              const decide = canDecide(item.status);
              const activate = item.status === "approved";

              return (
                <li
                  key={item.id}
                  className={`admin-card${open ? " is-open" : ""}${decide ? " is-pending" : ""}`}
                >
                  <header className="admin-card-head">
                    <div className="admin-card-title">
                      <h2>{item.displayName}</h2>
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
                    {item.companyLegalName && item.companyLegalName !== item.displayName && (
                      <><span>{item.companyLegalName}</span><span className="admin-meta-sep" aria-hidden>·</span></>
                    )}
                    {item.companyCnpjFormatted ? (
                      <>
                        <span>{item.companyCnpjFormatted}</span>
                        <span className="admin-meta-sep" aria-hidden>·</span>
                      </>
                    ) : null}
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
                      <dd>{positions}</dd>
                    </div>
                    <div>
                      <dt>Benefício</dt>
                      <dd className="admin-sponsorship-benefit">{benefitSummary(item)}</dd>
                    </div>
                    <div>
                      <dt>Prazo de resgate</dt>
                      <dd>{redemptionDeadline(item)}</dd>
                    </div>
                  </dl>

                  {item.prizeRedemptionInstructions?.trim() && (
                    <RankingDocument title="Instruções de resgate" text={item.prizeRedemptionInstructions} />
                  )}
                  {item.regulationText?.trim() && (
                    <RankingDocument title="Regulamento do ranking" text={item.regulationText} />
                  )}

                  {item.reviewNote ? (
                    <p className="admin-note-prev">Nota: {item.reviewNote}</p>
                  ) : null}

                  {open ? (
                    <div className="admin-detail" id={`patrocinio-detalhes-${item.id}`}>
                      <RankingPreview item={item} positions={positions} />
                      <dl className="admin-dl">
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
                      Nota da revisão (opcional)
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
                      className="pill-outline admin-sponsorship-details"
                      aria-expanded={open}
                      aria-controls={open ? `patrocinio-detalhes-${item.id}` : undefined}
                      onClick={() => setExpandedId(open ? null : item.id)}
                    >
                      {open ? "Fechar prévia" : "Prévia do ranking"}
                    </button>
                    {decide ? (
                      <button
                        type="button"
                        className="pill-outline admin-sponsorship-reject"
                        disabled={busyId !== null}
                        onClick={() => runAction(item.id, "reject")}
                      >
                        Rejeitar
                      </button>
                    ) : null}
                    {activate ? (
                      <button
                        type="button"
                        className="pill-outline"
                        disabled={busyId !== null}
                        onClick={() => runAction(item.id, "activate")}
                      >
                        {busy ? "Salvando…" : item.rankingId ? "Reaplicar ao ranking" : "Ativar no ranking"}
                      </button>
                    ) : null}
                    {decide ? (
                      <button
                        type="button"
                        className="pill-cta"
                        disabled={busyId !== null}
                        onClick={() => runAction(item.id, "approve")}
                      >
                        {busy ? "Salvando…" : "Aprovar e ativar"}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AdminFrame>
  );
}
