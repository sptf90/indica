/**
 * Marca um usuário como admin (eh_admin = 1).
 * Uso: node scripts/tornar-admin.mjs [username]
 * Padrão: kaue
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const username = String(process.argv[2] || "kaue").trim();

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

if (!username) {
  console.error("Informe o username.");
  process.exit(1);
}

const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

try {
  const [rows] = await connection.query(
    `SELECT id, nome_usuario, tipo_conta, eh_admin, excluido_em
     FROM usuarios
     WHERE LOWER(nome_usuario) = LOWER(?)
     LIMIT 1`,
    [username]
  );
  const user = rows[0];
  if (!user) {
    console.error(`Usuário "${username}" não encontrado.`);
    process.exit(1);
  }
  if (user.excluido_em) {
    console.error(`Usuário "${user.nome_usuario}" está excluído.`);
    process.exit(1);
  }
  if (user.tipo_conta === "company") {
    console.error(
      `Usuário "${user.nome_usuario}" é empresa. Admin só em conta pessoa.`
    );
    process.exit(1);
  }

  await connection.query(
    `UPDATE usuarios SET eh_admin = 1 WHERE id = ?`,
    [user.id]
  );

  console.log(
    `OK: @${user.nome_usuario} (id ${user.id}) agora é admin.` +
      (Number(user.eh_admin) === 1 ? " (já era)" : "")
  );
} finally {
  await connection.end();
}
