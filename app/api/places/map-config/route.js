import { isPlacesConfigured } from "@/lib/google-places";
import { cityMapCenter } from "@/lib/city-map";
import { assertConsumerUser, jsonError, requireUser } from "@/lib/auth";

export async function GET(request) {
  try {
    assertConsumerUser(await requireUser());
    const { searchParams } = new URL(request.url);
    const cityName = searchParams.get("cityName") || "";
    const cityState = searchParams.get("cityState") || "";
    const center = cityMapCenter(cityName, cityState);
    const tileUrl = process.env.MAP_TILE_URL?.trim() || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
    // Somente a chave explicitamente destinada ao navegador pode ser exposta.
    const browserApiKey = process.env.GOOGLE_MAPS_BROWSER_API_KEY?.trim() || "";
    const google = Boolean(browserApiKey) && searchParams.get("manual") !== "1";
    if (!google && (!tileUrl.startsWith("https://") || !["{z}", "{x}", "{y}"].every((part) => tileUrl.includes(part)))) {
      return jsonError("O mapa está indisponível no momento.", 503);
    }
    return Response.json({
      provider: google ? "google" : "openstreetmap", tileUrl, center,
      ...(google ? { browserApiKey, mapId: process.env.GOOGLE_MAPS_MAP_ID?.trim() || "DEMO_MAP_ID" } : {}),
      placesConfigured: google && isPlacesConfigured(),
      attribution: process.env.MAP_TILE_ATTRIBUTION?.trim() || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
