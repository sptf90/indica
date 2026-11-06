"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client-api";

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
    status === "pending" ||
    status === "submitted" ||
    status === "under_review" ||
    status === "awaiting_correction"
  ) {
    return "emp-status emp-status-pending";
  }
  if (status === "redeemed" || status === "approved") {
    return "emp-status emp-status-ok";
  }
  if (status === "expired" || status === "rejected") {
    return "emp-status emp-status-bad";
  }
  return "emp-status";
}

export default function EmpresaResgatesPage() {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState("loading");
  const [company, setCompany] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const pendingRewards = useMemo(
    () => rewards.filter((r) => r.status === "pending").length,
    [rewards]
  );

  const load = useCallback(async () => {
    const [me, rewardData] = await Promise.all([
      api("/api/empresa"),
      api("/api/empresa/rewards"),
    ]);
    setCompany(me.company);
    setRewards(rewardData.items || []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api("/api/auth/me");
        if (cancelled) return;
        if (!me.user?.isCompany && !me.user?.isAdmin) {
          setMode("denied");
          setReady(true);
          return;
        }
        await load();
        if (cancelled) return;
        setMode("ok");
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        if (err.status === 401) {
          setMode("denied");
        } else {
          setError(err.message);
          setMode("ok");
        }
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function onConfirmReward(id) {
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      const data = await api(`/api/empresa/rewards/${id}/confirm`, {
        method: "POST",
      });
      setSuccess(data.message || "Resgate confirmado.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!ready || mode === "loading") {
    return (
      <main className="page page-empresa">
        <p className="muted">Carregando…</p>
      </main>
    );
  }

  if (mode === "denied") {
    return (
      <main className="page page-empresa">
        <section className="emp-panel reveal">
          <h1>Resgates</h1>
          <p className="muted">
            Só contas empresariais confirmam resgates.{" "}
            <Link href="/login">Entrar</Link> ou{" "}
            <Link href="/empresa">área da empresa</Link>.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="page page-empresa">
      <section className="emp-hero emp-hero-compact reveal" data-tour="emp-hero">
        <div className="emp-hero-main">
          <p className="eyebrow">Área da empresa</p>
          <h1>Resgates</h1>
          <p className="lead emp-hero-lead">
            Confirme benefícios dos ganhadores da sua campanha — fora do fluxo
            de patrocínio.
          </p>
        </div>
        <div className="emp-hero-meta">
          <div className="emp-hero-stats">
            <span>
              <strong>{pendingRewards}</strong> pendentes
            </span>
            <span>
              <strong>{rewards.length}</strong> no total
            </span>
          </div>
          <Link href="/empresa" className="pill-outline sm">
            Voltar ao patrocínio
          </Link>
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

      <section
        className="emp-panel reveal"
        data-tour="emp-rewards"
      >
        <header className="emp-panel-head">
          <h2>
            {company?.legalName
              ? `Campanha · ${company.legalName}`
              : "Campanha"}
          </h2>
          <p className="muted emp-lead">
            Pendente → você confirma → resgatado. Prazos expirados fecham
            sozinhos.
          </p>
        </header>
        {rewards.length === 0 ? (
          <p className="muted">Nenhum benefício a confirmar.</p>
        ) : (
          <ul className="emp-list">
            {rewards.map((rw) => (
              <li key={rw.id} className="emp-list-item emp-reward">
                <div>
                  <strong>
                    {rw.finalPosition}º · @{rw.username}
                  </strong>
                  <p className="muted">{rw.rankingTitle}</p>
                  <p className="emp-reward-benefit">{rw.benefitText}</p>
                  <p className="hint">
                    Validade até {formatPeriod(rw.expiresAt)}
                    {rw.redeemedAt
                      ? ` · confirmado em ${formatPeriod(rw.redeemedAt)}`
                      : ""}
                  </p>
                </div>
                <div className="emp-reward-actions">
                  <span className={statusClass(rw.status)}>
                    {rw.statusLabel}
                  </span>
                  {rw.status === "pending" ? (
                    <button
                      type="button"
                      className="pill-cta sm"
                      disabled={busy}
                      onClick={() => onConfirmReward(rw.id)}
                    >
                      Confirmar resgate
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
