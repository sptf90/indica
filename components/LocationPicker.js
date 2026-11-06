"use client";

import { useId } from "react";
import MapLocationPicker from "@/components/MapLocationPicker";
import PlaceNavigationLinks from "@/components/PlaceNavigationLinks";
import { coordinatesOf } from "@/lib/location";

/** Nome e endereço manuais; a localização de navegação é sempre o ponto marcado. */
export default function LocationPicker({ value, onChange, cityName, cityState, required = true }) {
  const hintId = useId();
  const point = coordinatesOf(value);
  function updateField(field, text) {
    onChange({ ...value, source: "manual", selectionSource: "map_pin", placeId: null, [field]: text });
  }
  return (
    <div className="location-picker">
      <p className="indicar-n-group-hint">Preencha o nome e o endereço e marque o ponto exato no mapa.</p>
      <label className="indicar-n-field">
        <span>Nome do local</span>
        <input value={value?.name || ""} onChange={(event) => updateField("name", event.target.value)}
          maxLength={255} required={required} placeholder="Ex.: Oficina do João" autoComplete="off" />
      </label>
      <label className="indicar-n-field">
        <span>Endereço do local</span>
        <input value={value?.address || ""} onChange={(event) => updateField("address", event.target.value)}
          aria-describedby={hintId} maxLength={1000} required={required} placeholder="Rua, número, bairro e cidade" autoComplete="off" />
      </label>
      <p id={hintId} className="indicar-n-hint">O endereço é preenchido manualmente. A navegação usa o ponto marcado no mapa.</p>
      <MapLocationPicker value={value} onChange={onChange} cityName={cityName} cityState={cityState} />
      {point ? <div className="map-location-result" role="status">
        <strong>Localização marcada</strong>
        <p>{point.lat.toFixed(6)}, {point.lng.toFixed(6)}</p>
        <PlaceNavigationLinks place={value} />
      </div> : null}
    </div>
  );
}
