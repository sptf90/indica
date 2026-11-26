"use client";

import MobileHelp from "@/components/MobileHelp";
import RequestPhoto from "@/components/RequestPhoto";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { contactModeLabel, isRequestContactMode } from "@/lib/indication-contact";
import { api } from "@/lib/client-api";
import { clearRequestDraft, loadRequestDraft } from "@/lib/request-draft";

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
  const [photoSrc, setPhotoSrc] = useState("");
  const [cityLabel, setCityLabel] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    let src = "";
    loadRequestDraft().then(async (data) => {
      if (!active) return;
      if (!isRequestContactMode(data?.contactMode) || data.photoUnavailable) {
        router.replace("/pedir");
        return;
      }
      if (data.photo) {
        src = URL.createObjectURL(data.photo);
        setPhotoSrc(src);
      }
      setDraft(data);
      if (data.cityLabel) {
        setCityLabel(data.cityLabel);
      } else if (data.cityName && data.state) {
        setCityLabel(`${data.cityName} (${data.state})`);
      } else {
        const result = await api("/api/cities");
        if (active) {
          const city = (result.cities || []).find(
            (c) => Number(c.id) === Number(data.cityId)
          );
          setCityLabel(city ? city.label : "");
        }
      }
    }).catch(() => {
      if (active) router.replace("/pedir");
    });
    return () => {
      active = false;
      if (src) URL.revokeObjectURL(src);
    };
  }, [router]);

  async function publish() {
    if (!draft || loading || ok) return;
    setLoading(true);
    setError("");
    try {
      const { photo, ...fields } = draft;
      let body = JSON.stringify(fields);
      if (photo) {
        const form = new FormData();
        for (const [key, value] of Object.entries(fields)) form.set(key, value);
        form.set("photo", photo);
        body = form;
      }
      await api("/api/requests", { method: "POST", body });
      clearRequestDraft();
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
        <MobileHelp heading={<h1 className="page-previa-title">Prévia do pedido</h1>} className="page-previa-lead" label="O que conferir na prévia">
          Confira os dados antes de publicar. Ainda dá para voltar e editar.
        </MobileHelp>
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
          <div className="page-previa-field"><dt>Receber</dt><dd>{contactModeLabel(draft.contactMode)}</dd></div>
          <div className="page-previa-field page-previa-field--block">
            <dt>Detalhes</dt>
            <dd className={details ? undefined : "page-previa-empty"}>
              {details || "Nenhum detalhe informado"}
            </dd>
          </div>
          {photoSrc ? (
            <div className="page-previa-field page-previa-field--block">
              <dt>Foto</dt>
              <dd><RequestPhoto src={photoSrc} /></dd>
            </div>
          ) : null}
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
          disabled={loading || Boolean(ok)}
        >
          {loading ? "Publicando…" : "Confirmar publicação"}
        </button>
      </div>

      {error ? <p className="error-box">{error}</p> : null}
      {ok ? <p className="ok-box">{ok}</p> : null}
    </main>
  );
}
