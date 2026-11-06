"use client";

import { useEffect, useId, useRef, useState } from "react";
import { coordinatesOf } from "@/lib/location";

/** Busca explícita: evita chamadas pagas a cada tecla e descarta respostas antigas. */
export default function MapPlaceSearch({ cityName, cityState, onResults, onSelect, selectedId }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const requestRef = useRef(null);
  useEffect(() => () => requestRef.current?.abort(), []);

  function changeQuery(text) {
    requestRef.current?.abort(); requestRef.current = null;
    setQuery(text); setResults([]); onResults([]); setLoading(false); setMessage(""); setError("");
  }
  async function search() {
    const q = query.trim();
    if (q.length < 2) { setError("Digite pelo menos 2 caracteres para buscar."); return; }
    requestRef.current?.abort();
    const controller = new AbortController(); requestRef.current = controller;
    setLoading(true); setError(""); setMessage(""); setResults([]); onResults([]);
    try {
      const params = new URLSearchParams({ q, cityName, cityState, purpose: "map" });
      const response = await fetch(`/api/places/search?${params}`, { signal: controller.signal });
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(data.error || "Não foi possível buscar os estabelecimentos.");
      const places = (data.items || []).filter(place => place.placeId && place.name && place.address && coordinatesOf(place)).slice(0, 8);
      setResults(places); onResults(places);
      setMessage(places.length ? `${places.length} resultado${places.length === 1 ? "" : "s"}. Selecione na lista ou no mapa.` : "Nenhum estabelecimento encontrado. Tente outro nome ou marque o ponto manualmente.");
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message || "Erro na busca. Tente novamente ou marque o ponto manualmente.");
    } finally {
      if (requestRef.current === controller) setLoading(false);
    }
  }
  return <div className="map-place-search">
    <label htmlFor={id}>Buscar estabelecimento</label>
    <div className="map-place-search-row">
      <input id={id} value={query} maxLength={200} placeholder="Ex.: Muffato" autoComplete="off"
        onChange={event => changeQuery(event.target.value)} onKeyDown={event => {
          if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); search(); }
        }} />
      <button className="indicar-n-maps-btn" type="button" disabled={loading} onClick={search}>{loading ? "Buscando…" : "Buscar"}</button>
    </div>
    <p className="muted">{cityName ? `Busca em ${cityName}${cityState ? ` (${cityState})` : ""}. ` : ""}Você também pode marcar um ponto manualmente.</p>
    <p role="status" aria-live="polite">{loading ? "Buscando estabelecimentos…" : message}</p>
    {error ? <p className="error-box" role="alert">{error} A marcação manual continua disponível.</p> : null}
    {results.length ? <ol className="map-place-results" aria-label="Estabelecimentos encontrados">
      {results.map((place, index) => <li key={place.placeId}>
        <button type="button" className={`map-place-result${selectedId === place.placeId ? " is-selected" : ""}`}
          aria-pressed={selectedId === place.placeId} onClick={() => onSelect(place)}>
          <span aria-hidden="true">{index + 1}.</span>
          <span><strong>{place.name}</strong><span>{place.address}</span></span>
        </button>
      </li>)}
    </ol> : null}
  </div>;
}
