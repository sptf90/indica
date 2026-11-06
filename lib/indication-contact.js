import { coordinatesOf, coordinateKey } from "./location";

export const CONTACT_MODES = [
  { value: "maps", label: "Localização no mapa" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "both", label: "Localização e WhatsApp" },
];

export function contactModeLabel(mode) {
  return CONTACT_MODES.find((item) => item.value === mode)?.label || "Formato livre (pedido antigo)";
}

export function needsMaps(mode) {
  return mode === "maps" || mode === "both";
}

export function needsWhatsapp(mode) {
  return mode === "whatsapp" || mode === "both";
}

export function validateContactMode(mode) {
  if (!CONTACT_MODES.some((item) => item.value === mode)) {
    const error = new Error("Escolha localização, WhatsApp ou ambos.");
    error.status = 400;
    throw error;
  }
  return mode;
}

// Números brasileiros sem DDI recebem 55; números internacionais exigem +.
export function normalizeWhatsapp(raw) {
  const value = String(raw ?? "").trim();
  if (!value || !/^\+?[\d\s().-]+$/.test(value)) return null;
  let digits = value.replace(/\D/g, "");
  if (value.startsWith("+")) {
    if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  } else if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  } else if (!/^55\d{10,11}$/.test(digits)) {
    return null;
  }
  if (digits.startsWith("55") && !/^55[1-9]\d[2-9]\d{7,8}$/.test(digits)) return null;
  return digits;
}

export function validateIndicationContact(mode, { whatsappNumber, place }) {
  let message = "";
  if (needsMaps(mode) && !coordinatesOf(place)) {
    message = "Marque e confirme a localização no mapa.";
  } else if (needsMaps(mode) && !String(place?.name || "").trim()) {
    message = "Informe o nome do local.";
  } else if (needsMaps(mode) && !String(place?.address || "").trim()) {
    message = "Informe o endereço do local.";
  } else if (needsWhatsapp(mode) && !normalizeWhatsapp(whatsappNumber)) {
    message = "Informe um WhatsApp válido com DDD (ou + e DDI para outro país).";
  }
  if (message) {
    const error = new Error(message);
    error.status = 400;
    throw error;
  }
}

// Comparação direta com a escolhida; não propaga equivalência por terceiros.
export function sameIndicationContact(mode, chosen, candidate) {
  const samePlace = needsMaps(mode) && Boolean(chosen.place_id) && chosen.place_id === candidate.place_id;
  const chosenPoint = coordinateKey(chosen);
  const samePoint = needsMaps(mode) && (!chosen.place_id || !candidate.place_id) && chosenPoint && chosenPoint === coordinateKey(candidate);
  const samePhone = needsWhatsapp(mode) && Boolean(chosen.whatsapp_number) && chosen.whatsapp_number === candidate.whatsapp_number;
  return Boolean(samePlace || samePoint || samePhone);
}
