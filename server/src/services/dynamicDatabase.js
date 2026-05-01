import slugify from "slugify";
import { v4 as uuidv4 } from "uuid";
import { config, isFailSafeMode } from "../config.js";
import { query } from "../db.js";
import { getFailSafeDataset, listFailSafeDatasets, upsertFailSafeDataset } from "../store/failsafeStore.js";
import { normalizeHeader, quoteIdent } from "../utils.js";

function datasetNames(userId, displayName) {
  const userPart = normalizeHeader(String(userId).replaceAll("-", "_")).slice(0, 36);
  const slug = normalizeHeader(slugify(displayName, { lower: true, strict: true })).slice(0, 36);
  return {
    schemaName: `tenant_${userPart}`,
    tableName: `sales_${slug || "dataset"}`
  };
}

async function getExistingDataset(userId, displayName) {
  const result = await query(
    "select * from datasets where user_id = $1 and display_name = $2",
    [userId, displayName]
  );
  return result.rows[0] || null;
}

async function getCurrentPgColumns(schemaName, tableName) {
  const result = await query(
    `
      select column_name
      from information_schema.columns
      where table_schema = $1 and table_name = $2
      order by ordinal_position
    `,
    [schemaName, tableName]
  );
  return result.rows.map((row) => row.column_name);
}

async function createOrEvolveTable({ schemaName, tableName, schema, existingColumns }) {
  await query(`create schema if not exists ${quoteIdent(schemaName)}`);

  const dataColumnSql = schema
    .map((column) => `${quoteIdent(column.name)} ${column.pgType}`)
    .join(", ");

  await query(`
    create table if not exists ${quoteIdent(schemaName)}.${quoteIdent(tableName)} (
      id bigserial primary key,
      ingested_at timestamptz not null default now()
      ${dataColumnSql ? `, ${dataColumnSql}` : ""}
    )
  `);

  const actualColumns = existingColumns.length
    ? existingColumns
    : await getCurrentPgColumns(schemaName, tableName);

  const protectedColumns = new Set(["id", "ingested_at"]);
  const wanted = new Map(schema.map((column) => [column.name, column]));

  for (const column of schema) {
    if (!actualColumns.includes(column.name)) {
      await query(
        `alter table ${quoteIdent(schemaName)}.${quoteIdent(tableName)} add column ${quoteIdent(column.name)} ${column.pgType}`
      );
    }
  }

  const removedColumns = actualColumns.filter((name) => !protectedColumns.has(name) && !wanted.has(name));
  if (config.schemaEvolutionDropColumns) {
    for (const name of removedColumns) {
      await query(`alter table ${quoteIdent(schemaName)}.${quoteIdent(tableName)} drop column ${quoteIdent(name)}`);
    }
  }

  return removedColumns;
}

async function insertRows({ schemaName, tableName, rows, schema }) {
  await query(`truncate table ${quoteIdent(schemaName)}.${quoteIdent(tableName)} restart identity`);
  if (!rows.length) return;

  const columnNames = schema.map((column) => column.name);
  const columnSql = columnNames.map(quoteIdent).join(", ");
  const valueRows = [];
  const params = [];

  rows.forEach((row, rowIndex) => {
    const placeholders = columnNames.map((name, columnIndex) => {
      params.push(row[name]);
      return `$${rowIndex * columnNames.length + columnIndex + 1}`;
    });
    valueRows.push(`(${placeholders.join(", ")})`);
  });

  await query(
    `insert into ${quoteIdent(schemaName)}.${quoteIdent(tableName)} (${columnSql}) values ${valueRows.join(", ")}`,
    params
  );
}

async function createHelpfulIndexes({ schemaName, tableName, schema }) {
  const indexCandidates = schema.filter((column) =>
    /(date|month|region|country|state|category|customer)/i.test(column.name)
  );

  for (const column of indexCandidates.slice(0, 6)) {
    const indexName = normalizeHeader(`idx_${tableName}_${column.name}`).slice(0, 60);
    await query(
      `create index if not exists ${quoteIdent(indexName)} on ${quoteIdent(schemaName)}.${quoteIdent(tableName)} (${quoteIdent(column.name)})`
    );
  }
}

