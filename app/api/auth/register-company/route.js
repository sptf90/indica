import { getPool } from "@/lib/db";
import {
  hashPassword,
  jsonError,
  publicUser,
  validateCompanyRegisterInput,
  findUserById,
  getCurrentUser,
  isCompanyAccount,
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
  if (!validateCnpj(cnpj)) {
    return jsonError("CNPJ inválido.");
  }

  const pool = getPool();
  const [cityRows] = await pool.query(
    `SELECT id, name, state FROM cities WHERE id = ? LIMIT 1`,
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
        `INSERT INTO users (username, email, password_hash, account_type)
         VALUES (?, ?, ?, 'company')`,
        [username, email, passwordHash]
      );
      userId = userResult.insertId;
      try {
        await conn.query(
          `INSERT INTO companies (user_id, cnpj, legal_name, logo_url, city_id)
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
    throw error;
  } finally {
    conn.release();
  }
}
