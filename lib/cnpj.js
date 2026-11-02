/**
 * Helpers de CNPJ (client + server). Máscara BR: 00.000.000/0001-00.
 * Storage sempre com 14 dígitos sem pontuação.
 */

export function normalizeCnpj(raw) {
  return String(raw || "")
    .replace(/\D/g, "")
    .slice(0, 14);
}

/** Formata parcial ou completo enquanto digita / na exibição. */
export function formatCnpj(cnpj) {
  const d = normalizeCnpj(cnpj);
  if (!d) return "";
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  }
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Alias semântico para o input controlado. */
export function maskCnpjInput(raw) {
  return formatCnpj(raw);
}

export function validateCnpj(cnpj) {
  const digits = normalizeCnpj(cnpj);
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;
  const calc = (base, factors) => {
    let sum = 0;
    for (let i = 0; i < factors.length; i += 1) {
      sum += Number(base[i]) * factors[i];
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = calc(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(digits, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(digits[12]) && d2 === Number(digits[13]);
}

export function companyUsernameFromCnpj(cnpj) {
  return `emp_${normalizeCnpj(cnpj)}`;
}
