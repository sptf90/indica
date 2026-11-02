/**
 * Aplica sql/schema.sql usando MYSQL_* do ambiente ou .env.local / .env.
 * Uso: node scripts/apply-schema.mjs
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

const schemaPath = path.join(root, "sql", "schema.sql");
const migratePath = path.join(root, "sql", "migrate-reputation.sql");
const migrateRankingsPath = path.join(root, "sql", "migrate-rankings.sql");
const migrateSponsorPath = path.join(root, "sql", "migrate-rankings-sponsor.sql");
const migrateCompanyPath = path.join(root, "sql", "migrate-company-3c.sql");
const migrateNotificationsPath = path.join(root, "sql", "migrate-notifications.sql");
const migrateAccountDeletionPath = path.join(root, "sql", "migrate-account-deletion.sql");
const migrateShareLinksPath = path.join(root, "sql", "migrate-share-links.sql");
const sql = fs.readFileSync(schemaPath, "utf8");
const migrateSql = fs.existsSync(migratePath)
  ? fs.readFileSync(migratePath, "utf8")
  : null;
const migrateRankingsSql = fs.existsSync(migrateRankingsPath)
  ? fs.readFileSync(migrateRankingsPath, "utf8")
  : null;
const migrateSponsorSql = fs.existsSync(migrateSponsorPath)
  ? fs.readFileSync(migrateSponsorPath, "utf8")
  : null;
const migrateCompanySql = fs.existsSync(migrateCompanyPath)
  ? fs.readFileSync(migrateCompanyPath, "utf8")
  : null;
const migrateNotificationsSql = fs.existsSync(migrateNotificationsPath)
  ? fs.readFileSync(migrateNotificationsPath, "utf8")
  : null;
const migrateAccountDeletionSql = fs.existsSync(migrateAccountDeletionPath)
  ? fs.readFileSync(migrateAccountDeletionPath, "utf8")
  : null;
const migrateShareLinksSql = fs.existsSync(migrateShareLinksPath)
  ? fs.readFileSync(migrateShareLinksPath, "utf8")
  : null;

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
  console.log("Schema aplicado com sucesso.");
} catch (error) {
  // Reaplicar: FK selected_indication já existe
  if (error && error.code === "ER_FK_DUP_NAME") {
    console.log("Schema já parcialmente aplicado; FK selected_indication ok.");
  } else if (error && String(error.message || "").includes("fk_requests_selected_indication")) {
    console.log("Schema aplicado (constraint selected_indication já existia).");
  } else {
    console.error(error);
    process.exit(1);
  }
}

if (migrateSql) {
  try {
    await connection.query(migrateSql);
    console.log("Migração de reputação aplicada.");
  } catch (error) {
    console.error("Falha na migração de reputação:", error);
    process.exit(1);
  }
}

if (migrateRankingsSql) {
  try {
    await connection.query(migrateRankingsSql);
    console.log("Migração de rankings aplicada.");
  } catch (error) {
    console.error("Falha na migração de rankings:", error);
    process.exit(1);
  }
}

if (migrateSponsorSql) {
  try {
    await connection.query(migrateSponsorSql);
    console.log("Migração de patrocínio (3B) aplicada.");
  } catch (error) {
    console.error("Falha na migração de patrocínio:", error);
    process.exit(1);
  }
}

if (migrateCompanySql) {
  try {
    await connection.query(migrateCompanySql);
    console.log("Migração empresa/resgates (3C) aplicada.");
  } catch (error) {
    console.error("Falha na migração 3C:", error);
    process.exit(1);
  }
}

if (migrateNotificationsSql) {
  try {
    await connection.query(migrateNotificationsSql);
    console.log("Migração de notificações aplicada.");
  } catch (error) {
    console.error("Falha na migração de notificações:", error);
    process.exit(1);
  }
}

if (migrateAccountDeletionSql) {
  try {
    await connection.query(migrateAccountDeletionSql);
    console.log("Migração de exclusão de conta aplicada.");
  } catch (error) {
    console.error("Falha na migração de exclusão de conta:", error);
    process.exit(1);
  }
}

if (migrateShareLinksSql) {
  try {
    await connection.query(migrateShareLinksSql);
    console.log("Migração de link de partilha aplicada.");
  } catch (error) {
    console.error("Falha na migração de link de partilha:", error);
    process.exit(1);
  }
}

await connection.end();
console.log(
  "Para seed da semana/mês + demo 3B/3C/notificações/exclusão/share/admin: npm run db:migrate"
);
