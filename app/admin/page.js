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

const PREVIEW_CARDS = [
  {
    mode: "user",
    title: "Ver como usuário",
    body: "Navegação e permissões de pessoa: pedir, indicar, rankings e perfil.",
  },
  {
    mode: "company",
    title: "Ver como empresa",
    body: "Painel empresarial: patrocínio, resgates e ranking da marca.",
  },
];

export default function AdminHomePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState("");

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

  async function enterPreview(mode) {
    setPreviewError("");
    setPreviewLoading(mode);
    try {
      const data = await api("/api/admin/view-as", {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
      window.dispatchEvent(new Event("goindica:auth-changed"));
      router.push(data.redirectTo || (mode === "company" ? "/empresa" : "/"));
      router.refresh();
    } catch (err) {
      setPreviewError(err.message || "Não foi possível abrir a prévia.");
      setPreviewLoading("");
    }
  }

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
            Escolha o que quer gerir. Acesse também as áreas de usuário e empresa pelo menu.
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

      <section className="admin-preview-section">
        <div className="admin-hero-main">
          <p className="eyebrow">Prévia</p>
          <h2 className="admin-preview-title">Ver o app como outra conta</h2>
          <p className="lead admin-lead">
            Abre as mesmas telas e permissões de usuário ou empresa, sem trocar
            de login. Use o header para voltar.
          </p>
        </div>
        {previewError ? (
          <p className="form-error" role="alert">
            {previewError}
          </p>
        ) : null}
        <ul className="admin-home-grid" role="list">
          {PREVIEW_CARDS.map((card) => (
            <li key={card.mode}>
              <button
                type="button"
                className="admin-home-card admin-home-card-button"
                disabled={Boolean(previewLoading)}
                onClick={() => enterPreview(card.mode)}
              >
                <strong>{card.title}</strong>
                <span>
                  {previewLoading === card.mode ? "Abrindo…" : card.body}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
