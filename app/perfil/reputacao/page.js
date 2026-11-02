"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ReputationBadge from "@/components/ReputationBadge";
import { api } from "@/lib/client-api";

function formatDelta(delta) {
  const n = Number(delta) || 0;
  if (n > 0) return `+${n}`;
  return String(n);
}

export default function ReputacaoHistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api("/api/auth/me"),
      api("/api/profile/reputation-history?limit=100"),
    ])
      .then(([me, hist]) => {
        setUser(me.user);
        setHistory(hist.items || []);
      })
      .catch((err) => {
        if (err.status === 401) router.replace("/login");
        else setError(err.message);
      });
  }, [router]);

  if (!user && !error) {
    return (
      <main className="page">
        <p className="muted">Carregando…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page">
        <p className="error-box">{error}</p>
      </main>
    );
  }

  return (
    <main className="page page-wide">
      <p className="eyebrow">Privado</p>
      <h1>Histórico de reputação</h1>
      <div className="perfil-rep-hero">
        <ReputationBadge
          reputation={user.reputation}
          hasEvaluations={user.hasEvaluations}
          selectedAndEvaluatedCount={user.selectedAndEvaluatedCount}
          reputationLabel={user.reputationLabel}
          size="profile"
        />
      </div>
      <p className="muted">
        Cada linha: data, pedido, resultado, reputação anterior → variação →
        posterior.
      </p>

      {history.length === 0 ? (
        <p className="muted">Sem avaliações ainda.</p>
      ) : (
        <ul className="activity-list" style={{ marginTop: "1.25rem" }}>
          {history.map((item) => (
            <li key={item.id}>
              <div className="activity-row static">
                <span className="activity-body">
                  <span className="activity-title">{item.requestTitle}</span>
                  <span className="activity-meta">
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleString("pt-BR")
                      : ""}
                    {" · "}
                    {item.outcome === "valid" ? "Válida" : "Não válida"}
                    {" · "}
                    {item.reputationBefore} → {formatDelta(item.delta)} →{" "}
                    {item.reputationAfter}
                  </span>
                </span>
                <span
                  className={`status-badge ${
                    item.outcome === "valid" ? "ok" : "muted"
                  }`}
                >
                  {formatDelta(item.delta)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="auth-note">
        <Link href="/perfil">Voltar ao perfil</Link>
      </p>
    </main>
  );
}
