"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import GuestLanding from "@/components/GuestLanding";
import ReputationBadge from "@/components/ReputationBadge";
import { api } from "@/lib/client-api";
import { getReputationLevel } from "@/lib/reputation-ui";

function formatActivityDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function categoryTone(index) {
  const tones = ["food", "service", "pet"];
  return tones[index % tones.length];
}

function CategoryIcon({ tone }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.85,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  return (
    <span className={`activity-icon tone-${tone}`} aria-hidden>
      {tone === "food" ? (
        <svg {...common}>
          <path d="M8 3v8a2 2 0 0 0 2 2h0V3" />
          <path d="M8 13v8" />
          <path d="M16 3c0 4 2 5 2 9v9" />
          <path d="M16 3v6" />
        </svg>
      ) : tone === "pet" ? (
        <svg {...common}>
          <circle cx="8" cy="9" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="16" cy="9" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="5.5" cy="13" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="18.5" cy="13" r="1.4" fill="currentColor" stroke="none" />
          <ellipse cx="12" cy="16.5" rx="3.2" ry="2.6" />
        </svg>
      ) : (
        <svg {...common}>
          <path d="M4 10.5 12 4l8 6.5" />
          <path d="M6 9.5V20h12V9.5" />
          <path d="M10 20v-6h4v6" />
        </svg>
      )}
    </span>
  );
}

function MetricIcon({ kind }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.85,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  switch (kind) {
    case "pedidos":
      return (
        <svg {...common}>
          <path d="M8 7h9" />
          <path d="M8 12h9" />
          <path d="M8 17h6" />
          <rect x="4" y="3" width="16" height="18" rx="2" />
        </svg>
      );
    case "indicacoes":
      return (
        <svg {...common}>
          <path d="M21 11.5a8.4 8.4 0 0 1-8.4 8.4H6l-3 3V11.5A8.4 8.4 0 1 1 21 11.5Z" />
        </svg>
      );
    case "pontos":
      return (
        <svg {...common}>
          <path d="m12 3 2.2 4.5 5 .7-3.6 3.5.9 5L12 14.8 7.5 16.7l.9-5L4.8 8.2l5-.7Z" />
        </svg>
      );
    case "cred":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="m8.5 12.2 2.3 2.3 4.7-5" />
        </svg>
      );
    case "rank":
      return (
        <svg {...common}>
          <path d="M8 21h8" />
          <path d="M12 17v4" />
          <path d="M7 4h10v5a5 5 0 0 1-10 0Z" />
          <path d="M5 9H3V7a2 2 0 0 1 2-2" />
          <path d="M19 9h2V7a2 2 0 0 0-2-2" />
        </svg>
      );
    default:
      return null;
  }
}

function pendingStatusTone(status) {
  if (status === "open") return "ok";
  if (status === "in_evaluation") return "info";
  return "muted";
}

