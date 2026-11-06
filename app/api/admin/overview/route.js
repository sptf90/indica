import { jsonError } from "@/lib/auth";
import { requireManagementAdmin } from "@/lib/admin-auth";
import { adminOverview } from "@/lib/admin-service";
export async function GET() {
  try {
    await requireManagementAdmin();
    return Response.json(await adminOverview(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error.message || "Não foi possível carregar a gestão.", error.status || 500); }
}
