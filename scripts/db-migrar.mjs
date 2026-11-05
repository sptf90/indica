/**
 * Aplica sql/migrations/* em ordem (somente .sql e .mjs).
 * Uso: npm run db:migrar
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mysql from "mysql2/promise";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "sql", "migrations");

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

function listMigrations() {
  if (!fs.existsSync(migrationsDir)) {
    console.error(`Pasta não encontrada: ${migrationsDir}`);
    process.exit(1);
  }
  return fs
    .readdirSync(migrationsDir)
    .filter((name) => /^\d+_.*\.(sql|mjs)$/.test(name))
    .sort((a, b) => a.localeCompare(b, "en"));
}

const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  multipleStatements: true,
});

const reset = process.argv.includes("--reset");

try {
  if (reset) {
    console.log("⚠ --reset: removendo todas as tabelas do banco…");
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    const [tables] = await connection.query(
      `SELECT TABLE_NAME AS nome
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`
    );
    for (const row of tables) {
      await connection.query(`DROP TABLE IF EXISTS \`${row.nome}\``);
      console.log(`  drop ${row.nome}`);
    }
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
  }

  const [legacy] = await connection.query(`SHOW TABLES LIKE 'users'`);
  const [modern] = await connection.query(`SHOW TABLES LIKE 'usuarios'`);
  if (legacy.length && !modern.length) {
    console.error(
      "Schema antigo em inglês detectado (tabela users).\n" +
        "Faça backup e rode: npm run db:migrar -- --reset"
    );
    process.exit(1);
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS migracoes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      aplicada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_migracoes_nome (nome)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [appliedRows] = await connection.query(
    `SELECT nome FROM migracoes ORDER BY nome ASC`
  );
  const applied = new Set(appliedRows.map((r) => r.nome));
  const files = listMigrations();

  if (!files.length) {
    console.log("Nenhuma migration encontrada em sql/migrations.");
  }

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`— já aplicada: ${file}`);
      continue;
    }

    const full = path.join(migrationsDir, file);
    console.log(`→ aplicando ${file}`);

    if (file.endsWith(".sql")) {
      const sql = fs.readFileSync(full, "utf8");
      await connection.query(sql);
    } else {
      const mod = await import(pathToFileURL(full).href);
      if (typeof mod.up !== "function") {
        throw new Error(`${file} precisa exportar async function up(connection)`);
      }
      await mod.up(connection);
    }

    await connection.query(`INSERT INTO migracoes (nome) VALUES (?)`, [file]);
    console.log(`✓ ${file}`);
  }

  console.log("Migrations concluídas.");
} catch (error) {
  console.error("Falha ao migrar:", error);
  process.exitCode = 1;
} finally {
  await connection.end();
}
