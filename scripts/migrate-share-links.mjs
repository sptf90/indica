/**
 * Aplica sql/migrate-share-links.sql e gera share_code para users sem código.
 * Uso: node scripts/migrate-share-links.mjs
 */
import crypto from "node:crypto";
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

const ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789";

function generateShareCode(length = 8) {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

const migratePath = path.join(root, "sql", "migrate-share-links.sql");
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
  console.log("Migração de link de partilha aplicada.");

  const [missingCodes] = await connection.query(
    `SELECT id FROM users WHERE share_code IS NULL OR share_code = ''`
  );
  let assigned = 0;
  for (const row of missingCodes) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = generateShareCode();
      try {
        await connection.query(`UPDATE users SET share_code = ? WHERE id = ?`, [
          code,
          row.id,
        ]);
        assigned += 1;
        break;
      } catch (error) {
        if (error && error.code === "ER_DUP_ENTRY") continue;
        throw error;
      }
    }
  }
  console.log(`share_code atribuído a ${assigned} utilizador(es).`);

  // Recalcular contagens a partir de share_visits (idempotente)
  await connection.query(
    `UPDATE users u
     SET share_visit_count = (
       SELECT COUNT(*) FROM share_visits sv WHERE sv.owner_user_id = u.id
     )`
  );
  console.log("share_visit_count sincronizado.");
} catch (error) {
  console.error(error);
  process.exit(1);
} finally {
  await connection.end();
}
