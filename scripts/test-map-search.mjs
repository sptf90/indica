/** E2E com banco real e Google simulado em um servidor isolado (porta 3002).
 * Nenhuma chamada paga. Cria e remove somente seus próprios dados.
 */
import assert from 'node:assert/strict';
import { randomBytes, createHmac } from 'node:crypto';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { chromium } from '@playwright/test';
import { places } from './fixtures/google-places.mjs';
for (const file of ['.env.local', '.env']) if (existsSync(file)) process.loadEnvFile(file);
const port = Number(process.env.MAP_SEARCH_TEST_PORT || 3002), base = `http://localhost:${port}`;
const output = '/tmp/indica-map-search'; mkdirSync(output, { recursive: true });
const db = mysql.createPool({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE });
const users = [], requests = []; let browser, server; let serverOutput = '';
const session = uid => { const data = Buffer.from(JSON.stringify({ uid, exp: Date.now() + 3600000 })).toString('base64url'); return `${data}.${createHmac('sha256', process.env.AUTH_SECRET).update(data).digest('base64url')}`; };
async function api(path, uid, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(`${base}/api${path}`, { method, headers: { Cookie: `indica_session=${session(uid)}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json(); assert(response.ok, `${path}: ${JSON.stringify(data)}`); return data;
}
try {
  server = spawn(process.execPath, ['--import', fileURLToPath(new URL('./fixtures/google-places.mjs', import.meta.url)), 'node_modules/next/dist/bin/next', 'start', '-p', String(port)], { env: { ...process.env, GOOGLE_PLACES_API_KEY: 'indica-local-test-places', GOOGLE_MAPS_BROWSER_API_KEY: 'indica-local-test-browser' }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', chunk => { serverOutput += chunk; }); server.stderr.on('data', chunk => { serverOutput += chunk; });
  await new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error(`Servidor de teste não iniciou: ${serverOutput}`)), 15000);
    server.once('exit', code => { clearTimeout(deadline); reject(new Error(`Servidor encerrou (${code}): ${serverOutput}`)); });
    server.stdout.on('data', () => { if (serverOutput.includes('Ready')) { clearTimeout(deadline); resolve(); } });
  });
  const [[city]] = await db.query('SELECT id FROM cidades ORDER BY id LIMIT 1'); assert(city);
  for (let i = 0; i < 4; i++) {
    const name = `mapsearch_${randomBytes(5).toString('hex')}`;
    const [row] = await db.query('INSERT INTO usuarios (nome_usuario,email,senha_hash,cidade_id,codigo_compartilhamento,tutorial_concluido_em) VALUES (?,?,?,?,?,UTC_TIMESTAMP())', [name, `${name}@example.com`, 'fixture', city.id, name]); users.push(row.insertId);
  }
  const created = await api('/requests', users[0], { title: 'Mercado para teste do mapa', contactMode: 'maps', cityId: city.id });
  const rid = created.item.id; requests.push(rid);
  const config = await api('/places/map-config', users[1]); assert.equal(config.provider, 'google'); assert.equal(config.placesConfigured, true);
  assert(!JSON.stringify(config).includes('indica-local-test-places'));
  assert.equal((await api('/places/map-config?manual=1', users[1])).provider, 'openstreetmap');
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined), args: ['--no-sandbox'] });
  for (const [index, viewport] of [{ width: 390, height: 844 }, { width: 1440, height: 900 }].entries()) {
    const uid = users[index + 1], ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    await ctx.addCookies([{ name: 'indica_session', value: session(uid), url: base }]);
    const page = await ctx.newPage(); page.setDefaultTimeout(12000); const errors = [], urls = [];
    page.on('response', response => { if (response.status() === 500) console.log('HTTP500', new URL(response.url()).pathname); });
    page.on('pageerror', err => { errors.push(err.message); console.log('PAGEERROR', err.message); }); page.on('request', req => urls.push(req.url()));
    await page.route('https://maps.googleapis.com/maps/api/js?**', route => route.fulfill({ contentType: 'application/javascript', body: readFileSync('scripts/fixtures/google-maps-browser.js') }));
    await page.goto(`${base}/indicar/${rid}/nova`);
    await page.getByRole('button', { name: 'Selecionar no mapa', exact: true }).click();
    await page.waitForTimeout(100);
    const search = page.getByLabel('Buscar estabelecimento', { exact: true });
    await search.waitFor().catch(async err => { await page.screenshot({ path: `${output}/erro.png`, fullPage: true }); console.log(await page.locator('main').innerText()); console.log(serverOutput); throw err; });
    await search.fill('Nenhum');
    await page.getByRole('button', { name: 'Buscar', exact: true }).click(); await page.getByText(/^Nenhum estabelecimento encontrado/).waitFor();
    await search.fill('Falha'); await page.getByRole('button', { name: 'Buscar', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'Busca indisponível' }).waitFor();
    await search.fill('Lenta'); await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await search.fill('Muffato'); await search.press('Enter');
    const result = page.locator('.map-place-result').first(); await result.waitFor();
    await page.waitForTimeout(700); assert.equal(await page.locator('.map-place-result').count(), 2);
    assert.equal(await page.locator('test-map-marker').count(), 2);
    if (index === 0) await result.click(); else await page.locator('test-map-marker[title="1. Super Muffato Centro"]').click();
    await page.locator('.map-location-candidate').getByText('Super Muffato Centro', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), true);
    await page.locator('.map-location-canvas').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${output}/selecionado-${viewport.width}.png` });
    await page.getByRole('button', { name: 'Usar esta localização', exact: true }).click();
    assert.equal(await page.getByLabel('Nome do local', { exact: true }).inputValue(), places[0].displayName.text);
    assert.equal(await page.getByLabel('Endereço do local', { exact: true }).inputValue(), places[0].formattedAddress);
    await page.getByRole('button', { name: 'Ajustar localização no mapa', exact: true }).click();
    await page.getByLabel('Buscar estabelecimento', { exact: true }).fill('Muffato');
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await page.locator('.map-place-result').last().click();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    assert.equal(await page.getByLabel('Nome do local', { exact: true }).inputValue(), places[0].displayName.text);
    await page.locator('textarea').first().fill('Indico este mercado pelo atendimento e variedade.');
    await page.getByRole('button', { name: /^Pré-visualizar/ }).click();
    await page.getByRole('heading', { name: 'Prévia da indicação' }).waitFor();
    await page.getByText(places[0].formattedAddress, { exact: true }).waitFor();
    const navigation = await page.getByRole('link', { name: 'Abrir no Google Maps' }).getAttribute('href');
    assert(new URL(navigation).searchParams.get('destination') === '-23.5512345,-46.6354321');
    await page.getByRole('button', { name: /^Confirmar envio/ }).click();
    await page.getByText('Indicação enviada com sucesso').waitFor();
    const [[row]] = await db.query('SELECT i.id AS indication_id,l.* FROM indicacoes i JOIN indicacao_locais l ON l.indicacao_id=i.id WHERE i.pedido_id=? AND i.indicador_id=?', [rid, uid]);
    assert(row); assert.equal(row.place_id, places[0].id); assert.equal(row.origem, 'google_maps'); assert.equal(row.nome, places[0].displayName.text);
    assert.equal(Number(row.latitude), -23.5512345); assert.equal(Number(row.longitude), -46.6354321);
    const detail = await api(`/indications/${row.indication_id}`, uid); assert.equal(detail.item.place.placeId, places[0].id); assert.equal(detail.item.place.address, places[0].formattedAddress);
    await page.goto(`${base}/minhas-indicacoes/${row.indication_id}`); await page.getByText(places[0].displayName.text, { exact: false }).first().waitFor();
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await page.getByRole('button', { name: 'Ajustar localização no mapa', exact: true }).click();
    await page.getByRole('button', { name: 'Usar esta localização', exact: true }).click();
    await page.getByRole('button', { name: 'Salvar', exact: true }).click(); await page.waitForTimeout(200);
    assert.equal((await api(`/indications/${row.indication_id}`, uid)).item.place.placeId, places[0].id);
    assert.equal(urls.some(url => url.includes('indica-local-test-places')), false); assert.deepEqual(errors, []);
    await ctx.close(); console.log(`OK busca, lista/marcadores, preenchimento, prévia, persistência e edição ${viewport.width}px.`);
  }
  const fallback = await browser.newContext({ viewport: { width: 320, height: 568 } });
  await fallback.addCookies([{ name: 'indica_session', value: session(users[3]), url: base }]);
  const manualPage = await fallback.newPage(); manualPage.setDefaultTimeout(10000);
  await manualPage.route('https://maps.googleapis.com/maps/api/js?**', route => route.abort());
  await manualPage.route('https://tile.openstreetmap.org/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64') }));
  await manualPage.goto(`${base}/indicar/${rid}/nova`);
  await manualPage.getByRole('button', { name: 'Selecionar no mapa', exact: true }).click();
  await manualPage.getByRole('button', { name: 'Usar mapa manual', exact: true }).click();
  await manualPage.getByRole('button', { name: 'Usar ponto central', exact: true }).click();
  await manualPage.getByLabel('Nome do local', { exact: true }).fill('Mercado manual');
  await manualPage.getByLabel('Endereço do local', { exact: true }).fill('Rua escolhida manualmente, 10');
  await manualPage.getByRole('button', { name: 'Usar esta localização', exact: true }).click();
  assert.equal(await manualPage.getByLabel('Nome do local', { exact: true }).inputValue(), 'Mercado manual');
  assert.equal(await manualPage.getByLabel('Endereço do local', { exact: true }).inputValue(), 'Rua escolhida manualmente, 10');
  await manualPage.getByText('Localização marcada', { exact: true }).waitFor();
  assert.equal(await manualPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), true);
  await fallback.close(); console.log('OK falha no SDK: alternativa manual disponível em 320px.');
  // Tenta forjar os campos: os dados canônicos do Google prevalecem.
  const forged = await api('/indications', users[3], { requestId: rid, description: 'Teste canônico', place: { selectionSource: 'google_places', placeId: places[0].id, name: 'Forjado', address: 'Forjado', location: { lat: 0, lng: 0 } } });
  const detail = await api(`/indications/${forged.id}`, users[3]); assert.equal(detail.item.place.name, places[0].displayName.text); assert.equal(detail.item.place.location.lat, -23.5512345);
  const notifications = await api('/notifications?category=indications&unread=1', users[0]);
  assert(Array.isArray(notifications.items)); assert(Number.isFinite(notifications.unreadTotal));
  console.log('OK dados canônicos, notificações e chave do servidor protegida.');
} catch (err) {
  console.error(err); throw err;
} finally {
  await browser?.close(); server?.kill('SIGTERM');
  if (requests.length) {
    await db.query('DELETE FROM notificacoes WHERE pedido_id IN (?)', [requests]);
    await db.query('DELETE FROM indicacoes WHERE pedido_id IN (?)', [requests]);
    await db.query('DELETE FROM pedido_participacoes WHERE pedido_id IN (?)', [requests]);
    await db.query("DELETE FROM eventos_auditoria WHERE (tipo_entidade='request' AND entidade_id IN (?)) OR ator_id IN (?)", [requests, users]);
    await db.query('DELETE FROM pedidos WHERE id IN (?)', [requests]);
  }
  if (users.length) {
    await db.query('DELETE FROM solicitante_bloqueios WHERE indicador_id IN (?) OR solicitante_id IN (?)', [users, users]);
    await db.query('DELETE FROM usuarios WHERE id IN (?)', [users]);
  }
  await db.end();
}
