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
  if (digits.startsWith("55")) {
    const national = digits.slice(2);
    const ddd = national.slice(0, 2);
    const validDdd = /^(1[1-9]|2[12478]|3[1-578]|4[1-9]|5[1345]|6[1-9]|7[134579]|8[1-9]|9[1-9])$/.test(ddd);
    if (!validDdd || !/^(?:[2-5]\d{7}|9\d{8})$/.test(national.slice(2))) return null;
  }
  return digits;
}

export function formatWhatsapp(raw) {
  const value = String(raw ?? "");
  let digits = value.replace(/\D/g, "");
  const country = digits.startsWith("55") && (value.startsWith("+") || digits.length > 11);
  if (value.startsWith("+") && !country) return `+${digits.slice(0, 15)}`;
  if (country) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (!digits) return "";
  const prefix = country ? "+55 " : "";
  if (digits.length <= 2) return `${prefix}(${digits}`;
  const local = digits.slice(2);
  const split = local.length > 8 ? 5 : 4;
  return `${prefix}(${digits.slice(0, 2)}) ${local.slice(0, split)}${local.length > split ? `-${local.slice(split)}` : ""}`;
}

export function validateIndicationContact(mode, { whatsappNumber, place, contactName }) {
  let message = "";
  if (mode === "whatsapp" && (typeof contactName !== "string" || !contactName.trim() || contactName.trim().length > 255)) {
    message = "Informe o nome do profissional, empresa ou contato (até 255 caracteres).";
  } else if (needsMaps(mode) && !coordinatesOf(place)) {
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

// Comparação conservadora e direta; coincidências com dados conflitantes não pontuam.
function identityText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function storedWhatsapp(raw) {
  const value = String(raw || "");
  // No banco, números sem máscara já incluem o DDI, inclusive internacionais.
  return normalizeWhatsapp(/^[1-9]\d{7,14}$/.test(value) ? `+${value}` : value);
}

export function sameIndicationContact(mode, chosen, candidate) {
  if (!chosen || !candidate) return false;
  const phoneA = storedWhatsapp(chosen.whatsapp_number);
  const phoneB = storedWhatsapp(candidate.whatsapp_number);
  const samePhone = Boolean(phoneA && phoneA === phoneB);
  if (mode === "whatsapp") return samePhone;
  if (!needsMaps(mode)) return false;

  const bothIds = Boolean(chosen.place_id && candidate.place_id);
  const sameId = bothIds && chosen.place_id === candidate.place_id;
  if (bothIds && !sameId) return false;
  const nameA = identityText(chosen.name);
  const nameB = identityText(candidate.name);
  const addressA = identityText(chosen.address);
  const addressB = identityText(candidate.address);
  const pointA = coordinateKey(chosen);
  const pointB = coordinateKey(candidate);
  const sameManual = Boolean(nameA && nameA === nameB && addressA && addressA === addressB && pointA && pointA === pointB);
  const samePlace = sameId || sameManual;
  if (mode === "maps") return samePlace;

  if (phoneA && phoneB && !samePhone) return false;
  // Um mesmo telefone pode atender mais de um estabelecimento/profissional.
  if (!sameId && ((nameA && nameB && nameA !== nameB) ||
      (addressA && addressB && addressA !== addressB) ||
      (pointA && pointB && pointA !== pointB))) return false;
  return Boolean(samePlace || samePhone);
}
