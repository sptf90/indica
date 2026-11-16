import { getPlaceById } from "./google-places";
import { coordinatesOf, validatePlaceData } from "./location";

/** Local manual aceita texto ou coordenadas; Places resolve a identidade no servidor. */
export async function resolveIndicationPlace(place) {
  if (place?.selectionSource === "google_places" || (place?.source === "google_maps" && place?.selectionSource === "place")) {
    const resolved = await getPlaceById(place.placeId);
    return { ...resolved, selectionSource: "google_places" };
  }
  validatePlaceData(place);
  const location = coordinatesOf(place);
  const name = typeof place?.name === "string" ? place.name.trim() : "";
  const address = typeof place?.address === "string" ? place.address.trim() : "";
  const query = location ? `${location.lat},${location.lng}` : [name, address].filter(Boolean).join(", ");
  return {
    source: "manual", selectionSource: location ? "map_pin" : "text", placeId: null,
    name, address, location,
    mapsUrl: `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query })}`,
  };
}
