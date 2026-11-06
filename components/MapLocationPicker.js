"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { coordinatesOf } from "@/lib/location";
import { createSelectionMap } from "@/lib/client-map";
import MapPlaceSearch from "@/components/MapPlaceSearch";

export default function MapLocationPicker({ value, onChange, cityName = "", cityState = "" }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [manual, setManual] = useState(false);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [candidate, setCandidate] = useState(null);
  const [error, setError] = useState("");
  const [tileError, setTileError] = useState(false);
  const [geoStatus, setGeoStatus] = useState("");
  const canvasRef = useRef(null);
  const headingRef = useRef(null);
  const triggerRef = useRef(null);
  const mapRef = useRef(null);
  const candidateRef = useRef(null);
  const valueRef = useRef(value);
  const fieldsAtOpenRef = useRef(null);
  const geoSequenceRef = useRef(0);
  const savedLat = coordinatesOf(value)?.lat;
  const savedLng = coordinatesOf(value)?.lng;
  useEffect(() => { valueRef.current = value; }, [value]);

  const updateCandidate = useCallback(place => { candidateRef.current = place; setCandidate(place); }, []);
  const chooseResult = useCallback(place => {
    const point = coordinatesOf(place);
    if (!point) return;
    updateCandidate({ ...place, source: "google_maps", selectionSource: "google_places", location: point });
    mapRef.current?.selectPoint(point);
    mapRef.current?.setView(point, 17);
  }, [updateCandidate]);
  const selectManual = useCallback(raw => {
    const selected = coordinatesOf({ location: raw });
    if (!selected) return;
    const location = { lat: Number(selected.lat.toFixed(7)), lng: Number(selected.lng.toFixed(7)) };
    updateCandidate({ ...(candidateRef.current || valueRef.current), source: "manual", selectionSource: "map_pin", placeId: null, mapsUrl: null, photoName: null, photoAttributions: [], location });
    mapRef.current?.selectPoint(location);
  }, [updateCandidate]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let map;
    let sizeObserver;
    const controller = new AbortController();
    headingRef.current?.focus();
    function authFailure() {
      if (!cancelled) { setReady(false); setError("O Google Maps está indisponível. Tente novamente ou use a marcação manual."); }
    }
    window.addEventListener("indica:maps-auth-error", authFailure);
    async function initialize() {
      setLoading(true); setReady(false); setError(""); setTileError(false); setGeoStatus(""); setConfig(null);
      const point = coordinatesOf({ location: { lat: savedLat, lng: savedLng } });
      fieldsAtOpenRef.current = valueRef.current;
      const saved = point ? { ...valueRef.current, location: point } : null;
      candidateRef.current = saved; setCandidate(saved);
      try {
        const query = new URLSearchParams({ cityName, cityState, ...(manual ? { manual: "1" } : {}) });
        const response = await fetch(`/api/places/map-config?${query}`, { signal: controller.signal });
        const nextConfig = await response.json();
        if (!response.ok) throw new Error(nextConfig.error || "Não foi possível carregar o mapa.");
        if (cancelled) return;
        setConfig(nextConfig);
        const cityCenter = coordinatesOf({ location: nextConfig.center });
        if (!point && cityName && cityState && !cityCenter) throw new Error(`Não foi possível localizar ${cityName} (${cityState}) no mapa. Tente novamente mais tarde.`);
        map = await createSelectionMap({
          element: canvasRef.current, config: nextConfig,
          center: point || cityCenter || { lat: -14.235, lng: -51.9253 }, zoom: point ? 17 : cityCenter ? 13 : 4,
          onSelect: raw => { if (!cancelled) selectManual(raw); },
          onResultSelect: place => { if (!cancelled) chooseResult(place); },
          onTileError: failed => { if (!cancelled) setTileError(failed); },
        });
        if (cancelled) { map.destroy(); return; }
        mapRef.current = map;
        if (point) map.selectPoint(point);
        setReady(true); map.resize();
        sizeObserver = new ResizeObserver(() => map.resize());
        sizeObserver.observe(canvasRef.current);
      } catch (err) {
        if (!cancelled && err.name !== "AbortError") setError(err.message || "Não foi possível carregar o mapa. Tente novamente.");
      } finally { if (!cancelled) setLoading(false); }
    }
    initialize();
    return () => {
      cancelled = true; geoSequenceRef.current += 1;
      controller.abort(); sizeObserver?.disconnect(); map?.destroy(); mapRef.current = null;
      window.removeEventListener("indica:maps-auth-error", authFailure);
    };
  }, [open, attempt, manual, savedLat, savedLng, cityName, cityState, selectManual, chooseResult]);

  function close() { setOpen(false); triggerRef.current?.focus(); }
  function confirm() {
    const next = { ...candidate };
    let editedFields = false;
    for (const field of ["name", "address"]) {
      if (valueRef.current?.[field] !== fieldsAtOpenRef.current?.[field]) {
        next[field] = valueRef.current?.[field] || "";
        editedFields = true;
      }
    }
    if (editedFields) Object.assign(next, { source: "manual", selectionSource: "map_pin", placeId: null, mapsUrl: null });
    onChange(next); close();
  }
  function locate() {
    if (!navigator.geolocation) { setGeoStatus("Seu navegador não oferece localização. Posicione o mapa manualmente."); return; }
    const sequence = ++geoSequenceRef.current;
    setGeoStatus("Buscando sua localização…");
    navigator.geolocation.getCurrentPosition(position => {
      if (sequence !== geoSequenceRef.current) return;
      mapRef.current?.setView({ lat: position.coords.latitude, lng: position.coords.longitude }, 17);
      setGeoStatus("Mapa aproximado da sua localização. Marque o estabelecimento ou use o ponto central.");
    }, () => {
      if (sequence === geoSequenceRef.current) setGeoStatus("Não foi possível acessar sua localização. Você pode posicionar o mapa manualmente.");
    }, { timeout: 10000, maximumAge: 60000 });
  }

  const point = coordinatesOf(candidate);
  return <div className="map-location-picker">
    <button ref={triggerRef} className="indicar-n-maps-btn" type="button" aria-expanded={open} aria-controls={panelId}
      onClick={() => { if (open) close(); else { setLoading(true); setReady(false); setConfig(null); setError(""); setManual(false); setOpen(true); } }}>
      {open ? "Fechar mapa" : coordinatesOf(value) ? "Ajustar localização no mapa" : "Selecionar no mapa"}
    </button>
    {open ? <section id={panelId} className="map-location-panel" aria-labelledby={`${panelId}-title`}>
      <h3 ref={headingRef} id={`${panelId}-title`} tabIndex={-1}>Selecione o local exato</h3>
      <p className="muted">Busque o estabelecimento ou marque um ponto no mapa e confirme a localização.{cityName ? ` O pedido é para ${cityName}${cityState ? ` (${cityState})` : ""}.` : ""}</p>
      {ready && config?.placesConfigured ? <MapPlaceSearch key={`${cityName}:${cityState}:${attempt}:${manual}`} cityName={cityName} cityState={cityState}
        onResults={places => mapRef.current?.showResults(places)} onSelect={chooseResult} selectedId={candidate?.placeId} /> : ready ? <p className="muted">A busca por nome está indisponível no momento. Você pode marcar o ponto manualmente.</p> : null}
      <div className="map-location-canvas-wrap" aria-busy={loading}>
        <div ref={canvasRef} className="map-location-canvas" aria-label="Mapa interativo para selecionar a localização" />
        {ready && !loading ? <span className="map-location-crosshair" aria-hidden="true">+</span> : null}
        {loading ? <p className="map-location-loading" role="status">Carregando mapa…</p> : null}
      </div>
      <div className="map-location-actions">
        <button className="indicar-n-maps-btn" type="button" disabled={!ready || loading} onClick={() => selectManual(mapRef.current?.getCenter())}>Usar ponto central</button>
        <button className="indicar-n-maps-btn" type="button" disabled={!ready || loading} onClick={locate}>Usar minha localização</button>
      </div>
      <p className="muted">Para marcar manualmente, toque no mapa ou mova-o com as setas do teclado e use o ponto central.</p>
      {geoStatus ? <p className="muted" role="status">{geoStatus}</p> : null}
      {tileError ? <p className="error-box" role="status">Algumas partes do mapa não carregaram. Verifique sua conexão ou tente novamente.</p> : null}
      {error || tileError ? <div role={error ? "alert" : undefined} className="error-box">
        {error ? <p>{error}</p> : null}
        <div className="map-location-actions">
          <button className="indicar-n-maps-btn" type="button" onClick={() => { setReady(false); setLoading(true); setAttempt(current => current + 1); }} disabled={loading}>Tentar novamente</button>
          {config?.provider === "google" ? <button className="indicar-n-maps-btn" type="button" onClick={() => { setReady(false); setLoading(true); setManual(true); }} disabled={loading}>Usar mapa manual</button> : null}
        </div>
      </div> : null}
      {point ? <div className="map-location-candidate" role="status">
        {candidate.name ? <strong>{candidate.name}</strong> : null}
        {candidate.address ? <p>{candidate.address}</p> : null}
        <p className="map-location-result">Ponto selecionado: {point.lat.toFixed(6)}, {point.lng.toFixed(6)}</p>
      </div> : null}
      <div className="map-location-actions">
        <button className="indicar-n-cta" type="button" disabled={!point || !ready || loading || Boolean(error)} onClick={confirm}>Usar esta localização</button>
        <button className="indicar-n-secondary" type="button" onClick={close}>Cancelar</button>
      </div>
      {config?.provider === "openstreetmap" ? <a className="map-location-report" href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">Informar problema no mapa</a> : null}
    </section> : null}
  </div>;
}
