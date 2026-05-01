import { parse } from "csv-parse/sync";
import readXlsxFile from "read-excel-file/node";

export async function parseUploadedFile(file) {
  const lower = file.originalname.toLowerCase();

  if (lower.endsWith(".csv")) {
    const records = parse(file.buffer.toString("utf8"), {
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true
    });
    return splitHeaderAndRows(records);
  }

  if (lower.endsWith(".xlsx")) {
    const records = await readXlsxFile(file.buffer);
    return splitHeaderAndRows(records);
  }

  const error = new Error("Only CSV and XLSX files are supported.");
  error.status = 400;
  throw error;
}

function splitHeaderAndRows(records) {
  const nonEmpty = records.filter((row) => row.some((value) => String(value || "").trim() !== ""));
  if (nonEmpty.length < 2) {
    const error = new Error("Upload must include a header row and at least one data row.");
    error.status = 400;
    throw error;
  }

  const headers = nonEmpty[0].map((value, index) => String(value || `Column ${index + 1}`).trim());
  const rows = nonEmpty.slice(1).map((row) => headers.map((_, index) => row[index] ?? ""));
  return { headers, rows };
}
