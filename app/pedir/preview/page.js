"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";

const DRAFT_KEY = "indica_request_draft";

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export default function PedirPreviewPage() {
  const router = useRouter();
  const [draft, setDraft] = useState(null);
  const [cityLabel, setCityLabel] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) {
      router.replace("/pedir");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setDraft(parsed);
      if (parsed.cityLabel) {
        setCityLabel(parsed.cityLabel);
      } else if (parsed.cityName && parsed.state) {
        setCityLabel(`${parsed.cityName} (${parsed.state})`);
      } else {
        api("/api/cities").then((data) => {
          const city = (data.cities || []).find(
            (c) => Number(c.id) === Number(parsed.cityId)
          );
          setCityLabel(city ? city.label : "");
        });
      }
    } catch {
      router.replace("/pedir");
    }
  }, [router]);

  async function publish() {
    if (!draft) return;
    setLoading(true);
    setError("");
    try {
      await api("/api/requests", {
        method: "POST",
        body: JSON.stringify(draft),
      });
      sessionStorage.removeItem(DRAFT_KEY);
      setOk("Pedido publicado com sucesso.");
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!draft) {
    return (
      <main className="page page-previa">
        <p className="page-previa-loading">Carregando prévia…</p>
      </main>
    );
  }

  const details = (draft.details || "").trim();

  return (
    <main className="page page-previa">
      <nav className="page-previa-crumb" aria-label="Navegação">
        <Link href="/pedir">Pedir indicação</Link>
        <span aria-hidden>›</span>
        <span>Prévia</span>
      </nav>

      <header className="page-previa-head">
        <p className="eyebrow">Prévia</p>
        <h1 className="page-previa-title">Prévia do pedido</h1>
        <p className="page-previa-lead">
          Confira os dados antes de publicar. Ainda dá para voltar e editar.
        </p>
      </header>

      <section className="page-previa-card" aria-labelledby="previa-card-title">
        <header className="page-previa-card-head">
          <h2 id="previa-card-title" className="page-previa-card-title">
            {draft.title}
          </h2>
          <p className="page-previa-city">
            <span className="page-previa-city-icon" aria-hidden>
              <PinIcon />
            </span>
            {cityLabel || "Cidade não informada"}
          </p>
        </header>

        <dl className="page-previa-fields">
          <div className="page-previa-field">
            <dt>Título</dt>
            <dd>{draft.title}</dd>
          </div>
          <div className="page-previa-field">
            <dt>Cidade</dt>
            <dd>{cityLabel || "—"}</dd>
          </div>
          <div className="page-previa-field page-previa-field--block">
            <dt>Detalhes</dt>
            <dd className={details ? undefined : "page-previa-empty"}>
              {details || "Nenhum detalhe informado"}
            </dd>
          </div>
        </dl>
      </section>

      <div className="page-previa-actions">
        <Link className="page-previa-cta-secondary" href="/pedir">
          Voltar para editar
        </Link>
        <button
          className="page-previa-cta"
          type="button"
          onClick={publish}
          disabled={loading}
        >
          {loading ? "Publicando…" : "Confirmar publicação"}
        </button>
      </div>

      {error ? <p className="error-box">{error}</p> : null}
      {ok ? <p className="ok-box">{ok}</p> : null}
    </main>
  );
}
