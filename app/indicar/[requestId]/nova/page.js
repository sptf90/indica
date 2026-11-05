"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import PlaceSearchPicker from "@/components/PlaceSearchPicker";
import { api } from "@/lib/client-api";

function statusTone(status) {
  if (status === "open") return "ok";
  if (status === "in_evaluation") return "info";
  return "muted";
}

/** Aceita google.com/maps, maps.google.com, maps.app.goo.gl, goo.gl/maps, etc. */
function isGoogleMapsUrl(raw) {
  const text = String(raw || "").trim();
  if (!text) return false;
  try {
    const u = new URL(text);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const path = u.pathname.toLowerCase();
    if (host === "maps.app.goo.gl" || host === "maps.app.goo.gle") return true;
    if (host === "goo.gl" && path.startsWith("/maps")) return true;
    if (host === "maps.google.com" || host.startsWith("maps.google.")) return true;
    if (host === "google.com" || host.endsWith(".google.com")) {
      return path.includes("/maps") || host.startsWith("maps.");
    }
    return false;
  } catch {
    return false;
  }
}

function extractMapsUrl(text) {
  const trimmed = String(text || "").trim();
  if (isGoogleMapsUrl(trimmed)) return trimmed;
  const match = trimmed.match(/https?:\/\/[^\s]+/i);
  if (match && isGoogleMapsUrl(match[0])) return match[0];
  return null;
}

function mapsOpenUrl(cityName, cityState) {
  const query = [cityName, cityState].filter(Boolean).join(" ").trim();
  if (!query) return "https://www.google.com/maps";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default function NovaIndicacaoPage() {
  const { requestId } = useParams();
  const router = useRouter();
  const [request, setRequest] = useState(null);
  const [step, setStep] = useState("form");
  const [description, setDescription] = useState("");
  const [links, setLinks] = useState([""]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [placesUnavailable, setPlacesUnavailable] = useState(false);
  const [placeName, setPlaceName] = useState("");
  const [placeAddress, setPlaceAddress] = useState("");
  const [placeSource, setPlaceSource] = useState("manual");
  const [placeMapsUrl, setPlaceMapsUrl] = useState("");
  const [placeHint, setPlaceHint] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  const onPlacesUnavailable = useCallback(() => {
    setPlacesUnavailable(true);
  }, []);

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

  function applyPlaceAddress(value) {
    setPlaceAddress(value);
    if (isGoogleMapsUrl(value)) {
      setPlaceSource("google_maps");
      setPlaceMapsUrl(value.trim());
    } else {
      setPlaceSource("manual");
      setPlaceMapsUrl("");
    }
  }

  function openMaps() {
    window.open(
      mapsOpenUrl(request?.cityName, request?.cityState),
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function pasteMapsLink() {
    setPlaceHint("");
    setError("");
    try {
      if (!navigator.clipboard?.readText) {
        setPlaceHint("Cole o link manualmente no campo Endereço/link.");
        return;
      }
      const text = await navigator.clipboard.readText();
      const url = extractMapsUrl(text);
      if (!url) {
        setPlaceHint("Link do Maps inválido. Use Partilhar → Copiar link.");
        return;
      }
      applyPlaceAddress(url);
      if (!placeName.trim()) setPlaceName("Local no Maps");
      setPlaceHint("Link do Maps colado.");
    } catch {
      setPlaceHint("Não foi possível ler a área de transferência. Cole manualmente.");
    }
  }

  function buildPlacePayload() {
    if (selectedPlace?.name && selectedPlace?.address) {
      return {
        source: "google_maps",
        placeId: selectedPlace.placeId || null,
        name: selectedPlace.name.trim(),
        address: selectedPlace.address.trim(),
        mapsUrl: selectedPlace.mapsUrl || null,
      };
    }
    if (placeName.trim() && placeAddress.trim()) {
      return {
        source:
          placeSource === "google_maps" || isGoogleMapsUrl(placeAddress)
            ? "google_maps"
            : "manual",
        name: placeName.trim(),
        address: placeAddress.trim(),
        mapsUrl:
          placeMapsUrl.trim() ||
          (isGoogleMapsUrl(placeAddress) ? placeAddress.trim() : null),
      };
    }
    return null;
  }

  function goPreview(event) {
    event.preventDefault();
    setError("");
    if (!description.trim()) {
      setError("Descrição obrigatória.");
      return;
    }
    if (description.trim().length > 500) {
      setError("Descrição deve ter no máximo 500 caracteres.");
      return;
    }
    if (placesUnavailable) {
      const hasName = Boolean(placeName.trim());
      const hasAddress = Boolean(placeAddress.trim());
      if (hasName !== hasAddress) {
        setError("Local exige nome e endereço (ou link do Maps).");
        return;
      }
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
          {error ? <p className="error-box">{error}</p> : null}
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
          <p>Descreva com clareza. Links e local são opcionais.</p>
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
            <p className="indicar-n-group-hint">Site, Instagram, WhatsApp…</p>
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

          <fieldset className="indicar-n-group">
            <legend>
              Local <span className="indicar-n-opt">opcional</span>
            </legend>
            {!placesUnavailable ? (
              <>
                <p className="indicar-n-group-hint">
                  Busque o empreendimento no Google Places — com foto, endereço e
                  sugestões parecidas.
                </p>
                <PlaceSearchPicker
                  cityName={request?.cityName || ""}
                  cityState={request?.cityState || ""}
                  value={selectedPlace}
                  onChange={setSelectedPlace}
                  onUnavailable={onPlacesUnavailable}
                />
              </>
            ) : (
              <>
                <p className="indicar-n-group-hint">
                  Busca Places indisponível. Use nome e endereço — ou link do
                  Google Maps.
                </p>
                <div className="indicar-n-maps-row">
                  <button
                    className="indicar-n-maps-btn"
                    type="button"
                    onClick={openMaps}
                  >
                    Abrir no Maps
                  </button>
                  <button
                    className="indicar-n-maps-btn"
                    type="button"
                    onClick={pasteMapsLink}
                  >
                    Colar link do Maps
                  </button>
                </div>
                <p className="indicar-n-maps-tip">
                  No Maps: Partilhar → Copiar link → volte aqui.
                </p>
                {placeHint ? (
                  <p className="indicar-n-maps-status" role="status">
                    {placeHint}
                  </p>
                ) : null}
                <div className="indicar-n-place-grid">
                  <label className="indicar-n-field indicar-n-field--tight">
                    <span className="indicar-n-label-sm">Nome</span>
                    <input
                      value={placeName}
                      onChange={(e) => setPlaceName(e.target.value)}
                      placeholder="Ex.: Oficina do João"
                      autoComplete="organization"
                    />
                  </label>
                  <label className="indicar-n-field indicar-n-field--tight">
                    <span className="indicar-n-label-sm">Endereço / link</span>
                    <input
                      value={placeAddress}
                      onChange={(e) => applyPlaceAddress(e.target.value)}
                      placeholder="Rua, bairro… ou link do Maps"
                      autoComplete="street-address"
                      inputMode="url"
                    />
                  </label>
                </div>
                {placeSource === "google_maps" ? (
                  <p className="indicar-n-maps-badge">Tipo: Google Maps</p>
                ) : null}
              </>
            )}
          </fieldset>

          <div className="indicar-n-actions">
            <button className="indicar-n-cta" type="submit">
              Pré-visualizar
              <span aria-hidden>→</span>
            </button>
          </div>
        </form>

        {error ? <p className="error-box">{error}</p> : null}
      </section>

      <p className="indicar-n-footer">
        <Link href="/indicar">← Voltar à lista</Link>
      </p>
    </main>
  );
}
