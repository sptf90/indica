"use client";

import { useId } from "react";
import MapLocationPicker from "@/components/MapLocationPicker";
import PlaceNavigationLinks from "@/components/PlaceNavigationLinks";
import { coordinatesOf } from "@/lib/location";

/** Busca de estabelecimentos e seleção manual compartilham o mesmo local confirmado. */
export default function LocationPicker({ value, onChange, cityName, cityState, required = true }) {
  const hintId = useId();
  const point = coordinatesOf(value);
  function updateField(field, text) {
    onChange({ ...value, source: "manual", selectionSource: "map_pin", placeId: null, mapsUrl: null, photoName: null, [field]: text });
  }
  return (
    <div className="location-picker">
      <p className="indicar-n-group-hint">Busque o estabelecimento no mapa para preencher os dados, ou informe o nome e endereço e marque um ponto manualmente.</p>
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
      <p id={hintId} className="indicar-n-hint">Confira o nome e o endereço. A navegação usa as coordenadas do local confirmado.</p>
      <MapLocationPicker value={value} onChange={onChange} cityName={cityName} cityState={cityState} />
      {point ? <div className="map-location-result" role="status">
        <strong>Localização marcada</strong>
        <p>{point.lat.toFixed(6)}, {point.lng.toFixed(6)}</p>
        <PlaceNavigationLinks place={value} />
      </div> : null}
    </div>
  );
}
