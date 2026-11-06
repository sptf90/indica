"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import IndicationContactFields from "@/components/IndicationContactFields";
import { validateIndicationContact, normalizeWhatsapp } from "@/lib/indication-contact";
import PlaceNavigationLinks from "@/components/PlaceNavigationLinks";
import LocationPicker from "@/components/LocationPicker";
import { api } from "@/lib/client-api";

function statusTone(status) {
  if (status === "open") return "ok";
  if (status === "in_evaluation") return "info";
  return "muted";
}

export default function NovaIndicacaoPage() {
  const { requestId } = useParams();
  const router = useRouter();
  const [request, setRequest] = useState(null);
  const [step, setStep] = useState("form");
  const [description, setDescription] = useState("");
  const [links, setLinks] = useState([""]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api(`/api/indications/eligible/${requestId}`)
      .then((data) => setRequest(data.item))
      .catch((err) => {
        if (err.status === 401) router.push("/login");
        else setError(err.message);
      });
  }, [requestId, router]);

  function cleanLinks() {
    return links.map((l) => l.trim()).filter(Boolean);
  }

  function buildPlacePayload() {
    return selectedPlace?.name?.trim() && selectedPlace?.address?.trim() ? {
      ...selectedPlace, name: selectedPlace.name.trim(), address: selectedPlace.address.trim(),
    } : null;
  }

  function goPreview(event) {
    event.preventDefault();
    setError("");
    if (!request?.acceptsIndications) { setError(request?.message || "Aguarde o carregamento do pedido."); return; }
    try {
      validateIndicationContact(request.contactMode, { place: selectedPlace, whatsappNumber });
    } catch (err) { setError(err.message); return; }
    if (!description.trim()) {
      setError("Descrição obrigatória.");
      return;
    }
    if (description.trim().length > 500) {
      setError("Descrição deve ter no máximo 500 caracteres.");
      return;
    }
    setStep("preview");
  }

  async function publish() {
    setLoading(true);
    setError("");
    try {
      await api("/api/indications", {
        method: "POST",
        body: JSON.stringify({
          requestId: Number(requestId),
          description: description.trim(),
          links: cleanLinks(),
          place: buildPlacePayload(),
          whatsappNumber,
        }),
      });
      setOk("Indicação enviada com sucesso");
      setTimeout(() => {
        router.push("/indicar");
        router.refresh();
      }, 800);
    } catch (err) {
      setError(err.message);
      setStep("form");
    } finally {
      setLoading(false);
    }
  }

  const tone = statusTone(request?.status);
  const previewPlace = buildPlacePayload();

  if (step === "preview") {
    return (
      <main className="page page-indicar-nova">
        <nav className="indicar-n-crumb" aria-label="Navegação">
          <Link href="/indicar">Fazer uma indicação</Link>
          <span aria-hidden>›</span>
          <span>Prévia</span>
        </nav>

        {request ? (
          <aside className="indicar-n-context">
            <p className="indicar-n-context-kicker">Você está indicando para</p>
            <h2 className="indicar-n-context-title">{request.title}</h2>
            <p className="indicar-n-context-meta">
              <span className={`indicar-status indicar-status--${tone}`}>
                {request.statusLabel}
              </span>
              <span>
                {request.cityName} ({request.cityState})
              </span>
            </p>
          </aside>
        ) : null}

        <section className="indicar-n-card">
          <header className="indicar-n-card-head">
            <h1>Prévia da indicação</h1>
            <p>Confira antes de enviar. Ainda dá para editar.</p>
          </header>
          <div className="indicar-n-preview">
            <p>{description}</p>
            {whatsappNumber ? <p>WhatsApp: +{normalizeWhatsapp(whatsappNumber)}</p> : null}
            {cleanLinks().length ? (
              <ul className="indicar-n-preview-links">
                {cleanLinks().map((url) => (
                  <li key={url}>{url}</li>
                ))}
              </ul>
            ) : null}
            {previewPlace ? (
              <div className="indicar-n-preview-place-card">
                {selectedPlace?.photoName ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="indicar-n-preview-place-photo"
                    src={`/api/places/photo?name=${encodeURIComponent(selectedPlace.photoName)}&maxWidthPx=160`}
                    alt=""
                    width={72}
                    height={72}
                  />
                ) : null}
                <div>
                  <p className="indicar-n-preview-place-label">Local</p>
                  <p className="indicar-n-preview-place-name">{previewPlace.name}</p>
                  <p className="indicar-n-preview-place-addr">
                    {previewPlace.address}
                  </p>
                  <PlaceNavigationLinks place={previewPlace} />
                </div>
              </div>
            ) : null}
          </div>
          <div className="indicar-n-actions">
            <button
              className="indicar-n-secondary"
              type="button"
              onClick={() => setStep("form")}
            >
              Voltar para editar
            </button>
            <button
              className="indicar-n-cta"
              type="button"
              onClick={publish}
              disabled={loading}
            >
              {loading ? "Enviando…" : "Confirmar envio"}
              {!loading ? <span aria-hidden>→</span> : null}
            </button>
          </div>
          {request && !request.acceptsIndications ? <p className="error-box" role="status">{request.message}</p> : null}
          {error ? <p className="error-box" role="alert">{error}</p> : null}
          {ok ? <p className="ok-box">{ok}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="page page-indicar-nova">
      <nav className="indicar-n-crumb" aria-label="Navegação">
        <Link href="/indicar">Fazer uma indicação</Link>
        <span aria-hidden>›</span>
        <span>Nova indicação</span>
      </nav>

      {request ? (
        <aside className="indicar-n-context">
          <p className="indicar-n-context-kicker">Você está indicando para</p>
          <h2 className="indicar-n-context-title">{request.title}</h2>
          <p className="indicar-n-context-meta">
            <span className={`indicar-status indicar-status--${tone}`}>
              {request.statusLabel}
            </span>
            <span>
              {request.cityName} ({request.cityState})
            </span>
          </p>
          {request.details ? (
            <p className="indicar-n-context-details">{request.details}</p>
          ) : null}
        </aside>
      ) : null}

      <section className="indicar-n-card">
        <header className="indicar-n-card-head">
          <h1>Nova indicação</h1>
          <p>Descreva sua indicação e informe os dados solicitados no pedido.</p>
        </header>

        <form className="indicar-n-form" onSubmit={goPreview}>
          <label className="indicar-n-field">
            <span className="indicar-n-label">
              Descrição
              <span className="indicar-n-req">obrigatório</span>
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              maxLength={500}
              required
              placeholder="Quem você indica e por quê?"
            />
            <span className="indicar-n-hint">{description.length}/500</span>
          </label>

          <fieldset className="indicar-n-group">
            <legend>Links</legend>
            <p className="indicar-n-group-hint">Site, Instagram e outros links opcionais.</p>
            {links.map((link, index) => (
              <label key={index} className="indicar-n-field indicar-n-field--tight">
                <span className="indicar-n-label-sm">Link {index + 1}</span>
                <input
                  value={link}
                  onChange={(e) => {
                    const next = [...links];
                    next[index] = e.target.value;
                    setLinks(next);
                  }}
                  placeholder="https://"
                  inputMode="url"
                  autoComplete="off"
                />
              </label>
            ))}
            <button
              className="indicar-n-add"
              type="button"
              onClick={() => setLinks([...links, ""])}
            >
              + Adicionar link
            </button>
          </fieldset>

          <IndicationContactFields mode={request?.contactMode} whatsappNumber={whatsappNumber}
            onWhatsappChange={setWhatsappNumber} place={selectedPlace} onPlaceChange={setSelectedPlace}
            cityName={request?.cityName} cityState={request?.cityState} />

          {request && !request.contactMode ? <fieldset className="indicar-n-group">
            <legend>
              Local <span className="indicar-n-opt">opcional</span>
            </legend>
            <LocationPicker cityName={request?.cityName} cityState={request?.cityState}
              value={selectedPlace} onChange={setSelectedPlace} required={false} />
          </fieldset> : null}

          <div className="indicar-n-actions">
            <button className="indicar-n-cta" type="submit" disabled={!request?.acceptsIndications}>
              Pré-visualizar
              <span aria-hidden>→</span>
            </button>
          </div>
        </form>

        {request && !request.acceptsIndications ? <p className="error-box" role="status">{request.message}</p> : null}
        {error ? <p className="error-box" role="alert">{error}</p> : null}
      </section>

      <p className="indicar-n-footer">
        <Link href="/indicar">← Voltar à lista</Link>
      </p>
    </main>
  );
}
