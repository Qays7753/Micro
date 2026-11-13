/**
 * API route table core (EX-D18): base routes (health, auth, media,
 * notifications) plus the shared auth wrapper. Feature routes are registered
 * by routes.market.ts / routes.delivery.ts; the entry (index.ts) stays a thin
 * static+API dispatcher.
 */

import { authenticate, googleCallback, googleStart, health, sessionInfo, signOut } from "./api/auth.ts";
import { readMedia, removeMedia, uploadMedia } from "./api/media.ts";
import { listMyNotifications, markNotificationsRead, putAdminSetting } from "./api/system.ts";
import type { AuthenticatedContext } from "./auth/session.ts";
import { command } from "./commands.ts";
import { errorResponse } from "./http.ts";
import { ApiRouter, type RouteContext, type RouteHandler } from "./router.ts";
import { registerMarketRoutes } from "./routes.market.ts";
import { askQuestion, askStatus } from "./api/ask.ts";
import { registerDeliveryRoutes } from "./routes.delivery.ts";

/** Resolve the session then run the handler with it (uniform auth guard). */
export function withAuth(
  ctx: RouteContext,
  handler: (auth: AuthenticatedContext) => Promise<Response>,
): Promise<Response> {
  return (async () => {
    const auth = await authenticate(ctx.env.DB, ctx.request);
    if (!auth) return errorResponse("unauthorized", 401);
    return handler(auth);
  })();
}

/** Wrap a (ctx, auth) handler into a RouteHandler via withAuth. */
export function authedRoute(
  handler: (ctx: RouteContext, auth: AuthenticatedContext) => Promise<Response>,
): RouteHandler {
  return async (ctx: RouteContext) => withAuth(ctx, auth => handler(ctx, auth));
}

export function buildRouter(): ApiRouter {
  const router = new ApiRouter();
  router.get("api/health", ctx => health(ctx.env));
  router.get("api/auth/session", async ctx => sessionInfo(ctx.env.DB, ctx.request));
  router.get("api/auth/google/start", async ctx => googleStart(ctx.env.DB, ctx.env, ctx.url, ctx.request));
  router.get("api/auth/google/callback", async ctx =>
    googleCallback(ctx.env.DB, ctx.env, ctx.url, ctx.request),
  );
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
  router.get(
    "api/notifications",
    command("notifications-list", async ctx => {
      const auth = await authenticate(ctx.env.DB, ctx.request);
      if (!auth) return errorResponse("unauthorized", 401);
      return listMyNotifications(ctx.env.DB, auth);
    }),
  );
  router.post(
    "api/notifications/read",
    command("notifications-read", async ctx => {
      const auth = await authenticate(ctx.env.DB, ctx.request);
      if (!auth) return errorResponse("unauthorized", 401);
      return markNotificationsRead(ctx.env.DB, ctx, auth);
    }),
  );
  router.put(
    "api/admin/settings/:key",
    command("admin-setting-update", async ctx => {
      const auth = await authenticate(ctx.env.DB, ctx.request);
      if (!auth) return errorResponse("unauthorized", 401);
      return putAdminSetting(ctx.env.DB, ctx, auth);
    }),
  );
  // Ask Micro — universal permission-scoped boundary (EX-D21). The GET is a
  // context/status read; the POST is a pure question (no state change — no
  // idempotency command wrapper needed).
  router.get("api/ask/status", async ctx => askStatus(ctx.env.DB, ctx));
  router.post("api/ask", async ctx => askQuestion(ctx.env.DB, ctx));
  registerMarketRoutes(router);
  registerDeliveryRoutes(router);
  return router;
}
