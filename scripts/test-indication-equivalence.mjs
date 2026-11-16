import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const location = url(readFileSync('lib/location.js', 'utf8'));
const contact = await import(url(readFileSync('lib/indication-contact.js', 'utf8').replace('"./location"', JSON.stringify(location))));
const place = { place_id: null, name: 'Clínica Sorriso', address: 'Rua A, 10', latitude: -20.8, longitude: -49.4, whatsapp_number: '5517999998888' };
test('coordenadas iguais não unificam estabelecimentos diferentes', () => {
  assert.equal(contact.sameIndicationContact('maps', place, { ...place, name: 'Dental Kids' }), false);
  assert.equal(contact.sameIndicationContact('maps', place, { ...place, name: 'clinica sorriso' }), true);
  assert.equal(contact.sameIndicationContact('maps', { ...place, place_id: 'a' }, { ...place, place_id: 'b' }), false);
});
test('ambos exige ausência de conflito entre identificadores', () => {
  assert.equal(contact.sameIndicationContact('both', { ...place, place_id: 'a' }, { ...place, place_id: 'b' }), false);
  assert.equal(contact.sameIndicationContact('both', place, { ...place, whatsapp_number: '5517999990000' }), false);
  assert.equal(contact.sameIndicationContact('both', place, { ...place, name: 'Dental Kids' }), false);
  assert.equal(contact.sameIndicationContact('both', place, { ...place }), true);
});
test('WhatsApp usa número normalizado, independentemente do nome', () => {
  assert.equal(contact.sameIndicationContact('whatsapp', place, { whatsapp_number: '+55 (17) 99999-8888', name: 'Outro nome' }), true);
});
test('WhatsApp exige nome e a máscara preserva a normalização', () => {
  assert.throws(() => contact.validateIndicationContact('whatsapp', { whatsappNumber: '17999998888' }), { status: 400 });
  assert.doesNotThrow(() => contact.validateIndicationContact('whatsapp', { contactName: 'Clínica', whatsappNumber: '17999998888' }));
  assert.equal(contact.formatWhatsapp('17999998888'), '(17) 99999-8888');
  assert.equal(contact.normalizeWhatsapp(contact.formatWhatsapp('+5517999998888')), '5517999998888');
});

test('números brasileiros exigem DDD existente e formato de telefone', () => {
  for (const bad of ['20999998888', '11712345678', '1101234567', '+55 00 99999-8888']) assert.equal(contact.normalizeWhatsapp(bad), null);
  assert.equal(contact.normalizeWhatsapp('(11) 3333-4444'), '551133334444');
  assert.equal(contact.normalizeWhatsapp('+1 202 555 0123'), '12025550123');
});

test('números internacionais persistidos mantêm o DDI na comparação', () => {
  assert.equal(contact.sameIndicationContact('whatsapp', { whatsapp_number: '12025550123' }, { whatsapp_number: '+1 (202) 555-0123' }), true);
  assert.equal(contact.sameIndicationContact('whatsapp', { whatsapp_number: '12025550123' }, { whatsapp_number: '5512999999999' }), false);
});
