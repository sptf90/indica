"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client-api";

/** Sem preferência explícita na URL → Minha cidade. */
function filterFromSearchParams(searchParams) {
  const scope = searchParams.get("scope");
  const mineCity = searchParams.get("mineCity");
  if (scope === "all" || mineCity === "0") return "all";
  return "mine";
}

/** Fase da lista: todos | ativos | premios | finalizados */
function phaseFromSearchParams(searchParams) {
  const phase = searchParams.get("phase");
  if (phase === "ativos" || phase === "premios" || phase === "finalizados") {
    return phase;
  }
  return "todos";
}

function hasPrizePositions(ranking) {
  return (
    Array.isArray(ranking?.prizePositions) && ranking.prizePositions.length > 0
  );
}

/** Rankings em apuração ou finalizados com prêmios a acompanhar. */
function isAwaitingPrizes(ranking) {
  if (!ranking) return false;
  if (ranking.status === "tallying") return true;
  return ranking.status === "final" && hasPrizePositions(ranking);
}

function statusBadgeFor(ranking) {
  if (ranking.status === "open") {
    return { label: "Ativo", tone: "ok" };
  }
  if (ranking.status === "tallying") {
    return { label: "Em apuração", tone: "warn" };
  }
  if (ranking.status === "final" && hasPrizePositions(ranking)) {
    return { label: "Aguardando prêmios", tone: "info" };
  }
  if (ranking.status === "final") {
    return { label: "Finalizado", tone: "done" };
  }
  return { label: ranking.statusLabel || ranking.status, tone: "muted" };
}

function formatPeriod(start, end) {
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;
  if (!s || Number.isNaN(s.getTime())) return "";
  const opts = { day: "2-digit", month: "short" };
  const left = s.toLocaleDateString("pt-BR", opts);
  if (!e || Number.isNaN(e.getTime())) return left;
  const rightDate = new Date(e.getTime() - 1000);
  const right = rightDate.toLocaleDateString("pt-BR", opts);
  return `${left} – ${right}`;
}

function SponsorMark({ name, logoUrl }) {
  if (!name) return null;
  return (
    <p className="ranking-sponsor">
      <span className="ranking-sponsor-label">Patrocinado por</span>
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt=""
          width={20}
          height={20}
          className="sponsor-logo"
          unoptimized
        />
      ) : null}
      <strong>{name}</strong>
    </p>
  );
}

function RankingRow({ ranking, busyId, onEnroll, companyScope }) {
  const badge = statusBadgeFor(ranking);
  const prizeHint = hasPrizePositions(ranking)
    ? ` · Top ${ranking.prizePositions.join(", ")} com prêmios`
    : "";

  return (
    <li
      className={`ranking-row${ranking.sponsored ? " is-sponsored" : ""}${
        ranking.status === "final" ? " is-final" : ""
      }${ranking.status === "tallying" ? " is-tallying" : ""}`}
    >
      <div className="ranking-row-main">
        <div className="ranking-row-top">
          <Link href={`/rankings/${ranking.id}`} className="ranking-title">
            {ranking.title}
          </Link>
          <span
            className={`ranking-status-badge ranking-status-badge--${badge.tone}`}
          >
            {badge.label}
          </span>
        </div>
        <p className="ranking-meta">
          {ranking.modalityLabel}
          {ranking.cityName
            ? ` · ${ranking.cityName}${
                ranking.cityState ? `/${ranking.cityState}` : ""
              }`
            : ""}
          {" · "}
          {formatPeriod(ranking.periodStart, ranking.periodEnd)}
          {prizeHint}
        </p>
        {ranking.sponsored ? (
          <SponsorMark
            name={ranking.sponsorName}
            logoUrl={ranking.sponsorLogoUrl}
          />
        ) : null}
      </div>
      <div className="ranking-row-actions">
        {companyScope ? (
          <Link href={`/rankings/${ranking.id}`} className="btn-outline sm">
            Ver campanha
          </Link>
        ) : ranking.enrolled ? (
          <>
            <span className="ranking-badge">Inscrito</span>
            {ranking.status !== "final" ? (
              <span className="ranking-balance">
                {ranking.myBalance ?? 0} pts
              </span>
            ) : null}
            <Link href={`/rankings/${ranking.id}`} className="btn-outline sm">
              Ver classificação
            </Link>
          </>
        ) : ranking.status === "open" ? (
          <button
            type="button"
            className="btn-solid sm"
            disabled={busyId === ranking.id}
            onClick={() => onEnroll(ranking.id)}
          >
            {busyId === ranking.id ? "…" : "Inscrever-se"}
          </button>
        ) : (
          <Link href={`/rankings/${ranking.id}`} className="btn-outline sm">
            Ver classificação
          </Link>
        )}
      </div>
    </li>
  );
}

function RankingsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState([]);
  const [limits, setLimits] = useState(null);
  const [points, setPoints] = useState(0);
  const [myCity, setMyCity] = useState(null);
  const [filter, setFilter] = useState(() =>
    filterFromSearchParams(searchParams)
  );
  const [phase, setPhase] = useState(() =>
    phaseFromSearchParams(searchParams)
  );
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [flash, setFlash] = useState("");
  const [companyScope, setCompanyScope] = useState(false);

  useEffect(() => {
    setFilter(filterFromSearchParams(searchParams));
    setPhase(phaseFromSearchParams(searchParams));
  }, [searchParams]);

  const replaceQuery = useCallback(
    (mutate) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const applyFilter = useCallback(
    (next) => {
      setFilter(next);
      replaceQuery((params) => {
        params.delete("mineCity");
        if (next === "all") {
          params.set("scope", "all");
        } else {
          params.delete("scope");
        }
      });
    },
    [replaceQuery]
  );

  const applyPhase = useCallback(
    (next) => {
      setPhase(next);
      replaceQuery((params) => {
        if (next === "todos") {
          params.delete("phase");
        } else {
          params.set("phase", next);
        }
      });
    },
    [replaceQuery]
  );

  const load = useCallback(async () => {
    const qs = filter === "mine" ? "?mineCity=1" : "";
    const data = await api(`/api/rankings${qs}`);
    setItems(data.items || []);
    setLimits(data.limits || null);
    setPoints(Number(data.pointsAccumulated) || 0);
    setMyCity(data.myCity || null);
    setCompanyScope(Boolean(data.companyScope));
  }, [filter]);

  useEffect(() => {
    let cancelled = false;
    load().catch((err) => {
      if (cancelled) return;
      if (err.status === 401) router.replace("/login");
      else setError(err.message || "Falha ao carregar rankings.");
    });
    return () => {
      cancelled = true;
    };
  }, [load, router]);

  async function enroll(rankingId) {
    setBusyId(rankingId);
    setFlash("");
    setError("");
    try {
      const res = await api(`/api/rankings/${rankingId}/enroll`, {
        method: "POST",
      });
      setFlash(res.message || "Inscrição confirmada.");
      await load();
    } catch (err) {
      setError(err.message || "Não foi possível se inscrever.");
    } finally {
      setBusyId(null);
    }
  }

  const visibleItems = useMemo(() => {
    if (phase === "ativos") {
      return items.filter((r) => r.status === "open");
    }
    if (phase === "premios") {
      return items.filter(isAwaitingPrizes);
    }
    if (phase === "finalizados") {
      return items.filter((r) => r.status === "final");
    }
    return items;
  }, [items, phase]);

  const openItems = visibleItems.filter((r) => r.status === "open");
  const tallyingItems = visibleItems.filter((r) => r.status === "tallying");
  const awaitingPrizeFinals = visibleItems.filter(
    (r) => r.status === "final" && hasPrizePositions(r)
  );
  const plainFinalItems = visibleItems.filter(
    (r) => r.status === "final" && !hasPrizePositions(r)
  );
  /** No filtro Finalizados, manter todos os final (incl. com prêmios). */
  const finalSectionItems =
    phase === "finalizados" ? visibleItems : plainFinalItems;

  const myCityLabel = myCity?.name
    ? `${myCity.name}${myCity.state ? `/${myCity.state}` : ""}`
    : null;

  const phaseHint =
    phase === "ativos"
      ? "Só rankings ativos (em andamento)"
      : phase === "premios"
        ? "Em apuração ou finalizados com prêmios a acompanhar"
        : phase === "finalizados"
          ? "Rankings com classificação final publicada"
          : "Todas as fases: ativos, aguardando prêmios e finalizados";

  const sections = [
    { key: "open", title: "Ativos", list: openItems },
    {
      key: "tallying",
      title: "Em apuração",
      hint: "Classificação ainda não é final",
      list: tallyingItems,
    },
    {
      key: "awaiting-prizes",
      title: "Aguardando prêmios",
      hint: "Classificação final com prêmios a resgatar ou acompanhar",
      list: awaitingPrizeFinals,
    },
    {
      key: "final",
      title: "Finalizados",
      hint: "Arquivo com classificação final",
      list: finalSectionItems,
    },
  ].filter((section) => {
    if (phase === "ativos") return section.key === "open";
    if (phase === "premios") {
      return section.key === "tallying" || section.key === "awaiting-prizes";
    }
    if (phase === "finalizados") return section.key === "final";
    return true;
  });

  return (
    <main className="page page-rankings">
      <header className="rankings-head">
        <div>
          <p className="rankings-kicker">
            {companyScope ? "Área da empresa" : "Rankings"}
          </p>
          <h1>
            {companyScope ? "Seu ranking patrocinado" : "Classificações"}
          </h1>
          <p className="rankings-lead">
            {companyScope
              ? "Só a campanha da sua empresa aparece aqui — sem Café Demo nem outros patrocinadores. Gestão de solicitação e resgates fica em Patrocínio e resgates."
              : "Sua cidade primeiro; mensal e semanal ativos no topo. Filtre por fase: ativos, aguardando prêmios ou finalizados. Inscrição manual e definitiva (até 2 semanais e 1 mensal). Futuros ficam ocultos até o início do período."}
          </p>
        </div>
        {!companyScope ? (
          <div className="rankings-points" aria-label="Pontos acumulados">
            <span className="rankings-points-label">Pontos acumulados</span>
            <strong>{points}</strong>
          </div>
        ) : (
          <Link href="/empresa" className="btn-outline sm">
            Solicitar patrocínio
          </Link>
        )}
      </header>

      {!companyScope ? (
        <div className="rankings-toolbar">
          {limits ? (
            <p className="rankings-limits">
              <span className="rankings-limits-label">Suas inscrições</span>
              Semanais {limits.weekly.used}/{limits.weekly.max} · Mensal{" "}
              {limits.monthly.used}/{limits.monthly.max}
            </p>
          ) : null}

          <div className="rankings-filter-block">
            <span className="rankings-filter-label" id="rankings-filter-label">
              Filtrar por
            </span>
            <div
              className="rankings-filters"
              role="group"
              aria-labelledby="rankings-filter-label"
            >
              <button
                type="button"
                className={filter === "all" ? "is-selected" : ""}
                aria-pressed={filter === "all"}
                onClick={() => applyFilter("all")}
              >
                Todas as cidades
              </button>
              <button
                type="button"
                className={filter === "mine" ? "is-selected" : ""}
                aria-pressed={filter === "mine"}
                onClick={() => applyFilter("mine")}
              >
                Minha cidade
              </button>
            </div>
            <p className="rankings-filter-hint">
              {filter === "mine" ? (
                myCityLabel ? (
                  <>
                    Mostrando rankings de <strong>{myCityLabel}</strong>
                  </>
                ) : (
                  "Mostrando rankings da cidade do seu perfil"
                )
              ) : (
                "Mostrando rankings de todas as cidades"
              )}
            </p>
          </div>

          <div className="rankings-filter-block rankings-phase-block">
            <span className="rankings-filter-label" id="rankings-phase-label">
              Fase
            </span>
            <div
              className="rankings-filters rankings-phase-filters"
              role="group"
              aria-labelledby="rankings-phase-label"
            >
              <button
                type="button"
                className={phase === "todos" ? "is-selected" : ""}
                aria-pressed={phase === "todos"}
                onClick={() => applyPhase("todos")}
              >
                Todos
              </button>
              <button
                type="button"
                className={phase === "ativos" ? "is-selected" : ""}
                aria-pressed={phase === "ativos"}
                onClick={() => applyPhase("ativos")}
              >
                Ativos
              </button>
              <button
                type="button"
                className={phase === "premios" ? "is-selected" : ""}
                aria-pressed={phase === "premios"}
                onClick={() => applyPhase("premios")}
              >
                Aguardando prêmios
              </button>
              <button
                type="button"
                className={phase === "finalizados" ? "is-selected" : ""}
                aria-pressed={phase === "finalizados"}
                onClick={() => applyPhase("finalizados")}
              >
                Finalizados
              </button>
            </div>
            <p className="rankings-filter-hint">{phaseHint}</p>
          </div>
        </div>
      ) : null}

      {flash ? <p className="ok-box">{flash}</p> : null}
      {error ? <p className="error-box">{error}</p> : null}

      {!error && items.length === 0 ? (
        <p className="muted rankings-empty">
          {companyScope
            ? "Ainda não há ranking patrocinado pela sua empresa. Envie uma solicitação em Patrocínio e resgates."
            : "Nenhum ranking disponível no momento."}
        </p>
      ) : null}

      {!error && items.length > 0 && visibleItems.length === 0 ? (
        <p className="muted rankings-empty">
          Nenhum ranking nesta fase com o filtro atual.
        </p>
      ) : null}

      {sections.map((section) =>
        section.list.length ? (
          <section
            key={section.key}
            className={`rankings-section rankings-section--${section.key}`}
            aria-labelledby={`rankings-sec-${section.key}`}
          >
            <div className="rankings-section-head">
              <h2 id={`rankings-sec-${section.key}`}>{section.title}</h2>
              {section.hint ? (
                <p className="rankings-section-hint">{section.hint}</p>
              ) : null}
            </div>
            <ul className="rankings-list">
              {section.list.map((r) => (
                <RankingRow
                  key={r.id}
                  ranking={r}
                  busyId={busyId}
                  onEnroll={enroll}
                  companyScope={companyScope}
                />
              ))}
            </ul>
          </section>
        ) : null
      )}
    </main>
  );
}

export default function RankingsPage() {
  return (
    <Suspense
      fallback={
        <main className="page page-rankings">
          <p className="muted">Carregando…</p>
        </main>
      }
    >
      <RankingsPageContent />
    </Suspense>
  );
}
