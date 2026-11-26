"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import IndicationContactFields from "@/components/IndicationContactFields";
import RequestPhoto from "@/components/RequestPhoto";
import { validateIndicationContact, normalizeWhatsapp, contactModeLabel, needsMaps, needsWhatsapp } from "@/lib/indication-contact";
import { hasPlaceData } from "@/lib/location";
import PlaceNavigationLinks from "@/components/PlaceNavigationLinks";
import LocationPicker from "@/components/LocationPicker";
import { api } from "@/lib/client-api";
import { MAX_DESCRIPTION } from "@/lib/constants";

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
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [contactName, setContactName] = useState("");
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

  function buildPlacePayload() {
    return hasPlaceData(selectedPlace) ? {
      ...selectedPlace, name: selectedPlace.name?.trim() || "", address: selectedPlace.address?.trim() || "",
    } : null;
  }

  function goPreview(event) {
    event.preventDefault();
    setError("");
    if (!request?.acceptsIndications) { setError(request?.message || "Aguarde o carregamento do pedido."); return; }
    try {
      validateIndicationContact(request.contactMode, { place: selectedPlace, whatsappNumber, contactName, description });
    } catch (err) { setError(err.message); return; }
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
          place: buildPlacePayload(),
          whatsappNumber,
          contactName,
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
  const previewPlace = needsMaps(request?.contactMode) || !request?.contactMode ? buildPlacePayload() : null;

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
            <p>O solicitante deseja receber: <strong>{contactModeLabel(request.contactMode)}</strong>.</p>
            <p className="indicar-n-context-meta">
              <span className={`indicar-status indicar-status--${tone}`}>
                {request.statusLabel}
              </span>
              <span>
                {request.cityName} ({request.cityState})
              </span>
            </p>
            <RequestPhoto src={request.photoUrl} />
          </aside>
        ) : null}

        <section className="indicar-n-card">
          <header className="indicar-n-card-head">
            <h1>Prévia da indicação</h1>
            <p>Confira antes de enviar. Ainda dá para editar.</p>
          </header>
          <div className="indicar-n-preview">
            {description.trim() ? <p>{description.trim()}</p> : null}
            {request?.contactMode === "whatsapp" ? <p><strong>{contactName}</strong></p> : null}
            {needsWhatsapp(request?.contactMode) && whatsappNumber ? <p><a href={`https://wa.me/${normalizeWhatsapp(whatsappNumber)}`} target="_blank" rel="noreferrer">WhatsApp: +{normalizeWhatsapp(whatsappNumber)}</a></p> : null}
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
                  <p className="indicar-n-preview-place-name">{previewPlace.name || "Local indicado"}</p>
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
            <p>O solicitante deseja receber: <strong>{contactModeLabel(request.contactMode)}</strong>.</p>
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
          <RequestPhoto src={request.photoUrl} />
        </aside>
      ) : null}

      <section className="indicar-n-card">
        <header className="indicar-n-card-head">
          <h1>Nova indicação</h1>
          <p>Informe os dados solicitados no pedido.</p>
        </header>

        <form className="indicar-n-form" onSubmit={goPreview}>
          <label className="indicar-n-field">
            <span className="indicar-n-label">
              Descrição
              <span className="indicar-n-opt">opcional</span>
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={MAX_DESCRIPTION}
              placeholder="Quer acrescentar algum detalhe sobre a indicação?"
            />
            <span className="indicar-n-hint">{description.length}/{MAX_DESCRIPTION}</span>
          </label>

          <IndicationContactFields mode={request?.contactMode} contactName={contactName} onContactNameChange={setContactName} whatsappNumber={whatsappNumber}
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
