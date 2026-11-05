import { jsonError, requireUser } from "@/lib/auth";
import { ensureCity } from "@/lib/cities";
import { getPool } from "@/lib/db";

/** Garante cidade local a partir de nome + UF (IBGE) e devolve o id. */
export async function POST(request) {
  try {
    await requireUser();
    if (!getPool()) return jsonError("Banco não configurado.", 503);

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError("JSON inválido.");
    }

    const name = String(body.name || body.cityName || "").trim();
    const state = String(body.state || "")
      .trim()
      .toUpperCase();

    const id = await ensureCity(getPool(), { name, state });
    return Response.json({
      city: {
        id,
        name,
        state,
        label: `${name} (${state})`,
      },
    });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
