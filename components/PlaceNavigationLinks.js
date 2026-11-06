import { navigationLinks } from "@/lib/location";

export default function PlaceNavigationLinks({ place }) {
  const { googleMaps, waze } = navigationLinks(place);
  if (!googleMaps && !waze) return null;
  return (
    <div className="place-navigation" aria-label="Abrir localização">
      {googleMaps ? <a className="cmp-maps-link" href={googleMaps} target="_blank" rel="noopener noreferrer">Abrir no Google Maps</a> : null}
      {waze ? <a className="cmp-maps-link" href={waze} target="_blank" rel="noopener noreferrer">Abrir no Waze</a> : null}
    </div>
  );
}
