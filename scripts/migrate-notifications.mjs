/**
 * Aplica sql/migrate-notifications.sql e faz seed de exemplos para demo.
 * Uso: node scripts/migrate-notifications.mjs
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

async function ensureDemoUser(connection) {
  const username = "notif_demo";
  const email = "notif_demo@goindica.local";
  const pin = "123456";
  const [existing] = await connection.query(
    `SELECT id, username FROM users WHERE username = ? OR email = ? LIMIT 1`,
    [username, email]
  );
  if (existing[0]) {
    return { id: existing[0].id, username: existing[0].username, created: false, pin };
  }

  const [cities] = await connection.query(
    `SELECT id FROM cities ORDER BY id ASC LIMIT 1`
  );
  const cityId = cities[0]?.id ?? null;
  const hash = await bcrypt.hash(pin, 10);
  const [ins] = await connection.query(
    `INSERT INTO users
      (username, email, password_hash, city_id, reputation,
       valid_indication_count, selected_and_evaluated_count)
     VALUES (?, ?, ?, ?, 72, 3, 4)`,
    [username, email, hash, cityId]
  );
  return { id: ins.insertId, username, created: true, pin };
}

async function seedExampleNotifications(connection, userId) {
  const [rankings] = await connection.query(
    `SELECT id, title FROM rankings WHERE status IN ('open', 'tallying', 'final')
     ORDER BY id ASC LIMIT 1`
  );
  const ranking = rankings[0] || null;
  const rankingId = ranking?.id ?? null;
  const rankingTitle = ranking?.title || "São Paulo/SP — Semanal";

  const now = new Date();
  const samples = [
    {
      category: "indications",
      event: "new_indication",
      title: "Nova indicação no seu pedido",
      body: "Seu pedido «Café especial perto de mim» recebeu uma nova indicação.",
      deeplink: "/pedir/meus",
      key: `seed:new_indication:user:${userId}`,
      minutesAgo: 12,
    },
    {
      category: "indications",
      event: "selected",
      title: "Sua indicação foi selecionada para avaliação",
      body: "O solicitante vai testar sua indicação no pedido «Manutenção de notebook».",
      deeplink: "/minhas-indicacoes",
      key: `seed:selected:user:${userId}`,
      minutesAgo: 45,
    },
    {
      category: "indications",
      event: "result_invalid",
      title: "Resultado da sua indicação",
      body: "Indicação não válida — Produto ou serviço indisponível. Pedido «Pet shop 24h».",
      deeplink: "/minhas-indicacoes",
      key: `seed:result_invalid:user:${userId}`,
      minutesAgo: 90,
    },
    {
      category: "indications",
      event: "reminder_1h",
      title: "Lembrete: falta 1 hora",
      body: "O prazo para avaliar a indicação do pedido «Mecânico de confiança» termina em cerca de 1 hora.",
      deeplink: "/pedir/meus",
      key: `seed:reminder_1h:user:${userId}`,
      minutesAgo: 5,
    },
    {
      category: "indications",
      event: "round_all_invalid",
      title: "Rodada sem indicação válida",
      body: "Todas as indicações desta rodada do pedido «Padaria artesanal» foram invalidadas. Você pode reabrir ou encerrar.",
      deeplink: "/pedir/meus",
      key: `seed:round_all_invalid:user:${userId}`,
      minutesAgo: 180,
    },
    {
      category: "scoring",
      event: "score_change",
      title: "Pontuação atualizada",
      body: `${rankingTitle}: +10 pts (indicação válida). Pontuação atual: 30.`,
      deeplink: rankingId ? `/rankings/${rankingId}` : "/rankings",
      rankingId,
      key: `seed:score_change:user:${userId}`,
      minutesAgo: 30,
    },
    {
      category: "rankings",
      event: "ranking_final",
      title: "Classificação final publicada",
      body: `A classificação final de «${rankingTitle}» já está disponível.`,
      deeplink: rankingId ? `/rankings/${rankingId}` : "/rankings",
      rankingId,
      key: `seed:ranking_final:user:${userId}`,
      minutesAgo: 240,
      read: true,
    },
  ];

  let inserted = 0;
  for (const sample of samples) {
    const created = new Date(now.getTime() - sample.minutesAgo * 60 * 1000);
    const [result] = await connection.query(
      `INSERT INTO notifications
        (user_id, category, event, title, body, deeplink, ranking_id, read_at, created_at, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         body = VALUES(body),
         deeplink = VALUES(deeplink),
         ranking_id = VALUES(ranking_id),
         read_at = VALUES(read_at),
         created_at = VALUES(created_at),
         updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        sample.category,
        sample.event,
        sample.title,
        sample.body,
        sample.deeplink,
        sample.rankingId || null,
        sample.read ? toMysqlDatetime(created) : null,
        toMysqlDatetime(created),
        sample.key,
      ]
    );
    if (result.affectedRows) inserted += 1;
  }
  return inserted;
}

const migratePath = path.join(root, "sql", "migrate-notifications.sql");
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
  console.log("Migração de notificações aplicada com sucesso.");
  const demo = await ensureDemoUser(connection);
  const seeded = await seedExampleNotifications(connection, demo.id);
  console.log(
    `Seed demo: user=${demo.username} (id=${demo.id}, created=${demo.created}); notifications upserted≈${seeded}.`
  );
  console.log(`Login demo: ${demo.username} / PIN ${demo.pin}`);
} catch (error) {
  console.error(error);
  process.exit(1);
} finally {
  await connection.end();
}
