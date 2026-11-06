import { coordinatesOf } from "./location";

/**
 * Cliente server-side da Places API (New).
 * Docs: https://developers.google.com/maps/documentation/places/web-service/overview
 */

const PLACES_BASE = "https://places.googleapis.com/v1";

const SEARCH_FIELD_MASK = [
  "places.id",
  "places.name",
  "places.displayName",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.googleMapsUri",
  "places.photos",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.location",
  "places.rating",
  "places.userRatingCount",
].join(",");

const NEARBY_FIELD_MASK = SEARCH_FIELD_MASK;

function apiKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    ""
  ).trim();
}

export function isPlacesConfigured() {
  return Boolean(apiKey());
}

function httpError(message, status = 502) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function placesFetch(path, { method = "GET", body, fieldMask } = {}) {
  const key = apiKey();
  if (!key) throw httpError("Google Places não configurado.", 503);

  const headers = {
    "X-Goog-Api-Key": key,
  };
  if (fieldMask) headers["X-Goog-FieldMask"] = fieldMask;
  if (body != null) headers["Content-Type"] = "application/json";

  const response = await fetch(`${PLACES_BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      `Falha na Places API (${response.status}).`;
    throw httpError(msg, response.status >= 500 ? 502 : response.status);
  }
  return data;
}

function mapPlace(place) {
  if (!place) return null;
  const id = place.id || String(place.name || "").replace(/^places\//, "");
  const photoName = place.photos?.[0]?.name || null;
  const attributions = place.photos?.[0]?.authorAttributions || [];
  return {
    placeId: id || null,
    name: place.displayName?.text || place.displayName || "",
    address:
      place.formattedAddress ||
      place.shortFormattedAddress ||
      "",
    shortAddress: place.shortFormattedAddress || null,
    mapsUrl: place.googleMapsUri || null,
    photoName,
    photoAttributions: attributions.map((a) => ({
      displayName: a.displayName || "",
      uri: a.uri || null,
    })),
    primaryType: place.primaryType || null,
    primaryTypeLabel: place.primaryTypeDisplayName?.text || null,
    location: place.location
      ? {
          lat: place.location.latitude,
          lng: place.location.longitude,
        }
      : null,
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
  };
}

/**
 * Text Search (New) — busca por texto com foto/endereço.
 */
export async function searchPlacesText({
  textQuery,
  languageCode = "pt-BR",
  regionCode = "BR",
  pageSize = 8,
  locationBias = null,
  includedType = null,
}) {
  const query = String(textQuery || "").trim();
  if (query.length < 2) return [];

  const body = {
    textQuery: query,
    languageCode,
    regionCode,
    pageSize: Math.min(Math.max(Number(pageSize) || 8, 1), 15),
  };
  if (locationBias) body.locationBias = locationBias;
  if (includedType) body.includedType = includedType;

  const data = await placesFetch("/places:searchText", {
    method: "POST",
    fieldMask: SEARCH_FIELD_MASK,
    body,
  });

  return (data?.places || []).map(mapPlace).filter((p) => p?.placeId && p.name);
}

/**
 * Nearby Search (New) — estabelecimentos parecidos perto de um ponto.
 */
export async function searchPlacesNearby({
  lat,
  lng,
  includedType,
  radiusMeters = 2500,
  languageCode = "pt-BR",
  maxResultCount = 6,
}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

  const body = {
    languageCode,
    maxResultCount: Math.min(Math.max(Number(maxResultCount) || 6, 1), 10),
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: Math.min(Math.max(Number(radiusMeters) || 2500, 100), 50000),
      },
    },
  };
  if (includedType) body.includedTypes = [includedType];

  const data = await placesFetch("/places:searchNearby", {
    method: "POST",
    fieldMask: NEARBY_FIELD_MASK,
    body,
  });

  return (data?.places || []).map(mapPlace).filter((p) => p?.placeId && p.name);
}

/**
 * Baixa mídia de foto (Places Photos New) e devolve bytes + content-type.
 */
export async function fetchPlacePhoto({
  photoName,
  maxWidthPx = 400,
  maxHeightPx = null,
}) {
  const name = String(photoName || "").trim();
  if (!name.startsWith("places/") || !name.includes("/photos/")) {
    throw httpError("Referência de foto inválida.", 400);
  }

  const key = apiKey();
  if (!key) throw httpError("Google Places não configurado.", 503);

  const params = new URLSearchParams();
  params.set("maxWidthPx", String(Math.min(Math.max(Number(maxWidthPx) || 400, 1), 1600)));
  if (maxHeightPx) {
    params.set(
      "maxHeightPx",
      String(Math.min(Math.max(Number(maxHeightPx) || 400, 1), 1600))
    );
  }
  params.set("skipHttpRedirect", "true");

  const metaRes = await fetch(
    `${PLACES_BASE}/${name}/media?${params.toString()}`,
    {
      headers: { "X-Goog-Api-Key": key },
      cache: "no-store",
    }
  );
  const metaText = await metaRes.text();
  let meta = null;
  try {
    meta = metaText ? JSON.parse(metaText) : null;
  } catch {
    meta = null;
  }
  if (!metaRes.ok) {
    throw httpError(
      meta?.error?.message || "Não foi possível obter a foto.",
      metaRes.status >= 500 ? 502 : metaRes.status
    );
  }

  const photoUri = meta?.photoUri;
  if (!photoUri) throw httpError("Foto indisponível.", 404);

  const imgRes = await fetch(photoUri, { cache: "no-store" });
  if (!imgRes.ok) throw httpError("Falha ao baixar a foto.", 502);

  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const contentType = imgRes.headers.get("content-type") || "image/jpeg";
  return { buffer, contentType };
}

/** Resolve o ID selecionado; nome, endereço e URL vêm do Google, não do cliente. */
export async function getPlaceById(placeId) {
  const id = String(placeId || "").trim();
  if (!/^[A-Za-z0-9_-]{1,255}$/.test(id)) throw httpError("Local do Google Maps inválido.", 400);
  const data = await placesFetch(`/places/${encodeURIComponent(id)}`, {
    fieldMask: "id,displayName,formattedAddress,googleMapsUri,location",
  });
  const place = mapPlace(data);
  if (!place?.placeId || !place.name || !place.address || !coordinatesOf(place)) {
    throw httpError("Selecione um estabelecimento com endereço no Google Maps.", 400);
  }
  return { ...place, source: "google_maps" };
}
