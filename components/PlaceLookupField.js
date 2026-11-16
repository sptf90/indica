"use client";

import { useEffect, useId, useRef, useState } from "react";
import { hasPlaceData } from "@/lib/location";

/** Nome e endereço consultam o mesmo catálogo, com debounce e cancelamento. */
export default function PlaceLookupField({ label, value, onChange, onSelect, cityName = "", cityState = "", kind, maxLength, resetKey }) {
  const id = useId();
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const requestRef = useRef(null);
  const sequenceRef = useRef(0);
  const [state, setState] = useState({ resetKey, query: "", items: [], loading: false, error: "", searched: false });

  function cancel() {
    clearTimeout(timerRef.current);
    requestRef.current?.abort();
    sequenceRef.current += 1;
  }
  useEffect(() => {
    clearTimeout(timerRef.current);
    requestRef.current?.abort();
    sequenceRef.current += 1;
    return () => { clearTimeout(timerRef.current); requestRef.current?.abort(); sequenceRef.current += 1; };
  }, [resetKey, cityName, cityState]);

  async function search(raw) {
    cancel();
    const query = raw.trim();
    if (query.length < 2) return;
    if (query.length > 200) {
      setState({ resetKey, query, items: [], loading: false, error: "Use até 200 caracteres para buscar. O texto preenchido foi mantido.", searched: false });
      return;
    }
    const sequence = sequenceRef.current;
    const controller = new AbortController();
    requestRef.current = controller;
    setState({ resetKey, query, items: [], loading: true, error: "", searched: false });
    try {
      const params = new URLSearchParams({ q: query, cityName, cityState, purpose: "map" });
      const response = await fetch(`/api/places/search?${params}`, { signal: controller.signal });
      const data = await response.json();
      if (controller.signal.aborted || sequence !== sequenceRef.current) return;
      if (!response.ok) throw new Error(data.error || "Não foi possível buscar os locais.");
      const items = (data.items || []).filter(item => item.placeId && hasPlaceData(item));
      setState({ resetKey, query, items, loading: false, error: "", searched: true });
    } catch (error) {
      if (!controller.signal.aborted && sequence === sequenceRef.current) {
        setState({ resetKey, query, items: [], loading: false, error: error.message, searched: false });
      }
    }
  }

  function change(text) {
    cancel();
    onChange(text);
    setState({ resetKey, query: text.trim(), items: [], loading: false, error: "", searched: false });
    if (text.trim().length >= 3) timerRef.current = setTimeout(() => search(text), 450);
  }
  const current = state.resetKey === resetKey && state.query === value.trim();
  return (
    <div className="place-lookup-field">
      <label htmlFor={id}>{label}</label>
      <div className="map-place-search-row">
        <input ref={inputRef} id={id} value={value} onChange={event => change(event.target.value)}
          maxLength={maxLength} autoComplete="off" placeholder={kind === "name" ? "Ex.: Oficina do João" : "Rua, número, bairro e cidade"}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); search(value); } }} />
        <button className="indicar-n-maps-btn" type="button" disabled={value.trim().length < 2 || (current && state.loading)} onClick={() => search(value)}>
          {current && state.loading ? "Buscando…" : kind === "name" ? "Buscar nome" : "Buscar endereço"}
        </button>
      </div>
      {current && state.loading ? <p className="indicar-n-hint" role="status">Buscando locais…</p> : null}
      {current && state.error ? <p className="indicar-n-hint" role="status">{state.error} Você pode manter o texto ou selecionar no mapa.</p> : null}
      {current && state.searched && !state.items.length ? <p className="indicar-n-hint" role="status">Nenhum local encontrado. Tente outro termo ou mantenha o texto informado.</p> : null}
      {current && state.items.length ? <>
        <ul className="map-place-results" aria-label={`Resultados por ${kind === "name" ? "nome" : "endereço"}`}>
          {state.items.map(place => <li key={place.placeId}>
            <button className="map-place-result place-lookup-result" type="button" onClick={() => {
              cancel(); setState({ resetKey, query: "", items: [], loading: false, error: "", searched: false });
              onSelect(place); inputRef.current?.focus();
            }}><span><strong>{place.name}</strong><span>{place.address}</span></span></button>
          </li>)}
        </ul>
        <p className="indicar-n-hint">Resultados do Google Maps</p>
      </> : null}
    </div>
  );
}
