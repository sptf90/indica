import { createHash } from "node:crypto";
import { getPool } from "./db";
import { withTransaction } from "./db-tx";
import { writeAudit } from "./audit";
import { validateProfilePatch } from "./profile";
import { adminModule } from "./admin-catalog";
import { REQUEST_STATUS_LABELS, INVALID_REASONS } from "./constants";
import { fromMysqlDatetime } from "./time";
import { navigationLinks } from "./location";
import { formatCnpj } from "./cnpj";
import { isPlacesConfigured } from "./google-places";

function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
export function adminId(raw) {
  const text = String(raw ?? "");
  if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(Number(text))) fail("Identificador inválido.");
  return Number(text);
}
function pool() { const db = getPool(); if (!db) fail("Banco não configurado.", 503); return db; }
function iso(value) { return value ? fromMysqlDatetime(value).toISOString() : null; }
function localDayBoundary(day, nextDay = false) {
  const calendar = new Date(`${day}T12:00:00Z`);
  if (nextDay) calendar.setUTCDate(calendar.getUTCDate() + 1);
  const date = calendar.toISOString().slice(0, 10);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", timeZoneName: "longOffset" }).formatToParts(calendar).find(part => part.type === "timeZoneName").value.replace("GMT", "") || "+00:00";
  return new Date(`${date}T00:00:00${offset}`).toISOString().slice(0, 19).replace("T", " ");
}
function revision(row) {
  return createHash("sha256").update(JSON.stringify([row.id, row.username, row.email, row.cityId, row.photoUrl, Boolean(row.isAdmin), row.legalName, row.logoUrl, row.updatedAt])).digest("hex");
}
const city = "c.nome AS cityName,c.estado AS cityState";
const userStatus = "CASE WHEN u.excluido_em IS NOT NULL THEN 'deleted' WHEN u.eh_admin=1 AND u.tipo_conta='user' THEN 'admin' ELSE u.tipo_conta END";
const requestStatus = "CASE WHEN p.excluido_em IS NOT NULL THEN 'deleted' ELSE p.status END";
const indicationStatus = "CASE WHEN i.excluido_em IS NOT NULL THEN 'deleted' ELSE i.status END";
const rewardStatus = "CASE WHEN rw.status='pending' AND rw.expira_em<=UTC_TIMESTAMP() THEN 'expired' ELSE rw.status END";
const defs = {
  usuarios: { from: "usuarios u LEFT JOIN cidades c ON c.id=u.cidade_id", select: `u.id,u.nome_usuario AS title,u.email AS subtitle,${userStatus} AS status,${city},DATE_FORMAT(u.criado_em,'%Y-%m-%dT%H:%i:%sZ') AS createdAt,DATE_FORMAT(u.excluido_em,'%Y-%m-%dT%H:%i:%sZ') AS deletedAt,(SELECT COUNT(*) FROM pedidos p WHERE p.solicitante_id=u.id) AS requestCount,(SELECT COUNT(*) FROM indicacoes i WHERE i.indicador_id=u.id) AS indicationCount`, search: ["u.nome_usuario", "u.email", "c.nome", "c.estado"], status: userStatus, date: "u.criado_em", id: "u.id", relations: { cityId: "u.cidade_id" } },
  empresas: { from: "empresas e LEFT JOIN usuarios u ON u.id=e.usuario_id LEFT JOIN cidades c ON c.id=e.cidade_id", select: `e.id,COALESCE(e.razao_social,'Empresa sem razão social') AS title,e.cnpj,u.nome_usuario AS username,${city},DATE_FORMAT(e.criado_em,'%Y-%m-%dT%H:%i:%sZ') AS createdAt,CASE WHEN u.excluido_em IS NOT NULL THEN 'deleted' ELSE 'active' END AS status`, search: ["e.razao_social", "e.cnpj", "u.nome_usuario", "c.nome"], status: "CASE WHEN u.excluido_em IS NOT NULL THEN 'deleted' ELSE 'active' END", date: "e.criado_em", id: "e.id", relations: { userId: "e.usuario_id", cityId: "e.cidade_id" } },
  cidades: { from: "cidades c", select: "c.id,c.nome AS title,c.estado AS state,DATE_FORMAT(c.criado_em,'%Y-%m-%dT%H:%i:%sZ') AS createdAt,(SELECT COUNT(*) FROM usuarios u WHERE u.cidade_id=c.id AND u.excluido_em IS NULL) AS userCount,(SELECT COUNT(*) FROM pedidos p WHERE p.cidade_id=c.id) AS requestCount,(SELECT COUNT(*) FROM empresas e WHERE e.cidade_id=c.id) AS companyCount", search: ["c.nome", "c.estado"], date: "c.criado_em", id: "c.id", relations: {} },
  pedidos: { from: "pedidos p JOIN usuarios u ON u.id=p.solicitante_id JOIN cidades c ON c.id=p.cidade_id", select: `p.id,p.titulo AS title,u.nome_usuario AS username,${city},${requestStatus} AS status,DATE_FORMAT(p.criado_em,'%Y-%m-%dT%H:%i:%sZ') AS createdAt,(SELECT COUNT(*) FROM indicacoes i WHERE i.pedido_id=p.id) AS indicationCount`, search: ["p.titulo", "p.detalhes", "u.nome_usuario", "c.nome"], status: requestStatus, date: "p.criado_em", id: "p.id", relations: { userId: "p.solicitante_id", cityId: "p.cidade_id" } },
  indicacoes: { from: "indicacoes i JOIN pedidos p ON p.id=i.pedido_id JOIN usuarios u ON u.id=i.indicador_id LEFT JOIN indicacao_locais l ON l.indicacao_id=i.id JOIN cidades c ON c.id=p.cidade_id", select: `i.id,i.descricao AS title,p.titulo AS requestTitle,u.nome_usuario AS username,l.nome AS placeName,${indicationStatus} AS status,DATE_FORMAT(i.criado_em,'%Y-%m-%dT%H:%i:%sZ') AS createdAt,${city}`, search: ["i.descricao", "p.titulo", "u.nome_usuario", "l.nome", "l.endereco"], status: indicationStatus, date: "i.criado_em", id: "i.id", relations: { userId: "i.indicador_id", requestId: "i.pedido_id", cityId: "p.cidade_id" } },
  avaliacoes: { from: "avaliacoes a JOIN pedidos p ON p.id=a.pedido_id JOIN usuarios u ON u.id=a.avaliador_id", select: "a.id,p.titulo AS title,u.nome_usuario AS username,a.resultado AS status,a.motivo_codigo AS reason,DATE_FORMAT(a.avaliada_em,'%Y-%m-%dT%H:%i:%sZ') AS createdAt", search: ["p.titulo", "u.nome_usuario", "a.motivo_texto", "a.motivo_codigo"], status: "a.resultado", date: "a.avaliada_em", id: "a.id", relations: { userId: "a.avaliador_id", requestId: "a.pedido_id", indicationId: "a.indicacao_id" } },
  resgates: { from: "ranking_premios rw JOIN usuarios u ON u.id=rw.usuario_id JOIN empresas e ON e.id=rw.empresa_id JOIN rankings r ON r.id=rw.ranking_id", select: `rw.id,rw.texto_beneficio AS title,u.nome_usuario AS username,e.razao_social AS companyName,r.titulo AS rankingTitle,${rewardStatus} AS status,DATE_FORMAT(rw.expira_em,'%Y-%m-%dT%H:%i:%sZ') AS expiresAt,DATE_FORMAT(rw.criado_em,'%Y-%m-%dT%H:%i:%sZ') AS createdAt`, search: ["rw.texto_beneficio", "u.nome_usuario", "e.razao_social", "r.titulo"], status: rewardStatus, date: "rw.criado_em", id: "rw.id", relations: { userId: "rw.usuario_id", companyId: "rw.empresa_id", rankingId: "rw.ranking_id" } },
  pontuacao: { from: "ledger_pontuacao lp JOIN usuarios u ON u.id=lp.usuario_id JOIN rankings r ON r.id=lp.ranking_id", select: "lp.id,lp.tipo_evento AS title,u.nome_usuario AS username,r.titulo AS rankingTitle,lp.delta,lp.saldo_depois AS balance,DATE_FORMAT(lp.criado_em,'%Y-%m-%dT%H:%i:%sZ') AS createdAt", search: ["u.nome_usuario", "r.titulo", "lp.tipo_evento", "lp.chave_regra"], date: "lp.criado_em", id: "lp.id", relations: { userId: "lp.usuario_id", rankingId: "lp.ranking_id", requestId: "lp.pedido_id", indicationId: "lp.indicacao_id" } },
  reputacao: { from: "historico_reputacao h JOIN usuarios u ON u.id=h.usuario_id", select: "h.id,h.titulo_pedido_snapshot AS title,u.nome_usuario AS username,h.resultado AS status,h.delta,h.reputacao_depois AS reputationAfter,DATE_FORMAT(h.criado_em,'%Y-%m-%dT%H:%i:%sZ') AS createdAt", search: ["u.nome_usuario", "h.titulo_pedido_snapshot"], status: "h.resultado", date: "h.criado_em", id: "h.id", relations: { userId: "h.usuario_id", requestId: "h.pedido_id", evaluationId: "h.avaliacao_id" } },
  notificacoes: { from: "notificacoes n JOIN usuarios u ON u.id=n.usuario_id", select: "n.id,n.titulo AS title,u.nome_usuario AS username,n.categoria AS category,CASE WHEN n.lida_em IS NULL THEN 'unread' ELSE 'read' END AS status,DATE_FORMAT(n.criado_em,'%Y-%m-%dT%H:%i:%sZ') AS createdAt", search: ["n.titulo", "n.corpo", "u.nome_usuario"], status: "CASE WHEN n.lida_em IS NULL THEN 'unread' ELSE 'read' END", date: "n.criado_em", id: "n.id", relations: { userId: "n.usuario_id", requestId: "n.pedido_id", indicationId: "n.indicacao_id", rankingId: "n.ranking_id" } },
  auditoria: { from: "eventos_auditoria a LEFT JOIN usuarios u ON u.id=a.ator_id", select: "a.id,COALESCE(a.motivo,'Operação do sistema') AS title,a.tipo_entidade AS entityType,a.entidade_id AS entityId,COALESCE(u.nome_usuario,'Sistema') AS username,a.status_anterior AS fromStatus,a.status_novo AS toStatus,DATE_FORMAT(a.criado_em,'%Y-%m-%dT%H:%i:%sZ') AS createdAt", search: ["a.motivo", "a.tipo_entidade", "u.nome_usuario"], date: "a.criado_em", id: "a.id", relations: { userId: "a.ator_id", entityId: "a.entidade_id" } },
};
const labels = { ...REQUEST_STATUS_LABELS, user: "Usuário", company: "Empresa", admin: "Administrador", deleted: "Excluído", active: "Ativa", sent: "Enviada", selected: "Selecionada", valid: "Válida", invalid: "Não válida", not_selected: "Não escolhida", pending: "Pendente", redeemed: "Resgatado", expired: "Expirado", read: "Lida", unread: "Não lida" };
const reasons = Object.fromEntries(INVALID_REASONS.map(r => [r.code, r.label]));
export async function listAdminRecords(section, params = new URLSearchParams()) {
  const def = defs[section], meta = adminModule(section);
  if (!def || !meta) fail("Área administrativa não encontrada.", 404);
  const supported = new Set(["q", "status", "page", "from", "to", ...Object.keys(def.relations), ...(section === "auditoria" ? ["entityType"] : []), ...(section === "pedidos" ? ["overdue"] : [])]);
  if ([...params.keys()].some(key => !supported.has(key))) fail("Filtro não disponível nesta área administrativa.");
  const page = Number(params.get("page") || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) fail("Página inválida.");
  const q = String(params.get("q") || "").trim();
  if (q.length > 160) fail("Use até 160 caracteres na busca.");
  const status = params.get("status") || "all";
  if (!meta.statuses.some(([value]) => value === status)) fail("Filtro de situação inválido.");
  const where = [], values = [];
  if (q) {
    const term = `%${q.replace(/[=%_]/g, "=$&")}%`;
    const matches = def.search.map(col => `${col} LIKE ? ESCAPE '='`);
    values.push(...def.search.map(() => term));
    if (/^\d+$/.test(q)) { matches.push(`${def.id}=?`); values.push(q); }
    const document = q.replace(/\D/g, "");
    if (section === "empresas" && /^[\d.\/\s-]+$/.test(q) && document.length === 14) { matches.push("e.cnpj=?"); values.push(document); }
    where.push(`(${matches.join(" OR ")})`);
  }
  if (status !== "all") { where.push(`(${def.status})=?`); values.push(status); }
  for (const [key, column] of Object.entries(def.relations)) if (params.has(key)) { where.push(`${column}=?`); values.push(adminId(params.get(key))); }
  if (section === "auditoria" && params.get("entityType")) { where.push("a.tipo_entidade=?"); values.push(String(params.get("entityType")).slice(0, 32)); }
  for (const key of ["from", "to"]) {
    const date = params.get(key); if (!date) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) fail("Data inválida.");
    where.push(`${def.date} ${key === "from" ? ">= ?" : "< ?"}`); values.push(localDayBoundary(date, key === "to"));
  }
  if (params.get("from") && params.get("to") && params.get("from") > params.get("to")) fail("A data inicial deve vir antes da final.");
  if (params.get("overdue") === "1") {
    if (section !== "pedidos") fail("Filtro de prazo disponível somente para pedidos.");
    where.push("p.status='in_evaluation' AND p.avaliacao_prazo_em<UTC_TIMESTAMP() AND p.excluido_em IS NULL");
  }
  const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  const db = pool(), pageSize = 25;
  const [[counts], [rows]] = await Promise.all([
    db.query(`SELECT COUNT(*) AS total FROM ${def.from}${clause}`, values),
    db.query(`SELECT ${def.select} FROM ${def.from}${clause} ORDER BY ${def.date} DESC,${def.id} DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, values),
  ]);
  const items = rows.map(row => ({ ...row, ...(row.cnpj ? { cnpj: formatCnpj(row.cnpj) } : {}), createdAt: iso(row.createdAt), expiresAt: iso(row.expiresAt), deletedAt: iso(row.deletedAt), cityLabel: [row.cityName, row.cityState].filter(Boolean).join(" / ") || "—", statusLabel: labels[row.status] || row.status || "—", reason: reasons[row.reason] || row.reason || "—", category: { indications: "Indicações", rankings: "Rankings", scoring: "Pontuação" }[row.category] || row.category, entityLabel: row.entityType ? `${row.entityType} #${row.entityId}` : undefined }));
  return { items, pagination: { page, pageSize, total: Number(counts[0].total), totalPages: Math.max(1, Math.ceil(Number(counts[0].total) / pageSize)) } };
}

const userSelect = `SELECT u.id,u.nome_usuario AS username,u.email,u.tipo_conta AS accountType,u.eh_admin AS isAdmin,u.foto_url AS photoUrl,u.cidade_id AS cityId,u.reputacao AS reputation,u.contagem_indicacoes_validas AS validCount,u.contagem_selecionadas_avaliadas AS evaluatedCount,u.contagem_visitas_compartilhamento AS shareVisits,DATE_FORMAT(u.excluido_em,'%Y-%m-%dT%H:%i:%sZ') AS deletedAt,DATE_FORMAT(u.criado_em,'%Y-%m-%dT%H:%i:%sZ') AS createdAt,DATE_FORMAT(u.atualizado_em,'%Y-%m-%dT%H:%i:%sZ') AS updatedAt,${city} FROM usuarios u LEFT JOIN cidades c ON c.id=u.cidade_id`;
const companySelect = `SELECT e.id,e.usuario_id AS userId,e.razao_social AS legalName,e.cnpj,e.logo_url AS logoUrl,e.cidade_id AS cityId,DATE_FORMAT(e.criado_em,'%Y-%m-%dT%H:%i:%sZ') AS createdAt,DATE_FORMAT(e.atualizado_em,'%Y-%m-%dT%H:%i:%sZ') AS updatedAt,u.nome_usuario AS username,DATE_FORMAT(u.excluido_em,'%Y-%m-%dT%H:%i:%sZ') AS accountDeletedAt,${city} FROM empresas e LEFT JOIN usuarios u ON u.id=e.usuario_id LEFT JOIN cidades c ON c.id=e.cidade_id`;
function field(label, value, type = "text", href) { return { label, value: value ?? null, type, ...(href ? { href } : {}) }; }
function related(title, section, filter) { return { title, href: `/admin/${section}?${new URLSearchParams(filter)}` }; }
function itemLink(section, id) { return id ? `/admin/${section}/${id}` : null; }
function safeUrl(value) { try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; } }
function redact(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !/password|senha|secret|token|cookie/i.test(key)).map(([key, item]) => [key, redact(item)]));
}
export async function getAdminRecord(section, id, viewerId) {
  if (!adminModule(section) || !Object.hasOwn(defs, section)) fail("Área administrativa não encontrada.", 404);
  id = adminId(id); const db = pool();
  let fields = [], relations = [], title, statusLabel, editable = null, location = null;
  if (section === "usuarios") {
    const [[row]] = await db.query(`${userSelect} WHERE u.id=?`, [id]); if (!row) fail("Usuário não encontrado.", 404);
    row.isAdmin = Boolean(row.isAdmin); row.updatedAt = iso(row.updatedAt);
    title = `@${row.username}`; statusLabel = row.deletedAt ? "Conta excluída" : row.isAdmin && row.accountType === "user" ? "Administrador" : row.accountType === "company" ? "Empresa" : "Usuário";
    fields = [field("E-mail", row.email), field("Foto", row.photoUrl), field("Perfil", statusLabel), field("Cidade", [row.cityName, row.cityState].filter(Boolean).join(" / ")), field("Reputação", `${row.reputation}/100`), field("Indicações válidas", row.validCount), field("Avaliações recebidas", row.evaluatedCount), field("Visitas por compartilhamento", row.shareVisits), field("Cadastro", iso(row.createdAt), "date"), field("Última alteração", row.updatedAt, "date"), field("Exclusão", iso(row.deletedAt), "date")];
    relations = [related("Pedidos deste usuário", "pedidos", { userId: id }), related("Indicações deste usuário", "indicacoes", { userId: id }), related("Empresas vinculadas", "empresas", { userId: id }), related("Extrato de pontos", "pontuacao", { userId: id }), related("Histórico de reputação", "reputacao", { userId: id }), related("Prêmios e resgates", "resgates", { userId: id }), related("Notificações", "notificacoes", { userId: id }), related("Operações realizadas", "auditoria", { userId: id })];
    if (!row.deletedAt) editable = { kind: "user", ...Object.fromEntries(["id", "username", "email", "photoUrl", "cityId", "cityName", "cityState", "accountType", "isAdmin"].map(key => [key, row[key]])), revision: revision(row), isSelf: Number(viewerId) === id };
  } else if (section === "empresas") {
    const [[row]] = await db.query(`${companySelect} WHERE e.id=?`, [id]); if (!row) fail("Empresa não encontrada.", 404);
    row.updatedAt = iso(row.updatedAt); title = row.legalName || "Empresa sem razão social"; statusLabel = row.accountDeletedAt ? "Conta excluída" : "Ativa";
    fields = [field("CNPJ", formatCnpj(row.cnpj)), field("Responsável", row.username, "text", itemLink("usuarios", row.userId)), field("Cidade", [row.cityName, row.cityState].filter(Boolean).join(" / ")), field("Logo", row.logoUrl), field("Cadastro", iso(row.createdAt), "date"), field("Última alteração", row.updatedAt, "date")];
    relations = [related("Prêmios e resgates", "resgates", { companyId: id }), { title: "Gerenciar patrocínios", href: "/admin/patrocinios" }];
    if (!row.accountDeletedAt) editable = { kind: "company", ...Object.fromEntries(["id", "legalName", "logoUrl", "cityId", "cityName", "cityState"].map(key => [key, row[key]])), revision: revision(row) };
  } else if (section === "pedidos") {
    const [[r]] = await db.query(`SELECT p.id,p.titulo AS title,p.detalhes AS details,p.solicitante_id AS userId,u.nome_usuario AS username,${city},p.canal_indicacao AS contactMode,p.status,p.numero_ciclo AS cycle,p.contagem_reaberturas AS reopenCount,p.indicacao_selecionada_id AS selectedId,DATE_FORMAT(p.avaliacao_prazo_em,'%Y-%m-%dT%H:%i:%sZ') AS deadline,DATE_FORMAT(p.comparacao_aberta_em,'%Y-%m-%dT%H:%i:%sZ') AS comparisonAt,DATE_FORMAT(p.criado_em,'%Y-%m-%dT%H:%i:%sZ') AS createdAt,DATE_FORMAT(p.fechado_em,'%Y-%m-%dT%H:%i:%sZ') AS closedAt,p.motivo_fechamento AS closeReason,DATE_FORMAT(p.excluido_em,'%Y-%m-%dT%H:%i:%sZ') AS deletedAt FROM pedidos p JOIN usuarios u ON u.id=p.solicitante_id JOIN cidades c ON c.id=p.cidade_id WHERE p.id=?`, [id]); if (!r) fail("Pedido não encontrado.", 404);
    title = r.title; statusLabel = r.deletedAt ? "Excluído" : labels[r.status] || r.status;
    fields = [field("Solicitante", r.username, "text", itemLink("usuarios", r.userId)), field("Descrição", r.details), field("Cidade", `${r.cityName} / ${r.cityState}`), field("Contato solicitado", { maps: "Localização", whatsapp: "WhatsApp", both: "Localização e WhatsApp" }[r.contactMode] || "Formato livre"), field("Ciclo", r.cycle), field("Reaberturas", r.reopenCount), field("Indicação escolhida", r.selectedId ? `#${r.selectedId}` : null, "text", itemLink("indicacoes", r.selectedId)), field("Comparação aberta", iso(r.comparisonAt), "date"), field("Prazo de avaliação", iso(r.deadline), "date"), field("Criado em", iso(r.createdAt), "date"), field("Fechado em", iso(r.closedAt), "date"), field("Motivo do fechamento", r.closeReason), field("Excluído em", iso(r.deletedAt), "date")];
    relations = [related("Todas as indicações deste pedido", "indicacoes", { requestId: id }), related("Avaliações do pedido", "avaliacoes", { requestId: id }), related("Pontos gerados", "pontuacao", { requestId: id }), related("Linha do tempo do pedido", "auditoria", { entityType: "request", entityId: id })];
  } else if (section === "indicacoes") {
    const [[r]] = await db.query(`SELECT i.id,i.descricao AS title,i.status,i.resultado AS result,i.whatsapp_numero AS whatsapp,i.indicador_id AS userId,u.nome_usuario AS username,i.pedido_id AS requestId,p.titulo AS requestTitle,i.numero_ciclo AS cycle,DATE_FORMAT(i.selecionada_em,'%Y-%m-%dT%H:%i:%sZ') AS selectedAt,DATE_FORMAT(i.avaliada_em,'%Y-%m-%dT%H:%i:%sZ') AS evaluatedAt,DATE_FORMAT(i.criado_em,'%Y-%m-%dT%H:%i:%sZ') AS createdAt,DATE_FORMAT(i.excluido_em,'%Y-%m-%dT%H:%i:%sZ') AS deletedAt,i.motivo_invalido_texto AS reasonText,i.motivo_invalido_codigo AS reasonCode,l.nome AS placeName,l.endereco AS address,l.latitude,l.longitude,l.place_id AS placeId,l.origem AS source FROM indicacoes i JOIN usuarios u ON u.id=i.indicador_id JOIN pedidos p ON p.id=i.pedido_id LEFT JOIN indicacao_locais l ON l.indicacao_id=i.id WHERE i.id=?`, [id]); if (!r) fail("Indicação não encontrada.", 404);
    title = `Indicação #${id}`; statusLabel = r.deletedAt ? "Excluída" : labels[r.status] || r.status;
    fields = [field("Descrição", r.title), field("Indicador", r.username, "text", itemLink("usuarios", r.userId)), field("Pedido", r.requestTitle, "text", itemLink("pedidos", r.requestId)), field("WhatsApp", r.whatsapp), field("Estabelecimento", r.placeName), field("Endereço", r.address), field("Latitude", r.latitude), field("Longitude", r.longitude), field("Origem do local", r.source), field("Place ID", r.placeId), field("Ciclo", r.cycle), field("Resultado", labels[r.result] || r.result), field("Motivo", reasons[r.reasonCode] || r.reasonCode), field("Complemento", r.reasonText), field("Enviada em", iso(r.createdAt), "date"), field("Selecionada em", iso(r.selectedAt), "date"), field("Avaliada em", iso(r.evaluatedAt), "date"), field("Excluída em", iso(r.deletedAt), "date")];
    const [links] = await db.query("SELECT url FROM indicacao_links WHERE indicacao_id=? ORDER BY ordem,id", [id]);
    fields.push(...links.map((link, index) => field(`Link ${index + 1}`, link.url, "text", safeUrl(link.url))));
    location = navigationLinks(r);
    relations = [related("Avaliações desta indicação", "avaliacoes", { indicationId: id }), related("Pontos gerados", "pontuacao", { indicationId: id }), related("Linha do tempo da indicação", "auditoria", { entityType: "indication", entityId: id })];
  } else if (section === "cidades") {
    const [[r]] = await db.query("SELECT id,nome AS title,estado AS state,slug,DATE_FORMAT(criado_em,'%Y-%m-%dT%H:%i:%sZ') AS createdAt FROM cidades WHERE id=?", [id]); if (!r) fail("Cidade não encontrada.", 404);
    title = `${r.title} / ${r.state}`; fields = [field("Município", r.title), field("UF", r.state), field("Identificador", r.slug), field("Cadastro", iso(r.createdAt), "date")];
    relations = [related("Usuários nesta cidade", "usuarios", { cityId: id }), related("Pedidos nesta cidade", "pedidos", { cityId: id }), related("Empresas nesta cidade", "empresas", { cityId: id })];
  } else {
    const extra = {
      avaliacoes: { select: "a.pedido_id AS requestId,a.indicacao_id AS indicationId,a.avaliador_id AS userId,a.motivo_texto AS reasonText", fields: [["Motivo", "reason"], ["Complemento", "reasonText"]] },
      resgates: { select: "rw.usuario_id AS userId,rw.empresa_id AS companyId,rw.ranking_id AS rankingId,rw.posicao_final AS position,DATE_FORMAT(rw.resgatado_em,'%Y-%m-%dT%H:%i:%sZ') AS redeemedAt", fields: [["Posição", "position"], ["Prazo de resgate", "expiresAt", "date"], ["Resgatado em", "redeemedAt", "date"]] },
      pontuacao: { select: "lp.usuario_id AS userId,lp.ranking_id AS rankingId,lp.pedido_id AS requestId,lp.indicacao_id AS indicationId,lp.chave_regra AS rule,lp.codigo_motivo AS reasonCode", fields: [["Variação", "delta"], ["Saldo após", "balance"], ["Regra", "rule"], ["Motivo", "reasonCode"]] },
      reputacao: { select: "h.usuario_id AS userId,h.pedido_id AS requestId,h.avaliacao_id AS evaluationId,h.reputacao_antes AS beforeReputation", fields: [["Reputação antes", "beforeReputation"], ["Variação", "delta"], ["Reputação após", "reputationAfter"]] },
      notificacoes: { select: "n.usuario_id AS userId,n.pedido_id AS requestId,n.indicacao_id AS indicationId,n.ranking_id AS rankingId,n.corpo AS body,DATE_FORMAT(n.lida_em,'%Y-%m-%dT%H:%i:%sZ') AS readAt,n.evento AS event", fields: [["Mensagem", "body"], ["Evento", "event"], ["Categoria", "category"], ["Lida em", "readAt", "date"]] },
      auditoria: { select: "a.ator_id AS userId,a.payload_json AS payload", fields: [["Estado anterior", "fromStatus"], ["Estado posterior", "toStatus"], ["Dados da operação", "payload", "json"]] },
    }[section];
    const def = defs[section]; const [[r]] = await db.query(`SELECT ${def.select},${extra.select} FROM ${def.from} WHERE ${def.id}=?`, [id]); if (!r) fail("Registro não encontrado.", 404);
    title = r.title || `${adminModule(section).singular} #${id}`; statusLabel = labels[r.status] || r.status;
    fields = [field("Criado em", iso(r.createdAt), "date")];
    if (r.userId) fields.push(field(section === "auditoria" ? "Responsável" : "Usuário", r.username || `#${r.userId}`, "text", itemLink("usuarios", r.userId)));
    if (r.requestId) fields.push(field("Pedido", `#${r.requestId}`, "text", itemLink("pedidos", r.requestId)));
    if (r.indicationId) fields.push(field("Indicação", `#${r.indicationId}`, "text", itemLink("indicacoes", r.indicationId)));
    if (r.evaluationId) fields.push(field("Avaliação", `#${r.evaluationId}`, "text", itemLink("avaliacoes", r.evaluationId)));
    if (r.companyId) fields.push(field("Empresa", r.companyName || `#${r.companyId}`, "text", itemLink("empresas", r.companyId)));
    if (r.rankingId) fields.push(field("Ranking", r.rankingTitle || `#${r.rankingId}`, "text", `/rankings/${r.rankingId}`));
    if (section === "auditoria") {
      const target = { user: "usuarios", company: "empresas", request: "pedidos", indication: "indicacoes" }[r.entityType];
      fields.push(field("Registro relacionado", `${r.entityType} #${r.entityId}`, "text", target ? itemLink(target, r.entityId) : null));
      try { r.payload = redact(typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload); } catch { r.payload = null; }
    }
    for (const [label, key, type = "text"] of extra.fields) fields.push(field(label, type === "date" ? iso(r[key]) : key === "reason" ? reasons[r[key]] || r[key] : r[key], type));
  }
  return { id, section, title, statusLabel: statusLabel || null, fields, relations, editable, location };
}

