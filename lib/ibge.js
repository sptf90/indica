/**
 * Cliente da API de Localidades do IBGE.
 * https://servicodados.ibge.gov.br/api/docs/localidades
 */

const IBGE_BASE = "https://servicodados.ibge.gov.br/api/v1/localidades";

const cache = {
  estados: null,
  estadosAt: 0,
  municipiosByUf: new Map(),
};

const CACHE_MS = 24 * 60 * 60 * 1000;

function httpError(message, status = 502) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function ibgeGet(path) {
  const response = await fetch(`${IBGE_BASE}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86400 },
  });
  if (!response.ok) {
    throw httpError(`IBGE indisponível (${response.status}).`, 502);
  }
  return response.json();
}

export async function listEstados() {
  const now = Date.now();
  if (cache.estados && now - cache.estadosAt < CACHE_MS) {
    return cache.estados;
  }
  const rows = await ibgeGet("/estados?orderBy=nome");
  const estados = (rows || []).map((e) => ({
    id: e.id,
    sigla: e.sigla,
    nome: e.nome,
    label: `${e.nome} (${e.sigla})`,
  }));
  cache.estados = estados;
  cache.estadosAt = now;
  return estados;
}

export async function listMunicipiosByUf(uf) {
  const sigla = String(uf || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(sigla)) {
    throw httpError("UF inválida.", 400);
  }

  const cached = cache.municipiosByUf.get(sigla);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.items;
  }

  const rows = await ibgeGet(`/estados/${encodeURIComponent(sigla)}/municipios`);
  const items = (rows || [])
    .map((m) => ({
      id: m.id,
      nome: m.nome,
      uf: sigla,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  cache.municipiosByUf.set(sigla, { items, at: Date.now() });
  return items;
}
