"use client";

import { useEffect, useId, useRef, useState } from "react";
import { coordinatesOf } from "@/lib/location";

export default function MapLocationPicker({ value, onChange, cityName = "", cityState = "" }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
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
  const selectRef = useRef(null);
  const geoSequenceRef = useRef(0);
  const savedLat = coordinatesOf(value)?.lat;
  const savedLng = coordinatesOf(value)?.lng;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let map;
    let marker;
    let sizeObserver;
    const controller = new AbortController();
    headingRef.current?.focus();

    async function initialize() {
      setLoading(true);
      setReady(false);
      setError("");
      setTileError(false);
      setGeoStatus("");
      const point = coordinatesOf({ location: { lat: savedLat, lng: savedLng } });
      setCandidate(point);
      try {
        const query = new URLSearchParams({ cityName, cityState });
        const [leafletModule, response] = await Promise.all([
          import("leaflet"), fetch(`/api/places/map-config?${query}`, { signal: controller.signal }),
        ]);
        const config = await response.json();
        if (!response.ok) throw new Error(config.error || "Não foi possível carregar o mapa.");
        if (cancelled) return;
        const cityCenter = coordinatesOf({ location: config.center });
        if (!point && cityName && cityState && !cityCenter) {
          throw new Error(`Não foi possível localizar ${cityName} (${cityState}) no mapa. Tente novamente mais tarde.`);
        }
        const L = leafletModule.default;
        map = L.map(canvasRef.current, { scrollWheelZoom: true, minZoom: 2, maxZoom: 19, fadeAnimation: false })
          .setView(point || cityCenter || { lat: -14.235, lng: -51.9253 }, point ? 17 : cityCenter ? 13 : 4);
        L.tileLayer(config.tileUrl, {
          attribution: config.attribution, maxZoom: 19,
          // Carrega apenas a área visível; mantém o cache HTTP padrão do navegador.
          keepBuffer: 0, updateWhenIdle: true,
        }).on("tileerror", () => { if (!cancelled) setTileError(true); })
          .on("tileload", () => { if (!cancelled) setTileError(false); }).addTo(map);
        const brand = getComputedStyle(document.documentElement).getPropertyValue("--brand").trim();
        function selectPoint(raw) {
          const selected = coordinatesOf({ location: raw });
          if (!selected || cancelled) return;
          // Arredonda somente à precisão armazenada no banco (~centímetros).
          const location = { lat: Number(selected.lat.toFixed(7)), lng: Number(selected.lng.toFixed(7)) };
          setCandidate(location);
          if (marker) marker.setLatLng(location);
          else marker = L.circleMarker(location, { radius: 8, color: brand, fillColor: brand, fillOpacity: 0.7, weight: 3, interactive: false }).addTo(map);
        }
        if (point) selectPoint(point);
        map.on("click", (event) => selectPoint(event.latlng.wrap()));
        mapRef.current = map;
        selectRef.current = selectPoint;
        setReady(true);
        map.invalidateSize();
        sizeObserver = new ResizeObserver(() => map.invalidateSize({ pan: false, debounceMoveend: true }));
        sizeObserver.observe(canvasRef.current);
      } catch (err) {
        if (!cancelled && err.name !== "AbortError") setError(err.message || "Não foi possível carregar o mapa. Tente novamente.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    initialize();
    return () => {
      cancelled = true;
      geoSequenceRef.current += 1;
      controller.abort();
      sizeObserver?.disconnect();
      map?.remove();
      mapRef.current = null;
      selectRef.current = null;
    };
  }, [open, attempt, savedLat, savedLng, cityName, cityState]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function locate() {
    if (!navigator.geolocation) { setGeoStatus("Seu navegador não oferece localização. Posicione o mapa manualmente."); return; }
    const sequence = ++geoSequenceRef.current;
    setGeoStatus("Buscando sua localização…");
    navigator.geolocation.getCurrentPosition((position) => {
      if (sequence !== geoSequenceRef.current) return;
      mapRef.current?.setView([position.coords.latitude, position.coords.longitude], 17);
      setGeoStatus("Mapa aproximado da sua localização. Marque o estabelecimento ou use o ponto central.");
    }, () => {
      if (sequence === geoSequenceRef.current) setGeoStatus("Não foi possível acessar sua localização. Você pode posicionar o mapa manualmente.");
    }, { timeout: 10000, maximumAge: 60000 });
  }

  return (
    <div className="map-location-picker">
      <button ref={triggerRef} className="indicar-n-maps-btn" type="button"
        aria-expanded={open} aria-controls={panelId} onClick={() => open ? close() : setOpen(true)}>
        {open ? "Fechar mapa" : coordinatesOf(value) ? "Ajustar localização no mapa" : "Selecionar no mapa"}
      </button>
      {open ? <section id={panelId} className="map-location-panel" aria-labelledby={`${panelId}-title`}>
        <h3 ref={headingRef} id={`${panelId}-title`} tabIndex={-1}>Selecione o local exato</h3>
        <p className="muted">Toque no mapa ou mova-o com as setas do teclado e use o ponto central.{cityName ? ` O pedido é para ${cityName}${cityState ? ` (${cityState})` : ""}.` : ""}</p>
        <div className="map-location-canvas-wrap" aria-busy={loading}>
          <div ref={canvasRef} className="map-location-canvas" aria-label="Mapa interativo para selecionar a localização" />
          {ready && !loading ? <span className="map-location-crosshair" aria-hidden="true">+</span> : null}
          {loading ? <p className="map-location-loading" role="status">Carregando mapa…</p> : null}
        </div>
        <div className="map-location-actions">
          <button className="indicar-n-maps-btn" type="button" disabled={!ready || loading} onClick={() => selectRef.current?.(mapRef.current?.getCenter().wrap())}>Usar ponto central</button>
          <button className="indicar-n-maps-btn" type="button" disabled={!ready || loading} onClick={locate}>Usar minha localização</button>
        </div>
        {geoStatus ? <p className="muted" role="status">{geoStatus}</p> : null}
        {tileError ? <p className="error-box" role="status">Algumas partes do mapa não carregaram. Verifique sua conexão ou tente novamente.</p> : null}
        {error || tileError ? <div role={error ? "alert" : undefined} className="error-box">
          {error ? <p>{error}</p> : null}
          <button className="indicar-n-maps-btn" type="button" onClick={() => setAttempt((current) => current + 1)} disabled={loading}>Tentar novamente</button>
        </div> : null}
        {candidate ? <p className="map-location-result" role="status">Ponto selecionado: {candidate.lat.toFixed(6)}, {candidate.lng.toFixed(6)}</p> : null}
        <div className="map-location-actions">
          <button className="indicar-n-cta" type="button" disabled={!candidate || !ready || loading || Boolean(error)}
            onClick={() => { onChange({ ...value, source: "manual", selectionSource: "map_pin", placeId: null, location: candidate }); close(); }}>Usar esta localização</button>
          <button className="indicar-n-secondary" type="button" onClick={close}>Cancelar</button>
        </div>
        <a className="map-location-report" href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">Informar problema no mapa</a>
      </section> : null}
    </div>
  );
}
