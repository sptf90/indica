"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";

const TIPS = ["Do mais recente", "Status em destaque", "Abra para acompanhar"];

function statusTone(status) {
  if (status === "valid") return "done";
  if (status === "selected" || status === "in_evaluation") return "info";
  if (status === "invalid") return "warn";
  if (status === "not_selected" || String(status || "").startsWith("closed"))
    return "muted";
  if (status === "sent") return "ok";
  return "muted";
}

function formatWhen(value) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
    }).format(new Date(value));
  } catch {
    return null;
  }
}

export default function MinhasIndicacoesPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    api("/api/indications?scope=mine")
      .then((data) => setItems(data.items || []))
      .catch((err) => {
        if (err.status === 401) router.push("/login");
        else setError(err.message);
      })
      .finally(() => setBooting(false));
  }, [router]);

  const showEmpty = !booting && !error && items.length === 0;

  return (
    <main className="page page-minhas">
      <section className="flow-hero reveal">
        <div className="flow-hero-copy">
          <p className="flow-kicker">Minhas indicações</p>
          <h1 className="flow-title">
            Suas indicações,{" "}
            <span>do mais recente</span>
          </h1>
          <p className="flow-lead">
            Acompanhe o status das indicações que você enviou e abra o detalhe
            quando quiser revisar.
          </p>
          <ul className="flow-tips" aria-label="Dicas rápidas">
            {TIPS.map((tip) => (
              <li key={tip} className="flow-chip">
                {tip}
              </li>
            ))}
          </ul>
        </div>
        <div className="flow-hero-art" aria-hidden>
          <div className="flow-hero-panel">
            <Image
              src="/home/cta-indicar.png"
              alt=""
              width={240}
              height={240}
              className="flow-hero-illustration"
              priority
              unoptimized
            />
          </div>
        </div>
      </section>

      <div className="flow-toolbar reveal delay-1">
        <Link className="flow-cta" href="/indicar">
          Fazer indicação
          <span aria-hidden>→</span>
        </Link>
        <Link className="flow-cta-ghost" href="/">
          Home
        </Link>
      </div>

      {error ? <p className="error-box">{error}</p> : null}

      <section className="flow-list reveal delay-2" aria-live="polite">
        {booting ? <p className="flow-loading">Carregando indicações…</p> : null}

        {items.length > 0 ? (
          <ul className="flow-cards">
            {items.map((item) => {
              const when = formatWhen(item.createdAt);
              return (
                <li key={item.id}>
                  <Link className="flow-card" href={`/minhas-indicacoes/${item.id}`}>
                    <div className="flow-card-top">
                      <span
                        className={`flow-status flow-status--${statusTone(item.status)}`}
                      >
                        {item.statusLabel}
                      </span>
                      {when ? <span className="flow-when">{when}</span> : null}
                    </div>
                    <h2 className="flow-card-title">{item.requestTitle}</h2>
                    <div className="flow-card-meta">
                      <span className="flow-location" aria-label="Local">
                        <svg
                          viewBox="0 0 24 24"
                          width="14"
                          height="14"
                          aria-hidden
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
                          <circle cx="12" cy="10" r="2.5" />
                        </svg>
                        {item.cityName} ({item.cityState})
                      </span>
                      <span className="flow-card-cta" aria-hidden>
                        Ver →
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}

        {showEmpty ? (
          <div className="flow-empty">
            <div className="flow-empty-art" aria-hidden>
              <Image
                src="/home/cta-indicar.png"
                alt=""
                width={120}
                height={120}
                className="flow-empty-illustration"
                unoptimized
              />
            </div>
            <h2>Nenhuma indicação ainda</h2>
            <p>
              Quando você indicar em um pedido aberto, ela aparece aqui com o
              status.
            </p>
            <p className="flow-empty-hint">
              Escolha um pedido na cidade e conte o que você recomenda.
            </p>
            <Link className="flow-empty-link" href="/indicar">
              Fazer minha primeira indicação
              <span aria-hidden>→</span>
            </Link>
          </div>
        ) : null}
      </section>

      <p className="flow-footer reveal delay-3">
        <Link href="/indicar">Fazer indicação</Link>
        <span aria-hidden>·</span>
        <Link href="/">Home</Link>
      </p>
    </main>
  );
}
