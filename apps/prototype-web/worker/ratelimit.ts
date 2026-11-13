/**
 * Rate/abuse controls at the server boundary (D1 fixed-window counters).
 * Numeric limits are ENGINEERING REFERENCES from the approved specs
 * (10 submissions/entity/day, 60 images/day, 5 reports/account/day) —
 * configurable via network_settings, and the final pilot values remain an
 * owner action (EX-O16). Counters are atomic via UPSERT increments.
 */

import { HttpError } from "./http.ts";
import { getSetting, type Db } from "./db/db.ts";

export interface RateLimits {
  submissionsPerDay: number;
  imagesPerDay: number;
  reportsPerDay: number;
  /** Guest browse requests per minute per identity/IP bucket. */
  guestReadsPerMinute: number;
  /** Sign-in flow starts per minute per IP (engineering reference). */
  authStartsPerMinute?: number;
}

export const DEFAULT_RATE_LIMITS: RateLimits = {
  submissionsPerDay: 10,
  imagesPerDay: 60,
  reportsPerDay: 5,
  guestReadsPerMinute: 120,
};

export async function rateLimits(db: Db): Promise<RateLimits> {
  return getSetting<RateLimits>(db, "rate.limits", DEFAULT_RATE_LIMITS);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

function windowStart(now: number, windowMs: number): number {
  return Math.floor(now / windowMs) * windowMs;
}

export interface RateDecision {
  allowed: boolean;
  remaining: number;
}

/**
 * Consume one unit from a fixed window. Uses a single atomic UPSERT so two
 * concurrent requests cannot both read the same count.
 */
export async function consumeRate(
  db: Db,
  bucket: string,
  limit: number,
  windowMs: number,
  now: number,
): Promise<RateDecision> {
  const start = windowStart(now, windowMs);
  const row = await db
    .prepare(
      "INSERT INTO rate_counter (bucket, window_start, count) VALUES (?, ?, 1) " +
        "ON CONFLICT(bucket) DO UPDATE SET " +
        "count = CASE WHEN rate_counter.window_start = excluded.window_start THEN rate_counter.count + 1 ELSE 1 END, " +
        "window_start = excluded.window_start RETURNING count",
    )
    .bind(bucket, start)
    .first<Record<string, unknown>>();
  const count = Number(row?.count ?? 1);
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}

/** Raise a standard 429 when the limit is exceeded. */
export async function enforceRate(
  db: Db,
  bucket: string,
  limit: number,
  windowMs: number,
  now: number,
): Promise<void> {
  const decision = await consumeRate(db, bucket, limit, windowMs, now);
  if (!decision.allowed) {
    throw new HttpError(429, "too_many_requests", { retryAfterMs: windowMs });
  }
}

export function dailyBucket(kind: string, identityId: string, now: number): string {
  return `${kind}:${identityId}:${Math.floor(now / DAY_MS)}`;
}

export function minuteBucket(kind: string, key: string, now: number): string {
  return `${kind}:${key}:${Math.floor(now / MINUTE_MS)}`;
}

/**
 * Guest (unauthenticated) read limiter: fixed window per connecting IP.
 * Cloudflare always sets `CF-Connecting-IP` in production; without it (local
 * emulation) all callers share one bucket — still bounded, never bypassed.
 */
export async function enforceGuestReadLimit(db: Db, request: Request, now: number): Promise<void> {
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  const limits = await rateLimits(db);
  await enforceRate(db, minuteBucket("guest-read", ip, now), limits.guestReadsPerMinute, MINUTE_MS, now);
}
