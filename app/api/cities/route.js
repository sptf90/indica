import { getPool } from "@/lib/db";
import { jsonError } from "@/lib/auth";

export async function GET() {
  const pool = getPool();
  if (!pool) return jsonError("Banco não configurado.", 503);
  const [rows] = await pool.query(
    `SELECT id, name, state, slug FROM cities ORDER BY name ASC, state ASC`
  );
  return Response.json({
    cities: rows.map((c) => ({
      id: c.id,
      name: c.name,
      state: c.state,
      slug: c.slug,
      label: `${c.name} (${c.state})`,
    })),
  });
}
