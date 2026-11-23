/**
 * Command decorator: central CSRF enforcement is done at the entry point;
 * this wrapper adds Idempotency-Key handling for state-changing commands.
 * Retries carrying the same key + same body replay the stored response —
 * never duplicating state. A different body with the same key is a 409.
 *
 * SRV-03 (Post-Group 6 Wave 3 / DOC-041): `requireIdempotencyKey: true`
 * marks a CONSEQUENTIAL creation (e.g. booking creation): the key becomes
 * mandatory and is RESERVED atomically before the handler runs — a duplicate
 * in-flight request gets 409 `idempotency_key_in_progress` instead of a
 * second execution (reserve → execute → store; see idempotency.ts).
 */

import { hashRequest, lookupIdempotent, reserveIdempotent, storeIdempotent } from "./idempotency.ts";
import { sha256Hex } from "./crypto.ts";
import { errorResponse } from "./http.ts";
import type { RouteContext, RouteHandler } from "./router.ts";

export interface CommandOptions {
  /** SRV-03: reject the request outright when no Idempotency-Key header is
   * present, and reserve the key atomically before executing. */
  requireIdempotencyKey?: boolean;
}

export function command(seed: string, handler: RouteHandler, options: CommandOptions = {}): RouteHandler {
  void seed;
  return async (ctx: RouteContext): Promise<Response> => {
    const key = readIdempotencyKeyHeader(ctx.request);
    if (key === null) {
      if (options.requireIdempotencyKey === true) {
        return errorResponse("bad_request", 400, { reason: "idempotency_key_required" });
      }
      return handler(ctx);
    }
    // Scope the key to the caller's session so identical header values from
    // different accounts can never replay each other's responses.
    const sessionToken = readSessionCookie(ctx.request);
    const scopedKey = `${key}:${sessionToken === null ? "anon" : await sha256Hex(sessionToken)}`;
    const bodyText = await ctx.request.clone().text();
    const requestHash = await hashRequest(
      `${ctx.url.pathname}${ctx.url.search}`,
      ctx.request.method,
      bodyText,
    );
    if (options.requireIdempotencyKey === true) {
      // SRV-03: reserve BEFORE executing — a concurrent duplicate fails fast.
      const reservation = await reserveIdempotent(ctx.env.DB, { key: scopedKey }, requestHash, Date.now());
      if (reservation.kind === "replay") {
        return replayResponse(reservation.stored);
      }
      if (reservation.kind === "in_progress") {
        return errorResponse("conflict", 409, { reason: "idempotency_key_in_progress" });
      }
      let response: Response;
      try {
        response = await handler(ctx);
      } catch (error) {
        // A failed execution never stores its response; the reservation is
        // left to expire so an honest retry with the same key re-executes.
        throw error;
      }
      if (shouldStore(response)) {
        await storeIdempotent(ctx.env.DB, { key: scopedKey }, requestHash, response, Date.now());
      }
      return response;
    }
    const stored = await lookupIdempotent(ctx.env.DB, { key: scopedKey }, requestHash, Date.now());
    if (stored !== null) {
      return replayResponse(stored);
    }
    let response: Response;
    try {
      response = await handler(ctx);
    } catch (error) {
      // Thrown errors are never stored: a fixed retry with the same key must
      // re-execute (the stored-replay path is for completed responses only).
      throw error;
    }
    // Responses that carry a Set-Cookie (session changes) are never replayed.
    // Phase F (reviewer 3): 401 responses are never stored either — a replayed
    // unauthenticated response is worthless to the caller, and skipping the
    // store closes the unbounded anonymous idempotency-row write vector (the
    // caller must authenticate and retry, which stores under its own session).
    if (shouldStore(response)) {
      await storeIdempotent(ctx.env.DB, { key: scopedKey }, requestHash, response, Date.now());
    }
    return response;
  };
}

function shouldStore(response: Response): boolean {
  return response.status < 500 && response.status !== 401 && !response.headers.has("set-cookie");
}

function replayResponse(stored: { status: number; body: string }): Response {
  return new Response(stored.body, {
    status: stored.status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-idempotent-replay": "1",
    },
  });
}

function readIdempotencyKeyHeader(request: Request): string | null {
  const header = request.headers.get("idempotency-key");
  if (header === null || header.length === 0 || header.length > 128) return null;
  return header;
}

function readSessionCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (header === null) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    if (part.slice(0, eq).trim() === "micro_session") return part.slice(eq + 1).trim();
  }
  return null;
}
