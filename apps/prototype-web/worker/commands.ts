/**
 * Command decorator: central CSRF enforcement is done at the entry point;
 * this wrapper adds Idempotency-Key handling for state-changing commands.
 * Retries carrying the same key + same body replay the stored response —
 * never duplicating state. A different body with the same key is a 409.
 */

import { hashRequest, lookupIdempotent, storeIdempotent } from "./idempotency.ts";
import { sha256Hex } from "./crypto.ts";
import type { RouteContext, RouteHandler } from "./router.ts";

export function command(seed: string, handler: RouteHandler): RouteHandler {
  return async (ctx: RouteContext): Promise<Response> => {
    const key = readIdempotencyKeyHeader(ctx.request);
    if (key === null) return handler(ctx);
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
    const stored = await lookupIdempotent(ctx.env.DB, { key: scopedKey }, requestHash, Date.now());
    if (stored !== null) {
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
    if (response.status < 500 && response.status !== 401 && !response.headers.has("set-cookie")) {
      await storeIdempotent(ctx.env.DB, { key: scopedKey }, requestHash, response, Date.now());
    }
    return response;
  };
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
