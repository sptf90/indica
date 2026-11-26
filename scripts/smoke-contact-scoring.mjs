/** Teste de integração local. Cria e remove somente seus próprios registros.
 * Uso: BASE_URL=http://127.0.0.1:3001 node scripts/smoke-contact-scoring.mjs
 */
import assert from 'node:assert/strict';
import { randomBytes, createHmac } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import mysql from 'mysql2/promise';

for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}
const locationModule = `data:text/javascript;base64,${Buffer.from(readFileSync('lib/location.js')).toString('base64')}`;
const contactSource = readFileSync('lib/indication-contact.js', 'utf8').replace('"./location"', JSON.stringify(locationModule));
const contact = await import(`data:text/javascript;base64,${Buffer.from(contactSource).toString('base64')}`);
assert.equal(contact.normalizeWhatsapp('(11) 99999-1234'), '5511999991234');
assert.equal(contact.normalizeWhatsapp('+55 (11) 99999-1234'), '5511999991234');
assert.equal(contact.normalizeWhatsapp('5511999991234'), '5511999991234');
for (const bad of ['abc11999991234', '', '1234', '00000000000', 'https://wa.me/5511999991234']) assert.equal(contact.normalizeWhatsapp(bad), null);
assert.throws(() => contact.validateIndicationContact('both', { whatsappNumber: '11999991234' }));
assert.throws(() => contact.validateIndicationContact('both', { place: { placeId: 'test' } }));

