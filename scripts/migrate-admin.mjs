/**
 * Aplica sql/migrate-admin.sql + seed demo admin (Fase 4 MVP patrocínio).
 * Uso: node scripts/migrate-admin.mjs
 * (também encadeado em npm run db:migrate)
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

async function seedAdminDemo(connection) {
  const email = "admin.demo@goindica.local";
  const username = "admin_demo";
  const password = "123456";
  const passwordHash = await bcrypt.hash(password, 12);

  const [cities] = await connection.query(
    `SELECT id FROM cities ORDER BY id ASC LIMIT 1`
  );
  const cityId = cities[0]?.id || null;

  await connection.query(
    `INSERT INTO users (username, email, password_hash, account_type, is_admin, city_id)
     VALUES (?, ?, ?, 'user', 1, ?)
     ON DUPLICATE KEY UPDATE
       account_type = 'user',
       is_admin = 1,
       password_hash = VALUES(password_hash),
       deleted_at = NULL`,
    [username, email, passwordHash, cityId]
  );

  const [users] = await connection.query(
    `SELECT id, username, email, is_admin, account_type
     FROM users WHERE email = ? LIMIT 1`,
    [email]
  );
  const user = users[0];
  if (!user) return { ok: false };

  // Garantir que conta empresa demo NÃO é admin
  await connection.query(
    `UPDATE users SET is_admin = 0
     WHERE account_type = 'company' AND is_admin <> 0`
  );

  return {
    ok: true,
    userId: user.id,
    login: email,
    password,
    username: user.username,
  };
}

const migratePath = path.join(root, "sql", "migrate-admin.sql");
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
  console.log("Migração admin (is_admin) aplicada com sucesso.");
  const demo = await seedAdminDemo(connection);
  console.log(
    `Seed admin: user_id=${demo.userId}; login=${demo.login}; password=${demo.password}`
  );
} catch (error) {
  console.error(error);
  process.exit(1);
} finally {
  await connection.end();
}
