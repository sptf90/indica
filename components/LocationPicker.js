"use client";

import MapLocationPicker from "@/components/MapLocationPicker";
import PlaceNavigationLinks from "@/components/PlaceNavigationLinks";
import { coordinatesOf, hasPlaceData } from "@/lib/location";

export default function LocationPicker({ value, onChange, cityName, cityState }) {
  const point = coordinatesOf(value);
  return (
    <div className="location-picker">
      <MapLocationPicker value={value} onChange={onChange} cityName={cityName} cityState={cityState} />
      {hasPlaceData(value) ? <div className="map-location-result" role="status">
        <strong>{point ? "Localização marcada" : "Local salvo"}</strong>
        {value?.name ? <p>{value.name}</p> : null}
        {value?.address ? <p>{value.address}</p> : null}
        {point ? <p>{point.lat.toFixed(6)}, {point.lng.toFixed(6)}</p> : null}
        <PlaceNavigationLinks place={value} />
      </div> : null}
    </div>
  );
}
