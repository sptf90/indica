"use client";

import { CONTACT_MODES } from "@/lib/indication-contact";
import MobileHelp from "@/components/MobileHelp";

export default function ContactModePicker({ value, onChange, disabled = false }) {
  return (
    <fieldset className="contact-mode-picker" disabled={disabled}>
      <MobileHelp as="legend" heading="O que você quer receber?" className="muted" label="Como funcionam os dados da indicação">
        Quem indicar deverá informar os dados escolhidos abaixo. Se a indicação for confirmada como válida, quem indicou o mesmo local ou WhatsApp também pontua.
      </MobileHelp>
      <div className="contact-mode-options">
        {CONTACT_MODES.map((mode) => (
          <label key={mode.value}>
            <input type="radio" name="contactMode" value={mode.value}
              checked={value === mode.value} onChange={() => onChange(mode.value)} required />
            <span>{mode.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