export async function updateAdminRecord(actor, section, id, body) {
  if (!["usuarios", "empresas"].includes(section)) fail("Este registro é consultado nesta área; use o fluxo de gestão correspondente para alterações.", 405);
  id = adminId(id);
  if (!body || typeof body !== "object" || Array.isArray(body)) fail("Dados inválidos.");
  const allowed = section === "usuarios" ? ["username", "email", "photoUrl", "cityId", "isAdmin", "revision", "reason"] : ["legalName", "logoUrl", "cityId", "revision", "reason"];
  if (Object.keys(body).some(key => !allowed.includes(key))) fail("O cadastro contém campos que não podem ser alterados nesta tela.");
  const reason = typeof body.reason === "string" ? body.reason.trim() : ""; if (reason.length < 5 || reason.length > 255) fail("Informe um motivo de 5 a 255 caracteres para a alteração.");
  try {
    return await withTransaction(async conn => {
      // Ordem estável serializa concessões/revogações e revalida o ator sob lock.
      const [admins] = await conn.query("SELECT id,eh_admin,tipo_conta,excluido_em FROM usuarios WHERE (eh_admin=1 AND tipo_conta='user' AND excluido_em IS NULL) OR id IN (?,?) ORDER BY id FOR UPDATE", [actor.id, section === "usuarios" ? id : actor.id]);
      const currentActor = admins.find(row => Number(row.id) === Number(actor.id));
      if (!currentActor || !currentActor.is_admin || currentActor.account_type !== "user" || currentActor.deleted_at) fail("Seu acesso administrativo mudou. Recarregue a sessão.", 403);
      const query = section === "usuarios" ? `${userSelect} WHERE u.id=? FOR UPDATE` : `${companySelect} WHERE e.id=? FOR UPDATE`;
      const [[row]] = await conn.query(query, [id]); if (!row) fail("Cadastro não encontrado.", 404);
      if (row.deletedAt || row.accountDeletedAt) fail("Cadastros de contas excluídas não podem ser editados.", 409);
      row.isAdmin = Boolean(row.isAdmin); row.updatedAt = iso(row.updatedAt);
      if (!body.revision || body.revision !== revision(row)) fail("Este cadastro foi alterado por outra pessoa. Recarregue os dados antes de salvar.", 409);
      const changes = {}, beforeRole = Boolean(row.isAdmin);
      for (const key of allowed.filter(key => !["revision", "reason"].includes(key))) {
        if (!Object.hasOwn(body, key)) continue;
        let next = body[key];
        if (key === "isAdmin") { if (typeof next !== "boolean") fail("Permissão administrativa inválida."); }
        else if (key === "cityId") next = next == null || next === "" ? null : adminId(next);
        else { if (next !== null && typeof next !== "string") fail("Valor inválido no cadastro."); next = String(next || "").trim(); if (["photoUrl", "logoUrl"].includes(key) && !next) next = null; }
        if ((row[key] ?? null) !== next) changes[key] = next;
      }
      const cityId = Object.hasOwn(changes, "cityId") ? changes.cityId : row.cityId;
      if (cityId != null) { const [[cityRow]] = await conn.query("SELECT id FROM cidades WHERE id=?", [cityId]); if (!cityRow) fail("Cidade inválida."); }
      if (section === "usuarios") {
        const errors = validateProfilePatch({ username: changes.username, photoUrl: changes.photoUrl, cityId }); if (errors.length) fail(errors[0]);
        if (changes.email !== undefined && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email) || changes.email.length > 255)) fail("Informe um e-mail válido com até 255 caracteres.");
        if (Object.hasOwn(changes, "isAdmin")) {
          if (Number(actor.id) === id && !changes.isAdmin) fail("Você não pode remover seu próprio acesso administrativo.", 409);
          if (row.accountType !== "user" && changes.isAdmin) fail("Contas empresariais não podem receber acesso administrativo.");
          if (!changes.isAdmin && admins.filter(a => a.is_admin && a.account_type === "user" && !a.deleted_at && Number(a.id) !== id).length === 0) fail("O sistema precisa manter ao menos um administrador ativo.", 409);
        }
      } else {
        const name = changes.legalName ?? row.legalName;
        if (!name || name.length < 2 || name.length > 255) fail("Informe uma razão social de 2 a 255 caracteres.");
        if (!cityId) fail("Selecione a cidade da empresa.");
        if (changes.logoUrl && (changes.logoUrl.length > 500 || (!safeUrl(changes.logoUrl) && !/^\/(?:api\/)?uploads\//.test(changes.logoUrl)))) fail("Informe uma URL válida para o logo, com até 500 caracteres.");
      }
      if (!Object.keys(changes).length) fail("Nenhuma alteração foi feita.");
      const columns = { username: "nome_usuario", email: "email", photoUrl: "foto_url", cityId: "cidade_id", isAdmin: "eh_admin", legalName: "razao_social", logoUrl: "logo_url" };
      await conn.query(`UPDATE ${section === "usuarios" ? "usuarios" : "empresas"} SET ${Object.keys(changes).map(key => `${columns[key]}=?`).join(",")} WHERE id=?`, [...Object.values(changes), id]);
      await writeAudit(conn, { entityType: section === "usuarios" ? "user" : "company", entityId: id, actorType: "user", actorId: actor.id, reason: `admin_${section === "usuarios" ? "user" : "company"}_update`, fromStatus: section === "usuarios" ? beforeRole ? "admin" : row.accountType : null, toStatus: section === "usuarios" ? (changes.isAdmin ?? beforeRole) ? "admin" : row.accountType : null, payload: { administrative: true, changedFields: Object.keys(changes), note: reason } });
      return { ok: true };
    });
  } catch (error) { if (["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(error.code)) fail("Outro administrador está alterando este cadastro. Recarregue e tente novamente.", 409); if (error.code === "ER_DUP_ENTRY") fail("Nome de usuário ou e-mail já utilizado por outro cadastro.", 409); throw error; }
}

export async function adminOverview() {
  const db = pool();
  const [[counts], [recent]] = await Promise.all([
    db.query(`SELECT
      (SELECT COUNT(*) FROM usuarios WHERE excluido_em IS NULL) AS users,
      (SELECT COUNT(*) FROM usuarios WHERE eh_admin=1 AND tipo_conta='user' AND excluido_em IS NULL) AS admins,
      (SELECT COUNT(*) FROM empresas) AS companies,
      (SELECT COUNT(*) FROM pedidos WHERE excluido_em IS NULL) AS requests,
      (SELECT COUNT(*) FROM pedidos WHERE status='open' AND excluido_em IS NULL) AS openRequests,
      (SELECT COUNT(*) FROM pedidos WHERE status='in_evaluation' AND excluido_em IS NULL) AS evaluatingRequests,
      (SELECT COUNT(*) FROM pedidos WHERE status='in_evaluation' AND avaliacao_prazo_em<UTC_TIMESTAMP() AND excluido_em IS NULL) AS overdueEvaluations,
      (SELECT COUNT(*) FROM indicacoes WHERE excluido_em IS NULL) AS indications,
      (SELECT COUNT(*) FROM indicacoes WHERE status='valid' AND excluido_em IS NULL) AS validIndications,
      (SELECT COUNT(*) FROM solicitacoes_patrocinio WHERE status IN ('submitted','under_review','awaiting_correction')) AS pendingSponsorships,
      (SELECT COUNT(*) FROM ranking_premios WHERE status='pending' AND expira_em>UTC_TIMESTAMP()) AS pendingRewards,
      (SELECT COUNT(*) FROM rankings WHERE status='open' AND periodo_inicio<=UTC_TIMESTAMP() AND periodo_fim>UTC_TIMESTAMP()) AS activeRankings,
      (SELECT COUNT(*) FROM cidades) AS cities`),
    db.query("SELECT a.id,a.tipo_entidade AS entityType,a.entidade_id AS entityId,a.motivo AS reason,DATE_FORMAT(a.criado_em,'%Y-%m-%dT%H:%i:%sZ') AS createdAt,COALESCE(u.nome_usuario,'Sistema') AS username FROM eventos_auditoria a LEFT JOIN usuarios u ON u.id=a.ator_id ORDER BY a.criado_em DESC,a.id DESC LIMIT 8"),
  ]);
  return { counts: Object.fromEntries(Object.entries(counts[0]).map(([key, value]) => [key, Number(value)])), recent: recent.map(row => ({ ...row, createdAt: iso(row.createdAt) })), integrations: { database: true, places: isPlacesConfigured(), googleMap: Boolean(process.env.GOOGLE_MAPS_BROWSER_API_KEY?.trim()), cronProtected: Boolean(process.env.CRON_SECRET?.trim()) }, checkedAt: new Date().toISOString() };
}
