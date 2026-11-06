import { getPlaceById } from "./google-places";
import { coordinatesOf } from "./location";

/** Seleção manual usa coordenadas; Places resolve a identidade no servidor. */
export async function resolveIndicationPlace(place) {
  const fail = (message) => { throw Object.assign(new Error(message), { status: 400 }); };
  if (place?.selectionSource === "google_places" || (place?.source === "google_maps" && place?.selectionSource === "place")) {
    const resolved = await getPlaceById(place.placeId);
    return { ...resolved, selectionSource: "google_places" };
  }
  const location = coordinatesOf(place);
  if (!location) fail("Marque e confirme a localização no mapa.");
  const name = typeof place?.name === "string" ? place.name.trim() : "";
  const address = typeof place?.address === "string" ? place.address.trim() : "";
  if (!name || name.length > 255) fail("Informe o nome do local com até 255 caracteres.");
  if (!address || address.length > 1000) fail("Informe o endereço com até 1000 caracteres.");
  return {
    source: "manual", selectionSource: "map_pin", placeId: null,
    name, address, location,
    mapsUrl: `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: `${location.lat},${location.lng}` })}`,
  };
}
