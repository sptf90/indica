/** Formulário real com APIs e SDK de mapa simulados; não grava dados. */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
const base = process.env.BASE_URL || 'http://127.0.0.1:3001';
const output = '/tmp/indica-equivalence-ui';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined), args: ['--no-sandbox'] });
const labels = { maps: 'Localização no mapa', whatsapp: 'WhatsApp', both: 'Localização e WhatsApp' };
const place = { placeId: 'clinica_sorriso', name: 'Clínica Sorriso', address: 'Rua A, 10', source: 'google_maps', selectionSource: 'google_places', location: { lat: -23.55, lng: -46.63 } };
try {
  for (const width of [320, 1440]) for (const mode of ['maps', 'whatsapp', 'both']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    const errors = [], searches = []; let submitted, edited;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url()), path = url.pathname;
      let data = { items: [], unreadTotal: 0 };
      let status = 200;
      if (path === '/api/auth/me') data = { user: { id: 1, username: 'indicador_teste', accountType: 'user', cityName: 'São Paulo', cityState: 'SP', tutorialCompleted: true, reputation: 0, validIndicationCount: 0 } };
      if (path.includes('/indications/eligible/')) data = { item: { id: 123, title: 'Dentista infantil', contactMode: mode, acceptsIndications: true, status: 'open', statusLabel: 'Aberto', cityName: 'São Paulo', cityState: 'SP' } };
      if (path === '/api/places/map-config') data = { provider: 'google', browserKey: 'fixture', center: { lat: -23.55, lng: -46.63 }, placesConfigured: true };
      if (path === '/api/places/search') {
        const query = url.searchParams.get('q'); searches.push(query);
        data = { items: [place] };
        if (query === 'Nenhum') data = { items: [] };
        if (query === 'Falha') { status = 503; data = { error: 'Busca indisponível para teste.' }; }
        if (query === 'Lenta') {
          await new Promise(resolve => setTimeout(resolve, 1000));
          data = { items: [{ ...place, placeId: 'old', name: 'Resultado antigo' }] };
        }
      }
      if (path === '/api/indications' && route.request().method() === 'POST') { submitted = route.request().postDataJSON(); data = { id: 1000 }; }
      if (path === '/api/indications/1000') {
        if (route.request().method() === 'PATCH') edited = route.request().postDataJSON();
        data = { item: { ...submitted, ...edited, id: 1000, contactMode: mode, canEdit: true, requestTitle: 'Dentista infantil', requestStatus: 'open', cityName: 'São Paulo', cityState: 'SP' } };
      }
      await route.fulfill({ status: path === '/api/indications' && submitted ? 201 : status, json: data });
    });
    await page.route('https://maps.googleapis.com/maps/api/js?**', route => route.fulfill({ contentType: 'application/javascript', body: readFileSync('scripts/fixtures/google-maps-browser.js') }));
    await page.goto(`${base}/indicar/123/nova`);
    await page.getByRole('button', { name: 'Pré-visualizar' }).waitFor();
    await page.getByText(`O solicitante deseja receber: ${labels[mode]}.`).waitFor();
    assert.equal(await page.getByRole('combobox').count(), 0);
    assert.equal(await page.getByRole('group', { name: 'Links', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: /Adicionar link/ }).count(), 0);
    assert.equal(await page.locator('input[name="whatsappNumber"]').count(), mode === 'maps' ? 0 : 1);
    assert.equal(await page.getByLabel('Nome do local', { exact: true }).count(), 0);
    assert.equal(await page.getByLabel('Endereço do local', { exact: true }).count(), 0);
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
      await page.getByRole('alert').getByText('Selecione um local no mapa.', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Selecionar no mapa', exact: true }).click();
      await page.getByRole('button', { name: 'Usar ponto central', exact: true }).click();
      await page.getByRole('button', { name: 'Usar esta localização', exact: true }).click();
      await page.getByRole('button', { name: 'Pré-visualizar' }).click();
      await page.getByRole('heading', { name: 'Prévia da indicação' }).waitFor();
      await page.getByRole('link', { name: 'Abrir no Google Maps', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Voltar para editar', exact: true }).click();
      await page.getByRole('button', { name: 'Ajustar localização no mapa', exact: true }).click();
      const search = page.getByLabel('Buscar estabelecimento', { exact: true });
      await search.waitFor({ state: 'visible' });
      assert.equal(await page.getByRole('button', { name: 'Buscar', exact: true }).count(), 0);
      await search.fill('A');
      await page.waitForTimeout(550);
      assert.equal(searches.length, 0);
      await search.dispatchEvent('compositionstart');
      await search.fill('Composição');
      await page.waitForTimeout(550);
      assert.equal(searches.length, 0);
      await search.dispatchEvent('compositionend');
      await page.locator('.map-place-result').first().waitFor();
      await search.fill('');
      assert.equal(await page.locator('.map-place-result').count(), 0);
      await search.fill('Nenhum');
      await page.getByText(/^Nenhum estabelecimento encontrado/).waitFor();
      await search.fill('Falha');
      await page.getByRole('alert').filter({ hasText: 'Busca indisponível' }).waitFor();
      const slowRequest = page.waitForRequest(request => new URL(request.url()).searchParams.get('q') === 'Lenta');
      await search.fill('Lenta');
      await slowRequest;
      await search.fill('Clínica');
      const result = page.locator('.map-place-result').first();
      await result.waitFor();
      await page.waitForTimeout(1100);
      assert.equal(await page.getByText('Resultado antigo', { exact: true }).count(), 0);
      assert.equal(await page.locator('.map-place-result').count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), true);
      await search.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${output}/map-search-${mode}-${width}.png`, fullPage: true });
      await result.focus();
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Usar esta localização', exact: true }).click();
      await page.locator('.map-location-result').getByText(place.name, { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Ajustar localização no mapa', exact: true }).click();
      await page.getByRole('button', { name: 'Usar ponto central', exact: true }).click();
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await page.locator('.map-location-result').getByText(place.name, { exact: true }).waitFor();
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
    if (mode === 'maps') {
      await page.goto(`${base}/minhas-indicacoes/1000`);
      await page.getByRole('button', { name: 'Editar', exact: true }).click();
      assert.equal(await page.getByLabel('Nome do local', { exact: true }).count(), 0);
      assert.equal(await page.getByLabel('Endereço do local', { exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Ajustar localização no mapa', exact: true }).click();
      await page.getByLabel('Buscar estabelecimento', { exact: true }).fill('Clínica');
      await page.locator('.map-place-result').first().click();
      await page.getByRole('button', { name: 'Usar esta localização', exact: true }).click();
      await page.getByRole('button', { name: 'Salvar', exact: true }).click();
      await page.getByRole('button', { name: 'Editar', exact: true }).waitFor();
      assert.equal(edited.place.placeId, place.placeId);
      assert.deepEqual(edited.place.location, place.location);
    }
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
