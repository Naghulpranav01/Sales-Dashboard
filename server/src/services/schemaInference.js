import { normalizeHeader, toDate, toNumber } from "../utils.js";

function inferValueType(value) {
  if (value === null || value === undefined || value === "") return "empty";
  const text = String(value).trim();
  if (/^(true|false|yes|no|0|1)$/i.test(text)) return "boolean";
  if (/^-?\d+$/.test(text.replace(/,/g, ""))) return "integer";
  if (toNumber(text) !== null) return "numeric";
  if (toDate(text)) return "timestamptz";
  return "text";
}

function combineTypes(types) {
  const useful = types.filter((type) => type !== "empty");
  if (!useful.length) return "text";
  if (useful.every((type) => type === "integer")) return "integer";
  if (useful.every((type) => type === "integer" || type === "numeric")) return "numeric";
  if (useful.every((type) => type === "boolean")) return "boolean";
  if (useful.every((type) => type === "timestamptz")) return "timestamptz";
  return "text";
}

export function inferSchema(headers, rows) {
  const seen = new Map();
  return headers.map((header, index) => {
    const baseName = normalizeHeader(header, index);
    const count = seen.get(baseName) || 0;
    seen.set(baseName, count + 1);
    const name = count ? `${baseName}_${count + 1}` : baseName;
    const samples = rows.slice(0, 250).map((row) => row[index]);

    return {
      sourceName: String(header || `Column ${index + 1}`).trim(),
      name,
      pgType: combineTypes(samples.map(inferValueType))
    };
  });
}

export function castValue(value, pgType) {
  if (value === undefined || value === null || value === "") return null;
  if (pgType === "integer") {
    const number = toNumber(value);
    return number === null ? null : Math.trunc(number);
  }
  if (pgType === "numeric") return toNumber(value);
  if (pgType === "boolean") return /^(true|yes|1)$/i.test(String(value).trim());
  if (pgType === "timestamptz") {
    const date = toDate(value);
    return date ? date.toISOString() : null;
  }
  return String(value).trim();
}

export function normalizeRows(rows, schema) {
  const unique = new Map();
  for (const row of rows) {
    const record = {};
    schema.forEach((column, index) => {
      record[column.name] = castValue(row[index], column.pgType);
    });
    const signature = JSON.stringify(record);
    if (!unique.has(signature)) unique.set(signature, record);
  }
  return [...unique.values()];
}
