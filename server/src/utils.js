import crypto from "crypto";

export function normalizeHeader(header, fallbackIndex = 0) {
  const cleaned = String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  const safe = cleaned || `column_${fallbackIndex + 1}`;
  return /^[a-z_]/.test(safe) ? safe.slice(0, 60) : `c_${safe}`.slice(0, 60);
}

export function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function stableId(prefix = "id") {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

export function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).replace(/[$,₹€£\s]/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function compactObject(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}
