import { jsonError } from "@/lib/auth";
import { requireManagementAdmin } from "@/lib/admin-auth";
import { listAdminRecords } from "@/lib/admin-service";
export async function GET(request, { params }) {
  try {
    await requireManagementAdmin();
    const { section } = await params;
    return Response.json(await listAdminRecords(section, new URL(request.url).searchParams), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error.message || "Não foi possível carregar os registros.", error.status || 500); }
}
