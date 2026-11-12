/**
 * Command idempotency (contract 21 §6): retries with the same
 * `Idempotency-Key` and the same request body replay the stored response and
 * never duplicate state. Same key with a different body is a 409 conflict.
 */

import { sha256Hex } from "./crypto.ts";
import { HttpError, type ApiResult } from "./http.ts";
import type { Db } from "./db/d1.ts";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

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

export async function lookupIdempotent(
  db: Db,
  key: IdempotencyKey,
  requestHash: string,
  now: number,
): Promise<StoredResponse | null> {
  const row = await db
    .prepare("SELECT request_hash, response_status, response_body, created_at FROM idempotency WHERE key = ?")
    .bind(key.key)
    .first<Record<string, unknown>>();
  if (!row) return null;
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
  // the command forever (Reviewer 5, 2026-11-12).
  await db
    .prepare(
      "INSERT INTO idempotency (key, request_hash, response_status, response_body, created_at) VALUES (?, ?, ?, ?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET request_hash = excluded.request_hash, response_status = excluded.response_status, " +
        "response_body = excluded.response_body, created_at = excluded.created_at",
    )
    .bind(key.key, requestHash, response.status, body, now)
    .run();
}
