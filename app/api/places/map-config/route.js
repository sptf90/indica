import { assertConsumerUser, jsonError, requireUser } from "@/lib/auth";

export async function GET() {
  try {
    assertConsumerUser(await requireUser());
    const tileUrl = process.env.MAP_TILE_URL?.trim() || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
    if (!tileUrl.startsWith("https://") || !["{z}", "{x}", "{y}"].every((part) => tileUrl.includes(part))) {
      return jsonError("O mapa está indisponível no momento.", 503);
    }
    return Response.json({
      provider: "openstreetmap", tileUrl,
      attribution: process.env.MAP_TILE_ATTRIBUTION?.trim() || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
