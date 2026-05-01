import pg from "pg";
import { config, isFailSafeMode } from "./config.js";

let pool = null;

export function getPool() {
  if (isFailSafeMode) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: config.databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000
    });
  }
  return pool;
}

export async function query(text, params = []) {
  const activePool = getPool();
  if (!activePool) throw new Error("PostgreSQL is not configured.");
  return activePool.query(text, params);
}

export async function initPostgres() {
  if (isFailSafeMode) return;

  await query(`
    create table if not exists app_users (
      id uuid primary key,
      name text not null,
      email text not null unique,
      password_hash text not null,
      role text not null default 'analyst',
      created_at timestamptz not null default now()
    );

    create table if not exists datasets (
      id uuid primary key,
      user_id uuid not null references app_users(id) on delete cascade,
      display_name text not null,
      schema_name text not null,
      table_name text not null,
      original_columns jsonb not null,
      current_columns jsonb not null,
      removed_columns jsonb not null default '[]'::jsonb,
      row_count integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(user_id, display_name)
    );
  `);
}
