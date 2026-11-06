/** Integração local com fixtures próprias e limpeza. Aplicação em BASE_URL (3001).
 * Testa permissões, filtros/paginação, detalhes, edição, conflitos e acesso admin.
 */
import assert from 'node:assert/strict';
import { randomBytes, createHmac } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import mysql from 'mysql2/promise';
import { chromium } from '@playwright/test';
const { ADMIN_MODULES } = await import(`data:text/javascript;base64,${Buffer.from((await import('node:fs')).readFileSync('lib/admin-catalog.js')).toString('base64')}`);
for (const file of ['.env.local', '.env']) if (existsSync(file)) process.loadEnvFile(file);
const base = process.env.BASE_URL || 'http://localhost:3001', output = '/tmp/indica-admin-console'; mkdirSync(output, { recursive: true });
const db = mysql.createPool({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE });
const suffix = randomBytes(4).toString('hex'), prefix = `ac_${suffix}_`;
const users = []; let companyId, requestId, indicationId, evaluationId, rankingId, participationId, rewardId, reputationId, scoreId, notificationId, browser;
const cookie = (id, mode = 'admin') => {
  const data = Buffer.from(JSON.stringify({ uid: id, exp: Date.now() + 3600000 })).toString('base64url');
  return `indica_session=${data}.${createHmac('sha256', process.env.AUTH_SECRET).update(data).digest('base64url')}; indica_admin_view=${mode}`;
};
let checks = 0;
async function api(path, id, { method = 'GET', body, status = 200, mode = 'admin' } = {}) {
  const res = await fetch(`${base}/api/admin${path}`, { method, headers: { ...(id ? { Cookie: cookie(id, mode) } : {}), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json(); checks++; assert.equal(res.status, status, `${method} ${path}: ${JSON.stringify(data)}`); return data;
}
async function insert(sql, values) { const [row] = await db.query(sql, values); return row.insertId; }
try {
  const [[city]] = await db.query('SELECT id,nome,estado FROM cidades ORDER BY id LIMIT 1'); assert(city);
  for (let index = 0; index < 29; index++) {
    const name = `${prefix}${index}`;
    users.push(await insert('INSERT INTO usuarios(nome_usuario,email,senha_hash,cidade_id,eh_admin,tipo_conta,codigo_compartilhamento,tutorial_concluido_em,excluido_em) VALUES(?,?,?,?,?,?,?,UTC_TIMESTAMP(),?)', [name, `${name}@example.com`, 'fixture-never-expose', city.id, index < 2 ? 1 : 0, index === 4 ? 'company' : 'user', `${suffix}${index}`, index === 5 ? new Date() : null]));
  }
  const [admin, secondAdmin, owner, indicator, companyUser, deletedUser] = users;
  companyId = await insert('INSERT INTO empresas(usuario_id,cnpj,razao_social,cidade_id) VALUES(?,?,?,?)', [companyUser, `8${String(companyUser).padStart(13, '0')}`, `Empresa ${prefix}`, city.id]);
  requestId = await insert("INSERT INTO pedidos(solicitante_id,cidade_id,titulo,detalhes,status,canal_indicacao) VALUES(?,?,?,?, 'completed','both')", [owner, city.id, `${prefix} pedido ${'título extenso '.repeat(10)}`.slice(0, 200), 'Descrição completa do pedido.']);
  indicationId = await insert("INSERT INTO indicacoes(pedido_id,indicador_id,descricao,status,resultado,whatsapp_numero,selecionada_em,avaliada_em) VALUES(?,?,?,'valid','valid',?,UTC_TIMESTAMP(),UTC_TIMESTAMP())", [requestId, indicator, `${prefix} indicação ${'Detalhes do atendimento. '.repeat(18)}`.slice(0, 500), '5511999991234']);
  await db.query('UPDATE pedidos SET indicacao_selecionada_id=? WHERE id=?', [indicationId, requestId]);
  await db.query("INSERT INTO indicacao_locais(indicacao_id,origem,nome,endereco,latitude,longitude,tipo_localizacao) VALUES(?,'manual',?,?,?,?,'map_pin')", [indicationId, `Local ${prefix}`, 'Endereço extenso '.repeat(35), -23.5512345, -46.6354321]);
  await db.query('INSERT INTO indicacao_links(indicacao_id,url,ordem) VALUES(?,?,0)', [indicationId, 'javascript:alert(1)']);
  evaluationId = await insert("INSERT INTO avaliacoes(pedido_id,indicacao_id,avaliador_id,resultado) VALUES(?,?,?,'valid')", [requestId, indicationId, owner]);
  reputationId = await insert("INSERT INTO historico_reputacao(usuario_id,avaliacao_id,pedido_id,titulo_pedido_snapshot,resultado,reputacao_antes,delta,reputacao_depois) VALUES(?,?,?,?,'valid',90,5,95)", [indicator, evaluationId, requestId, `${prefix} pedido`]);
  rankingId = await insert("INSERT INTO rankings(cidade_id,modalidade,periodo_inicio,periodo_fim,status,titulo,patrocinador_empresa_id) VALUES(NULL,'weekly',UTC_TIMESTAMP()-INTERVAL 7 DAY,UTC_TIMESTAMP(),'final',?,?)", [`Ranking ${prefix}`, companyId]);
  participationId = await insert("INSERT INTO ranking_participacoes(ranking_id,usuario_id,inscrito_em,saldo,status,posicao_final) VALUES(?,?,UTC_TIMESTAMP(),10,'final',1)", [rankingId, indicator]);
  rewardId = await insert("INSERT INTO ranking_premios(ranking_id,empresa_id,usuario_id,participacao_id,posicao_final,texto_beneficio,status,expira_em) VALUES(?,?,?,?,1,?,'pending',UTC_TIMESTAMP()+INTERVAL 30 DAY)", [rankingId, companyId, indicator, participationId, `Benefício ${prefix}`]);
  scoreId = await insert("INSERT INTO ledger_pontuacao(usuario_id,ranking_id,participacao_id,tipo_evento,chave_regra,delta,saldo_depois,avaliacao_id,pedido_id,indicacao_id,chave_idempotencia) VALUES(?,?,?,'valid','fixture',10,10,?,?,?,?)", [indicator, rankingId, participationId, evaluationId, requestId, indicationId, prefix]);
  notificationId = await insert("INSERT INTO notificacoes(usuario_id,categoria,evento,titulo,corpo,deeplink,pedido_id,indicacao_id) VALUES(?,'indications','fixture',?,?,?, ?,?)", [indicator, `Notificação ${prefix}`, 'Mensagem de teste.', `/minhas-indicacoes/${indicationId}`, requestId, indicationId]);
  const ids = { usuarios: owner, empresas: companyId, cidades: city.id, pedidos: requestId, indicacoes: indicationId, avaliacoes: evaluationId, resgates: rewardId, pontuacao: scoreId, reputacao: reputationId, notificacoes: notificationId };
  await api('/overview', null, { status: 401 });
  const overview = await api('/overview', admin); assert(overview.counts.users >= 28); assert.equal(overview.integrations.database, true); assert(!JSON.stringify(overview).includes(process.env.AUTH_SECRET));
  for (const section of Object.keys(ADMIN_MODULES)) {
    await api(`/data/${section}`, owner, { status: 403 });
    await api(`/data/${section}`, admin, { status: 403, mode: 'user' });
    await api(`/data/${section}`, admin, { status: 403, mode: 'company' });
    const listing = await api(`/data/${section}`, admin); assert(Array.isArray(listing.items)); assert(Number.isInteger(listing.pagination.total));
    await api(`/data/${section}?status=forjado`, admin, { status: 400 });
    if (ids[section]) {
      const record = await api(`/data/${section}/${ids[section]}`, admin); assert.equal(Number(record.id), ids[section]); assert(Array.isArray(record.fields));
      assert(!JSON.stringify(record).includes('fixture-never-expose')); assert(!JSON.stringify(record).includes('senha_hash'));
      await api(`/data/${section}/${ids[section]}`, owner, { status: 403 });
    }
  }
  await api('/data/usuarios?companyId=1', admin, { status: 400 });
  await api('/data/constructor', admin, { status: 404 });
  await api('/data/constructor/1', admin, { status: 404 });
  await api('/data/inexistente', admin, { status: 404 }); await api('/data/usuarios/0', admin, { status: 400 });
  await api('/data/usuarios?from=2026-02-30', admin, { status: 400 }); await api('/data/usuarios?from=2026-11-06&to=2026-01-01', admin, { status: 400 });
  await db.query("UPDATE usuarios SET criado_em='2020-07-01 01:30:00' WHERE id=?", [users[6]]);
  assert.equal((await api(`/data/usuarios?q=${prefix}&from=2020-06-30&to=2020-06-30`, admin)).pagination.total, 1, "Filtro usa a mesma data local mostrada na interface.");
  const first = await api(`/data/usuarios?q=${prefix}`, admin); assert.equal(first.pagination.total, 29); assert.equal(first.items.length, 25);
  const second = await api(`/data/usuarios?q=${prefix}&page=2`, admin); assert.equal(second.items.length, 4); assert(!second.items.some(row => first.items.some(previous => previous.id === row.id)));
  assert.equal((await api(`/data/indicacoes?userId=${indicator}&requestId=${requestId}`, admin)).pagination.total, 1);
  const detail = await api(`/data/indicacoes/${indicationId}`, admin); assert(detail.fields.some(f => f.value === '5511999991234')); assert(!detail.fields.some(f => f.href?.startsWith('javascript:'))); assert(detail.location.googleMaps.includes('-23.5512345'));
  await api(`/data/pedidos/${requestId}`, admin, { method: 'PATCH', status: 405, body: { reason: 'Não alterar conteúdo.' } });
  const initial = await api(`/data/usuarios/${owner}`, admin);
  assert(Math.abs(new Date(initial.fields.find(f => f.label === "Cadastro").value).getTime() - Date.now()) < 120000, "DATETIME UTC deve ser apresentado sem deslocamento adicional.");
  const changed = await api(`/data/usuarios/${owner}`, admin, { method: 'PATCH', body: { username: `${prefix}editado`, email: `${prefix}editado@example.com`, isAdmin: true, revision: initial.editable.revision, reason: 'Conceder acesso à equipe de operação.' } });
  assert.equal(changed.editable.isAdmin, true); assert.equal(changed.editable.username, `${prefix}editado`);
  await api("/overview", owner);
  await api(`/data/usuarios/${owner}`, admin, { method: 'PATCH', status: 409, body: { email: 'stale@example.com', revision: initial.editable.revision, reason: 'Conflito de edição antigo.' } });
  const revoked = await api(`/data/usuarios/${owner}`, secondAdmin, { method: 'PATCH', body: { isAdmin: false, revision: changed.editable.revision, reason: 'Retirar acesso concedido no teste.' } }); assert.equal(revoked.editable.isAdmin, false);
  await api('/overview', owner, { status: 403 });
  const own = await api(`/data/usuarios/${admin}`, admin);
  await api(`/data/usuarios/${admin}`, admin, { method: 'PATCH', status: 409, body: { isAdmin: false, revision: own.editable.revision, reason: 'Tentativa de remover o próprio acesso.' } });
  const companyAccount = await api(`/data/usuarios/${companyUser}`, admin);
  await api(`/data/usuarios/${companyUser}`, admin, { method: 'PATCH', status: 400, body: { isAdmin: true, revision: companyAccount.editable.revision, reason: 'Empresa não deve receber acesso admin.' } });
  const deleted = await api(`/data/usuarios/${deletedUser}`, admin); assert.equal(deleted.editable, null);
  await api(`/data/usuarios/${deletedUser}`, admin, { method: 'PATCH', status: 409, body: { username: 'invalido', revision: 'invalid', reason: 'Conta excluída não deve ser alterada.' } });
  await api(`/data/usuarios/${owner}`, admin, { method: 'PATCH', status: 400, body: { isAdmin: 'true', revision: revoked.editable.revision, reason: 'Booleano inválido não altera acesso.' } });
  await api(`/data/usuarios/${owner}`, admin, { method: 'PATCH', status: 400, body: { username: 'nome_atualizado', revision: revoked.editable.revision, reason: '' } });
  await api(`/data/usuarios/${owner}`, admin, { method: 'PATCH', status: 400, body: { reputation: 100, revision: revoked.editable.revision, reason: 'Não alterar reputação manualmente.' } });
  await api(`/data/usuarios/${owner}`, admin, { method: 'PATCH', status: 409, body: { email: `${prefix}0@example.com`, revision: revoked.editable.revision, reason: 'Verificar e-mail em uso.' } });
  const co = await api(`/data/empresas/${companyId}`, admin);
  const cnpj = co.fields.find(field => field.label === 'CNPJ').value;
  assert.equal((await api(`/data/empresas?q=${encodeURIComponent(cnpj)}`, admin)).pagination.total, 1);
  const editedCo = await api(`/data/empresas/${companyId}`, admin, { method: 'PATCH', body: { legalName: `Empresa editada ${prefix}`, revision: co.editable.revision, reason: 'Corrigir razão social no cadastro.' } }); assert.equal(editedCo.editable.legalName, `Empresa editada ${prefix}`);
  const audit = await api(`/data/auditoria?entityType=user&entityId=${owner}`, admin); assert(audit.items.length >= 2); ids.auditoria = audit.items[0].id;
  const auditDetail = await api(`/data/auditoria/${ids.auditoria}`, admin); const payload = auditDetail.fields.find(f => f.type === 'json').value; assert(payload.changedFields.includes('isAdmin')); assert.equal(JSON.stringify(payload).includes('@example.com'), false);
  // Concessões/revogações concorrentes devem terminar com ao menos um admin ativo.
  const other = await api(`/data/usuarios/${secondAdmin}`, admin);
  const race = await Promise.all([[admin, secondAdmin, other.editable.revision], [secondAdmin, admin, own.editable.revision]].map(async ([actorId, targetId, version]) => {
    const response = await fetch(`${base}/api/admin/data/usuarios/${targetId}`, { method: 'PATCH', headers: { Cookie: cookie(actorId), 'Content-Type': 'application/json' }, body: JSON.stringify({ isAdmin: false, revision: version, reason: 'Concorrência entre administradores.' }) });
    assert([200, 403, 409].includes(response.status), await response.text()); return response.status;
  }));
  const [[survivors]] = await db.query("SELECT COUNT(*) AS total FROM usuarios WHERE id IN (?,?) AND eh_admin=1 AND tipo_conta='user'", [admin, secondAdmin]); assert(survivors.total >= 1); assert(race.includes(200));
  // Reativa as duas fixtures para verificar navegação e formulário, sem depender de quem venceu.
  await db.query('UPDATE usuarios SET eh_admin=1 WHERE id IN (?,?)', [admin, secondAdmin]);
  console.log(`OK ${checks} verificações de API, permissões, paginação, conflitos e auditoria.`);

  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined), args: ['--no-sandbox'] });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 568 }]) {
    const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' }); const token = cookie(admin).split(';')[0].split('=').slice(1).join('=');
    await ctx.addCookies([{ name: 'indica_session', value: token, url: base }]); const page = await ctx.newPage(); page.setDefaultTimeout(10000); const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.route('**/api/ibge/estados', route => route.fulfill({ json: { estados: [{ id: 35, sigla: 'SP', nome: 'São Paulo' }] } }));
    await page.route('**/api/ibge/municipios?**', route => route.fulfill({ json: { municipios: [{ id: 3550308, nome: 'São Paulo', uf: 'SP' }] } }));
    async function check(path) {
      await page.goto(`${base}${path}`); await page.waitForTimeout(180);
      await page.getByText('Carregando registros…', { exact: true }).waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), true, `Overflow em ${path} ${viewport.width}`);
      assert.equal(await page.getByRole('heading', { name: 'Não foi possível carregar', exact: true }).count(), 0, path);
    }
    await check('/admin'); await page.getByRole('heading', { name: 'Acompanhamento da operação' }).waitFor(); await page.screenshot({ path: `${output}/visao-geral-${viewport.width}.png`, fullPage: true });
    for (const section of Object.keys(ADMIN_MODULES)) {
      await check(`/admin/${section}?q=${prefix}`);
      if (section === "usuarios") await page.screenshot({ path: `${output}/usuarios-${viewport.width}.png`, fullPage: true });
      if (ids[section]) await check(`/admin/${section}/${ids[section]}`);
    }
    await check(`/admin/usuarios/${owner}`); await page.getByRole('button', { name: 'Editar cadastro', exact: true }).click();
    await page.getByLabel('Nome de usuário', { exact: true }).fill(`${prefix}interface${viewport.width}`);
    await page.getByLabel('Permitir administrar o sistema').check();
    assert.equal(await page.getByRole('button', { name: 'Salvar alterações', exact: true }).isDisabled(), true);
    await page.getByLabel('Confirmo esta alteração de permissão.').check();
    await page.getByLabel('Motivo da alteração').fill('Alteração realizada pelo formulário administrativo.');
    await page.screenshot({ path: `${output}/editor-${viewport.width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
    await page.getByText('Cadastro atualizado. A alteração foi registrada na auditoria.', { exact: true }).waitFor();
    assert.equal((await api(`/data/usuarios/${owner}`, admin)).editable.isAdmin, true);
    const promoted = await api(`/data/usuarios/${owner}`, admin);
    await api(`/data/usuarios/${owner}`, admin, { method: 'PATCH', body: { isAdmin: false, revision: promoted.editable.revision, reason: 'Restaurar fixture após teste da interface.' } });
    assert.deepEqual(errors, []); await ctx.close(); console.log(`OK telas, detalhes e edição em ${viewport.width}px.`);
  }
} finally {
  await browser?.close();
  if (requestId) {
    await db.query('DELETE FROM notificacoes WHERE pedido_id=?', [requestId]);
    await db.query('DELETE FROM ledger_pontuacao WHERE pedido_id=?', [requestId]);
    await db.query('DELETE FROM historico_reputacao WHERE pedido_id=?', [requestId]);
    await db.query('DELETE FROM avaliacoes WHERE pedido_id=?', [requestId]);
    await db.query('UPDATE pedidos SET indicacao_selecionada_id=NULL WHERE id=?', [requestId]);
    await db.query('DELETE FROM indicacoes WHERE pedido_id=?', [requestId]);
    await db.query('DELETE FROM pedidos WHERE id=?', [requestId]);
  }
  if (rankingId) { await db.query('DELETE FROM ranking_premios WHERE ranking_id=?', [rankingId]); await db.query('DELETE FROM ranking_participacoes WHERE ranking_id=?', [rankingId]); await db.query('DELETE FROM rankings WHERE id=?', [rankingId]); }
  if (companyId) await db.query('DELETE FROM empresas WHERE id=?', [companyId]);
  if (users.length) { await db.query('DELETE FROM eventos_auditoria WHERE ator_id IN (?)', [users]); await db.query('DELETE FROM usuarios WHERE id IN (?)', [users]); }
  await db.end();
}
