/**
 * Micro network worker entry (Cloudflare Pages advanced mode `_worker.js`).
 *
 * EX-D18: same-origin BFF compatible with Pages Functions/Workers, deployed
 * from the repository's actual build output (`apps/prototype-web/dist/public`).
 * The worker owns: `/api/*` routing, static-asset serving with SPA fallback,
 * and the security headers (the `_headers`/`_redirects` conventions are
 * re-applied here deterministically because advanced mode bypasses them).
 */

import { authenticate, googleCallback, googleStart, health, sessionInfo, signOut } from "./api/auth.ts";
import {
  browseListings,
  checkQuantity,
  createListingDraft,
  attachListingMedia,
  confirmAvailability,
  listingDetail,
  marketMeta,
  reportListing,
  saveVendorProfile,
  submitListing,
  submitVendorProfile,
  toggleSavedListing,
  updateListingDraft,
  vendorListingLifecycle,
  vendorOverview,
} from "./api/market.ts";
import { reviewListing, reviewMedia, reviewProfile, reviewQueue } from "./api/marketReview.ts";
import { readMedia, removeMedia, uploadMedia } from "./api/media.ts";
import { listMyNotifications, markNotificationsRead } from "./api/system.ts";
import { assertSameOrigin } from "./auth/csrf.ts";
import type { AuthenticatedContext } from "./auth/session.ts";
import { command } from "./commands.ts";
import type { Env } from "./env.ts";
import { errorResponse, jsonResponse } from "./http.ts";
import { ApiRouter, type RouteContext, type RouteHandler } from "./router.ts";

/** Mirror of `client/public/_headers` (advanced mode bypasses the file). */
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; " +
  "img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'";

const NO_CACHE_PATHS = new Set(["/sw.js", "/registerSW.js", "/manifest.webmanifest"]);

