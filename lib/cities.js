/**
 * Helpers da tabela local `cidades` (criadas sob demanda via IBGE).
 */

import { ensureOrganicRankingsForCity } from "./rankings";

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function citySlug(name, state) {
  const base = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const uf = String(state || "")
    .trim()
    .toLowerCase();
  return `${base}-${uf}`;
}

/**
 * Garante cidade no banco a partir do nome + UF (ex.: seleção IBGE).
 * @returns {Promise<number>} city id
 */
export async function ensureCity(pool, { name, state }) {
  const cityName = String(name || "").trim();
  const uf = String(state || "")
    .trim()
    .toUpperCase();

  if (!cityName || cityName.length > 120) {
    throw httpError("Cidade inválida.");
  }
  if (!/^[A-Z]{2}$/.test(uf)) {
    throw httpError("Estado inválido.");
  }

  const slug = citySlug(cityName, uf);

  const [existing] = await pool.query(
    `SELECT id, nome, estado FROM cidades
     WHERE slug = ? OR (nome = ? AND estado = ?)
     LIMIT 1`,
    [slug, cityName, uf]
  );
  let cityId = existing[0] ? Number(existing[0].id) : null;

  if (!cityId) {
    try {
      const [result] = await pool.query(
        `INSERT INTO cidades (nome, estado, slug) VALUES (?, ?, ?)`,
        [cityName, uf, slug]
      );
      cityId = Number(result.insertId);
    } catch (error) {
      if (error && error.code === "ER_DUP_ENTRY") {
        const [again] = await pool.query(
          `SELECT id FROM cidades WHERE slug = ? LIMIT 1`,
          [slug]
        );
        if (again[0]) cityId = Number(again[0].id);
        else throw error;
      } else {
        throw error;
      }
    }
  }

  await ensureOrganicRankingsForCity(pool, {
    cityId,
    cityName,
    state: uf,
  });

  return cityId;
}
