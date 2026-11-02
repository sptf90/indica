import { jsonError, requireUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import {
  closeNoValidIfMaxReopens,
  closeRequestVoluntary,
} from "@/lib/requests-service";

export async function POST(request, { params }) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = await requireUser();
    const { id } = await params;
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const item =
      body.mode === "no_valid"
        ? await closeNoValidIfMaxReopens(user, id)
        : await closeRequestVoluntary(user, id);
    return Response.json({ item });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
