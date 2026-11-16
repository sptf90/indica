/** Navegação, hierarquia e estados da gestão, sem alterar o banco. */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { mockApi, userFor } from './fixtures/responsive.mjs';

const base = process.env.BASE_URL || 'http://localhost:3001';
const output = '/tmp/indica-admin-dashboard';
mkdirSync(output, { recursive: true });
const counts = { users: 3, admins: 2, companies: 1, requests: 1, indications: 0, activeRankings: 11, pendingSponsorships: 0, evaluatingRequests: 0, pendingRewards: 0, overdueEvaluations: 0 };
const recent = [
  { id: 1, reason: 'admin_user_update', username: 'kaue', entityType: 'user', entityId: 3, createdAt: '2026-11-16T14:00:00Z' },
  { id: 2, reason: 'create', username: 'usuario', entityType: 'request', entityId: 1, createdAt: '2026-11-16T13:30:00Z' },
  { id: 3, reason: 'equivalent_valid', username: 'Sistema', entityType: 'indication', entityId: 2, createdAt: '2026-11-16T13:00:00Z' },
];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined), args: ['--no-sandbox'] });
try {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
    const { width } = viewport;
    const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await ctx.newPage(); page.setDefaultTimeout(10000);
    let scenario = 'empty', mode = 'admin', previewFailure = false;
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      requests.push(path);
      if (path === '/api/auth/me') return route.fulfill({ json: { user: { ...userFor(mode === 'admin' ? 'admin' : mode), username: 'kaue', isRealAdmin: true, viewAs: mode } } });
      if (path === '/api/admin/overview') {
        if (scenario === 'error') return route.fulfill({ status: 503, json: { error: 'Falha temporária na consulta.' } });
        if (scenario === 'forbidden') return route.fulfill({ status: 403, json: { error: 'Acesso apenas para gestão.' } });
        if (scenario === 'loading') await new Promise(resolve => setTimeout(resolve, 750));
        return route.fulfill({ json: { counts: { ...counts, ...(scenario === 'pending' ? { overdueEvaluations: 2, pendingSponsorships: 3, evaluatingRequests: 5, pendingRewards: 1 } : {}) }, recent, checkedAt: '2026-11-16T14:00:00Z' } });
      }
      if (path === '/api/admin/system') return route.fulfill({ json: { integrations: { database: true, places: false, googleMap: false, cronProtected: true }, checkedAt: '2026-11-16T14:00:00Z' } });
      if (path === '/api/admin/view-as') {
        if (previewFailure) return route.fulfill({ status: 503, json: { error: 'Não foi possível abrir a prévia.' } });
        mode = route.request().postDataJSON().mode;
        return route.fulfill({ json: { redirectTo: mode === 'admin' ? '/admin' : mode === 'company' ? '/empresa' : '/' } });
      }
      return mockApi(route, mode === 'admin' ? 'admin' : mode);
    });
    const fit = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), true, `Overflow em ${width}px`);
    await page.goto(`${base}/admin`);
    await page.getByText('Nenhuma pendência no momento', { exact: true }).waitFor();
    assert.equal(await page.locator('.admin-summary-stats > div').count(), 4);
    assert.equal(await page.getByRole('heading', { name: 'Integrações e configuração' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Ver como usuário' }).count(), 0);
    assert.equal(requests.includes('/api/admin/system'), false);
    await fit();
    await page.screenshot({ path: `${output}/dashboard-${width}.png`, fullPage: true });
    if (width <= 860) {
      await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
      await page.waitForFunction(() => Math.abs(document.querySelector('.sidebar').getBoundingClientRect().left) < 1);
      assert.equal(await page.locator('.sidebar').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight + 1), true);
    }
    const nav = page.locator('.sidebar-nav');
    const admin = nav.getByRole('group', { name: 'Admin', exact: true });
    assert.equal(await admin.locator('details').count(), 4);
    assert.equal(await admin.locator('details[open]').count(), 0);
    for (const label of ['Usuário', 'Empresa']) await nav.getByRole('group', { name: label, exact: true }).waitFor();
    const hrefs = await admin.locator('a').evaluateAll(links => links.map(link => link.getAttribute('href')));
    assert.equal(new Set(hrefs).size, hrefs.length, 'Destinos duplicados no menu administrativo');
    for (const path of ['/admin/usuarios', '/admin/empresas', '/admin/cidades', '/admin/pedidos', '/admin/indicacoes', '/admin/avaliacoes', '/admin/patrocinios', '/admin/rankings/mensal', '/admin/rankings/semanal', '/admin/resgates', '/admin/pontuacao', '/admin/reputacao', '/admin/notificacoes', '/admin/auditoria', '/admin/sistema']) assert(hrefs.includes(path), path);
    const accounts = admin.locator('summary').filter({ hasText: /^Contas$/ });
    await accounts.focus(); await page.keyboard.press('Enter');
    await admin.getByRole('link', { name: 'Usuários', exact: true }).waitFor();
    await page.screenshot({ path: `${output}/menu-${width}.png` });
    await admin.getByRole('link', { name: 'Usuários', exact: true }).click();
    await page.waitForURL('**/admin/usuarios');
    assert.equal(await admin.locator('details[open] summary').innerText(), 'Contas');
    assert.equal(await admin.locator('[aria-current="page"]').getAttribute('href'), '/admin/usuarios');
    await fit();
    await page.goto(`${base}/admin/sistema`);
    await page.getByRole('heading', { name: 'Integrações e configuração', exact: true }).waitFor();
    await page.getByText('Conexão ativa', { exact: true }).waitFor();
    await fit();
    await page.screenshot({ path: `${output}/sistema-${width}.png`, fullPage: true });
    previewFailure = true;
    await page.getByRole('button', { name: 'Ver como usuário', exact: true }).click();
    await page.getByRole('alert').getByText('Não foi possível abrir a prévia.').waitFor();
    previewFailure = false;
    await page.getByRole('button', { name: 'Ver como usuário', exact: true }).click();
    await page.getByRole('button', { name: 'Voltar à gestão admin', exact: true }).first().waitFor();
    assert.equal(await nav.getByRole('group', { name: 'Admin', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Voltar à gestão admin', exact: true }).first().click();
    await page.waitForURL('**/admin');
    scenario = 'pending';
    await page.getByRole('button', { name: 'Atualizar dados', exact: true }).click();
    await page.locator('.admin-task-list li').first().waitFor();
    assert.equal(await page.locator('.admin-task-list li').count(), 4);
    assert.match(await page.locator('.admin-task-list a').first().getAttribute('href'), /overdue=1/);
    await fit(); await page.screenshot({ path: `${output}/pendencias-${width}.png`, fullPage: true });
    scenario = 'error'; await page.getByRole('button', { name: 'Atualizar dados', exact: true }).click();
    await page.getByRole('heading', { name: 'Não foi possível carregar', exact: true }).waitFor();
    scenario = 'empty'; await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
    await page.getByText('Nenhuma pendência no momento', { exact: true }).waitFor();
    scenario = 'forbidden'; await page.getByRole('button', { name: 'Atualizar dados', exact: true }).click();
    await page.getByRole('heading', { name: 'Acesso restrito', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Tentar novamente', exact: true }).count(), 0);
    scenario = 'loading'; await page.goto(`${base}/admin`);
    await page.getByText('Carregando registros…', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Atualizando…', exact: true }).isDisabled(), true);
    await page.getByText('Nenhuma pendência no momento', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    await ctx.close();
    console.log(`OK ${width}px: hierarquia, menu sem duplicações, teclado, seleção ativa, sistema, prévias, estados e responsividade.`);
  }
} finally { await browser.close(); }
