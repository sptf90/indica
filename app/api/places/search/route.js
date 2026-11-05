import { assertConsumerUser, jsonError, requireUser } from "@/lib/auth";
import {
  isPlacesConfigured,
  searchPlacesNearby,
  searchPlacesText,
} from "@/lib/google-places";

function buildBiasedQuery(q, cityName, cityState) {
  const base = String(q || "").trim();
  const place = [cityName, cityState].filter(Boolean).join(" ").trim();
  if (!place) return base;
  const lower = base.toLowerCase();
  if (place && !lower.includes(String(cityName || "").toLowerCase())) {
    return `${base} em ${place}`;
  }
  return base;
}

export async function GET(request) {
  try {
    assertConsumerUser(await requireUser());

    if (!isPlacesConfigured()) {
      return jsonError("Google Places não configurado.", 503, {
        configured: false,
      });
    }

    const { searchParams } = new URL(request.url);
    const mode = (searchParams.get("mode") || "search").toLowerCase();
    const q = String(searchParams.get("q") || "").trim();
    const cityName = String(searchParams.get("cityName") || "").trim();
    const cityState = String(searchParams.get("cityState") || "").trim();
    const excludePlaceId = String(
      searchParams.get("excludePlaceId") || ""
    ).trim();
    const primaryType = String(searchParams.get("primaryType") || "").trim();
    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));

    let items = [];

    if (mode === "similar") {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return jsonError("Localização necessária para parecidos.");
      }
      if (primaryType) {
        items = await searchPlacesNearby({
          lat,
          lng,
          includedType: primaryType,
          radiusMeters: 3000,
          maxResultCount: 8,
        });
      }
      if (items.length < 3) {
        const label =
          String(searchParams.get("typeLabel") || "").trim() ||
          primaryType ||
          "estabelecimento";
        const fallback = await searchPlacesText({
          textQuery: buildBiasedQuery(label, cityName, cityState),
          pageSize: 8,
          locationBias: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: 4000,
            },
          },
          includedType: primaryType || undefined,
        });
        const seen = new Set(items.map((p) => p.placeId));
        for (const p of fallback) {
          if (!seen.has(p.placeId)) {
            items.push(p);
            seen.add(p.placeId);
          }
        }
      }
    } else {
      if (q.length < 2) {
        return Response.json({ items: [], configured: true });
      }
      items = await searchPlacesText({
        textQuery: buildBiasedQuery(q, cityName, cityState),
        pageSize: 8,
      });
    }

    if (excludePlaceId) {
      items = items.filter((p) => p.placeId !== excludePlaceId);
    }

    return Response.json({
      configured: true,
      items: items.slice(0, 8),
    });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500, {
      configured: isPlacesConfigured(),
    });
  }
}
