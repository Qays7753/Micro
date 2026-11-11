/**
 * Command decorator: central CSRF enforcement is done at the entry point;
 * this wrapper adds Idempotency-Key handling for state-changing commands.
 * Retries carrying the same key + same body replay the stored response —
 * never duplicating state. A different body with the same key is a 409.
 */

import { hashRequest, lookupIdempotent, storeIdempotent } from "./idempotency.ts";
import type { RouteContext, RouteHandler } from "./router.ts";

export function command(seed: string, handler: RouteHandler): RouteHandler {
  return async (ctx: RouteContext): Promise<Response> => {
    const key = readIdempotencyKeyHeader(ctx.request);
    if (key === null) return handler(ctx);
    const bodyText = await ctx.request.clone().text();
    const requestHash = await hashRequest(ctx.url.pathname, ctx.request.method, bodyText);
    const stored = await lookupIdempotent(ctx.env.DB, { key }, requestHash, Date.now());
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
    const response = await handler(ctx);
    if (response.status < 500) {
      await storeIdempotent(ctx.env.DB, { key }, requestHash, response, Date.now());
    }
    return response;
  };
}

function readIdempotencyKeyHeader(request: Request): string | null {
  const header = request.headers.get("idempotency-key");
  if (header === null || header.length === 0 || header.length > 128) return null;
  return header;
}
