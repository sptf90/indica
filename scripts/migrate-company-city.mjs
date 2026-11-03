/**
 * Aplica sql/migrate-company-city.sql + backfill cidade demo.
 * Uso: node scripts/migrate-company-city.mjs
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

const sqlPath = path.join(root, "sql", "migrate-company-city.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  multipleStatements: true,
});

try {
  await conn.query(sql);
  // Demo Café → Rio de Janeiro (mesma cidade dos seeds 3C)
  const [rj] = await conn.query(
    `SELECT id FROM cities WHERE slug = 'rio-de-janeiro-rj' LIMIT 1`
  );
  if (rj[0]?.id) {
    const [r] = await conn.query(
      `UPDATE companies SET city_id = ?
       WHERE cnpj = '00000000000191' AND city_id IS NULL`,
      [rj[0].id]
    );
    if (r.affectedRows) {
      console.log(`Backfill demo Café → city_id=${rj[0].id}`);
    }
  }
  console.log("OK migrate-company-city.sql");
} finally {
  await conn.end();
}
