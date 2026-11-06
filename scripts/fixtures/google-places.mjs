/** Fixture do processo de teste isolado. Nunca ativa sem a chave sentinela. */
export const places = [
  { id: 'muffato_centro', displayName: { text: 'Super Muffato Centro' }, formattedAddress: 'Rua das Flores, 100 — São Paulo, SP', location: { latitude: -23.5512345, longitude: -46.6354321 }, googleMapsUri: 'https://www.google.com/maps/place/?q=place_id:muffato_centro' },
  { id: 'muffato_norte', displayName: { text: 'Super Muffato Norte' }, formattedAddress: 'Avenida Brasil, 250 — São Paulo, SP', location: { latitude: -23.5412345, longitude: -46.6254321 }, googleMapsUri: 'https://www.google.com/maps/place/?q=place_id:muffato_norte' },
];
if (process.env.GOOGLE_PLACES_API_KEY === 'indica-local-test-places') {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    const url = String(input?.url || input);
    if (!url.startsWith('https://places.googleapis.com/v1/')) return original(input, options);
    if (url.endsWith('/places:searchText')) {
      const query = JSON.parse(options.body).textQuery;
      if (/Falha/i.test(query)) return Response.json({ error: { message: 'Busca indisponível para teste.' } }, { status: 503 });
      if (/Lenta/i.test(query)) {
        await new Promise(resolve => setTimeout(resolve, 600));
        return Response.json({ places: [{ ...places[0], id: 'resultado_antigo', displayName: { text: 'Resultado antigo' } }] });
      }
      return Response.json({ places: /Nenhum/i.test(query) ? [] : places });
    }
    const place = places.find(p => url.endsWith(`/places/${p.id}`));
    return place ? Response.json(place) : Response.json({ error: { message: 'Local não encontrado.' } }, { status: 404 });
  };
}
