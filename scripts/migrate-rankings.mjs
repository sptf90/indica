/**
 * Aplica sql/migrate-rankings.sql + migrate-rankings-sponsor.sql
 * e faz seed dos rankings da semana/mês + demo patrocinado 3B.
 * Uso: node scripts/migrate-rankings.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

/** Segunda 00:00 UTC da semana corrente (seg–dom). Fuso oficial TBD. */
function currentWeekWindow(now = new Date()) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const day = start.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + diff);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

function currentMonthWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

function nextWeekWindow(now = new Date()) {
  const current = currentWeekWindow(now);
  const start = new Date(current.end);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

function titleFor(cityName, state, modality) {
  const place = cityName ? `${cityName}${state ? `/${state}` : ""}` : "Brasil";
  return modality === "weekly"
    ? `${place} — Semanal`
    : `${place} — Mensal`;
}

async function seedCurrentRankings(connection) {
  const [cities] = await connection.query(
    `SELECT id, name, state FROM cities ORDER BY name ASC`
  );
  const week = currentWeekWindow();
  const month = currentMonthWindow();
  const targets = cities.length
    ? cities.map((c) => ({
        cityId: c.id,
        name: c.name,
        state: c.state,
      }))
    : [{ cityId: null, name: "Brasil", state: null }];

  let inserted = 0;
  for (const target of targets) {
    for (const spec of [
      { modality: "weekly", ...week },
      { modality: "monthly", ...month },
    ]) {
      const title = titleFor(target.name, target.state, spec.modality);
      const [result] = await connection.query(
        `INSERT IGNORE INTO rankings
          (city_id, modality, period_start, period_end, status, title)
         VALUES (?, ?, ?, ?, 'open', ?)`,
        [
          target.cityId,
          spec.modality,
          toMysqlDatetime(spec.start),
          toMysqlDatetime(spec.end),
          title,
        ]
      );
      if (result.affectedRows) inserted += 1;
    }
  }
  return { cities: targets.length, inserted };
}

/**
 * Demo 3B: empresa stub + 1 ranking ativo patrocinado (SP semanal) +
 * 1 ranking futuro preparado (oculto até início+ativo).
 */
async function seedSponsoredDemo(connection) {
  const logoUrl = "/brand/goindica-logo.png";
  const [companyResult] = await connection.query(
    `INSERT INTO companies (cnpj, legal_name, logo_url)
     VALUES ('00000000000191', 'Café Demo GoIndica Ltda', ?)
     ON DUPLICATE KEY UPDATE
       legal_name = VALUES(legal_name),
       logo_url = VALUES(logo_url)`,
    [logoUrl]
  );

  const [companies] = await connection.query(
    `SELECT id, legal_name, logo_url FROM companies WHERE cnpj = '00000000000191' LIMIT 1`
  );
  const company = companies[0];
  if (!company) {
    return { companyId: null, sponsored: 0, futureHidden: 0 };
  }

  const week = currentWeekWindow();
  const [spCities] = await connection.query(
    `SELECT id, name, state FROM cities WHERE slug = 'sao-paulo-sp' LIMIT 1`
  );
  const city = spCities[0];
  const cityId = city?.id ?? null;
  const cityLabel = city
    ? `${city.name}/${city.state}`
    : "São Paulo/SP";

  const prizePositions = JSON.stringify([1, 2, 3]);
  const prizeBenefits = JSON.stringify({
    default:
      "Voucher de café especial no Café Demo (retirada no balcão com documento).",
  });
  const instructions =
    "Após o resultado final, apresente este benefício no balcão do Café Demo com documento. O resgate é confirmado pela empresa patrocinadora (sem botão de confirmação no app).";

  const siteUrl = "https://www.cafedemo.example";
  const [upd] = await connection.query(
    `UPDATE rankings
     SET sponsor_company_id = ?,
         sponsor_display_name = ?,
         sponsor_logo_url = ?,
         sponsor_site_url = ?,
         prize_positions_json = ?,
         prize_benefit_mode = 'equal',
         prize_benefits_json = ?,
         prize_redemption_instructions = ?,
         title = ?
     WHERE modality = 'weekly'
       AND period_start = ?
       AND ${cityId == null ? "city_id IS NULL" : "city_id = ?"}
     LIMIT 1`,
    cityId == null
      ? [
          company.id,
          "Café Demo",
          logoUrl,
          siteUrl,
          prizePositions,
          prizeBenefits,
          instructions,
          `${cityLabel} — Semanal · Café Demo`,
          toMysqlDatetime(week.start),
        ]
      : [
          company.id,
          "Café Demo",
          logoUrl,
          siteUrl,
          prizePositions,
          prizeBenefits,
          instructions,
          `${cityLabel} — Semanal · Café Demo`,
          toMysqlDatetime(week.start),
          cityId,
        ]
  );

  const next = nextWeekWindow();
  const futureTitle = `${cityLabel} — Semanal (preparado)`;
  const [futureIns] = await connection.query(
    `INSERT IGNORE INTO rankings
      (city_id, modality, period_start, period_end, status, title,
       sponsor_company_id, sponsor_display_name, sponsor_logo_url,
       prize_positions_json, prize_benefit_mode, prize_benefits_json,
       prize_redemption_instructions)
     VALUES (?, 'weekly', ?, ?, 'open', ?, ?, ?, ?, ?, 'equal', ?, ?)`,
    [
      cityId,
      toMysqlDatetime(next.start),
      toMysqlDatetime(next.end),
      futureTitle,
      company.id,
      "Café Demo",
      logoUrl,
      prizePositions,
      prizeBenefits,
      instructions,
    ]
  );

  return {
    companyId: company.id,
    companyInsertId: companyResult.insertId || null,
    sponsored: upd.affectedRows,
    futureHidden: futureIns.affectedRows,
    futurePeriodStart: toMysqlDatetime(next.start),
  };
}

const migratePath = path.join(root, "sql", "migrate-rankings.sql");
const sponsorPath = path.join(root, "sql", "migrate-rankings-sponsor.sql");
const sql = fs.readFileSync(migratePath, "utf8");
const sponsorSql = fs.readFileSync(sponsorPath, "utf8");

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
  console.log("Migração de rankings aplicada com sucesso.");
  await connection.query(sponsorSql);
  console.log("Migração de patrocínio (3B) aplicada com sucesso.");
  const seed = await seedCurrentRankings(connection);
  console.log(
    `Seed: ${seed.inserted} ranking(s) novos (${seed.cities} cidade(s)/escopo).`
  );
  const demo = await seedSponsoredDemo(connection);
  console.log(
    `Seed 3B: company_id=${demo.companyId}; sponsored_rows=${demo.sponsored}; future_hidden=${demo.futureHidden} (start ${demo.futurePeriodStart}).`
  );
  console.log(
    "Para empresa/resgates (3C): npm run db:migrate-company (já incluso em npm run db:migrate)."
  );
} catch (error) {
  console.error(error);
  process.exit(1);
} finally {
  await connection.end();
}
