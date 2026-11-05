/**
 * Smoke: 2 users empatados em pontos; visita ao link; ordem muda; perfil mostra N.
 * Uso: BASE_URL=http://127.0.0.1:3001 node scripts/smoke-share-tiebreak.mjs
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
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

const BASE = process.env.BASE_URL || "http://127.0.0.1:3001";
const suffix = crypto.randomBytes(3).toString("hex");

const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function api(pathname, { method = "GET", body, cookie } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const setCookie = res.headers.getSetCookie?.() || [];
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data, setCookie, headers: res.headers, location: res.headers.get("location") };
}

function cookieJar(setCookieList, previous = "") {
  const map = new Map();
  for (const part of previous.split(";").map((s) => s.trim()).filter(Boolean)) {
    const i = part.indexOf("=");
    if (i > 0) map.set(part.slice(0, i), part.slice(i + 1));
  }
  for (const raw of setCookieList) {
    const first = raw.split(";")[0];
    const i = first.indexOf("=");
    if (i > 0) map.set(first.slice(0, i), first.slice(i + 1));
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

try {
  // Preferir ranking semanal open já seedado e visível
  const [openRank] = await conn.query(
    `SELECT r.id, r.cidade_id, r.periodo_inicio, r.periodo_fim
     FROM rankings r
     WHERE r.status = 'open'
       AND r.periodo_inicio <= UTC_TIMESTAMP()
       AND r.periodo_fim > UTC_TIMESTAMP()
       AND r.cidade_id IS NOT NULL
     ORDER BY r.id ASC
     LIMIT 1`
  );
  assert(openRank[0], "Sem ranking open no período actual");
  const rankingId = openRank[0].id;
  const cityId = openRank[0].city_id;
  console.log("using ranking", rankingId, "city", cityId);

  const userA = `tieA_${suffix}`;
  const userB = `tieB_${suffix}`;
  const emailA = `${userA}@example.com`;
  const emailB = `${userB}@example.com`;
  const pin = "123456";

  // Register A
  let res = await api("/api/auth/register", {
    method: "POST",
    body: { username: userA, email: emailA, password: pin, cityId },
  });
  assert(res.status === 201, `register A: ${res.status} ${JSON.stringify(res.data)}`);
  let cookieA = cookieJar(res.setCookie);
  const idA = res.data.user.id;
  const shareCodeA = res.data.user.shareCode;
  assert(shareCodeA, "user A deve ter shareCode");

  // Register B
  res = await api("/api/auth/register", {
    method: "POST",
    body: { username: userB, email: emailB, password: pin, cityId },
  });
  assert(res.status === 201, `register B: ${res.status}`);
  let cookieB = cookieJar(res.setCookie);
  const idB = res.data.user.id;

  // Enroll both (direct insert se API bloquear por limite 2+1)
  for (const uid of [idA, idB]) {
    await conn.query(
      `INSERT IGNORE INTO ranking_participacoes
        (ranking_id, usuario_id, inscrito_em, saldo, contagem_validas_periodo, status)
       VALUES (?, ?, UTC_TIMESTAMP(), 0, 0, 'active')`,
      [rankingId, uid]
    );
  }

  // Equal points + equal valid_count
  await conn.query(
    `UPDATE ranking_participacoes
     SET saldo = 50, contagem_validas_periodo = 2
     WHERE ranking_id = ? AND usuario_id IN (?, ?)`,
    [rankingId, idA, idB]
  );
  await conn.query(`UPDATE usuarios SET contagem_visitas_compartilhamento = 0 WHERE id IN (?, ?)`, [
    idA,
    idB,
  ]);
  await conn.query(`DELETE FROM visitas_compartilhamento WHERE dono_usuario_id IN (?, ?)`, [idA, idB]);

  // Before visits: B should be ahead if enrolled earlier? We force enrolled_at so A first then B
  await conn.query(
    `UPDATE ranking_participacoes SET inscrito_em = '2026-01-01 00:00:00' WHERE ranking_id = ? AND usuario_id = ?`,
    [rankingId, idA]
  );
  await conn.query(
    `UPDATE ranking_participacoes SET inscrito_em = '2026-01-02 00:00:00' WHERE ranking_id = ? AND usuario_id = ?`,
    [rankingId, idB]
  );

  res = await api(`/api/rankings/${rankingId}`, { cookie: cookieA });
  assert(res.status === 200, `standings before ${res.status}`);
  const before = (res.data.standings || []).filter((s) =>
    [idA, idB].includes(s.userId)
  );
  const posBeforeA = before.find((s) => s.userId === idA)?.position;
  const posBeforeB = before.find((s) => s.userId === idB)?.position;
  assert(posBeforeA < posBeforeB, `antes: A (${posBeforeA}) deve estar à frente de B (${posBeforeB}) por enrolled_at`);

  // Visit A's link as anonymous visitors (3 distinct cookies)
  for (let i = 0; i < 3; i += 1) {
    const visit = await fetch(`${BASE}/r/${shareCodeA}`, {
      redirect: "manual",
      headers: { Cookie: `indica_vid=smoke_visitor_${suffix}_${i}` },
    });
    assert(
      visit.status === 307 || visit.status === 302 || visit.status === 303,
      `visit ${i} status ${visit.status}`
    );
  }

  // Refresh shouldn't inflate (same visitor)
  await fetch(`${BASE}/r/${shareCodeA}`, {
    redirect: "manual",
    headers: { Cookie: `indica_vid=smoke_visitor_${suffix}_0` },
  });

  // Owner visiting own link shouldn't count (session + visitor)
  const beforeOwner = Number(
    (
      await conn.query(`SELECT contagem_visitas_compartilhamento FROM usuarios WHERE id = ?`, [idA])
    )[0][0].share_visit_count
  );
  await fetch(`${BASE}/r/${shareCodeA}`, {
    redirect: "manual",
    headers: { Cookie: `${cookieA}; indica_vid=smoke_owner_${suffix}` },
  });
  const afterOwner = Number(
    (
      await conn.query(`SELECT contagem_visitas_compartilhamento FROM usuarios WHERE id = ?`, [idA])
    )[0][0].share_visit_count
  );
  assert(
    afterOwner === beforeOwner,
    `dono não deve contar (antes=${beforeOwner} depois=${afterOwner})`
  );

  const [countRows] = await conn.query(
    `SELECT contagem_visitas_compartilhamento FROM usuarios WHERE id = ?`,
    [idA]
  );
  assert(
    Number(countRows[0].share_visit_count) === 3,
    `share_visit_count A esperado 3, got ${countRows[0].share_visit_count}`
  );

  res = await api("/api/auth/me", { cookie: cookieA });
  assert(res.status === 200, "me");
  assert(
    Number(res.data.user.shareVisitCount) === 3,
    `perfil/me count ${res.data.user.shareVisitCount}`
  );

  res = await api(`/api/rankings/${rankingId}`, { cookie: cookieA });
  const after = (res.data.standings || []).filter((s) =>
    [idA, idB].includes(s.userId)
  );
  const posAfterA = after.find((s) => s.userId === idA)?.position;
  const posAfterB = after.find((s) => s.userId === idB)?.position;
  assert(
    posAfterA < posAfterB,
    `depois: A (${posAfterA}) continua à frente de B (${posAfterB}) via share visits`
  );
  const shareA = after.find((s) => s.userId === idA)?.shareVisitCount;
  assert(Number(shareA) === 3, `standing shareVisitCount ${shareA}`);

  // Give B more visits → B sobe
  const [codeB] = await conn.query(`SELECT codigo_compartilhamento FROM usuarios WHERE id = ?`, [idB]);
  for (let i = 0; i < 5; i += 1) {
    await fetch(`${BASE}/r/${codeB[0].share_code}`, {
      redirect: "manual",
      headers: { Cookie: `indica_vid=smoke_b_${suffix}_${i}` },
    });
  }

  res = await api(`/api/rankings/${rankingId}`, { cookie: cookieA });
  const flipped = (res.data.standings || []).filter((s) =>
    [idA, idB].includes(s.userId)
  );
  const posFlipA = flipped.find((s) => s.userId === idA)?.position;
  const posFlipB = flipped.find((s) => s.userId === idB)?.position;
  assert(
    posFlipB < posFlipA,
    `após visitas B: B (${posFlipB}) deve passar A (${posFlipA})`
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        rankingId,
        userA: { id: idA, shareCode: shareCodeA, before: posBeforeA, after: posAfterA, flip: posFlipA },
        userB: { id: idB, before: posBeforeB, after: posAfterB, flip: posFlipB },
        shareVisitCountA: 3,
      },
      null,
      2
    )
  );
} catch (error) {
  console.error("SMOKE FAIL:", error);
  process.exit(1);
} finally {
  await conn.end();
}
