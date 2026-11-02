/**
 * Aplica sql/migrate-company-3c.sql + seed demo empresarial (Fase 3C).
 * Uso: node scripts/migrate-company-3c.mjs
 * (também encadeado em migrate-rankings.mjs / npm run db:migrate)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env"));

const required = ["MYSQL_HOST", "MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Faltam variáveis: ${missing.join(", ")}`);
  process.exit(1);
}

function toMysqlDatetime(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

async function seedCompanyDemo(connection) {
  const cnpj = "00000000000191";
  const email = "empresa.demo@goindica.local";
  const username = `emp_${cnpj}`;
  const passwordHash = await bcrypt.hash("123456", 12);
  const logoUrl = "/brand/goindica-logo.png";

  const [userIns] = await connection.query(
    `INSERT INTO users (username, email, password_hash, account_type)
     VALUES (?, ?, ?, 'company')
     ON DUPLICATE KEY UPDATE
       account_type = 'company',
       password_hash = VALUES(password_hash)`,
    [username, email, passwordHash]
  );

  const [users] = await connection.query(
    `SELECT id FROM users WHERE email = ? LIMIT 1`,
    [email]
  );
  const userId = users[0]?.id;
  if (!userId) return { ok: false };

  await connection.query(
    `INSERT INTO companies (user_id, cnpj, legal_name, logo_url)
     VALUES (?, ?, 'Café Demo GoIndica Ltda', ?)
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id),
       legal_name = VALUES(legal_name),
       logo_url = VALUES(logo_url)`,
    [userId, cnpj, logoUrl]
  );

  const [companies] = await connection.query(
    `SELECT id FROM companies WHERE cnpj = ? LIMIT 1`,
    [cnpj]
  );
  const companyId = companies[0]?.id;
  if (!companyId) return { ok: false, userId };

  // Garantir user_id no stub 3B
  await connection.query(
    `UPDATE companies SET user_id = ? WHERE id = ?`,
    [userId, companyId]
  );

  // Ranking final demo (RJ mensal passado) com recompensas Pendente/Resgatado/Expirado
  const [rj] = await connection.query(
    `SELECT id, name, state FROM cities WHERE slug = 'rio-de-janeiro-rj' LIMIT 1`
  );
  const city = rj[0];
  if (!city) return { ok: true, userId, companyId, rewards: 0 };

  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const title = `${city.name}/${city.state} — Mensal · Café Demo (final)`;
  const prizePositions = JSON.stringify([1, 2, 3]);
  const prizeBenefits = JSON.stringify({
    default: "Voucher Café Demo — resgate no balcão.",
  });
  const instructions =
    "Apresente documento no balcão. Confirmação exclusiva da empresa patrocinadora.";

  await connection.query(
    `INSERT INTO rankings
      (city_id, modality, period_start, period_end, status, title,
       sponsor_company_id, sponsor_display_name, sponsor_logo_url,
       prize_positions_json, prize_benefit_mode, prize_benefits_json,
       prize_redemption_instructions, prize_redemption_deadline_days,
       regulation_text)
     VALUES (?, 'monthly', ?, ?, 'final', ?, ?, 'Café Demo', ?,
             CAST(? AS JSON), 'equal', CAST(? AS JSON), ?, 30, ?)
     ON DUPLICATE KEY UPDATE
       status = 'final',
       sponsor_company_id = VALUES(sponsor_company_id),
       sponsor_display_name = VALUES(sponsor_display_name),
       sponsor_logo_url = VALUES(sponsor_logo_url),
       prize_positions_json = VALUES(prize_positions_json),
       prize_benefit_mode = VALUES(prize_benefit_mode),
       prize_benefits_json = VALUES(prize_benefits_json),
       prize_redemption_instructions = VALUES(prize_redemption_instructions),
       prize_redemption_deadline_days = VALUES(prize_redemption_deadline_days),
       regulation_text = VALUES(regulation_text),
       title = VALUES(title)`,
    [
      city.id,
      toMysqlDatetime(periodStart),
      toMysqlDatetime(periodEnd),
      title,
      companyId,
      logoUrl,
      prizePositions,
      prizeBenefits,
      instructions,
      "Regulamento demo 3C: 1 empresa, resgate confirmado pelo patrocinador.",
    ]
  );

  const [rankings] = await connection.query(
    `SELECT id FROM rankings
     WHERE city_id = ? AND modality = 'monthly' AND period_start = ?
     LIMIT 1`,
    [city.id, toMysqlDatetime(periodStart)]
  );
  const rankingId = rankings[0]?.id;
  if (!rankingId) return { ok: true, userId, companyId, rewards: 0 };

  // Usuários ganhadores demo
  const winners = [
    { username: "rank3c_w1", position: 1, status: "pending" },
    { username: "rank3c_w2", position: 2, status: "redeemed" },
    { username: "rank3c_w3", position: 3, status: "expired" },
  ];

  let rewards = 0;
  for (const w of winners) {
    const hash = await bcrypt.hash("123456", 10);
    await connection.query(
      `INSERT INTO users (username, email, password_hash, account_type, city_id, reputation)
       VALUES (?, ?, ?, 'user', ?, 80)
       ON DUPLICATE KEY UPDATE city_id = VALUES(city_id)`,
      [w.username, `${w.username}@goindica.local`, hash, city.id]
    );
    const [urows] = await connection.query(
      `SELECT id FROM users WHERE username = ? LIMIT 1`,
      [w.username]
    );
    const uid = urows[0]?.id;
    if (!uid) continue;

    await connection.query(
      `INSERT INTO ranking_participations
        (ranking_id, user_id, enrolled_at, balance, valid_count_in_period,
         frozen_reputation, final_position, status)
       VALUES (?, ?, ?, 30, 3, 80, ?, 'final')
       ON DUPLICATE KEY UPDATE
         final_position = VALUES(final_position),
         status = 'final',
         balance = VALUES(balance)`,
      [rankingId, uid, toMysqlDatetime(periodStart), w.position]
    );
    const [parts] = await connection.query(
      `SELECT id FROM ranking_participations
       WHERE ranking_id = ? AND user_id = ? LIMIT 1`,
      [rankingId, uid]
    );
    const partId = parts[0]?.id;
    if (!partId) continue;

    const expires =
      w.status === "expired"
        ? new Date(Date.now() - 2 * 24 * 3600 * 1000)
        : new Date(Date.now() + 20 * 24 * 3600 * 1000);
    const redeemedAt =
      w.status === "redeemed" ? toMysqlDatetime(new Date()) : null;
    const remindersStopped =
      w.status === "pending" ? null : toMysqlDatetime(new Date());

    await connection.query(
      `INSERT INTO ranking_rewards
        (ranking_id, company_id, user_id, participation_id,
         final_position, benefit_text, status, expires_at,
         redeemed_at, reminders_stopped_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         expires_at = VALUES(expires_at),
         redeemed_at = VALUES(redeemed_at),
         reminders_stopped_at = VALUES(reminders_stopped_at),
         benefit_text = VALUES(benefit_text)`,
      [
        rankingId,
        companyId,
        uid,
        partId,
        w.position,
        "Voucher Café Demo — resgate no balcão.",
        w.status,
        toMysqlDatetime(expires),
        redeemedAt,
        remindersStopped,
      ]
    );
    rewards += 1;
  }

  // Solicitação enviada (não publicada) para slot futuro RJ semanal
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const thisMonday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff)
  );
  const nextStart = new Date(thisMonday);
  nextStart.setUTCDate(nextStart.getUTCDate() + 14);
  const nextEnd = new Date(nextStart);
  nextEnd.setUTCDate(nextEnd.getUTCDate() + 7);

  await connection.query(
    `INSERT INTO sponsorship_requests
      (company_id, city_id, modality, period_start, period_end,
       display_name, logo_url, regulation_text,
       prize_positions_json, prize_benefit_mode, prize_benefits_json,
       prize_redemption_instructions, redemption_deadline_days, status)
     SELECT ?, ?, 'weekly', ?, ?, 'Café Demo', ?,
            'Regulamento demo: solicitação enviada, aguardando análise.',
            CAST(? AS JSON), 'equal', CAST(? AS JSON),
            ?, 30, 'submitted'
     FROM DUAL
     WHERE NOT EXISTS (
       SELECT 1 FROM sponsorship_requests
       WHERE company_id = ? AND city_id = ? AND modality = 'weekly'
         AND period_start = ?
     )`,
    [
      companyId,
      city.id,
      toMysqlDatetime(nextStart),
      toMysqlDatetime(nextEnd),
      logoUrl,
      prizePositions,
      prizeBenefits,
      instructions,
      companyId,
      city.id,
      toMysqlDatetime(nextStart),
    ]
  );

  return {
    ok: true,
    userId,
    companyId,
    rankingId,
    rewards,
    userInsertId: userIns.insertId || null,
    login: email,
    password: "123456",
  };
}

const migratePath = path.join(root, "sql", "migrate-company-3c.sql");
const sql = fs.readFileSync(migratePath, "utf8");

const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  multipleStatements: true,
});

try {
  await connection.query(sql);
  console.log("Migração empresa/resgates (3C) aplicada com sucesso.");
  const demo = await seedCompanyDemo(connection);
  console.log(
    `Seed 3C: company_id=${demo.companyId}; user_id=${demo.userId}; rewards=${demo.rewards}; login=${demo.login}`
  );
} catch (error) {
  console.error(error);
  process.exit(1);
} finally {
  await connection.end();
}
