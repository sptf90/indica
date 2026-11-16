/** Coordenadas decimais; aceita strings numéricas retornadas por DECIMAL do MySQL. */
export function coordinatesOf(place) {
  const lat = place?.location?.lat ?? place?.latitude;
  const lng = place?.location?.lng ?? place?.longitude;
  const numeric = (value) => (typeof value === "number" ||
    (typeof value === "string" && /^-?(?:\d+\.?\d*|\.\d+)$/.test(value.trim()))) && Number.isFinite(Number(value));
  if (!numeric(lat) || !numeric(lng)) return null;
  const location = { lat: Number(lat), lng: Number(lng) };
  if (Math.abs(location.lat) > 90 || Math.abs(location.lng) > 180) return null;
  return location;
}

/** Um local pode ser descrito por nome, endereço ou coordenadas confirmadas. */
export function hasPlaceData(place) {
  return Boolean((typeof place?.name === "string" && place.name.trim()) ||
    (typeof place?.address === "string" && place.address.trim()) || coordinatesOf(place));
}

export function validatePlaceData(place) {
  const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
  for (const [field, limit, label] of [["name", 255, "nome"], ["address", 1000, "endereço"]]) {
    if (place?.[field] != null && (typeof place[field] !== "string" || place[field].trim().length > limit)) {
      fail(`Informe o ${label} com até ${limit} caracteres.`);
    }
  }
  const hasCoordinates = place?.location != null || place?.latitude != null || place?.longitude != null;
  if (hasCoordinates && !coordinatesOf(place)) fail("Selecione uma localização válida no mapa.");
  if (!hasPlaceData(place)) fail("Preencha pelo menos um item do local: nome, endereço ou mapa.");
}

export function coordinateKey(place) {
  const point = coordinatesOf(place);
  return point ? `${point.lat.toFixed(5)},${point.lng.toFixed(5)}` : null;
}

export function navigationLinks(place) {
  const location = coordinatesOf(place);
  if (location) {
    const point = `${location.lat},${location.lng}`;
    return {
      googleMaps: `https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", destination: point, dir_action: "navigate" })}`,
      waze: `https://waze.com/ul?${new URLSearchParams({ ll: point, navigate: "yes", utm_source: "goindica" })}`,
    };
  }
  // Registros anteriores à migração não têm coordenadas: nunca inventar um ponto.
  const url = place?.mapsUrl || place?.maps_url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" &&
        ["www.google.com", "google.com", "maps.google.com", "maps.app.goo.gl", "goo.gl"].includes(parsed.hostname)) {
      return { googleMaps: parsed.href, waze: null };
    }
  } catch { /* Sem URL compatível. */ }
  return { googleMaps: null, waze: null };
}

export function mapPlaceRow(row) {
  if (!row) return null;
  return {
    source: row.source,
    selectionSource: row.location_kind || "place",
    placeId: row.place_id || null,
    name: row.name,
    address: row.address,
    mapsUrl: row.maps_url || null,
    location: coordinatesOf(row),
  };
}
