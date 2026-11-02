"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";

const CARDS = [
  {
    href: "/admin/patrocinios",
    title: "Patrocínios",
    body: "Aprovar, rejeitar ou ativar solicitações das empresas.",
  },
  {
    href: "/admin/rankings/mensal",
    title: "Rankings mensais",
    body: "Ver períodos por cidade: finalizados, ativos e agendados.",
  },
  {
    href: "/admin/rankings/semanal",
    title: "Rankings semanais",
    body: "Mesma gestão, na modalidade semanal.",
  },
];

export default function AdminHomePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState("");

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
  }, [router]);

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
        <section className="admin-hero admin-hero-compact">
          <p className="eyebrow">Admin</p>
          <h1>Acesso restrito</h1>
          <p className="lead admin-lead">
            Só administradores acessam esta área.
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
    <main className="page page-admin page-admin-home">
      <section className="admin-hero admin-hero-compact">
        <div className="admin-hero-main">
          <p className="eyebrow">Admin</p>
          <h1>Gestão</h1>
          <p className="lead admin-lead">
            Escolha o que quer gerir. Sem pedidos nem indicações da comunidade.
          </p>
        </div>
      </section>

      <ul className="admin-home-grid" role="list">
        {CARDS.map((card) => (
          <li key={card.href}>
            <Link href={card.href} className="admin-home-card">
              <strong>{card.title}</strong>
              <span>{card.body}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
