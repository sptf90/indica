"use client";

import { useState } from "react";
import MapLocationPicker from "@/components/MapLocationPicker";
import PlaceNavigationLinks from "@/components/PlaceNavigationLinks";
import PlaceLookupField from "@/components/PlaceLookupField";
import { coordinatesOf } from "@/lib/location";

export default function LocationPicker({ value, onChange, cityName, cityState, required = true }) {
  const [selectionVersion, setSelectionVersion] = useState(0);
  const point = coordinatesOf(value);
  function updateField(field, text) {
    onChange({ ...value, source: "manual", selectionSource: "map_pin", placeId: null, mapsUrl: null, photoName: null, [field]: text });
  }
  function choosePlace(place) {
    setSelectionVersion(version => version + 1);
    onChange({ ...place, source: "google_maps", selectionSource: "google_places" });
  }
  return (
    <div className="location-picker">
      <p className="indicar-n-group-hint">{required ? "Preencha pelo menos um: nome, endereço ou mapa." : "Informe nome, endereço ou selecione no mapa, se desejar."} Ao escolher uma sugestão, os dados do local são preenchidos juntos.</p>
      <PlaceLookupField label="Nome do local" kind="name" value={value?.name || ""} maxLength={255}
        onChange={text => updateField("name", text)} onSelect={choosePlace} cityName={cityName} cityState={cityState} resetKey={selectionVersion} />
      <PlaceLookupField label="Endereço do local" kind="address" value={value?.address || ""} maxLength={1000}
        onChange={text => updateField("address", text)} onSelect={choosePlace} cityName={cityName} cityState={cityState} resetKey={selectionVersion} />
      <MapLocationPicker value={value} onChange={place => { setSelectionVersion(version => version + 1); onChange(place); }} cityName={cityName} cityState={cityState} />
      {point ? <div className="map-location-result" role="status">
        <strong>Localização marcada</strong>
        <p>{point.lat.toFixed(6)}, {point.lng.toFixed(6)}</p>
        <PlaceNavigationLinks place={value} />
      </div> : null}
    </div>
  );
}