const db = await mysql.createConnection({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE });
const base = process.env.BASE_URL || 'http://127.0.0.1:3001';
const suffix = randomBytes(5).toString('hex');
const users = [], requests = [];
let rankingId;
const cookie = (uid) => {
  const data = Buffer.from(JSON.stringify({ uid, exp: Date.now() + 3600000 })).toString('base64url');
  return `indica_session=${data}.${createHmac('sha256', process.env.AUTH_SECRET).update(data).digest('base64url')}`;
};
async function api(path, uid, body, method = 'POST', status = 200) {
  const res = await fetch(`${base}/api${path}`, { method, headers: { Cookie: cookie(uid), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json();
  assert.equal(res.status, status, `${path}: ${JSON.stringify(data)}`);
  return data;
}
try {
  const [[city]] = await db.query('SELECT id FROM cidades LIMIT 1');
  assert(city, 'É necessária uma cidade no banco de teste.');
  for (let index = 0; index < 8; index++) {
    const name = `contact_${suffix}_${index}`;
    const [insert] = await db.query('INSERT INTO usuarios (nome_usuario, email, senha_hash, cidade_id, codigo_compartilhamento) VALUES (?, ?, ?, ?, ?)', [name, `${name}@example.com`, 'fixture', city.id, `${suffix}${index}`]);
    users.push(insert.insertId);
  }
  const [ranking] = await db.query("INSERT INTO rankings (cidade_id, modalidade, periodo_inicio, periodo_fim, status, titulo) VALUES (NULL, 'weekly', UTC_TIMESTAMP() - INTERVAL 1 DAY, UTC_TIMESTAMP() + INTERVAL 1 DAY, 'open', ?)", [`Teste contatos ${suffix}`]);
  rankingId = ranking.insertId;
  for (const uid of users.slice(1)) await db.query("INSERT INTO ranking_participacoes (ranking_id, usuario_id, inscrito_em) VALUES (?, ?, UTC_TIMESTAMP() - INTERVAL 1 DAY)", [rankingId, uid]);
  const owner = users[0];
  const config = await api('/places/map-config?cityName=S%C3%A3o%20Paulo&cityState=SP', owner, undefined, 'GET');
  assert.deepEqual(config.center, { lat: -23.5329, lng: -46.6395 });
  const missingCity = await api('/places/map-config?cityName=Inexistente&cityState=SP', owner, undefined, 'GET');
  assert.equal(missingCity.center, null);

  const body = { title: 'Teste de contatos', cityId: city.id };
  await api('/requests', owner, body, 'POST', 400);
  await api('/requests', owner, { ...body, contactMode: 'free' }, 'POST', 400);
  await api('/requests', owner, { ...body, contactMode: 'both' }, 'POST', 400);
  for (const mode of ['maps', 'whatsapp', 'both']) {
    let created;
    if (mode === 'both') {
      // Fixture histórica: novos pedidos não permitem mais a modalidade combinada.
      const [legacy] = await db.query("INSERT INTO pedidos (solicitante_id, cidade_id, titulo, canal_indicacao) VALUES (?, ?, ?, 'both')", [owner, city.id, body.title]);
      created = { item: { id: legacy.insertId, contactMode: 'both' } };
    } else {
      created = await api('/requests', owner, { ...body, contactMode: mode }, 'POST', 201);
    }
    const rid = created.item.id; requests.push(rid);
    assert.equal(created.item.contactMode, mode);
    await api('/indications', users[1], { requestId: rid, description: 'Sem contato' }, 'POST', 400);
    const eligible = await api(`/indications/eligible/${rid}`, users[1], undefined, 'GET');
    assert.equal(eligible.item.contactMode, mode);
    if (mode === 'whatsapp') {
      const createdInd = await api('/indications', users[1], { requestId: rid, contactName: 'Clínica Sorriso', whatsappNumber: '(11) 99999-1234' }, 'POST', 201);
      const createdDetail = await api(`/indications/${createdInd.id}`, users[1], undefined, 'GET');
      assert.equal(createdDetail.item.description, '');
      await api(`/indications/${createdInd.id}`, users[1], { description: 'Contato', contactName: 'Clínica Sorriso', whatsappNumber: 'ruim' }, 'PATCH', 400);
      await api(`/indications/${createdInd.id}`, users[1], { description: 'Contato editado', contactName: 'Clínica Sorriso', whatsappNumber: '+55 (11) 99999-5678' }, 'PATCH');
      const detail = await api(`/indications/${createdInd.id}`, users[1], undefined, 'GET');
      assert.equal(detail.item.whatsappNumber, '5511999995678');
      await api(`/indications/${createdInd.id}`, users[1], { description: '', contactName: 'Clínica Sorriso', whatsappNumber: '+55 (11) 99999-5678' }, 'PATCH');
      const clearedDetail = await api(`/indications/${createdInd.id}`, users[1], undefined, 'GET');
      assert.equal(clearedDetail.item.description, '');
      assert.equal(detail.item.contactName, 'Clínica Sorriso');
      await db.query('DELETE FROM notificacoes WHERE indicacao_id = ?', [createdInd.id]);
      await db.query('DELETE FROM indicacoes WHERE id = ?', [createdInd.id]);
    }
    // Escolhida, mesmo local, mesmo telefone, diferente, ciclo anterior e excluída.
    const seeds = [ ['place-A', '5511999990001', 0, false], ['place-A', '5511999990002', 0, false], ['place-B', '5511999990001', 0, false], ['place-B', '5511999990002', 0, false], ['place-A', '5511999990001', -1, false], ['place-A', '5511999990001', 0, true] ];
    const ids = [];
    for (let index = 0; index < seeds.length; index++) {
      const [place, phone, cycle, deleted] = seeds[index];
      const [insert] = await db.query("INSERT INTO indicacoes (pedido_id, indicador_id, descricao, whatsapp_numero, numero_ciclo, excluido_em) VALUES (?, ?, 'Indicação de teste', ?, ?, IF(?, UTC_TIMESTAMP(), NULL))", [rid, users[index + 1], mode === 'maps' ? null : mode === 'both' && index === 1 ? '5511999990001' : phone, cycle, deleted]);
      ids.push(insert.insertId);
      if (mode !== 'whatsapp') await db.query("INSERT INTO indicacao_locais (indicacao_id, origem, place_id, nome, endereco) VALUES (?, 'google_maps', ?, 'Teste', 'Endereço')", [insert.insertId, place]);
    }
    await api(`/requests/${rid}/open-comparison`, owner, {});
    await api(`/requests/${rid}/select`, owner, { indicationId: ids[0] });
    // Mesmo uma inserção fora da API após o bloqueio não pode gerar reconhecimento.
    const [late] = await db.query("INSERT INTO indicacoes (pedido_id, indicador_id, descricao, whatsapp_numero, numero_ciclo, status, bloqueada_em, criado_em) VALUES (?, ?, 'Resposta tardia', '5511999990001', 1, 'in_evaluation', UTC_TIMESTAMP(), UTC_TIMESTAMP() + INTERVAL 1 DAY)", [rid, users[7]]);
    if (mode !== 'whatsapp') await db.query("INSERT INTO indicacao_locais (indicacao_id, origem, place_id, nome, endereco) VALUES (?, 'google_maps', 'place-A', 'Teste', 'Endereço')", [late.insertId]);
    const comparison = await api(`/requests/${rid}/comparison`, owner, undefined, 'GET');
    assert.equal(JSON.stringify(comparison).includes('5511999990002'), false, 'Contatos de outras indicações devem permanecer ocultos após escolha.');
    await api(`/requests/${rid}/evaluate`, owner, { outcome: 'valid' });
    await api(`/requests/${rid}/evaluate`, owner, { outcome: 'valid' }, 'POST', 400);
    const [rows] = await db.query('SELECT id, resultado, selecionada_em FROM indicacoes WHERE id IN (?) ORDER BY id', [ids]);
    const [[lateScore]] = await db.query('SELECT COUNT(*) AS n FROM historico_reputacao WHERE indicacao_id = ?', [late.insertId]);
    assert.equal(Number(lateScore.n), 0);
    const expected = mode === 'maps' ? [0, 1] : mode === 'whatsapp' ? [0, 2] : [0, 1];
    for (let index = 0; index < rows.length; index++) assert.equal(rows[index].resultado === 'valid', expected.includes(index), `${mode}: indicação ${index}`);
    for (const index of expected) {
      const [[score]] = await db.query('SELECT SUM(delta) AS points, COUNT(*) AS n FROM ledger_pontuacao WHERE ranking_id = ? AND indicacao_id = ?', [rankingId, ids[index]]);
      assert.equal(Number(score.points), index === 0 ? 10 : 5);
      assert.equal(Number(score.n), 1);
      const [[reputation]] = await db.query('SELECT reputacao FROM usuarios WHERE id = ?', [users[index + 1]]);
      assert.equal(Number(reputation.reputacao), 100);
      const [[history]] = await db.query('SELECT tipo_validacao, pontos_atribuidos, indicacao_origem_id FROM historico_reputacao WHERE indicacao_id = ?', [ids[index]]);
      assert.equal(history.tipo_validacao, index === 0 ? 'chosen' : 'equivalent');
      assert.equal(history.pontos_atribuidos, index === 0 ? 10 : 5);
      assert.equal(history.indicacao_origem_id, index === 0 ? null : ids[0]);
      const profile = await api('/auth/me', users[index + 1], undefined, 'GET');
      assert.equal(profile.user.validIndicationCount, profile.user.chosenValidCount + profile.user.equivalentValidCount);
      assert.equal(profile.user.hasEvaluations, true);
      const detail = await api(`/indications/${ids[index]}`, users[index + 1], undefined, 'GET');
      assert.equal(detail.item.outcome.wasChosen, index === 0);
      if (index !== 0) assert.match(detail.item.outcome.title, /também/);
    }
    console.log(`OK ${mode}: campos obrigatórios, equivalência, +10/+5 pontos, privacidade, idempotência e isolamento de ciclo.`);
  }
  // Uma avaliação inválida afeta somente a escolhida.
  const invalidRequest = await api('/requests', owner, { ...body, contactMode: 'whatsapp' }, 'POST', 201);
  const invalidRid = invalidRequest.item.id; requests.push(invalidRid);
  const invalidIds = [];
  for (const uid of users.slice(1, 4)) {
    const [insert] = await db.query("INSERT INTO indicacoes (pedido_id, indicador_id, descricao, whatsapp_numero) VALUES (?, ?, 'Contato de teste', '5511999990001')", [invalidRid, uid]);
    invalidIds.push(insert.insertId);
  }
  await api(`/requests/${invalidRid}/open-comparison`, owner, {});
  await api(`/requests/${invalidRid}/select`, owner, { indicationId: invalidIds[0] });
  await api(`/requests/${invalidRid}/evaluate`, owner, { outcome: 'invalid', reasonCode: 'no_contact' });
  const [[untouched]] = await db.query('SELECT resultado FROM indicacoes WHERE id = ?', [invalidIds[1]]);
  assert.equal(untouched.resultado, null);
  const [[noScore]] = await db.query('SELECT COUNT(*) AS n FROM ledger_pontuacao WHERE indicacao_id = ?', [invalidIds[1]]);
  assert.equal(Number(noScore.n), 0);
  console.log('OK avaliação inválida: nenhuma pontuação ou penalidade propagada.');
  await api(`/requests/${invalidRid}/select`, owner, { indicationId: invalidIds[1] });
  await api(`/requests/${invalidRid}/evaluate`, owner, { outcome: 'valid' });
  const [afterRetry] = await db.query('SELECT tipo_validacao, resultado FROM indicacoes WHERE id IN (?) ORDER BY id', [invalidIds]);
  assert.deepEqual(afterRetry.map(row => row.resultado), ['invalid', 'valid', 'valid']);
  assert.deepEqual(afterRetry.map(row => row.tipo_validacao), [null, 'chosen', 'equivalent']);
  console.log('OK nova escolha após inválida: principal e equivalência usam a indicação confirmada posteriormente.');
  // Seleção manual por coordenadas: nenhum serviço externo é necessário.
  const manualPin = (location) => ({ source: 'manual', selectionSource: 'map_pin', placeId: null,
    name: 'Oficina do teste', address: 'Rua do teste, 10', location });
  const pinRequest = await api('/requests', owner, { ...body, contactMode: 'maps' }, 'POST', 201);
  const pinRid = pinRequest.item.id; requests.push(pinRid);
  const exactPoint = { lat: -23.5505217, lng: -46.6333089 };
  const pinA = manualPin(exactPoint);
  const pinB = manualPin(exactPoint);
  await api('/indications', users[3], { requestId: pinRid, description: 'Ponto inválido', place: { ...pinA, location: { lat: 91, lng: 0 } } }, 'POST', 400);
  await api('/indications', users[4], { requestId: pinRid, description: 'Local vazio', place: {} }, 'POST', 400);
  const createdA = await api('/indications', users[3], { requestId: pinRid, description: 'Ponto exato', place: pinA }, 'POST', 201);
  const createdB = await api('/indications', users[4], { requestId: pinRid, description: 'Mesmo ponto', place: pinB }, 'POST', 201);
  const detailA = await api(`/indications/${createdA.id}`, users[3], undefined, 'GET');
  assert.deepEqual(detailA.item.place.location, exactPoint);
  assert.equal(detailA.item.place.address, 'Rua do teste, 10');
  assert.equal(detailA.item.place.selectionSource, 'map_pin');
  assert.equal(detailA.item.place.source, 'manual');
  assert.equal(detailA.item.place.selectionToken, undefined);
  const adjustedPoint = { lat: -23.5505317, lng: -46.6333189 };
  await api(`/indications/${createdA.id}`, users[3], { description: 'Ponto ajustado', place: manualPin(adjustedPoint) }, 'PATCH');
  await api(`/indications/${createdB.id}`, users[4], { description: 'Mesmo ponto ajustado', place: manualPin(adjustedPoint) }, 'PATCH');
  await api(`/indications/${createdA.id}`, users[4], { description: 'Sem permissão', place: pinB }, 'PATCH', 403);
  await api(`/requests/${pinRid}`, owner, { contactMode: 'whatsapp' }, 'PATCH', 400);
  await api(`/requests/${pinRid}/open-comparison`, owner, {});
  const pinComparison = await api(`/requests/${pinRid}/comparison`, owner, undefined, 'GET');
  assert.match(JSON.stringify(pinComparison), /-23.5505317/);
  assert.equal(JSON.stringify(pinComparison).includes('selectionToken'), false, 'Não expor assinaturas na comparação');
  await api(`/requests/${pinRid}/select`, owner, { indicationId: createdA.id });
  await api(`/requests/${pinRid}/evaluate`, owner, { outcome: 'valid' });
  const pinHistory = await api(`/requests/${pinRid}`, owner, undefined, 'GET');
  assert.equal(pinHistory.chosenIndications.length, 2);
  for (const item of pinHistory.chosenIndications) assert.deepEqual(item.place.location, adjustedPoint);
  for (const [index, iid] of [createdA.id, createdB.id].entries()) {
    const [[score]] = await db.query('SELECT SUM(delta) AS points FROM ledger_pontuacao WHERE ranking_id = ? AND indicacao_id = ?', [rankingId, iid]);
    assert.equal(Number(score.points), index === 0 ? 10 : 5);
  }
  // Basta nome, endereço ou mapa, na criação e na edição.
  const partialPlaces = [{ name: 'Oficina do bairro' }, { address: 'Rua A, 100' }, { location: { lat: -23.55, lng: -46.63 } }];
  for (const [index, place] of partialPlaces.entries()) {
    const partialRequest = await api('/requests', users[7], { ...body, contactMode: 'maps' }, 'POST', 201);
    requests.push(partialRequest.item.id);
    const created = await api('/indications', users[index], { requestId: partialRequest.item.id, description: 'Local parcial', place }, 'POST', 201);
    const detail = await api(`/indications/${created.id}`, users[index], undefined, 'GET');
    if (place.name) assert.equal(detail.item.place.name, place.name);
    if (place.address) assert.equal(detail.item.place.address, place.address);
    if (place.location) assert.deepEqual(detail.item.place.location, place.location);
    const editedPlace = partialPlaces[(index + 1) % partialPlaces.length];
    await api(`/indications/${created.id}`, users[index], { description: 'Local parcial editado', place: editedPlace }, 'PATCH');
    const edited = await api(`/indications/${created.id}`, users[index], undefined, 'GET');
    if (editedPlace.name) assert.equal(edited.item.place.name, editedPlace.name);
    if (editedPlace.address) assert.equal(edited.item.place.address, editedPlace.address);
    if (editedPlace.location) assert.deepEqual(edited.item.place.location, editedPlace.location);
    await api(`/indications/${created.id}`, users[index], { description: 'Local vazio', place: {} }, 'PATCH', 400);
  }
  console.log('OK local parcial: nome, endereço ou mapa isolados na criação, leitura e edição; local vazio rejeitado.');
  // Reconhecimento independente de inscrição em rankings.
  await db.query('DELETE FROM ranking_participacoes WHERE ranking_id = ? AND usuario_id IN (?)', [rankingId, [users[5], users[6]]]);
  const noRankingRequest = await api('/requests', owner, { ...body, contactMode: 'whatsapp' }, 'POST', 201);
  const noRankingRid = noRankingRequest.item.id; requests.push(noRankingRid);
  const noRankingIds = [];
  for (const uid of [users[5], users[6]]) {
    const created = await api('/indications', uid, { requestId: noRankingRid, description: 'Mesmo profissional', contactName: 'Dentista', whatsappNumber: '(17) 99999-8888', contactMode: 'maps' }, 'POST', 201);
    noRankingIds.push(created.id);
  }
  await api('/indications', users[5], { requestId: noRankingRid, description: 'Participação duplicada', contactName: 'Dentista', whatsappNumber: '17999998888' }, 'POST', 400);
  await api(`/requests/${noRankingRid}/open-comparison`, owner, {});
  await api('/indications', users[7], { requestId: noRankingRid, description: 'Após bloqueio', contactName: 'Dentista', whatsappNumber: '17999998888' }, 'POST', 400);
  await api(`/requests/${noRankingRid}/select`, owner, { indicationId: noRankingIds[0] });
  const responses = await Promise.all([1, 2].map(() => fetch(`${base}/api/requests/${noRankingRid}/evaluate`, { method: 'POST', headers: { Cookie: cookie(owner), 'Content-Type': 'application/json' }, body: JSON.stringify({ outcome: 'valid' }) })));
  assert.deepEqual(responses.map(res => res.status).sort(), [200, 400]);
  for (const [index, iid] of noRankingIds.entries()) {
    const [[history]] = await db.query('SELECT COUNT(*) AS n, SUM(pontos_atribuidos) AS points FROM historico_reputacao WHERE indicacao_id = ?', [iid]);
    assert.equal(Number(history.n), 1);
    assert.equal(Number(history.points), index === 0 ? 10 : 5);
    const [[ledger]] = await db.query('SELECT COUNT(*) AS n FROM ledger_pontuacao WHERE indicacao_id = ?', [iid]);
    assert.equal(Number(ledger.n), 0);
    const me = await api('/auth/me', users[index + 5], undefined, 'GET');
    assert.equal(me.user.accumulatedPoints, index === 0 ? 10 : 5);
    assert.equal(me.user.selectedAndEvaluatedCount, index === 0 ? 1 : 0);
    assert.equal(me.user.equivalentValidCount, index === 0 ? 0 : 1);
  }
  console.log('OK sem ranking: pontuação acumulada, contadores separados, modalidade imutável e avaliações concorrentes sem duplicação.');
  const mapConfig = await api('/places/map-config', owner, undefined, 'GET');
  assert.equal(mapConfig.provider, 'openstreetmap');
  assert.equal(mapConfig.browserKey, undefined);
  assert.match(mapConfig.tileUrl, /^https:\/\//);
  const anonymous = await fetch(`${base}/api/places/map-config`);
  assert.equal(anonymous.status, 401);
  console.log('OK mapa: coordenadas exatas na criação, edição, comparação e histórico; validação manual, autorização e +10/+5 pontos para o mesmo estabelecimento.');
  console.log('Todos os testes de contatos e pontuação passaram.');
} finally {
  if (requests.length) {
    await db.query('DELETE FROM notificacoes WHERE pedido_id IN (?)', [requests]);
    await db.query('DELETE FROM ledger_pontuacao WHERE pedido_id IN (?)', [requests]);
    await db.query('DELETE FROM historico_reputacao WHERE pedido_id IN (?)', [requests]);
    await db.query('DELETE FROM avaliacoes WHERE pedido_id IN (?)', [requests]);
    await db.query('UPDATE pedidos SET indicacao_selecionada_id = NULL WHERE id IN (?)', [requests]);
    await db.query('DELETE FROM indicacoes WHERE pedido_id IN (?)', [requests]);
    await db.query('DELETE FROM pedido_participacoes WHERE pedido_id IN (?)', [requests]);
    await db.query("DELETE FROM eventos_auditoria WHERE (tipo_entidade = 'request' AND entidade_id IN (?)) OR ator_id IN (?)", [requests, users]);
    await db.query('DELETE FROM pedidos WHERE id IN (?)', [requests]);
  }
  if (rankingId) {
    await db.query('DELETE FROM ranking_participacoes WHERE ranking_id = ?', [rankingId]);
    await db.query('DELETE FROM rankings WHERE id = ?', [rankingId]);
  }
  if (users.length) {
    await db.query('DELETE FROM solicitante_bloqueios WHERE indicador_id IN (?) OR solicitante_id IN (?)', [users, users]);
    await db.query('DELETE FROM usuarios WHERE id IN (?)', [users]);
  }
  await db.end();
}
