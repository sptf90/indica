"use client";

import { useState } from "react";
import LocationPicker from "@/components/LocationPicker";
import { contactModeLabel, formatWhatsapp, needsMaps, needsWhatsapp } from "@/lib/indication-contact";
import { useContactPicker, useTouchDevice } from "@/lib/use-touch-device";

export default function IndicationContactFields({ mode, contactName = "", onContactNameChange, whatsappNumber, onWhatsappChange, place, onPlaceChange, cityName, cityState }) {
  const touch = useTouchDevice();
  const pickerSupported = useContactPicker();
  const [pickerError, setPickerError] = useState("");
  if (!mode) return null;

  async function pickFromAgenda() {
    setPickerError("");
    try {
      const [contact] = await navigator.contacts.select(["name", "tel"], { multiple: false });
      if (!contact) return;
      const name = contact.name?.[0]?.trim();
      const tel = contact.tel?.[0];
      if (mode === "whatsapp" && name) onContactNameChange(name.slice(0, 255));
      if (tel) onWhatsappChange(formatWhatsapp(tel));
      else setPickerError("Esse contato não tem telefone. Escolha outro.");
    } catch (err) {
      if (err?.name !== "AbortError") setPickerError("Não foi possível abrir a agenda. Digite o número manualmente.");
    }
  }

  return (
    <fieldset className="indicar-n-group">
      <legend>{contactModeLabel(mode)} — obrigatório</legend>
      {needsWhatsapp(mode) && touch && pickerSupported ? (
        <>
          <button className="request-visibility-button contact-agenda-button" type="button" onClick={pickFromAgenda}>
            Escolher da agenda do celular
          </button>
          {pickerError ? <p className="error-box" role="alert">{pickerError}</p> : null}
        </>
      ) : null}
      {mode === "whatsapp" ? (
        <label className="indicar-n-field">
          <span>Nome do profissional, empresa ou contato</span>
          <input name="contactName" value={contactName} onChange={(event) => onContactNameChange(event.target.value)}
            required maxLength={255} autoComplete="off" />
        </label>
      ) : null}
      {needsWhatsapp(mode) ? (
        <label className="indicar-n-field">
          <span>WhatsApp de quem você indica</span>
          <input name="whatsappNumber" type="tel" inputMode="tel" value={whatsappNumber}
            onChange={(event) => onWhatsappChange(formatWhatsapp(event.target.value))} required maxLength={25}
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
