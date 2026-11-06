/** Integração local: cria usuários temporários e limpa seus próprios registros.
 * BASE_URL=http://localhost:3001 node scripts/test-admin-navigation.mjs
 */
import assert from 'node:assert/strict';
import { randomBytes, createHmac } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import mysql from 'mysql2/promise';
import { chromium } from '@playwright/test';
for (const file of ['.env.local', '.env']) if (existsSync(file)) process.loadEnvFile(file);
const base = process.env.BASE_URL || 'http://localhost:3001';
const output = process.env.ADMIN_NAV_OUTPUT || '/tmp/indica-admin-navigation';
mkdirSync(output, { recursive: true });
const db = await mysql.createConnection({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE });
const users = []; let browser;
const session = id => {
  const data = Buffer.from(JSON.stringify({ uid: id, exp: Date.now() + 3600000 })).toString('base64url');
  return `${data}.${createHmac('sha256', process.env.AUTH_SECRET).update(data).digest('base64url')}`;
};
async function api(id, mode, path, expected = 200, body) {
  const response = await fetch(`${base}/api${path}`, { method: body ? 'POST' : 'GET', headers: { Cookie: `indica_session=${session(id)}; indica_admin_view=${mode}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json(); assert.equal(response.status, expected, `${path}: ${JSON.stringify(data)}`); return data;
}
try {
  const [[city]] = await db.query('SELECT id FROM cidades LIMIT 1'); assert(city);
  for (const isAdmin of [1, 0]) {
    const name = `nav_${randomBytes(6).toString('hex')}`;
    const [row] = await db.query('INSERT INTO usuarios (nome_usuario, email, senha_hash, cidade_id, codigo_compartilhamento, eh_admin, tutorial_concluido_em) VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())', [name, `${name}@example.com`, 'fixture', city.id, name, isAdmin]);
    users.push(row.insertId);
  }
  const [admin, ordinary] = users;
  // Chamadas simultâneas devem criar/reutilizar uma única empresa própria do admin.
  await Promise.all(['/empresa', '/empresa/slots', '/empresa/sponsorships', '/empresa/rewards'].map(path => api(admin, 'admin', path)));
  const context = await api(admin, 'admin', '/empresa');
  assert(context.company); assert.equal(context.user.isAdmin, true); assert.equal(context.user.isCompany, false);
  const [[count]] = await db.query('SELECT COUNT(*) AS total FROM empresas WHERE usuario_id = ?', [admin]); assert.equal(count.total, 1);
  for (const mode of ['admin', 'company']) {
    const me = await api(admin, mode, '/auth/me'); assert.equal(me.user.isAdmin, mode === 'admin'); assert.equal(me.user.isCompany, mode === 'company');
    await api(admin, mode, '/empresa/rewards');
  }
  for (const id of [ordinary, admin]) {
    const mode = id === admin ? 'user' : 'admin';
    for (const path of ['/empresa/slots', '/empresa/sponsorships', '/empresa/rewards']) await api(id, mode, path, 403);
    assert.equal((await api(id, mode, '/empresa')).company, null);
  }
  await api(admin, 'company', '/requests', 403);
  await api(ordinary, 'admin', '/admin/view-as', 403, { mode: 'company' });
  console.log('OK permissões: admin completo, contexto empresarial próprio e isolamento das prévias.');

  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined), args: ['--no-sandbox'] });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 568 }]) {
    const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    await ctx.addCookies([{ name: 'indica_session', value: session(admin), url: base }]);
    const page = await ctx.newPage(); page.setDefaultTimeout(10000); const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto(`${base}/admin`);
    const nav = page.locator('.sidebar-nav');
    for (const label of ['Admin', 'Usuário', 'Empresa']) await nav.getByRole('group', { name: label, exact: true }).waitFor({ state: 'attached' });
    const hrefs = [...new Set(await nav.locator('a').evaluateAll(links => links.map(a => a.getAttribute('href'))))];
    for (const path of ['/', '/pedir', '/indicar', '/pedir/meus', '/minhas-indicacoes', '/pontuacao', '/rankings', '/perfil', '/perfil/reputacao', '/beneficios', '/missoes', '/empresa', '/empresa/resgates', '/admin', '/admin/patrocinios', '/admin/rankings/mensal', '/admin/rankings/semanal']) assert(hrefs.includes(path), `Link ausente: ${path}`);
    // Verifica os destinos no desktop; no mobile cobre home/empresa e a lista rolável.
    for (const path of viewport.width > 860 ? hrefs : ['/', '/empresa', '/empresa/resgates']) {
      await page.goto(`${base}${path}`); await page.waitForTimeout(250);
      assert.notEqual(new URL(page.url()).pathname, '/login');
      if (path === '/') assert.equal(new URL(page.url()).pathname, '/');
      if (path.startsWith('/empresa')) assert.equal(await page.getByText('Acesso restrito', { exact: true }).count(), 0);
      await nav.getByRole('group', { name: 'Empresa', exact: true }).waitFor({ state: 'attached' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), true, `Overflow em ${path}`);
    }
    await page.goto(`${base}/admin`);
    if (viewport.width <= 860) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
    await nav.getByRole('group', { name: 'Empresa', exact: true }).getByRole('link', { name: 'Resgates', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/admin-${viewport.width}.png` });
    if (viewport.width <= 860) await page.getByRole('button', { name: 'Fechar navegação', exact: true }).click();
    // Usa os botões originais para entrar nas duas prévias e retornar à gestão.
    for (const mode of ['usuário', 'empresa']) {
      await page.getByRole('button', { name: new RegExp(`^Ver como ${mode}`) }).click();
      await page.getByRole('button', { name: 'Voltar à gestão admin', exact: true }).first().waitFor();
      await page.waitForTimeout(250);
      assert.equal(await nav.locator('.sidebar-section-title').count(), 0);
      const paths = await nav.locator('a').evaluateAll(links => links.map(a => a.getAttribute('href')));
      assert.equal(paths.some(path => path.startsWith('/admin')), false);
      assert.equal(paths.includes('/empresa'), mode === 'empresa');
      assert.equal(paths.includes('/pedir'), mode === 'usuário');
      await page.getByRole('button', { name: 'Voltar à gestão admin', exact: true }).first().click();
      await page.waitForURL('**/admin'); await nav.getByRole('group', { name: 'Admin', exact: true }).waitFor({ state: 'attached' });
    }
    assert.deepEqual(errors, []); await ctx.close();
    console.log(`OK navegação e prévias ${viewport.width}×${viewport.height}.`);
  }
} finally {
  await browser?.close();
  if (users.length) {
    await db.query('DELETE FROM empresas WHERE usuario_id IN (?)', [users]);
    await db.query('DELETE FROM usuarios WHERE id IN (?)', [users]);
  }
  await db.end();
}
