/** Adaptadores do mapa de seleção. Places é exibido somente sobre Google Maps. */
let googleLoading;
async function loadGoogleMaps(key) {
  if (window.google?.maps?.importLibrary) return window.google.maps;
  if (!googleLoading) {
    googleLoading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const timeout = setTimeout(() => fail(), 20000);
      function fail() {
        clearTimeout(timeout); script.remove(); googleLoading = null;
        delete window.__indicaMapsReady;
        reject(new Error("Não foi possível carregar o Google Maps. Tente novamente ou use a marcação manual."));
      }
      window.gm_authFailure = () => {
        fail(); window.dispatchEvent(new Event("indica:maps-auth-error"));
      };
      window.__indicaMapsReady = () => {
        clearTimeout(timeout); delete window.__indicaMapsReady;
        resolve(window.google.maps);
      };
      script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key, loading: "async", callback: "__indicaMapsReady", v: "weekly", language: "pt-BR", region: "BR" })}`;
      script.async = true; script.onerror = fail;
      document.head.append(script);
    });
  }
  return googleLoading;
}

export async function createSelectionMap({ element, config, center, zoom, onSelect, onResultSelect, onTileError }) {
  if (config.provider === "google") {
    const maps = await loadGoogleMaps(config.browserApiKey);
    const [{ Map }, { AdvancedMarkerElement, PinElement }] = await Promise.all([maps.importLibrary("maps"), maps.importLibrary("marker")]);
    const map = new Map(element, { center, zoom, mapId: config.mapId || "DEMO_MAP_ID", minZoom: 2, maxZoom: 19, scrollwheel: true, gestureHandling: "greedy", streetViewControl: false, mapTypeControl: false, fullscreenControl: false, clickableIcons: false });
    let selected;
    let results = [];
    const click = map.addListener("click", event => {
      if (event.latLng) onSelect(event.latLng.toJSON());
    });
    const clearResults = () => {
      for (const marker of results) { maps.event.clearInstanceListeners(marker); marker.map = null; }
      results = [];
    };
    return {
      selectPoint(point) {
        if (selected) selected.position = point;
        else selected = new AdvancedMarkerElement({ map, position: point, title: "Local selecionado" });
      },
      getCenter: () => map.getCenter()?.toJSON(),
      setView(point, level = 17) { map.setCenter(point); map.setZoom(level); },
      showResults(places) {
        clearResults();
        if (!places.length) return;
        const bounds = new maps.LatLngBounds();
        results = places.map((place, index) => {
          const marker = new AdvancedMarkerElement({ map, position: place.location, title: `${index + 1}. ${place.name}` });
          marker.append(new PinElement({ glyphText: String(index + 1) }));
          marker.addListener("click", () => onResultSelect(place));
          bounds.extend(place.location);
          return marker;
        });
        if (places.length === 1) { map.setCenter(places[0].location); map.setZoom(17); }
        else map.fitBounds(bounds, 45);
      },
      resize() {},
      destroy() { clearResults(); click.remove(); if (selected) selected.map = null; maps.event.clearInstanceListeners(map); element.replaceChildren(); },
    };
  }
  const L = (await import("leaflet")).default;
  const map = L.map(element, { scrollWheelZoom: true, minZoom: 2, maxZoom: 19, fadeAnimation: false }).setView(center, zoom);
  L.tileLayer(config.tileUrl, { attribution: config.attribution, maxZoom: 19, keepBuffer: 0, updateWhenIdle: true })
    .on("tileerror", () => onTileError(true)).on("tileload", () => onTileError(false)).addTo(map);
  const brand = getComputedStyle(document.documentElement).getPropertyValue("--brand").trim();
  let marker;
  map.on("click", event => onSelect(event.latlng.wrap()));
  return {
    selectPoint(point) {
      if (marker) marker.setLatLng(point);
      else marker = L.circleMarker(point, { radius: 8, color: brand, fillColor: brand, fillOpacity: 0.7, weight: 3, interactive: false }).addTo(map);
    },
    getCenter: () => map.getCenter().wrap(),
    setView: (point, level = 17) => map.setView(point, level),
    showResults() {}, // Nenhum conteúdo do Places sobre OpenStreetMap.
    resize: () => map.invalidateSize({ pan: false, debounceMoveend: true }),
    destroy: () => map.remove(),
  };
}
