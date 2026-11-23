/**
 * Command idempotency (contract 21 §6): retries with the same
 * `Idempotency-Key` and the same request body replay the stored response and
 * never duplicate state. Same key with a different body is a 409 conflict.
 *
 * SRV-03 (Post-Group 6 Wave 3 / DOC-041): the key can be RESERVED
 * atomically BEFORE the handler runs. A reserved-but-not-stored row
 * (response_status = 0) makes a concurrent duplicate request fail fast with
 * `idempotency_key_in_progress` instead of double-executing the command —
 * the reserve → execute → store chain closes the lookup/execute/store race
 * the security audit found. A reservation older than RESERVATION_TTL_MS
 * (a crashed worker never stored its response) is honestly taken over.
 */

import { sha256Hex } from "./crypto.ts";
import { HttpError, type ApiResult } from "./http.ts";
import type { Db } from "./db/db.ts";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/** An in-flight reservation older than this is presumed dead (worker crash
 * between execute and store) and may be taken over — 5 minutes. */
export const RESERVATION_TTL_MS = 5 * 60 * 1000;

/** The response_status sentinel marking a RESERVED (in-flight) row. */
const RESERVED_STATUS = 0;

export interface IdempotencyKey {
  key: string;
}

export async function hashRequest(path: string, method: string, bodyText: string): Promise<string> {
  return sha256Hex(`${method} ${path}\n${bodyText}`);
}

export interface StoredResponse {
  status: number;
  body: string;
}

export type ReservationOutcome =
  { kind: "reserved" } | { kind: "replay"; stored: StoredResponse } | { kind: "in_progress" };

/**
 * Atomically reserve the key for this request hash (SRV-03). Returns:
 * - `reserved`  — this caller owns the key and must execute then store;
 * - `replay`    — a completed stored response exists (same body): return it;
 * - `in_progress` — another request with the SAME key and body is executing
 *   right now: the caller must answer 409 `idempotency_key_in_progress`.
 * A different body under the same key is a 409 (existing contract §6 rule).
 */
export async function reserveIdempotent(
  db: Db,
  key: IdempotencyKey,
  requestHash: string,
  now: number,
): Promise<ReservationOutcome> {
  const existing = await readRow(db, key);
  if (existing !== null) {
    if (Number(existing.response_status) === RESERVED_STATUS) {
      const reservedAt = existing.reserved_at === null ? 0 : Number(existing.reserved_at);
      if (now - reservedAt <= RESERVATION_TTL_MS) return { kind: "in_progress" };
      // Dead reservation (crashed worker): take it over honestly.
      await db
        .prepare(
          "UPDATE idempotency SET request_hash = ?, reserved_at = ?, created_at = ? WHERE key = ? AND response_status = 0",
        )
        .bind(requestHash, now, now, key.key)
        .run();
      return { kind: "reserved" };
    }
    if (Number(existing.created_at) + IDEMPOTENCY_TTL_MS <= now) {
      // Expired — treat as fresh and re-reserve below.
      await db
        .prepare("DELETE FROM idempotency WHERE key = ? AND created_at = ?")
        .bind(key.key, existing.created_at)
        .run();
    } else {
      if (String(existing.request_hash) !== requestHash) {
        throw new HttpError(409, "conflict", { reason: "idempotency_key_reused_with_different_body" });
      }
      return {
        kind: "replay",
        stored: { status: Number(existing.response_status), body: String(existing.response_body) },
      };
    }
  }
  // The race-safe reserve: an INSERT that wins is the single owner; a unique
  // violation means a concurrent request reserved first — re-read it.
  try {
    await db
      .prepare(
        "INSERT INTO idempotency (key, request_hash, response_status, response_body, created_at, reserved_at) VALUES (?, ?, 0, '', ?, ?)",
      )
      .bind(key.key, requestHash, now, now)
      .run();
    return { kind: "reserved" };
  } catch {
    const raced = await readRow(db, key);
    if (raced !== null && String(raced.request_hash) !== requestHash) {
      throw new HttpError(409, "conflict", { reason: "idempotency_key_reused_with_different_body" });
    }
    return { kind: "in_progress" };
  }
}

async function readRow(db: Db, key: IdempotencyKey): Promise<Record<string, unknown> | null> {
  return db
    .prepare(
      "SELECT request_hash, response_status, response_body, created_at, reserved_at FROM idempotency WHERE key = ?",
    )
    .bind(key.key)
    .first<Record<string, unknown>>();
}

export async function lookupIdempotent(
  db: Db,
  key: IdempotencyKey,
  requestHash: string,
  now: number,
): Promise<StoredResponse | null> {
  const row = await readRow(db, key);
  if (!row) return null;
  if (Number(row.response_status) === RESERVED_STATUS) return null; // in flight — not replayable
  if (Number(row.created_at) + IDEMPOTENCY_TTL_MS <= now) return null; // expired — treat as fresh
  if (String(row.request_hash) !== requestHash) {
    throw new HttpError(409, "conflict", { reason: "idempotency_key_reused_with_different_body" });
  }
  return { status: Number(row.response_status), body: String(row.response_body) };
}

export async function storeIdempotent(
  db: Db,
  key: IdempotencyKey,
  requestHash: string,
  response: ApiResult,
  now: number,
): Promise<void> {
  const body = await response.clone().text();
  // Upsert (not INSERT OR IGNORE): after the TTL expires the same key must be
  // able to store a FRESH response, otherwise every later retry re-executes
  // the command forever (Reviewer 5, 2026-11-12). The upsert also completes a
  // reservation in place (SRV-03: reserve → execute → store).
  await db
    .prepare(
      "INSERT INTO idempotency (key, request_hash, response_status, response_body, created_at, reserved_at) VALUES (?, ?, ?, ?, ?, NULL) " +
        "ON CONFLICT(key) DO UPDATE SET request_hash = excluded.request_hash, response_status = excluded.response_status, " +
        "response_body = excluded.response_body, created_at = excluded.created_at, reserved_at = NULL",
    )
    .bind(key.key, requestHash, response.status, body, now)
    .run();
}
