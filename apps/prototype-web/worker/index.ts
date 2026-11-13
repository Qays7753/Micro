/**
 * Micro network worker entry (Cloudflare Pages advanced mode `_worker.js`).
 *
 * EX-D18: same-origin BFF compatible with Pages Functions/Workers, deployed
 * from the repository's actual build output (`apps/prototype-web/dist/public`).
 * The worker owns: `/api/*` routing, static-asset serving with SPA fallback,
 * and the security headers (the `_headers`/`_redirects` conventions are
 * re-applied here deterministically because advanced mode bypasses them).
 */

import { assertSameOrigin } from "./auth/csrf.ts";
import type { Env } from "./env.ts";
import { errorResponse, jsonResponse } from "./http.ts";
import { processDueReminders } from "./api/reminders.ts";
import type { RouteContext } from "./router.ts";
import { buildRouter } from "./routes.ts";
import { endDb, withDbEnv } from "./db/db.ts";

/** Mirror of `client/public/_headers` (advanced mode bypasses the file). */
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; " +
  "img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'";

const NO_CACHE_PATHS = new Set(["/sw.js", "/registerSW.js", "/manifest.webmanifest"]);

function applyStaticHeaders(response: Response, url: URL): Response {
  const headers = new Headers(response.headers);
  if (!headers.has("content-security-policy")) headers.set("content-security-policy", CSP);
  if (!headers.has("x-content-type-options")) headers.set("x-content-type-options", "nosniff");
  if (!headers.has("service-worker-allowed")) headers.set("service-worker-allowed", "/");
  if (NO_CACHE_PATHS.has(url.pathname)) headers.set("cache-control", "no-cache, no-store, must-revalidate");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function isNavigationRequest(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const accept = request.headers.get("sec-fetch-dest") ?? request.headers.get("accept") ?? "";
  return accept.includes("document") || accept.includes("text/html");
}

/** Serve the SPA: asset first, `/index.html` fallback for navigations. */
async function serveStatic(request: Request, url: URL, env: Env): Promise<Response> {
  const direct = await env.ASSETS.fetch(request);
  if (direct.status !== 404) return applyStaticHeaders(direct, url);
  if (isNavigationRequest(request)) {
    const indexRequest = new Request(new URL("/index.html", url.origin), { method: "GET" });
    const indexResponse = await env.ASSETS.fetch(indexRequest);
    if (indexResponse.status !== 404) {
      return applyStaticHeaders(
        new Response(indexResponse.body, { status: 200, headers: indexResponse.headers }),
        url,
      );
    }
  }
  return applyStaticHeaders(direct, url);
}

const router = buildRouter();

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      if (!env.DB || !env.MEDIA) return errorResponse("network_not_configured", 503);
      const ctx: RouteContext = { request, url, params: {}, env: withDbEnv(env) };
      try {
        assertSameOrigin(request, url);
      } catch (error) {
        await endDb(ctx.env.DB);
        return errorResponse("forbidden", 403, (error as { details?: unknown }).details);
      }
      try {
        return await router.dispatch(ctx);
      } finally {
        // Request-scoped PostgreSQL client: close its socket before the
        // request context ends (workerd forbids cross-request I/O reuse).
        await endDb(ctx.env.DB);
      }
    }
    if (url.pathname === "/api") return jsonResponse({ api: "micro-network/1" });
    return serveStatic(request, url, env);
  },

  /** In-app reminders due-processing (contract 19 §9). Enabled repository-side;
   * the trigger itself is an owner/Manus Cloudflare setup step (Cron Trigger
   * on the Pages project — see worker/README.md), with the admin endpoint
   * POST /api/admin/reminders/due as the manual fallback. Idempotent; never
   * transitions product state (no auto-close ever). */
  async scheduled(_controller: unknown, env: Env, _ctx: unknown): Promise<void> {
    if (!env.DB) return;
    const db = withDbEnv(env).DB;
    try {
      await processDueReminders(db, Date.now());
    } finally {
      await endDb(db);
    }
  },
} satisfies {
  fetch(request: Request, env: Env): Promise<Response>;
  scheduled(controller: unknown, env: Env, ctx: unknown): Promise<void>;
};

export { router as apiRouter };
