import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const locationUrl = moduleUrl(readFileSync("lib/location.js", "utf8"));
const location = await import(locationUrl);
const selection = await import(moduleUrl(readFileSync("lib/map-selection.js", "utf8")
  .replace('"./location"', JSON.stringify(locationUrl))));
const contact = await import(moduleUrl(readFileSync("lib/indication-contact.js", "utf8").replace('"./location"', JSON.stringify(locationUrl))));

test("coordenadas: limites, zero e DECIMAL; sem converter ausência em zero", () => {
  assert.deepEqual(location.coordinatesOf({ latitude: "-23.5505200", longitude: "-46.6333080" }), { lat: -23.55052, lng: -46.633308 });
  assert.deepEqual(location.coordinatesOf({ location: { lat: 0, lng: 0 } }), { lat: 0, lng: 0 });
  for (const point of [{ lat: null, lng: 0 }, { lat: "", lng: 0 }, { lat: 91, lng: 0 }, { lat: 0, lng: 181 }, { lat: Infinity, lng: NaN }, { lat: false, lng: true }]) {
    assert.equal(location.coordinatesOf({ location: point }), null);
  }
});

test("navegação usa o mesmo ponto nos links HTTPS de Google Maps e Waze", () => {
  const links = location.navigationLinks({ location: { lat: -23.55052, lng: -46.633308 }, address: "Endereço impreciso", mapsUrl: "https://www.google.com/maps?outro=ponto" });
  const maps = new URL(links.googleMaps);
  const waze = new URL(links.waze);
  assert.equal(maps.searchParams.get("api"), "1");
  assert.equal(maps.searchParams.get("destination"), "-23.55052,-46.633308");
  assert.equal(waze.searchParams.get("ll"), maps.searchParams.get("destination"));
  assert.equal(waze.searchParams.get("navigate"), "yes");
  assert.equal(maps.protocol, "https:"); assert.equal(waze.protocol, "https:");
  assert.equal(location.navigationLinks({ mapsUrl: "javascript:alert(1)" }).googleMaps, null);
  assert.equal(location.navigationLinks({ mapsUrl: "https://maps.app.goo.gl/old" }).waze, null);
});

test("equivalência por ponto preserva lugares identificados distintos", () => {
  const chosen = { latitude: "-23.5505200", longitude: "-46.6333080", place_id: null };
  assert.equal(contact.sameIndicationContact("maps", chosen, { ...chosen }), true);
  assert.equal(contact.sameIndicationContact("maps", chosen, { latitude: -24, longitude: -47 }), false);
  assert.equal(contact.sameIndicationContact("maps", { ...chosen, place_id: "a" }, { ...chosen, place_id: "b" }), false);
  assert.equal(contact.sameIndicationContact("whatsapp", chosen, { ...chosen }), false);
  assert.doesNotThrow(() => contact.validateIndicationContact("maps", { place: { name: "Local", address: "Rua 10", selectionSource: "map_pin", location: { lat: 0, lng: 0 } } }));
});

test("seleção manual é validada sem chave e sem consultar APIs externas", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("Nenhuma API externa deve ser consultada"); };
  try {
    const input = { source: "google_maps", placeId: "ID-forjado", selectionToken: "não é necessário",
      name: "  Oficina  ", address: "  Rua 10  ", location: { lat: -23.5505217, lng: -46.6333089 } };
    const result = await selection.resolveIndicationPlace(input);
    assert.deepEqual(result.location, input.location);
    assert.equal(result.name, "Oficina");
    assert.equal(result.address, "Rua 10");
    assert.equal(result.placeId, null);
    assert.equal(result.source, "manual");
    assert.equal(result.selectionSource, "map_pin");
    assert.equal("selectionToken" in result, false);
    assert.match(result.mapsUrl, /-23.5505217/);
    for (const bad of [
      { ...input, location: null }, { ...input, location: { lat: 91, lng: 0 } },
      { ...input, name: "" }, { ...input, address: "" },
      { ...input, name: "x".repeat(256) }, { ...input, address: "x".repeat(1001) },
      { ...input, name: {} }, { ...input, address: [] },
    ]) await assert.rejects(() => selection.resolveIndicationPlace(bad), { status: 400 });
  } finally { globalThis.fetch = originalFetch; }
});


test("visão inicial usa cidade e UF da base local, sem APIs externas", async () => {
  const source = readFileSync("lib/city-map.js", "utf8").replace('import cityCenters from "../data/br-city-centers.json";',
    `const cityCenters = ${readFileSync("data/br-city-centers.json", "utf8")};`);
  const { cityMapCenter } = await import(moduleUrl(source));
  assert.deepEqual(cityMapCenter("São Paulo", "SP"), { lat: -23.5329, lng: -46.6395 });
  assert.deepEqual(cityMapCenter("  sao paulo ", "sp"), cityMapCenter("São Paulo", "SP"));
  assert.notDeepEqual(cityMapCenter("Bom Jesus", "RS"), cityMapCenter("Bom Jesus", "PI"));
  assert(cityMapCenter("Boa Esperança do Norte", "MT"));
  assert.equal(cityMapCenter("Cidade inexistente", "SP"), null);
  assert.equal(cityMapCenter("São Paulo", "XX"), null);
});
