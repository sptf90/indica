import {
  canAccessCompanyArea,
  jsonError,
  publicUser,
  requireUser,
} from "@/lib/auth";
import { getPool } from "@/lib/db";
import {
  findAccessibleCompanyForUser,
  getCompanyContextForUser,
  mapCompany,
} from "@/lib/company";

export async function GET() {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = await requireUser();
    if (!canAccessCompanyArea(user)) {
      return Response.json({
        user: publicUser(user),
        company: null,
        registered: false,
      });
    }
    const company = await getCompanyContextForUser(user);
    return Response.json({
      user: publicUser(user),
      company,
      registered: Boolean(company),
    });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}

export async function PATCH(request) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = await requireUser();
    if (!canAccessCompanyArea(user)) {
      return jsonError("Acesso restrito a conta empresarial.", 403);
    }
    const company = await findAccessibleCompanyForUser(user);
    if (!company) return jsonError("Empresa não encontrada.", 404);

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError("JSON inválido.");
    }

    const legalName =
      body.legalName != null
        ? String(body.legalName).trim()
        : company.legal_name;
    const logoUrl =
      body.logoUrl !== undefined
        ? String(body.logoUrl || "").trim() || null
        : company.logo_url;

    let cityId = company.city_id;
    if (body.cityId !== undefined) {
      cityId = Number(body.cityId);
      if (!cityId || Number.isNaN(cityId)) {
        return jsonError("Cidade obrigatória (onde a empresa está instalada).");
      }
      const poolCheck = getPool();
      const [cityRows] = await poolCheck.query(
        `SELECT id FROM cidades WHERE id = ? LIMIT 1`,
        [cityId]
      );
      if (!cityRows[0]) return jsonError("Cidade inválida.");
    }

    if (!legalName || legalName.length < 2) {
      return jsonError("Razão social obrigatória.");
    }
    if (!cityId) {
      return jsonError("Cidade obrigatória (onde a empresa está instalada).");
    }

    const pool = getPool();
    await pool.query(
      `UPDATE empresas SET razao_social = ?, logo_url = ?, cidade_id = ? WHERE id = ?`,
      [legalName, logoUrl, cityId, company.id]
    );
    const [rows] = await pool.query(
      `SELECT co.*, c.nome AS city_name, c.estado AS city_state
       FROM empresas co
       LEFT JOIN cidades c ON c.id = co.cidade_id
       WHERE co.id = ?
       LIMIT 1`,
      [company.id]
    );
    return Response.json({
      user: publicUser(user),
      company: mapCompany(rows[0]),
    });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
