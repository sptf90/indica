import { jsonError, requireUser } from "@/lib/auth";
import { fetchPlacePhoto, isPlacesConfigured } from "@/lib/google-places";

export async function GET(request) {
  try {
    await requireUser();

    if (!isPlacesConfigured()) {
      return jsonError("Google Places não configurado.", 503);
    }

    const { searchParams } = new URL(request.url);
    const name = String(searchParams.get("name") || "").trim();
    const maxWidthPx = Number(searchParams.get("maxWidthPx") || 320);

    if (!name) return jsonError("name obrigatório.");

    const { buffer, contentType } = await fetchPlacePhoto({
      photoName: name,
      maxWidthPx,
    });

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
