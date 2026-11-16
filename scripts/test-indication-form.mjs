/** Formulário real com APIs e SDK de mapa simulados; não grava dados. */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
const base = process.env.BASE_URL || 'http://127.0.0.1:3001';
const output = '/tmp/indica-equivalence-ui';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined), args: ['--no-sandbox'] });
const labels = { maps: 'Localização no mapa', whatsapp: 'WhatsApp', both: 'Localização e WhatsApp' };
try {
  for (const width of [320, 1440]) for (const mode of ['maps', 'whatsapp', 'both']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    const errors = []; let submitted;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let data = { items: [], unreadTotal: 0 };
      if (path === '/api/auth/me') data = { user: { id: 1, username: 'indicador_teste', accountType: 'user', cityName: 'São Paulo', cityState: 'SP', tutorialCompleted: true, reputation: 0, validIndicationCount: 0 } };
      if (path.includes('/indications/eligible/')) data = { item: { id: 123, title: 'Dentista infantil', contactMode: mode, acceptsIndications: true, status: 'open', statusLabel: 'Aberto', cityName: 'São Paulo', cityState: 'SP' } };
      if (path === '/api/places/map-config') data = { provider: 'google', browserKey: 'fixture', center: { lat: -23.55, lng: -46.63 }, placesConfigured: false };
      if (path === '/api/indications' && route.request().method() === 'POST') { submitted = route.request().postDataJSON(); data = { id: 1000 }; }
      await route.fulfill({ status: path === '/api/indications' && submitted ? 201 : 200, json: data });
    });
    await page.route('https://maps.googleapis.com/maps/api/js?**', route => route.fulfill({ contentType: 'application/javascript', body: readFileSync('scripts/fixtures/google-maps-browser.js') }));
    await page.goto(`${base}/indicar/123/nova`);
    await page.getByRole('button', { name: 'Pré-visualizar' }).waitFor();
    await page.getByText(`O solicitante deseja receber: ${labels[mode]}.`).waitFor();
    assert.equal(await page.getByRole('combobox').count(), 0);
    assert.equal(await page.getByRole('group', { name: 'Links', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: /Adicionar link/ }).count(), 0);
    assert.equal(await page.locator('input[name="whatsappNumber"]').count(), mode === 'maps' ? 0 : 1);
    assert.equal(await page.getByLabel('Nome do local', { exact: true }).count(), mode === 'whatsapp' ? 0 : 1);
    await page.getByRole('textbox', { name: /Descrição/ }).fill('Atendimento recomendado para crianças.');
    if (mode === 'whatsapp') {
      await page.getByLabel('Nome do profissional, empresa ou contato').fill('Clínica Sorriso');
      await page.getByLabel('WhatsApp de quem você indica').fill('123');
      await page.getByRole('button', { name: 'Pré-visualizar' }).click();
      await page.getByRole('alert').getByText(/WhatsApp válido/).waitFor();
    }
    if (mode !== 'maps') {
      await page.getByLabel('WhatsApp de quem você indica').fill('17999998888');
      assert.equal(await page.getByLabel('WhatsApp de quem você indica').inputValue(), '(17) 99999-8888');
    }
    if (mode !== 'whatsapp') {
      await page.getByRole('button', { name: 'Pré-visualizar' }).click();
      await page.getByRole('alert').getByText(/pelo menos um item/).waitFor();
      if (mode === 'maps') {
        for (const [field, text] of [['Nome do local', 'Clínica Sorriso'], ['Endereço do local', 'Rua A, 10']]) {
          await page.getByLabel('Nome do local', { exact: true }).fill('');
          await page.getByLabel('Endereço do local', { exact: true }).fill('');
          await page.getByLabel(field, { exact: true }).fill(text);
          await page.getByRole('button', { name: 'Pré-visualizar' }).click();
          await page.getByRole('heading', { name: 'Prévia da indicação' }).waitFor();
          await page.getByText(text, { exact: true }).waitFor();
          await page.getByRole('button', { name: 'Voltar para editar', exact: true }).click();
        }
        await page.getByLabel('Nome do local', { exact: true }).fill('');
        await page.getByLabel('Endereço do local', { exact: true }).fill('');
      }
      await page.getByRole('button', { name: 'Selecionar no mapa', exact: true }).click();
      await page.getByRole('button', { name: 'Usar ponto central', exact: true }).click();
      await page.getByRole('button', { name: 'Usar esta localização', exact: true }).click();
      await page.getByRole('button', { name: 'Pré-visualizar' }).click();
      await page.getByRole('heading', { name: 'Prévia da indicação' }).waitFor();
      await page.getByRole('link', { name: 'Abrir no Google Maps', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Voltar para editar', exact: true }).click();
      await page.getByLabel('Nome do local', { exact: true }).fill('Clínica Sorriso');
      await page.getByLabel('Endereço do local', { exact: true }).fill('Rua A, 10');
    }
    await page.screenshot({ path: `${output}/${mode}-form-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Pré-visualizar' }).click();
    await page.getByRole('heading', { name: 'Prévia da indicação' }).waitFor();
    assert.equal(await page.getByRole('link', { name: /WhatsApp:/ }).count(), mode === 'maps' ? 0 : 1);
    assert.equal(await page.getByText('Rua A, 10', { exact: true }).count(), mode === 'whatsapp' ? 0 : 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), true);
    await page.screenshot({ path: `${output}/${mode}-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Confirmar envio', exact: true }).click();
    await page.getByText('Indicação enviada com sucesso', { exact: true }).waitFor();
    assert.equal(submitted.requestId, 123);
    assert.equal(Object.hasOwn(submitted, 'links'), false);
    if (mode === 'whatsapp') assert.equal(submitted.contactName, 'Clínica Sorriso');
    if (mode !== 'whatsapp') assert.deepEqual(submitted.place.location, { lat: -23.55, lng: -46.63 });
    assert.deepEqual(errors, []);
    if (mode === 'whatsapp') {
      await page.goto(`${base}/pedir`);
      const picker = page.getByRole('group', { name: 'O que você quer receber?', exact: true });
      await picker.waitFor();
      assert.equal(await picker.getByRole('radio').count(), 2);
      await picker.getByRole('radio', { name: 'Localização no mapa', exact: true }).check();
      await picker.getByRole('radio', { name: 'WhatsApp', exact: true }).check();
      assert.equal(await picker.getByRole('radio', { name: 'Localização e WhatsApp', exact: true }).count(), 0);
      await page.screenshot({ path: `${output}/pedir-${width}.png`, fullPage: true });
      await page.evaluate(() => sessionStorage.setItem('indica_request_draft', JSON.stringify({ title: 'Rascunho antigo', contactMode: 'both' })));
      await page.goto(`${base}/pedir/preview`);
      await page.waitForURL('**/pedir');
      await picker.waitFor();
      assert.equal(await picker.locator('input:checked').count(), 0);
    }
    await context.close();
    console.log(`OK ${mode} em ${width}px: modalidade, campos, validação, máscara, mapa, prévia e envio.`);
  }
} finally { await browser.close(); }
