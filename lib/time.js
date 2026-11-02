export function utcNow() {
  return new Date();
}

export function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function toMysqlDatetime(date = new Date()) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function fromMysqlDatetime(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const normalized = String(value).includes("T")
    ? String(value)
    : `${String(value).replace(" ", "T")}Z`;
  return new Date(normalized);
}

export function msUntil(deadline) {
  const d = fromMysqlDatetime(deadline);
  if (!d) return null;
  return d.getTime() - Date.now();
}
