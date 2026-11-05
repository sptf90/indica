import { getPool } from "@/lib/db";
import {
  hashPassword,
  jsonError,
  publicUser,
  validateCompanyRegisterInput,
  findUserById,
  getCurrentUser,
  isCompanyAccount,
  isRealAdminAccount,
} from "@/lib/auth";
import {
  companyUsernameFromCnpj,
  convertUserToCompany,
  normalizeCnpj,
  validateCnpj,
} from "@/lib/company";
import { setSessionCookie } from "@/lib/session";

export async function POST(request) {
  if (!getPool()) return jsonError("Banco não configurado.", 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("JSON inválido.");
  }

  const sessionUser = await getCurrentUser();
  if (sessionUser && isRealAdminAccount(sessionUser)) {
    return jsonError(
      "Administradores usam a prévia de empresa em /admin, sem converter a conta.",
      403
    );
  }
  const converting =
    Boolean(sessionUser) && !isCompanyAccount(sessionUser);

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const legalName = String(body.legalName || "").trim();
  const logoUrl = String(body.logoUrl || "").trim() || null;
  const cityId = Number(body.cityId);
  const cnpj = normalizeCnpj(body.cnpj);

  const errors = validateCompanyRegisterInput({
    email,
    password,
    cnpj,
    legalName,
    cityId,
    convertExisting: converting,
  });
  if (errors.length) return jsonError(errors[0], 400, { errors });
  if (logoUrl && logoUrl.length > 500) {
    return jsonError("URL do logotipo deve ter no máximo 500 caracteres.");
  }
  if (!validateCnpj(cnpj)) {
    return jsonError("CNPJ inválido.");
  }

  const pool = getPool();
  const [cityRows] = await pool.query(
    `SELECT id, nome, estado FROM cidades WHERE id = ? LIMIT 1`,
    [cityId]
  );
  if (!cityRows[0]) {
    return jsonError("Cidade inválida.");
  }

  if (sessionUser && isCompanyAccount(sessionUser)) {
    return jsonError("Esta conta já é empresarial.", 409);
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    let userId;
    let company;

    if (converting) {
      // Mesma conta: username + senha permanecem; só vira empresa.
      company = await convertUserToCompany(conn, {
        userId: sessionUser.id,
        cnpj,
        legalName,
        logoUrl,
        cityId,
      });
      userId = sessionUser.id;
    } else {
      const username = companyUsernameFromCnpj(cnpj);
      const passwordHash = await hashPassword(password);
      const [userResult] = await conn.query(
        `INSERT INTO usuarios (nome_usuario, email, senha_hash, tipo_conta)
         VALUES (?, ?, ?, 'company')`,
        [username, email, passwordHash]
      );
      userId = userResult.insertId;
      try {
        await conn.query(
          `INSERT INTO empresas (usuario_id, cnpj, razao_social, logo_url, cidade_id)
           VALUES (?, ?, ?, ?, ?)`,
          [userId, cnpj, legalName, logoUrl, cityId]
        );
      } catch (error) {
        if (error?.code === "ER_DUP_ENTRY") {
          throw Object.assign(new Error("CNPJ já cadastrado."), { status: 409 });
        }
        throw error;
      }
      company = {
        cnpj,
        legalName,
        logoUrl,
        cityId,
        cityName: cityRows[0].name,
        cityState: cityRows[0].state,
      };
    }

    await conn.commit();
    await setSessionCookie(userId);
    const user = await findUserById(userId);
    return Response.json(
      {
        user: publicUser(user),
        company: converting
          ? company
          : {
              cnpj,
              legalName,
              logoUrl,
              cityId,
              cityName: cityRows[0].name,
              cityState: cityRows[0].state,
            },
        converted: converting,
      },
      { status: converting ? 200 : 201 }
    );
  } catch (error) {
    await conn.rollback();
    if (error?.status) return jsonError(error.message, error.status);
    if (error?.code === "ER_DUP_ENTRY") {
      return jsonError("E-mail ou CNPJ já cadastrado.", 409);
    }
    if (error?.code === "ER_DATA_TOO_LONG") {
      return jsonError(
        "Dados longos demais (razão social até 255 caracteres; logo até 500).",
        400
      );
    }
    if (error?.code === "ER_BAD_FIELD_ERROR") {
      return jsonError(
        "Schema desatualizado — rode npm run db:migrar (empresas.cidade_id).",
        503
      );
    }
    console.error("[register-company]", error?.code || error);
    return jsonError(
      error?.sqlMessage || error?.message || "Falha ao criar conta empresarial.",
      500
    );
  } finally {
    conn.release();
  }
}