function DashboardHome({ user }) {
  const [requests, setRequests] = useState([]);
  const [indications, setIndications] = useState([]);
  const [pendingHelps, setPendingHelps] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [pendingEmptyMessage, setPendingEmptyMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const cityQs = user.cityId
      ? `?cityId=${encodeURIComponent(user.cityId)}&limit=6`
      : null;

    Promise.allSettled([
      api("/api/requests"),
      api("/api/indications?scope=mine"),
      cityQs
        ? api(`/api/indications${cityQs}`)
        : Promise.resolve({ items: [], emptyMessage: "" }),
    ]).then(([reqRes, indRes, pendingRes]) => {
      if (cancelled) return;
      if (reqRes.status === "fulfilled") {
        setRequests(reqRes.value.items || []);
      }
      if (indRes.status === "fulfilled") {
        setIndications(indRes.value.items || []);
      }
      if (pendingRes.status === "fulfilled") {
        setPendingHelps(pendingRes.value.items || []);
        setPendingEmptyMessage(pendingRes.value.emptyMessage || "");
      } else if (pendingRes.reason?.status !== 401) {
        setLoadError(
          pendingRes.reason?.message ||
            "Não foi possível carregar os pedidos da comunidade."
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user.cityId]);

  const helps = pendingHelps.map((item, index) => ({
    id: item.id,
    href: `/indicar/${item.id}/nova`,
    title: item.title,
    place: [item.cityName, item.cityState].filter(Boolean).join(" - "),
    statusLabel: item.statusLabel || (item.status === "open" ? "Aberto" : item.status),
    tone: pendingStatusTone(item.status),
    category: categoryTone(index),
    date: formatActivityDate(item.createdAt),
  }));

  const pointsValue = Number(user.points ?? user.score ?? 0);
  const pointsDisplay = Number.isFinite(pointsValue) ? String(pointsValue) : "0";
  const repLevel = getReputationLevel({
    reputation: user.reputation,
    hasEvaluations: user.hasEvaluations,
    selectedAndEvaluatedCount: user.selectedAndEvaluatedCount,
  });

  return (
    <main className="page page-dashboard">
      <section className="dash-hero reveal" data-tour="home-hero">
        <div className="dash-hero-row">
          <div className="dash-hero-copy">
            <h1 className="dash-question">
              Olá! <span>O que você precisa encontrar?</span>
            </h1>
            <p className="dash-support">
              Faça um pedido de indicação ou compartilhe uma indicação e ajude
              outras pessoas.
            </p>
          </div>
          <Link
            href="/pontuacao"
            className="rep-spotlight"
            data-tour="metric-reputacao"
          >
            <ReputationBadge
              reputation={user.reputation}
              hasEvaluations={user.hasEvaluations}
              selectedAndEvaluatedCount={user.selectedAndEvaluatedCount}
              reputationLabel={user.reputationLabel}
              size="compact"
              showTrust={false}
              showLabel={false}
            />
            <span className="rep-spotlight-copy">
              <span className="rep-spotlight-kicker">Reputação</span>
              <span className="rep-spotlight-label">{repLevel.label}</span>
              <span className="rep-spotlight-link">Ver confiança →</span>
            </span>
          </Link>
        </div>
        <div className="dash-hero-mark" aria-hidden />
      </section>

      <section className="cta-duo reveal delay-1">
        <article className="cta-card ask" data-tour="cta-pedir">
          <div className="cta-card-copy">
            <div className="cta-title-row">
              <span className="cta-glyph ask-glyph" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.9" />
                  <path
                    d="M9.6 9.6a2.4 2.4 0 0 1 4.7.7c0 1.5-2.35 2-2.35 3.5"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                  />
                  <path d="M12 16.8h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </span>
              <h2>Pedir uma indicação</h2>
            </div>
            <p>
              Não sabe onde encontrar algo? Faça seu pedido e receba ajuda.
            </p>
            <Link href="/pedir" className="btn-solid">
              Criar pedido de indicação
              <span className="btn-arrow" aria-hidden>
                →
              </span>
            </Link>
          </div>
          <div className="cta-art ask-art" aria-hidden>
            <div className="cta-art-panel">
              <Image
                src="/home/cta-pedir.png"
                alt=""
                width={240}
                height={240}
                className="cta-illustration"
                priority
                unoptimized
              />
            </div>
          </div>
        </article>
        <article className="cta-card give" data-tour="cta-indicar">
          <div className="cta-card-copy">
            <div className="cta-title-row">
              <span className="cta-glyph give-glyph" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="m22 2-7 20-4-9-9-4Z"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M22 2 11 13"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <h2>Fazer uma indicação</h2>
            </div>
            <p>
              Sabe onde encontrar algo que alguém procura? Compartilhe sua
              indicação.
            </p>
            <Link href="/indicar" className="btn-outline">
              Ver pedidos disponíveis
              <span className="btn-arrow" aria-hidden>
                →
              </span>
            </Link>
          </div>
          <div className="cta-art give-art" aria-hidden>
            <div className="cta-art-panel">
              <Image
                src="/home/cta-fazer.png"
                alt=""
                width={240}
                height={240}
                className="cta-illustration"
                priority
                unoptimized
              />
            </div>
          </div>
        </article>
      </section>

      <section className="dash-bottom reveal delay-2">
        <div className="activity-panel" data-tour="ajude-comunidade">
          <div className="activity-head">
            <h2>Ajude a comunidade</h2>
            <Link href="/indicar" className="btn-outline sm">
              Ver todos →
            </Link>
          </div>
          <p className="activity-subhead">
            Pedidos abertos na sua cidade em que você ainda pode indicar — dos
            mais antigos aos mais novos.
          </p>
          {loadError ? <p className="error-box">{loadError}</p> : null}
          <ul className="activity-list">
            {helps.map((item) => (
              <li key={`help-${item.id}`}>
                <div className="activity-row">
                  <Link href={item.href} className="activity-main activity-main--help">
                    <CategoryIcon tone={item.category} />
                    <span className="activity-body">
                      <span className="activity-title">{item.title}</span>
                      <span className="activity-place">
                        <svg
                          className="place-pin"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden
                        >
                          <path
                            d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                          <circle
                            cx="12"
                            cy="10"
                            r="2.2"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                        </svg>
                        {item.place}
                      </span>
                    </span>
                    <span className="activity-mid">
                      <span className={`status-badge ${item.tone}`}>
                        {item.statusLabel}
                      </span>
                      <span className="activity-date">{item.date}</span>
                    </span>
                    <span className="activity-cta-label" aria-hidden>
                      Indicar →
                    </span>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          {!loadError && helps.length === 0 ? (
            <p className="muted empty-activity">
              {user.cityId
                ? pendingEmptyMessage ||
                  "Não há pedidos disponíveis para indicar no momento."
                : "Defina sua cidade no perfil para ver pedidos da comunidade."}
            </p>
          ) : null}
        </div>

        <aside className="side-panels">
          <div
            className="metric-inline"
            aria-label="Resumo rápido"
          >
            <Link
              href="/pedir/meus"
              className="metric-chip"
              data-tour="metric-pedidos"
            >
              <span className="metric-icon blue" aria-hidden>
                <MetricIcon kind="pedidos" />
              </span>
              <span className="metric-chip-body">
                <span className="metric-chip-label">Meus pedidos</span>
                <strong className="metric-chip-value">{requests.length}</strong>
              </span>
            </Link>
            <Link
              href="/minhas-indicacoes"
              className="metric-chip"
              data-tour="metric-indicacoes"
            >
              <span className="metric-icon green" aria-hidden>
                <MetricIcon kind="indicacoes" />
              </span>
              <span className="metric-chip-body">
                <span className="metric-chip-label">Minhas indicações</span>
                <strong className="metric-chip-value">
                  {indications.length}
                </strong>
              </span>
            </Link>
            <Link
              href="/rankings"
              className="metric-chip"
              data-tour="metric-pontos"
            >
              <span className="metric-icon gold" aria-hidden>
                <MetricIcon kind="pontos" />
              </span>
              <span className="metric-chip-body">
                <span className="metric-chip-label">Pontos</span>
                <strong
                  className="metric-chip-value"
                  aria-label={`${pointsDisplay} pontos`}
                >
                  {pointsDisplay}
                </strong>
              </span>
            </Link>
            <Link
              href="/rankings"
              className="metric-chip"
              data-tour="metric-posicao"
            >
              <span className="metric-icon red" aria-hidden>
                <MetricIcon kind="rank" />
              </span>
              <span className="metric-chip-body">
                <span className="metric-chip-label">Posição</span>
                <strong className="metric-chip-value">—</strong>
              </span>
            </Link>
          </div>

          <div className="panel-block">
            <div className="panel-head">
              <h3>Minhas conquistas</h3>
              <Link href="/pontuacao" className="panel-link">
                Ver todas →
              </Link>
            </div>
            <div className="achieve-card">
              <div className="achieve-medal" aria-hidden>
                <Image
                  src="/home/medal.png"
                  alt=""
                  width={96}
                  height={106}
                  className="medal-photo"
                  unoptimized
                />
              </div>
              <div>
                <p className="achieve-title">Você está no caminho certo!</p>
                <p>
                  Continue pedindo e fazendo indicações para ganhar mais pontos
                  e subir no ranking.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default function HomePage() {
  const [user, setUser] = useState(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/auth/me")
      .then((data) => setUser(data.user))
      .catch((err) => {
        if (err.status === 401) setUser(null);
        else {
          setError(err.message);
          setUser(null);
        }
      });
  }, []);

  if (user === undefined) {
    return (
      <main className="page">
        <p className="muted">Carregando…</p>
      </main>
    );
  }

  if (error && !user) {
    return (
      <main className="page">
        <p className="error-box">{error}</p>
        <p className="auth-note">
          <Link href="/login">Entrar</Link>
        </p>
      </main>
    );
  }

  if (!user) return <GuestLanding />;
  return <DashboardHome user={user} />;
}
