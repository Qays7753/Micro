/**
 * D1 helpers: typed row access, ID generation, and settings access.
 * All queries go through prepared statements; cross-entity state changes use
 * `batch` (D1's atomic transaction surface) so failures never leave partial
 * state.
 */

import type { D1Database, D1Meta, D1PreparedStatement, D1ResultRow } from "../env.ts";

export interface Db {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<Array<{ results: D1ResultRow[]; meta: D1Meta }>>;
}

export function dbOf(env: { DB: D1Database }): Db {
  return env.DB;
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
