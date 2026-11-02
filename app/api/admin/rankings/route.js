import { jsonError, requireAdminUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { listAllSponsorshipRequests } from "@/lib/company";
import { listAdminRankingsGestao } from "@/lib/rankings";

const PENDING_STATUSES = new Set([
  "submitted",
  "under_review",
  "awaiting_correction",
]);

export async function GET(request) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    await requireAdminUser();
    const { searchParams } = new URL(request.url);
    const raw = (searchParams.get("modality") || "monthly").toLowerCase();
    const modality =
      raw === "weekly" || raw === "semanal" ? "weekly" : "monthly";

    const data = await listAdminRankingsGestao(modality);
    const allRequests = await listAllSponsorshipRequests({ status: "all" });
    const pending = allRequests.filter(
      (item) => item.modality === modality && PENDING_STATUSES.has(item.status)
    );

    return Response.json({
      ...data,
      pending,
      counts: {
        ...data.counts,
        pendentes: pending.length,
      },
    });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