function applyStaticHeaders(response: Response, url: URL): Response {
  const headers = new Headers(response.headers);
  if (!headers.has("content-security-policy")) headers.set("content-security-policy", CSP);
  if (!headers.has("x-content-type-options")) headers.set("x-content-type-options", "nosniff");
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

function buildRouter(): ApiRouter {
  const router = new ApiRouter();
  router.get("api/health", ctx => health(ctx.env));
  router.get("api/auth/session", async ctx => sessionInfo(ctx.env.DB, ctx.request));
  router.get("api/auth/google/start", async ctx => googleStart(ctx.env.DB, ctx.env, ctx.url));
  router.get("api/auth/google/callback", async ctx => googleCallback(ctx.env.DB, ctx.env, ctx.url));
  router.post(
    "api/auth/signout",
    command("signout", async ctx => signOut(ctx.env.DB, ctx)),
  );
  router.post(
    "api/media",
    command("media-upload", async ctx => {
      const auth = await authenticate(ctx.env.DB, ctx.request);
      if (!auth) return errorResponse("unauthorized", 401);
      return uploadMedia(ctx, auth);
    }),
  );
  router.get("api/media/:id", async ctx => readMedia(ctx, await authenticate(ctx.env.DB, ctx.request)));
  router.delete(
    "api/media/:id",
    command("media-delete", async ctx => {
      const auth = await authenticate(ctx.env.DB, ctx.request);
      if (!auth) return errorResponse("unauthorized", 401);
      return removeMedia(ctx, auth);
    }),
  );
  router.get("api/notifications", async ctx => {
    const auth = await authenticate(ctx.env.DB, ctx.request);
    if (!auth) return errorResponse("unauthorized", 401);
    return listMyNotifications(ctx.env.DB, auth);
  });
  router.post(
    "api/notifications/read",
    command("notifications-read", async ctx => {
      const auth = await authenticate(ctx.env.DB, ctx.request);
      if (!auth) return errorResponse("unauthorized", 401);
      return markNotificationsRead(ctx.env.DB, ctx, auth);
    }),
  );
  registerMarketRoutes(router);
  return router;
}

/** Resolve the session then run the handler with it (uniform auth guard). */
function withAuth(
  ctx: RouteContext,
  handler: (auth: AuthenticatedContext) => Promise<Response>,
): Promise<Response> {
  return (async () => {
    const auth = await authenticate(ctx.env.DB, ctx.request);
    if (!auth) return errorResponse("unauthorized", 401);
    return handler(auth);
  })();
}

function registerMarketRoutes(router: ApiRouter): void {
  router.get("api/market/listings", ctx => browseListings(ctx));
  router.get("api/market/listings/:id", ctx => listingDetail(ctx));
  router.get("api/market/meta", ctx => marketMeta(ctx));
  router.post(
    "api/market/quantity-check",
    command("market-quantity-check", ctx => checkQuantity(ctx)),
  );
  const authed =
    (handler: (ctx: RouteContext, auth: AuthenticatedContext) => Promise<Response>): RouteHandler =>
    async (ctx: RouteContext) =>
      withAuth(ctx, auth => handler(ctx, auth));
  router.get(
    "api/market/vendor/overview",
    authed((ctx, auth) => vendorOverview(ctx, auth)),
  );
  router.post(
    "api/market/vendor/profile",
    command(
      "vendor-profile-save",
      authed((ctx, auth) => saveVendorProfile(ctx, auth)),
    ),
  );
  router.post(
    "api/market/vendor/profile/submit",
    command(
      "vendor-profile-submit",
      authed((ctx, auth) => submitVendorProfile(ctx, auth)),
    ),
  );
  router.post(
    "api/market/vendor/listings",
    command(
      "listing-create",
      authed((ctx, auth) => createListingDraft(ctx, auth)),
    ),
  );
  router.post(
    "api/market/vendor/listings/:id",
    command(
      "listing-update",
      authed((ctx, auth) => updateListingDraft(ctx, auth)),
    ),
  );
  router.post(
    "api/market/vendor/listings/:id/submit",
    command(
      "listing-submit",
      authed((ctx, auth) => submitListing(ctx, auth)),
    ),
  );
  router.post(
    "api/market/vendor/listings/:id/confirm-availability",
    command(
      "listing-confirm-availability",
      authed((ctx, auth) => confirmAvailability(ctx, auth)),
    ),
  );
  router.post(
    "api/market/vendor/listings/:id/pause",
    command(
      "listing-pause",
      authed((ctx, auth) => vendorListingLifecycle(ctx, auth, "pause")),
    ),
  );
  router.post(
    "api/market/vendor/listings/:id/resume",
    command(
      "listing-resume",
      authed((ctx, auth) => vendorListingLifecycle(ctx, auth, "resume")),
    ),
  );
  router.post(
    "api/market/vendor/listings/:id/archive",
    command(
      "listing-archive",
      authed((ctx, auth) => vendorListingLifecycle(ctx, auth, "archive")),
    ),
  );
  router.post(
    "api/market/vendor/listings/:id/media",
    command(
      "listing-attach-media",
      authed((ctx, auth) => attachListingMedia(ctx, auth)),
    ),
  );
  router.post(
    "api/market/saved/:listingId",
    command(
      "market-save-toggle",
      authed((ctx, auth) => toggleSavedListing(ctx, auth)),
    ),
  );
  router.post(
    "api/market/report",
    command(
      "market-report",
      authed((ctx, auth) => reportListing(ctx, auth)),
    ),
  );
  router.get(
    "api/market/review/queue",
    authed((ctx, auth) => reviewQueue(ctx, auth)),
  );
  router.post(
    "api/market/review/profile/:id",
    command(
      "review-profile",
      authed((ctx, auth) => reviewProfile(ctx, auth)),
    ),
  );
  router.post(
    "api/market/review/listing/:id",
    command(
      "review-listing",
      authed((ctx, auth) => reviewListing(ctx, auth)),
    ),
  );
  router.post(
    "api/market/review/media/:mediaId",
    command(
      "review-media",
      authed((ctx, auth) => reviewMedia(ctx, auth)),
    ),
  );
}

const router = buildRouter();

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      if (!env.DB || !env.MEDIA) return errorResponse("network_not_configured", 503);
      const ctx: RouteContext = { request, url, params: {}, env };
      try {
        assertSameOrigin(request, url);
      } catch (error) {
        return errorResponse("forbidden", 403, (error as { details?: unknown }).details);
      }
      return router.dispatch(ctx);
    }
    if (url.pathname === "/api") return jsonResponse({ api: "micro-network/1" });
    return serveStatic(request, url, env);
  },
} satisfies { fetch(request: Request, env: Env): Promise<Response> };

export { router as apiRouter };
