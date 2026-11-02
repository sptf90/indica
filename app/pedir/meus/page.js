"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";

const TIPS = ["Do mais recente", "Status em destaque", "Abra para acompanhar"];

function statusTone(status) {
  if (status === "open") return "ok";
  if (status === "in_evaluation") return "info";
  if (status === "completed") return "done";
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

export default function MeusPedidosPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    api("/api/requests")
      .then((data) => setItems(data.items || []))
      .catch((err) => {
        if (err.status === 401) router.push("/login");
        else setError(err.message);
      })
      .finally(() => setBooting(false));
  }, [router]);

  const showEmpty = !booting && !error && items.length === 0;

  return (
    <main className="page page-meus-pedidos">
      <section className="meus-hero reveal">
        <div className="meus-hero-copy">
          <p className="meus-kicker">Meus pedidos</p>
          <h1 className="meus-title">
            Seus pedidos,{" "}
            <span>do mais recente</span>
          </h1>
          <p className="meus-lead">
            Acompanhe status, cidade e abra o detalhe quando quiser ver as
            indicações.
          </p>
          <ul className="meus-tips" aria-label="Dicas rápidas">
            {TIPS.map((tip) => (
              <li key={tip} className="meus-chip">
                {tip}
              </li>
            ))}
          </ul>
        </div>
        <div className="meus-hero-art" aria-hidden>
          <div className="meus-hero-panel">
            <Image
              src="/home/cta-pedir.png"
              alt=""
              width={240}
              height={240}
              className="meus-hero-illustration"
              priority
              unoptimized
            />
          </div>
        </div>
      </section>

      <div className="meus-toolbar reveal delay-1">
        <Link className="meus-cta" href="/pedir">
          Novo pedido
          <span aria-hidden>→</span>
        </Link>
        <Link className="meus-cta-ghost" href="/">
          Home
        </Link>
      </div>

      {error ? <p className="error-box">{error}</p> : null}

      <section className="meus-list reveal delay-2" aria-live="polite">
        {booting ? <p className="meus-loading">Carregando pedidos…</p> : null}

        {items.length > 0 ? (
          <ul className="meus-cards">
            {items.map((item) => {
              const when = formatWhen(item.createdAt);
              return (
                <li key={item.id}>
                  <Link className="meus-card" href={`/pedir/${item.id}`}>
                    <div className="meus-card-top">
                      <span
                        className={`meus-status meus-status--${statusTone(item.status)}`}
                      >
                        {item.statusLabel}
                      </span>
                      {when ? (
                        <span className="meus-when">{when}</span>
                      ) : null}
                    </div>
                    <h2 className="meus-card-title">{item.title}</h2>
                    <div className="meus-card-meta">
                      <span className="meus-location" aria-label="Local">
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
                      <span className="meus-card-cta" aria-hidden>
                        Ver →
                      </span>
                    </div>
                    {item.status === "open" && item.canEdit === false ? (
                      <p className="meus-card-edit-lock">
                        Edição bloqueada após a primeira indicação
                      </p>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}

        {showEmpty ? (
          <div className="meus-empty">
            <div className="meus-empty-art" aria-hidden>
              <Image
                src="/home/cta-pedir.png"
                alt=""
                width={120}
                height={120}
                className="meus-empty-illustration"
                unoptimized
              />
            </div>
            <h2>Nenhum pedido ainda</h2>
            <p>Quando você publicar um pedido, ele aparece aqui com o status.</p>
            <p className="meus-empty-hint">
              Um título claro e a cidade já bastam para começar.
            </p>
            <Link className="meus-empty-link" href="/pedir">
              Criar meu primeiro pedido
              <span aria-hidden>→</span>
            </Link>
          </div>
        ) : null}
      </section>

      <p className="meus-footer reveal delay-3">
        <Link href="/pedir">Novo pedido</Link>
        <span aria-hidden>·</span>
        <Link href="/">Home</Link>
      </p>
    </main>
  );
}
