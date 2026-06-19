export function parseId(raw: unknown) {
  return Number.parseInt(Array.isArray(raw) ? String(raw[0]) : String(raw), 10);
}

export function parseDateParam(raw: unknown) {
  return Array.isArray(raw) ? String(raw[0]) : String(raw);
}
