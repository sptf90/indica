"use client";

import { CONTACT_MODES } from "@/lib/indication-contact";

export default function ContactModePicker({ value, onChange, disabled = false }) {
  return (
    <fieldset className="contact-mode-picker" disabled={disabled}>
      <legend>O que você quer receber?</legend>
      <p className="muted">Quem indicar deverá informar os dados escolhidos abaixo.</p>
      <div className="contact-mode-options">
        {CONTACT_MODES.map((mode) => (
          <label key={mode.value}>
            <input type="radio" name="contactMode" value={mode.value}
              checked={value === mode.value} onChange={() => onChange(mode.value)} required />
            <span>{mode.label}</span>
          </label>
        ))}
      </div>
      <p className="muted">Se a indicação for confirmada como válida, quem indicou o mesmo local ou WhatsApp também pontua.</p>
    </fieldset>
  );
}
