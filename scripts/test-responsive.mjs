/** Testes geométricos com APIs simuladas, sem mutações de dados reais.
 * BASE_URL=http://localhost:3001 npm run test:responsive
 * CHROME_PATH opcional; usa Chrome do sistema quando disponível.
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { scenarios, mockApi, seedBrowser } from './fixtures/responsive.mjs';
const root = new URL(process.env.BASE_URL || 'http://localhost:3001');
const output = process.env.RESPONSIVE_OUTPUT || '/tmp/indica-responsive';
mkdirSync(output, { recursive: true });
const executablePath = process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
const browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });
const viewports = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }];
const results = []; const errors = [];
async function measure(page, label, { overlay = false } = {}) {
  const data = await page.evaluate(({ overlay }) => {
    const vw = innerWidth, vh = innerHeight;
    const visible = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[aria-hidden="true"]') && !el.closest('.sidebar:not(.unused)') && !el.closest('.leaflet-pane'); };
    const clipped = el => { for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) { if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) return true; } return false; };
    const out = [];
    for (const el of document.querySelectorAll('main h1,main h2,main h3,main p,main a,main button,main input,main textarea,main select,main table,main section,main article,main fieldset,.topbar')) {
      if (!visible(el) || clipped(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > vw + 2 || r.left < -2) out.push({ tag: el.tagName, cls: el.className, text: el.textContent?.trim().slice(0, 65), left: Math.round(r.left), right: Math.round(r.right) });
    }
    const panels = [];
    if (overlay) for (const el of document.querySelectorAll('.ibge-pick-dropdown,.user-menu-panel,.notif-drawer,.product-tour-card,.sidebar')) {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      if (!r.width || !r.height || s.visibility === 'hidden' || r.right <= 0 || r.left >= vw || (el.matches('.user-menu-panel') && !el.closest('details[open]')) || (el.matches('.sidebar') && vw <= 860 && !el.closest('.menu-open'))) continue;
      if (r.left < -2 || r.right > vw + 2 || r.top < -2 || r.bottom > vh + 2) panels.push({ cls: el.className, left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), viewport: [vw, vh] });
    }
    return { viewport: [vw, vh], width: document.documentElement.scrollWidth, overflow: out.slice(0, 15), panels };
  }, { overlay });
  const result = { label, url: new URL(page.url()).pathname, ...data };
  results.push(result);
  if (data.width > data.viewport[0] + 2 || data.overflow.length || data.panels.length) {
    console.log('FAIL', JSON.stringify(result));
    await page.screenshot({ path: `${output}/${String(results.length).padStart(3, '0')}.png`, fullPage: false });
  }
}
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    await seedBrowser(context);
    const page = await context.newPage(); page.setDefaultTimeout(10000); let role = 'user';
    page.on('pageerror', err => { errors.push({ url: page.url(), message: err.message }); console.log('PAGEERROR', err.message); });
    await page.route(`${root.origin}/api/**`, route => mockApi(route, role));
    // Sem tráfego de mapas durante a varredura de layout; o teste dedicado verifica o mapa real.
    await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64') }));
    for (const scenario of scenarios) {
      role = scenario.role;
      await page.goto(new URL(scenario.path, root).href);
      await page.waitForTimeout(160);
      await page.locator('main').first().waitFor({ timeout: 10000 }).catch(() => {});
      await measure(page, `${role}:${scenario.path}`);
      if (['/perfil', '/empresa', '/pedir/123'].includes(scenario.path) && viewport.width <= 390) {
        await page.screenshot({ path: `${output}/${role}-${scenario.path.replaceAll('/', '-')}-${viewport.width}.png`, fullPage: true });
      }
      if (scenario.path === '/pedir/123') {
        const invalid = page.getByRole('radio', { name: 'Não válida', exact: true });
        if (await invalid.count()) { await invalid.click(); await measure(page, 'avaliacao-motivo-aberto'); }
      }
      if (/^\/admin\/rankings\/(mensal|semanal)$/.test(scenario.path)) {
        for (const phase of ['Pendentes', 'Agendados', 'Finalizados', 'Ativos']) {
          await page.getByRole('tab', { name: new RegExp(`^${phase}`) }).click();
          await page.waitForTimeout(100); await measure(page, `admin-${scenario.path}-${phase}`);
          const detail = page.getByRole('button', { name: 'Detalhe', exact: true });
          if (await detail.count()) { await detail.first().click(); await measure(page, 'admin-ranking-detalhe'); }
        }
      }
      if (scenario.path === '/perfil') {
        const expand = page.getByRole('button', { name: 'Quero excluir minha conta', exact: true });
        if (await expand.count()) { await expand.click(); await measure(page, `${role}:perfil-exclusao-aberta`); }
      }
      if (scenario.path === '/minhas-indicacoes/15') {
        await page.getByRole('button', { name: 'Editar', exact: true }).click();
        await measure(page, 'indicacao-edicao');
        await page.getByRole('button', { name: /Ajustar localização no mapa/ }).click();
        await page.getByRole('button', { name: 'Usar ponto central', exact: true }).waitFor();
        await page.waitForTimeout(200); await measure(page, 'mapa-edicao');
      }
      if (scenario.path === '/indicar/123/nova') {
        await page.getByRole('button', { name: 'Selecionar no mapa', exact: true }).click();
        const central = page.getByRole('button', { name: 'Usar ponto central', exact: true });
        await central.waitFor(); await page.waitForTimeout(200);
        await measure(page, 'mapa-cidade');
        await page.locator('.map-location-canvas').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${output}/mapa-${viewport.width}.png` });
        if (!await page.getByRole('button', { name: 'Usar esta localização', exact: true }).isDisabled()) errors.push({ message: 'Cidade não pode selecionar o estabelecimento automaticamente.' });
        await central.click();
        const selected = await page.locator('.map-location-result').textContent();
        const [lat, lng] = selected.replace('Ponto selecionado: ', '').split(', ').map(Number);
        if (Math.abs(lat + 23.55052) > 0.0002 || Math.abs(lng + 46.633308) > 0.0002) errors.push({ message: `Centro da cidade incorreto: ${selected}` });
      }
      if (scenario.role === 'company' && scenario.path === '/empresa') {
        await page.getByRole('button', { name: 'Editar perfil', exact: true }).click();
        await measure(page, 'empresa-perfil-aberto');
        await page.getByRole('button', { name: 'Nova solicitação', exact: true }).click();
        await measure(page, 'empresa-periodo');
        await page.locator('input[name="sponsorship-slot"]').first().check();
        await page.getByRole('button', { name: 'Continuar', exact: true }).click();
        await measure(page, 'empresa-banner');
        // A edição existente preenche os campos obrigatórios do banner sem upload.
        await page.locator('.emp-request-actions').getByRole('button', { name: 'Editar', exact: true }).first().click();
        await page.getByRole('button', { name: 'Continuar', exact: true }).click();
        await measure(page, 'empresa-premios');
      }
      if (scenario.path === '/admin/patrocinios') {
        await page.getByRole('button', { name: 'Detalhe', exact: true }).first().click();
        await measure(page, 'admin-patrocinio-expandido');
      }

    }
    // Menus abertos no shell e painel de notificações.
    role = 'user'; await page.goto(new URL('/pedir', root).href);
    if (viewport.width <= 860) {
      await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
      await page.waitForTimeout(350); await measure(page, 'menu-lateral', { overlay: true });
      await page.getByRole('button', { name: 'Fechar navegação', exact: true }).click();
      await page.waitForTimeout(350);
    }
    await page.getByLabel('Menu da conta').click();
    await measure(page, 'menu-conta', { overlay: true });
    await page.getByLabel('Menu da conta').click();
    await page.getByRole('button', { name: /^Notificações/ }).click();
    await page.waitForTimeout(350); await measure(page, 'notificacoes', { overlay: true });
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    // Seletores no fim da janela, com a lista completamente aberta.
    const swap = page.getByRole('button', { name: 'Trocar', exact: true });
    if (await swap.count()) await swap.first().click();
    const state = page.getByRole('combobox').first();
    await state.scrollIntoViewIfNeeded();
    await state.evaluate(el => window.scrollBy(0, el.getBoundingClientRect().top - innerHeight + 100));
    await state.click(); await page.waitForTimeout(80);
    await measure(page, 'seletor-estado-inferior', { overlay: true });
    await page.getByRole('option').first().click();
    const city = page.getByRole('combobox').last();
    await city.click();
    await page.waitForTimeout(100);
    await measure(page, 'seletor-cidade', { overlay: true });
    await page.keyboard.press('Escape');
    // Tutorial também precisa caber em telas baixas, com rolagem interna.
    await page.getByLabel('Menu da conta').click();
    await page.getByTestId('restart-tutorial-menu').click();
    await page.getByTestId('product-tour-card').waitFor({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(300); await measure(page, 'tutorial', { overlay: true });
    for (let step = 1; step <= 20; step++) {
      const next = page.getByTestId('product-tour-next');
      if (!await next.count()) break;
      await next.click(); await page.waitForTimeout(350);
      await measure(page, `tutorial-passo-${step}`, { overlay: true });
    }
    role = 'company'; await page.goto(new URL('/empresa', root).href);
    await page.getByLabel('Menu da conta').click(); await page.getByTestId('restart-tutorial-menu').click();
    await page.getByTestId('product-tour-card').waitFor();
    for (let step = 0; step < 12; step++) {
      await page.waitForTimeout(350); await measure(page, `tutorial-empresa-${step}`, { overlay: true });
      const next = page.getByTestId('product-tour-next');
      if (!await next.count()) break;
      await next.click();
    }
    await context.close();
    console.log(`OK varredura ${viewport.width}x${viewport.height}`);
  }
} finally {
  await browser.close();
  const failures = results.filter(r => r.width > r.viewport[0] + 2 || r.overflow.length || r.panels.length);
  writeFileSync(`${output}/report.json`, JSON.stringify({ scenarios: scenarios.length, checks: results.length, failures, errors, results }, null, 2));
  console.log(JSON.stringify({ scenarios: scenarios.length, checks: results.length, failures: failures.length, errors: errors.length, report: `${output}/report.json` }));
  if ((failures.length || errors.length) && process.env.AUDIT_ALLOW_FAILURES !== '1') process.exitCode = 1;
}