export async function persistDataset({ userId, displayName, schema, rows }) {
  if (isFailSafeMode) {
    const { schemaName, tableName } = datasetNames(userId, displayName);
    const existing = (await listFailSafeDatasets(userId)).find((item) => item.displayName === displayName);
    const existingColumns = existing?.currentColumns?.map((column) => column.name) || [];
    const wanted = new Set(schema.map((column) => column.name));
    const removedColumns = existingColumns.filter((name) => !wanted.has(name));

    return upsertFailSafeDataset({
      userId,
      displayName,
      schemaName,
      tableName,
      originalColumns: schema.map((column) => column.sourceName),
      currentColumns: schema,
      removedColumns,
      rowCount: rows.length,
      rows
    });
  }

  const existing = await getExistingDataset(userId, displayName);
  const names = existing || datasetNames(userId, displayName);
  const existingColumns = existing ? await getCurrentPgColumns(names.schema_name, names.table_name) : [];
  const removedColumns = await createOrEvolveTable({
    schemaName: names.schema_name || names.schemaName,
    tableName: names.table_name || names.tableName,
    schema,
    existingColumns
  });

  const schemaName = names.schema_name || names.schemaName;
  const tableName = names.table_name || names.tableName;
  await insertRows({ schemaName, tableName, rows, schema });
  await createHelpfulIndexes({ schemaName, tableName, schema });

  const datasetId = existing?.id || uuidv4();
  await query(
    `
      insert into datasets (
        id, user_id, display_name, schema_name, table_name,
        original_columns, current_columns, removed_columns, row_count, updated_at
      )
      values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, now())
      on conflict (user_id, display_name)
      do update set
        current_columns = excluded.current_columns,
        removed_columns = excluded.removed_columns,
        row_count = excluded.row_count,
        updated_at = now()
      returning *
    `,
    [
      datasetId,
      userId,
      displayName,
      schemaName,
      tableName,
      JSON.stringify(schema.map((column) => column.sourceName)),
      JSON.stringify(schema),
      JSON.stringify(removedColumns),
      rows.length
    ]
  );

  return {
    id: datasetId,
    userId,
    displayName,
    schemaName,
    tableName,
    originalColumns: schema.map((column) => column.sourceName),
    currentColumns: schema,
    removedColumns,
    rowCount: rows.length
  };
}

export async function listDatasets(userId) {
  if (isFailSafeMode) return listFailSafeDatasets(userId);

  const result = await query(
    `
      select
        id,
        display_name as "displayName",
        schema_name as "schemaName",
        table_name as "tableName",
        original_columns as "originalColumns",
        current_columns as "currentColumns",
        removed_columns as "removedColumns",
        row_count as "rowCount",
        created_at as "createdAt",
        updated_at as "updatedAt"
      from datasets
      where user_id = $1
      order by updated_at desc
    `,
    [userId]
  );
  return result.rows;
}

export async function getDatasetWithRows(userId, datasetId) {
  if (isFailSafeMode) return getFailSafeDataset(userId, datasetId);

  const metadata = await query(
    `
      select
        id,
        display_name as "displayName",
        schema_name as "schemaName",
        table_name as "tableName",
        current_columns as "currentColumns",
        removed_columns as "removedColumns",
        row_count as "rowCount"
      from datasets
      where user_id = $1 and id = $2
    `,
    [userId, datasetId]
  );

  const dataset = metadata.rows[0];
  if (!dataset) return null;

  const rows = await query(
    `select * from ${quoteIdent(dataset.schemaName)}.${quoteIdent(dataset.tableName)} order by id asc limit 10000`
  );
  return { ...dataset, rows: rows.rows };
}
