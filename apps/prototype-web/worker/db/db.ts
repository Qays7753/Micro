/**
 * Db seam + typed row access, ID generation, and settings access.
 * All queries go through prepared statements; cross-entity state changes use
 * `batch` (a single PostgreSQL transaction) so failures never leave partial
 * state. The active engine is PostgreSQL via Hyperdrive (EX-D20); the earlier
 * D1 engine and its migrations remain under `db/migrations/` as labelled
 * superseded history.
 */

import postgres from "postgres";
import type { PgDatabaseBinding } from "../env.ts";
import { PgDb } from "./pg.ts";

/** Generic row shape (column name -> value). */
export interface DbRow {
  [column: string]: unknown;
}

/** Run metadata: `changes` is the affected-row count (command tag). */
export interface DbMeta {
  changes: number;
  duration: number;
  last_row_id: number;
  rows_read: number;
  rows_written: number;
}

export interface DbPreparedStatement {
  bind(...values: unknown[]): DbPreparedStatement;
  first<T = DbRow>(colName?: string): Promise<T | null>;
  all<T = DbRow>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; meta: DbMeta }>;
}

export interface Db {
  prepare(query: string): DbPreparedStatement;
  batch(statements: DbPreparedStatement[]): Promise<Array<{ results: DbRow[]; meta: DbMeta }>>;
}

/**
 * Resolve a REQUEST-SCOPED Db from the `DB` binding. Production: a Hyperdrive
 * binding (`.connectionString`). The client is created fresh per request and
 * closed by the worker entry after dispatch — workerd forbids reusing
 * request I/O objects (sockets) across requests, and with Hyperdrive the
 * connect goes to the colo-local pooler (the documented production pattern).
 */
export function dbOf(env: { DB: PgDatabaseBinding | Db }): Db {
  const binding = env.DB as PgDatabaseBinding | Db;
  if (typeof (binding as Db).prepare === "function") return binding as Db;
  if (typeof (binding as PgDatabaseBinding).connectionString === "string") {
    return new PgDb(
      postgres((binding as PgDatabaseBinding).connectionString, {
        max: 1,
        idle_timeout: 20,
        connect_timeout: 10,
        max_lifetime: 60 * 30,
        types: {
          bigint: {
            to: 20,
            from: [20],
            parse: (value: string): number => Number(value),
            serialize: (value: number | bigint): string => String(value),
          },
        },
      }),
    );
  }
  throw new Error("DB binding is neither a Db nor a Hyperdrive-style binding");
}

/** Close a request-scoped Db (no-op for injected non-PG adapters). */
export async function endDb(db: Db): Promise<void> {
  if (db instanceof PgDb) await db.end();
}

/** Env with the raw `DB` binding resolved into a request-scoped `Db`. */
export type RuntimeEnv<T extends { DB: PgDatabaseBinding | Db }> = Omit<T, "DB"> & { DB: Db };

/** Wrap an env so downstream route code sees `env.DB: Db` (fresh per call). */
export function withDbEnv<T extends { DB: PgDatabaseBinding | Db }>(env: T): RuntimeEnv<T> {
  return { ...env, DB: dbOf(env) } as RuntimeEnv<T>;
}

/** Prefixed random record id (e.g. `lst_aBc...`) — non-guessable. */
export function newId(prefix: string, randomToken: (byteLength?: number) => string): string {
  return `${prefix}_${randomToken(16)}`;
}

export function rowString(row: Record<string, unknown>, column: string): string {
  const value = row[column];
  if (typeof value !== "string") throw new Error(`column ${column} missing`);
  return value;
}

export function rowOptionalString(row: Record<string, unknown>, column: string): string | null {
  const value = row[column];
  return typeof value === "string" ? value : null;
}

export function rowNumber(row: Record<string, unknown>, column: string): number {
  const value = row[column];
  if (typeof value !== "number") throw new Error(`column ${column} missing`);
  return value;
}

export function rowOptionalNumber(row: Record<string, unknown>, column: string): number | null {
  const value = row[column];
  return typeof value === "number" ? value : null;
}

export function rowJson<T>(row: Record<string, unknown>, column: string): T {
  const raw = rowString(row, column);
  return JSON.parse(raw) as T;
}

/** Settings: admin-managed JSON values (operational data, not secrets). */
export async function getSetting<T>(db: Db, key: string, fallback: T): Promise<T> {
  const row = await db
    .prepare("SELECT value_json FROM network_settings WHERE key = ?")
    .bind(key)
    .first<Record<string, unknown>>();
  if (!row) return fallback;
  return JSON.parse(rowString(row, "value_json")) as T;
}

export async function putSetting(
  db: Db,
  key: string,
  value: unknown,
  updatedBy: string,
  now: number,
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO network_settings (key, value_json, updated_at, updated_by) VALUES (?, ?, ?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
    )
    .bind(key, JSON.stringify(value), now, updatedBy)
    .run();
}

/**
 * Recipient/customer disclosure gate (master prompt Phase 5 item 9):
 * detailed recipient phone/address are BLOCKED for drivers by default until
 * the owner/legal consent decision (EX-O14) is recorded. Admin can flip the
 * gate as a documented owner action; default is "blocked".
 */
export interface DisclosureSettings {
  recipient_details_to_driver: "blocked" | "allowed_after_acceptance";
}

export const DEFAULT_DISCLOSURE: DisclosureSettings = { recipient_details_to_driver: "blocked" };

export async function getDisclosureSettings(db: Db): Promise<DisclosureSettings> {
  return getSetting<DisclosureSettings>(db, "disclosure.recipient", DEFAULT_DISCLOSURE);
}

/**
 * Global module kill-switch (F-25, S12 scan — operational recovery during an
 * incident): the admin can disable market/delivery BUSINESS ACTIONS globally
 * through the allowlisted settings (`market.enabled` / `delivery.enabled`).
 * The flags never hide the shared shell entry points (EX-D19) — the action
 * fails closed server-side with an honest state, and the client renders that
 * state. Absence of a setting means ENABLED (the default posture); the
 * switch exists to be turned OFF deliberately during an incident.
 */
export interface GlobalModuleFlags {
  market_enabled?: boolean;
  delivery_enabled?: boolean;
}

export async function isGlobalModuleEnabled(db: Db, module: "market" | "delivery"): Promise<boolean> {
  const key = module === "market" ? "market.enabled" : "delivery.enabled";
  const flags = await getSetting<GlobalModuleFlags>(db, key, {});
  return module === "market" ? flags.market_enabled !== false : flags.delivery_enabled !== false;
}
