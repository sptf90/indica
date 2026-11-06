"use client";

import LocationPicker from "@/components/LocationPicker";
import { contactModeLabel, needsMaps, needsWhatsapp } from "@/lib/indication-contact";

export default function IndicationContactFields({ mode, whatsappNumber, onWhatsappChange, place, onPlaceChange, cityName, cityState }) {
  if (!mode) return null;
  return (
    <fieldset className="indicar-n-group">
      <legend>{contactModeLabel(mode)} — obrigatório</legend>
      {needsWhatsapp(mode) ? (
        <label className="indicar-n-field">
          <span>WhatsApp de quem você indica</span>
          <input name="whatsappNumber" type="tel" inputMode="tel" value={whatsappNumber}
            onChange={(event) => onWhatsappChange(event.target.value)} required maxLength={25}
            placeholder="(11) 99999-9999" aria-describedby="whatsapp-contact-hint" />
          <span id="whatsapp-contact-hint" className="indicar-n-hint">Inclua o DDD. Para outro país, use + e o DDI.</span>
        </label>
      ) : null}
      {needsMaps(mode) ? (
        <>
          <LocationPicker cityName={cityName} cityState={cityState} value={place}
            onChange={onPlaceChange} />
        </>
      ) : null}
    </fieldset>
  );
}
