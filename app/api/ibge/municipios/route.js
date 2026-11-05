import { jsonError } from "@/lib/auth";
import { listMunicipiosByUf } from "@/lib/ibge";

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const uf = searchParams.get("uf") || searchParams.get("state") || "";
    const q = normalizeSearch(searchParams.get("q") || "");

    let municipios = await listMunicipiosByUf(uf);
    if (q) {
      municipios = municipios.filter((m) =>
        normalizeSearch(m.nome).includes(q)
      );
    }

    return Response.json({
      uf: String(uf).trim().toUpperCase(),
      municipios,
    });
  } catch (error) {
    return jsonError(
      error.message || "Erro ao listar municípios.",
      error.status || 500
    );
  }
}
