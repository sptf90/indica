"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ReputationBadge from "@/components/ReputationBadge";
import { api } from "@/lib/client-api";

const TIPS = [
  "Reputação ao vivo",
  "Histórico privado",
  "Pontos com rankings",
];

export default function PontuacaoPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/auth/me")
      .then((me) => setUser(me.user))
      .catch((err) => {
        if (err.status === 401) router.replace("/login");
        else setError(err.message);
      });
  }, [router]);

  if (!user && !error) {
    return (
      <main className="page page-pontuacao">
        <p className="muted">Carregando…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page page-pontuacao">
        <p className="error-box">{error}</p>
      </main>
    );
  }

  const reputationPct = user.hasEvaluations ? Number(user.reputation) || 0 : 0;
  const reputationDisplay = `${reputationPct}%`;
  const validas = Number(user.validIndicationCount) || 0;
  const avaliadas = Number(user.selectedAndEvaluatedCount) || 0;
  const pontos = Number(user.points ?? user.score ?? 0) || 0;

  return (
    <main className="page page-pontuacao">
      <section className="pontuacao-hero reveal">
        <div className="pontuacao-hero-copy">
          <p className="pontuacao-kicker">Pontuação e credibilidade</p>
          <h1 className="pontuacao-title">
            Sua confiança{" "}
            <span>em números</span>
          </h1>
          <p className="pontuacao-lead">
            Acompanhe reputação, indicações válidas e o histórico privado.
            Pontos acumulados somam os saldos das suas inscrições ativas.
          </p>
          <ul className="pontuacao-tips" aria-label="Dicas rápidas">
            {TIPS.map((tip) => (
              <li key={tip} className="pontuacao-chip">
                {tip}
              </li>
            ))}
          </ul>
        </div>
        <div className="pontuacao-hero-art" aria-hidden>
          <div className="pontuacao-hero-panel">
            <Image
              src="/home/medal.png"
              alt=""
              width={220}
              height={220}
              className="pontuacao-hero-illustration"
              priority
              unoptimized
            />
          </div>
        </div>
      </section>

      <section className="pontuacao-grid reveal delay-1" aria-label="Métricas">
        <article className="pontuacao-card accent pontuacao-card-rep">
          <div className="pontuacao-rep-slot">
            <ReputationBadge
              reputation={user.reputation}
              hasEvaluations={user.hasEvaluations}
              selectedAndEvaluatedCount={user.selectedAndEvaluatedCount}
              reputationLabel={user.reputationLabel}
              size="hero"
            />
          </div>
          <div className="pontuacao-card-copy">
            <p className="pontuacao-card-label">Métrica de confiança</p>
            <strong className="pontuacao-card-value">{reputationDisplay}</strong>
            <p className="pontuacao-card-meta">
              {user.hasEvaluations
                ? user.reputationLabel
                : "Reputação 0/100 - Sem avaliações"}
              . Percentual ao vivo das indicações válidas entre as selecionadas e
              avaliadas.
            </p>
          </div>
        </article>

        <article className="pontuacao-card">
          <span className="pontuacao-card-icon green" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M20 7 10 17l-5-5"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p className="pontuacao-card-label">Indicações válidas</p>
          <strong className="pontuacao-card-value">{validas}</strong>
          <p
            className="pontuacao-card-meta"
            title="Total de indicações avaliadas como válidas no histórico — não expiram."
          >
            No histórico — não expiram
          </p>
        </article>

        <article className="pontuacao-card">
          <span className="pontuacao-card-icon blue" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M4 19V5M4 19h16M8 15V9M12 15V7M16 15v-3"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <p className="pontuacao-card-label">Selecionadas e avaliadas</p>
          <strong className="pontuacao-card-value">{avaliadas}</strong>
          <p className="pontuacao-card-meta">Denominador da reputação</p>
        </article>

        <article className="pontuacao-card">
          <span className="pontuacao-card-icon gold" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M12 8v8M9.5 10.5h3.2a1.8 1.8 0 0 1 0 3.6H9.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <p className="pontuacao-card-label">Pontos acumulados</p>
          <strong
            className="pontuacao-card-value"
            aria-label={`${pontos} pontos`}
          >
            {pontos}
          </strong>
          <p className="pontuacao-card-meta">
            Soma dos pontos nas inscrições ativas.{" "}
            <Link href="/rankings">Ver rankings →</Link>
          </p>
        </article>
      </section>

      <section className="pontuacao-panels reveal delay-2">
        <article className="pontuacao-panel">
          <p className="pontuacao-panel-kicker">Como funciona</p>
          <h2>Fórmula da reputação</h2>
          <p>
            A porcentagem é{" "}
            <strong>
              válidas ÷ selecionadas e avaliadas × 100
            </strong>
            , arredondada. Sem avaliações, permanece 0% com o texto “Sem
            avaliações”.
          </p>
          <p className="pontuacao-formula" aria-hidden>
            {user.hasEvaluations
              ? `${validas} ÷ ${avaliadas} × 100 → ${reputationDisplay}`
              : "Sem avaliações → 0%"}
          </p>
        </article>

        <article className="pontuacao-panel highlight">
          <p className="pontuacao-panel-kicker">Privado</p>
          <h2>Histórico de reputação</h2>
          <p>
            Cada avaliação gera uma linha com data, pedido, resultado e a
            variação (antes → Δ → depois). Só você vê esse histórico.
          </p>
          <Link href="/perfil/reputacao" className="btn-solid pontuacao-history-cta">
            Ver histórico completo
            <span className="btn-arrow" aria-hidden>
              →
            </span>
          </Link>
        </article>
      </section>
    </main>
  );
}
