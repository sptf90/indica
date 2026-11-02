import { jsonError, publicUser, requireUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import {
  findCompanyByUserId,
  getCompanyContextForUser,
  mapCompany,
} from "@/lib/company";

export async function GET() {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = await requireUser();
    if (user.account_type !== "company") {
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
    if (user.account_type !== "company") {
      return jsonError("Acesso restrito a conta empresarial.", 403);
    }
    const company = await findCompanyByUserId(user.id);
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

    if (!legalName || legalName.length < 2) {
      return jsonError("Razão social obrigatória.");
    }

    const pool = getPool();
    await pool.query(
      `UPDATE companies SET legal_name = ?, logo_url = ? WHERE id = ?`,
      [legalName, logoUrl, company.id]
    );
    const [rows] = await pool.query(
      `SELECT * FROM companies WHERE id = ? LIMIT 1`,
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
