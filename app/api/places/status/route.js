import { jsonError, requireUser } from "@/lib/auth";
import { isPlacesConfigured } from "@/lib/google-places";

export async function GET() {
  try {
    await requireUser();
    return Response.json({ configured: isPlacesConfigured() });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
