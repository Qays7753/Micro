/**
 * CSRF/origin protection for mutating API calls.
 * Two independent checks (defense in depth, no cookie-token pairing needed):
 *  1. Origin header must match the serving origin when present (same-origin).
 *  2. A non-standard custom header `x-micro-api: 1` is required — cross-site
 *     forms/links cannot attach custom headers without a CORS preflight that
 *     this API never grants.
 */

import { HttpError } from "../http.ts";

export const API_HEADER = "x-micro-api";

export function isMutatingMethod(method: string): boolean {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

/** Returns the origin the request was served on (`https://host` or http for local dev). */
export function servingOrigin(url: URL): string {
  return `${url.protocol}//${url.host}`;
}

/** Internal-path safety mirroring the client contract-26 rule (no open redirect). */
export function isSafeInternalPath(value: string | null): boolean {
  if (!value || !value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.includes("://")) return false;
  if (/[\u0000-\u001f]/.test(value)) return false;
  return true;
}

/** Enforce CSRF/origin rules for mutating requests. Throws HttpError(403). */
export function assertSameOrigin(request: Request, url: URL): void {
  if (!isMutatingMethod(request.method)) return;
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== servingOrigin(url)) {
    throw new HttpError(403, "forbidden", { reason: "origin_mismatch" });
  }
  if (request.headers.get("x-micro-api") !== "1") {
    throw new HttpError(403, "forbidden", { reason: "missing_api_header" });
  }
}
