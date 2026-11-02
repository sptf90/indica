import { jsonError, requireAdminUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { listAllSponsorshipRequests } from "@/lib/company";

export async function GET(request) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    await requireAdminUser();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const items = await listAllSponsorshipRequests({ status });
    return Response.json({ items });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
