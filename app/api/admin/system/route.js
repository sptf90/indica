import { jsonError } from "@/lib/auth";
import { requireManagementAdmin } from "@/lib/admin-auth";
import { adminSystemStatus } from "@/lib/admin-dashboard";

export async function GET() {
  try {
    await requireManagementAdmin();
    return Response.json(await adminSystemStatus(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return jsonError(error.message || "Não foi possível verificar o sistema.", error.status || 500);
  }
}
