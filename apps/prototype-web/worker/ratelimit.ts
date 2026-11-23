/**
 * Rate/abuse controls at the server boundary (D1 fixed-window counters).
 * Numeric limits are ENGINEERING REFERENCES from the approved specs
 * (10 submissions/entity/day, 60 images/day, 5 reports/account/day) —
 * configurable via network_settings, and the final pilot values remain an
 * owner action (EX-O16). Counters are atomic via UPSERT increments.
 */

import { sha256Hex } from "./crypto.ts";
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
  /** API-01 (Post-Group 6 — order bd242b3e): public quantity-check requests
   * per minute per IP (engineering reference; the pilot value stays an owner
   * action, EX-O16). */
  quantityChecksPerMinute?: number;
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
  void cleanupExpiredWindows(db, now);
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
 * SRV-06 (Post-Group 6 — order bd242b3e): the rate keys never store the raw
 * IP — the connecting address is salted only by its SHA-256 prefix before it
 * becomes part of a bucket key (data minimization; the raw address is not
 * needed for counting and the hash keeps distinct IPs distinct).
 */
export async function ipBucketKey(request: Request): Promise<string> {
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  return (await sha256Hex(ip)).slice(0, 24);
}

/** SRV-06: retention of rate_counter rows — windows older than this are dead
 * (their buckets embed the window number) and are cleaned opportunistically. */
const RATE_RETENTION_MS = 24 * 60 * 60 * 1000;

/** Opportunistic cleanup (SRV-06): a bounded probabilistic delete of expired
 * windows, amortized over enforcing traffic — no unbounded table growth and
 * no raw-IP retention beyond the live window. */
async function cleanupExpiredWindows(db: Db, now: number): Promise<void> {
  if (Math.random() >= 0.02) return;
  await db
    .prepare("DELETE FROM rate_counter WHERE window_start < ?")
    .bind(now - RATE_RETENTION_MS)
    .run();
}

/**
 * Guest (unauthenticated) read limiter: fixed window per connecting IP.
 * Cloudflare always sets `CF-Connecting-IP` in production; without it (local
 * emulation) all callers share one bucket — still bounded, never bypassed.
 */
export async function enforceGuestReadLimit(db: Db, request: Request, now: number): Promise<void> {
  const ipKey = await ipBucketKey(request);
  const limits = await rateLimits(db);
  await enforceRate(db, minuteBucket("guest-read", ipKey, now), limits.guestReadsPerMinute, MINUTE_MS, now);
}

/** API-01 (Post-Group 6 — order bd242b3e): the public quantity-check path is
 * rate-limited per connecting IP (hashed key — SRV-06) like every public
 * read; the limit is an engineering reference (default 60/minute). */
export async function enforceQuantityCheckLimit(db: Db, request: Request, now: number): Promise<void> {
  const ipKey = await ipBucketKey(request);
  const limits = await rateLimits(db);
  await enforceRate(
    db,
    minuteBucket("quantity-check", ipKey, now),
    limits.quantityChecksPerMinute ?? 60,
    MINUTE_MS,
    now,
  );
}
