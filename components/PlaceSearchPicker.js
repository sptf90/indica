"use client";

import { useEffect, useId, useRef, useState } from "react";
import { api } from "@/lib/client-api";

function photoSrc(photoName, maxWidthPx = 160) {
  if (!photoName) return null;
  return `/api/places/photo?name=${encodeURIComponent(photoName)}&maxWidthPx=${maxWidthPx}`;
}

function PlaceThumb({ place, size = 56 }) {
  const src = photoSrc(place?.photoName, size * 2);
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <span className="place-pick-thumb place-pick-thumb--empty" aria-hidden>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
          <path
            d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="place-pick-thumb"
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
}

function PlaceResultButton({
  place,
  active,
  onSelect,
  optionId,
}) {
  return (
    <button
      type="button"
      id={optionId}
      role="option"
      aria-selected={active}
      className={`place-pick-item${active ? " is-active" : ""}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onSelect(place)}
    >
      <PlaceThumb place={place} />
      <span className="place-pick-item-body">
        <span className="place-pick-item-name">{place.name}</span>
        <span className="place-pick-item-addr">
          {place.shortAddress || place.address}
        </span>
        {place.rating != null ? (
          <span className="place-pick-item-meta">
            ★ {Number(place.rating).toFixed(1)}
            {place.userRatingCount
              ? ` · ${place.userRatingCount} avaliações`
              : ""}
            {place.primaryTypeLabel ? ` · ${place.primaryTypeLabel}` : ""}
          </span>
        ) : place.primaryTypeLabel ? (
          <span className="place-pick-item-meta">{place.primaryTypeLabel}</span>
        ) : null}
      </span>
    </button>
  );
}

/**
 * @param {{
 *   cityName?: string,
 *   cityState?: string,
 *   value: null | {
 *     placeId: string,
 *     name: string,
 *     address: string,
 *     mapsUrl?: string | null,
 *     photoName?: string | null,
 *     primaryType?: string | null,
 *     primaryTypeLabel?: string | null,
 *     location?: { lat: number, lng: number } | null,
 *   },
 *   onChange: (place: object | null) => void,
 *   onUnavailable?: () => void,
 * }} props
 */
export default function PlaceSearchPicker({
  cityName = "",
  cityState = "",
  value,
  onChange,
  onUnavailable,
}) {
  const listId = useId();
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  const [configured, setConfigured] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [similar, setSimilar] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    api("/api/places/status")
      .then((data) => {
        if (cancelled) return;
        const ok = Boolean(data.configured);
        setConfigured(ok);
        if (!ok) onUnavailable?.();
      })
      .catch(() => {
        if (cancelled) return;
        setConfigured(false);
        onUnavailable?.();
      });
    return () => {
      cancelled = true;
    };
  }, [onUnavailable]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!value?.placeId || !value?.location) {
      setSimilar([]);
      return;
    }
    let cancelled = false;
    setSimilarLoading(true);
    const params = new URLSearchParams({
      mode: "similar",
      lat: String(value.location.lat),
      lng: String(value.location.lng),
      excludePlaceId: value.placeId,
    });
    if (cityName) params.set("cityName", cityName);
    if (cityState) params.set("cityState", cityState);
    if (value.primaryType) params.set("primaryType", value.primaryType);
    if (value.primaryTypeLabel) params.set("typeLabel", value.primaryTypeLabel);

    api(`/api/places/search?${params}`)
      .then((data) => {
        if (cancelled) return;
        setSimilar((data.items || []).slice(0, 6));
      })
      .catch(() => {
        if (cancelled) return;
        setSimilar([]);
      })
      .finally(() => {
        if (!cancelled) setSimilarLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [value?.placeId, value?.location?.lat, value?.location?.lng, value?.primaryType, value?.primaryTypeLabel, cityName, cityState]);

  function runSearch(raw) {
    const q = String(raw || "").trim();
    if (abortRef.current) abortRef.current.abort();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      setStatus("");
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError("");
    setStatus("Buscando…");

    const params = new URLSearchParams({ q });
    if (cityName) params.set("cityName", cityName);
    if (cityState) params.set("cityState", cityState);

    fetch(`/api/places/search?${params}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          if (res.status === 503) {
            setConfigured(false);
            onUnavailable?.();
          }
          throw new Error(data?.error || "Falha na busca");
        }
        return data;
      })
      .then((data) => {
        const items = data.items || [];
        setResults(items);
        setOpen(true);
        setActiveIndex(items.length ? 0 : -1);
        setStatus(
          items.length
            ? `${items.length} resultado${items.length === 1 ? "" : "s"}`
            : "Nenhum estabelecimento encontrado"
        );
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setResults([]);
        setError(err.message || "Erro na busca");
        setStatus("");
      })
      .finally(() => {
        if (abortRef.current === controller) setLoading(false);
      });
  }

  function onQueryChange(next) {
    setQuery(next);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(next), 320);
  }

  function selectPlace(place) {
    onChange({
      placeId: place.placeId,
      name: place.name,
      address: place.address,
      mapsUrl: place.mapsUrl || null,
      photoName: place.photoName || null,
      photoAttributions: place.photoAttributions || [],
      primaryType: place.primaryType || null,
      primaryTypeLabel: place.primaryTypeLabel || null,
      location: place.location || null,
      rating: place.rating ?? null,
      userRatingCount: place.userRatingCount ?? null,
    });
    setQuery("");
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
    setStatus(`${place.name} selecionado`);
    setError("");
  }

  function clearSelection() {
    onChange(null);
    setSimilar([]);
    setQuery("");
    setResults([]);
    setStatus("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function onKeyDown(event) {
    if (!open || !results.length) {
      if (event.key === "Escape") setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectPlace(results[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  if (configured === false) return null;
  if (configured === null) {
    return (
      <div className="place-pick place-pick--boot" aria-busy="true">
        <p className="place-pick-boot">Carregando busca de locais…</p>
      </div>
    );
  }

  return (
    <div className="place-pick">
      {value ? (
        <div className="place-pick-selected" aria-live="polite">
          <PlaceThumb place={value} size={72} />
          <div className="place-pick-selected-body">
            <p className="place-pick-selected-kicker">Selecionado</p>
            <p className="place-pick-selected-name">{value.name}</p>
            <p className="place-pick-selected-addr">{value.address}</p>
            {value.rating != null ? (
              <p className="place-pick-selected-meta">
                ★ {Number(value.rating).toFixed(1)}
                {value.userRatingCount
                  ? ` · ${value.userRatingCount} avaliações`
                  : ""}
              </p>
            ) : null}
            {value.mapsUrl ? (
              <a
                className="place-pick-maps-link"
                href={value.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver no Google Maps
              </a>
            ) : null}
          </div>
          <button
            type="button"
            className="place-pick-clear"
            onClick={clearSelection}
          >
            Trocar
          </button>
        </div>
      ) : (
        <div className="place-pick-search">
          <label className="indicar-n-field indicar-n-field--tight" htmlFor={`${listId}-input`}>
            <span className="indicar-n-label-sm">Buscar estabelecimento</span>
            <div className="place-pick-input-wrap">
              <input
                ref={inputRef}
                id={`${listId}-input`}
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onFocus={() => {
                  if (results.length) setOpen(true);
                }}
                onBlur={() => {
                  setTimeout(() => setOpen(false), 120);
                }}
                onKeyDown={onKeyDown}
                placeholder={
                  cityName
                    ? `Ex.: padaria, oficina… em ${cityName}`
                    : "Nome do lugar, tipo ou endereço"
                }
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                role="combobox"
                aria-expanded={open}
                aria-controls={`${listId}-list`}
                aria-autocomplete="list"
                aria-activedescendant={
                  activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
                }
              />
              {loading ? (
                <span className="place-pick-spinner" aria-hidden />
              ) : null}
            </div>
          </label>

          <div className="place-pick-sr" aria-live="polite">
            {status}
          </div>

          {open && (results.length > 0 || (!loading && query.trim().length >= 2)) ? (
            <div
              className="place-pick-dropdown"
              id={`${listId}-list`}
              role="listbox"
              aria-label="Resultados da busca"
            >
              {results.length ? (
                results.map((place, index) => (
                  <PlaceResultButton
                    key={place.placeId}
                    place={place}
                    active={index === activeIndex}
                    onSelect={selectPlace}
                    optionId={`${listId}-opt-${index}`}
                  />
                ))
              ) : (
                <p className="place-pick-empty">
                  Nenhum resultado. Tente outro nome ou inclua o bairro.
                </p>
              )}
            </div>
          ) : null}
        </div>
      )}

      {value ? (
        <div className="place-pick-similar">
          <div className="place-pick-similar-head">
            <h3>Parecidos por perto</h3>
            <p>
              Outras opções na região
              {value.primaryTypeLabel ? ` · ${value.primaryTypeLabel}` : ""}
            </p>
          </div>
          {similarLoading ? (
            <p className="place-pick-similar-loading">Buscando parecidos…</p>
          ) : similar.length ? (
            <ul className="place-pick-similar-list">
              {similar.map((place) => (
                <li key={place.placeId}>
                  <button
                    type="button"
                    className="place-pick-similar-card"
                    onClick={() => selectPlace(place)}
                  >
                    <PlaceThumb place={place} size={52} />
                    <span className="place-pick-item-body">
                      <span className="place-pick-item-name">{place.name}</span>
                      <span className="place-pick-item-addr">
                        {place.shortAddress || place.address}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="place-pick-similar-loading">
              Sem sugestões parecidas no momento.
            </p>
          )}
        </div>
      ) : null}

      {error ? <p className="place-pick-error">{error}</p> : null}
      <p className="place-pick-attr">
        Resultados e fotos via Google Places. Atribuições podem aparecer nas
        imagens.
      </p>
    </div>
  );
}
