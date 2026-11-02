"use client";

import { useEffect, useState } from "react";

const LABELS = {
  connected: "conectado",
  not_configured: "não configurado",
  error: "erro",
};

export default function HealthStatus() {
  const [health, setHealth] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/health")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setHealth(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  let body = <p>Consultando /api/health…</p>;

  if (failed) {
    body = <p>Não foi possível consultar /api/health.</p>;
  } else if (health) {
    const label = LABELS[health.database] || health.database;
    body = (
      <>
        <p>
          Banco: <strong className={health.database}>{label}</strong>
        </p>
        {health.error ? <p className="error">{health.error}</p> : null}
      </>
    );
  }

  return (
    <section className="health" aria-live="polite">
      <h2>Saúde do banco</h2>
      {body}
    </section>
  );
}
