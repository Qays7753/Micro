/**
 * Worker environment bindings (Cloudflare Pages advanced-mode `_worker.js`).
 *
 * EX-D18 (2026-11-12): Cloudflare Pages + Pages Functions/Workers-compatible
 * BFF within the same deployment; D1 for Market/Delivery network data; R2 for
 * private images/driver evidence; Google sign-in through Micro identity.
 *
 * Binding/secret NAMES are part of the owner/Manus setup contract — no values
 * live in this repository. Structural types are declared here (no
 * @cloudflare/workers-types dependency) covering exactly the surface used.
 */

/** Minimal D1 structural types (subset used by the worker). */
export interface D1ResultRow {
  [column: string]: unknown;
}

/** D1 result metadata (real API): `changes` is the affected-row count. */
export interface D1Meta {
  changes: number;
  duration: number;
  last_row_id: number;
  rows_read: number;
  rows_written: number;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = D1ResultRow>(colName?: string): Promise<T | null>;
  all<T = D1ResultRow>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; meta: D1Meta }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<Array<{ results: T[]; meta: D1Meta }>>;
  exec(sql: string): Promise<{ count: number }>;
}

/** Minimal R2 structural types (subset used by the worker). */
export interface R2ObjectBody {
  body: ReadableStream;
  readonly size: number;
}

export interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer | ReadableStream | string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
}

/** Pages-provided static asset fetcher (advanced mode `_worker.js`). */
export interface AssetFetcher {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}

/** Outbound fetcher for Google token exchange. In production this is a plain
 * `fetch` unless a `GOOGLE` service binding is configured (a Cloudflare
 * best practice); tests supply the binding. */
export type OutboundFetcher = AssetFetcher;

export interface Env {
  /** D1 database binding — Market/Delivery network data ONLY (EX-D18). */
  DB: D1Database;
  /** Private R2 bucket binding — images + driver evidence. Never public. */
  MEDIA: R2Bucket;
  /** Cloudflare Pages static assets (provided by the platform). */
  ASSETS: AssetFetcher;
  /** Google OAuth client id (plain var; not secret). */
  GOOGLE_CLIENT_ID?: string;
  /** Google OAuth client secret (Cloudflare secret storage only). */
  GOOGLE_CLIENT_SECRET?: string;
  /** One-time first owner/admin bootstrap email (Cloudflare var/secret). */
  BOOTSTRAP_OWNER_EMAIL?: string;
  /** Optional service binding used for Google token exchange (tests/ops). */
  GOOGLE?: OutboundFetcher;
}

export const DB_BINDING_NAME = "DB";
export const MEDIA_BINDING_NAME = "MEDIA";

/** Required bindings for the API to operate (health reporting). */
export function apiBindingsConfigured(env: Env): boolean {
  return Boolean(env.DB && env.MEDIA);
}

/** Google OAuth endpoints (fixed, no client-side discovery). */
export const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** Accepted Google issuer values per OIDC discovery document. */
export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"] as const;

/** Session lifetime: 7 days (engineering default, configurable via settings). */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** OAuth flow lifetime: 10 minutes. */
export const OAUTH_FLOW_TTL_MS = 10 * 60 * 1000;

/** Driver reply window (OD07): 30 minutes — engineering default. */
export const DRIVER_RESPONSE_WINDOW_MS = 30 * 60 * 1000;

/** Pickup/delivery baseline waits (OD07): 10 minutes each. */
export const BASELINE_WAIT_MS = 10 * 60 * 1000;

/** Requester confirmation reminder (contract 21 §3.2-5): 24h — operational. */
export const CONFIRMATION_REMINDER_MS = 24 * 60 * 60 * 1000;

/** Evidence expiry reminder suggestion (OD31): 7 days — operational only. */
export const EVIDENCE_REMINDER_MS = 7 * 24 * 60 * 60 * 1000;

/** Listing freshness (OD-11): reminder after 30 days, hide after 60 days. */
export const LISTING_FRESHNESS_REMINDER_MS = 30 * 24 * 60 * 60 * 1000;
export const LISTING_FRESHNESS_HIDE_MS = 60 * 24 * 60 * 60 * 1000;

/** Allowed media content types for upload (market images + driver evidence). */
export const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Maximum upload size: 5 MB (engineering default). */
export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

/** Maximum media objects per listing draft (spec §5.1: 1..6). */
export const MAX_LISTING_MEDIA = 6;
