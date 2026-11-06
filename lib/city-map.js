import cityCenters from "../data/br-city-centers.json";

export function cityMapCenter(cityName, cityState) {
  const state = String(cityState || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) return null;
  const name = String(cityName || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const pair = cityCenters[`${state}:${name}`];
  return pair ? { lat: pair[0], lng: pair[1] } : null;
}
