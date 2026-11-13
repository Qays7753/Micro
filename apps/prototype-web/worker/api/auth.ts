/**
 * Auth/session API: Google OIDC start/callback, session info, sign-out.
 * The client never sees or handles any token — only the HttpOnly cookie.
 */

import { isSafeInternalPath } from "../auth/csrf.ts";
import {
  consumeOAuthFlow,
  createOAuthFlow,
  defaultOutboundFetch,
  exchangeCode,
  googleAuthorizeUrl,
  validateIdTokenPayload,
  type OutboundFetch,
} from "../auth/oidc.ts";
import {
  bootstrapFirstAdmin,
  createSession,
  resolveSession,
  revokeSession,
  upsertIdentity,
} from "../auth/session.ts";
import { driverStatus, listWorkspaceMemberships, vendorStatus } from "../authorization.ts";
import { audit } from "../audit.ts";
import { nowMs } from "../clock.ts";
import { randomToken, sha256Hex } from "../crypto.ts";
import { newId, type Db } from "../db/db.ts";
import { enforceRate, minuteBucket, rateLimits } from "../ratelimit.ts";
import { apiBindingsConfigured, type Env } from "../env.ts";
import type { RuntimeEnv } from "../db/db.ts";
import { clearedSessionCookie, errorResponse, jsonResponse, parseCookies, sessionCookie } from "../http.ts";
import type { RouteContext } from "../router.ts";

export const SESSION_COOKIE = "micro_session";

function cookieToken(request: Request): string | undefined {
  return parseCookies(request.headers.get("cookie")).get(SESSION_COOKIE);
}

/** GET /api/health — honest configuration state (no resource claims). */
export function health(env: RuntimeEnv<Env>): Response {
  const googleConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  return jsonResponse({
    status: "ok",
    api: "micro-network/1",
    bindings: { db: Boolean(env.DB), media: Boolean(env.MEDIA) },
    googleSignIn: googleConfigured ? "configured" : "not_configured",
    ready: apiBindingsConfigured(env) && googleConfigured,
  });
}

/** GET /api/auth/session — current identity + server-derived capabilities. */
export async function sessionInfo(db: Db, request: Request): Promise<Response> {
  const auth = await resolveSession(db, cookieToken(request), nowMs());
  if (!auth) return jsonResponse({ authenticated: false });
  const vendor = await vendorStatus(db, auth.identityId);
  const driver = await driverStatus(db, auth.identityId, nowMs());
  const workspaces = await listWorkspaceMemberships(db, auth.identityId);
  return jsonResponse({
    authenticated: true,
    identity: { email: auth.email, displayName: auth.displayName },
    isAdmin: auth.isAdmin,
    workspaces: workspaces.map(w => ({
      id: w.workspaceId,
      displayName: w.displayName,
      role: w.role,
      capabilities: { market: w.marketEnabled, delivery: w.deliveryEnabled },
    })),
    vendor: vendor ? { status: vendor.status, supplierProfileId: vendor.supplierProfileId } : null,
    driver: driver
      ? {
          status: driver.profileStatus,
          eligibleForNewWork: driver.eligibleForNewWork,
          acceptingNew: driver.acceptingNew,
          evidenceValid: driver.requiredEvidenceValid,
          vehicleApproved: driver.vehicleApproved,
        }
      : null,
  });
}

/** GET /api/auth/google/start?returnTo=... — begin the OIDC flow. */
export async function googleStart(
  db: Db,
  env: RuntimeEnv<Env>,
  url: URL,
  request: Request,
): Promise<Response> {
  if (!env.GOOGLE_CLIENT_ID)
    return errorResponse("network_not_configured", 503, { binding: "GOOGLE_CLIENT_ID" });
  // Anonymous abuse control: one row is written per start, so throttle per
  // connecting IP (engineering reference — configurable, not policy).
  const startNow = nowMs();
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  const limits = await rateLimits(db);
  await enforceRate(
    db,
    minuteBucket("auth-start", ip, startNow),
    limits.authStartsPerMinute ?? 10,
    60 * 1000,
    startNow,
  );
  const requested = url.searchParams.get("returnTo") ?? "/";
  const returnTo = isSafeInternalPath(requested) ? requested : "/";
  const now = nowMs();
  const { state, nonce, flowCookie } = await createOAuthFlow(db, returnTo, now);
  const redirectUri = `${url.protocol}//${url.host}/api/auth/google/callback`;
  return new Response(null, {
    status: 302,
    headers: {
      location: googleAuthorizeUrl(env.GOOGLE_CLIENT_ID, redirectUri, state, nonce),
      "set-cookie": `micro_flow=${encodeURIComponent(flowCookie)}; Path=/; HttpOnly; SameSite=Lax;${url.protocol === "https:" ? " Secure;" : ""} Max-Age=600`,
    },
  });
}

/** GET /api/auth/google/callback — exchange code, validate, open session. */
export async function googleCallback(
  db: Db,
  env: RuntimeEnv<Env>,
  url: URL,
  ctxRequest: Request,
  outbound?: OutboundFetch,
): Promise<Response> {
  const toHome = new Response(null, { status: 302, headers: { location: "/" } });
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return errorResponse("network_not_configured", 503, { binding: "GOOGLE_*" });
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return toHome;
  const now = nowMs();
  const flowCookie = parseCookies(ctxRequest.headers.get("cookie")).get("micro_flow");
  const flow = await consumeOAuthFlow(db, state, flowCookie, now);
  if (!flow) return toHome;
  const redirectUri = `${url.protocol}//${url.host}/api/auth/google/callback`;
  const outboundFetch: OutboundFetch =
    outbound ?? (env.GOOGLE ? (tokenUrl, init) => env.GOOGLE!.fetch(tokenUrl, init) : defaultOutboundFetch);
  const { idTokenPayload } = await exchangeCode(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    code,
    redirectUri,
    outboundFetch,
  );
  const profile = validateIdTokenPayload(idTokenPayload, {
    clientId: env.GOOGLE_CLIENT_ID,
    nonce: flow.nonce,
    now,
  });
  const identityId = await upsertIdentity(db, profile, now, newId("idn", randomToken));
  const bootstrapped = await bootstrapFirstAdmin(
    db,
    identityId,
    profile.email,
    env.BOOTSTRAP_OWNER_EMAIL,
    now,
  );
  const { token, expiresAt } = await createSession(db, identityId, now);
  await audit(
    db,
    {
      actorIdentityId: identityId,
      action: bootstrapped ? "signin_bootstrap_admin" : "signin",
      objectType: "network_identity",
      objectId: identityId,
      result: "success",
    },
    now,
  );
  const maxAge = Math.max(1, Math.floor((expiresAt - now) / 1000));
  return new Response(null, {
    status: 302,
    headers: {
      location: flow.return_to,
      "set-cookie": sessionCookie(token, maxAge, url.protocol === "https:"),
    },
  });
}

/** POST /api/auth/signout — revoke the session and clear the cookie. */
export async function signOut(db: Db, ctx: RouteContext): Promise<Response> {
  // Resolve FIRST (capture the identity) — after revocation the session row
  // is filtered out and the signout audit would never fire.
  const auth = await resolveSession(db, cookieToken(ctx.request), nowMs());
  await revokeSession(db, cookieToken(ctx.request), nowMs());
  if (auth) {
    await audit(
      db,
      {
        actorIdentityId: auth.identityId,
        action: "signout",
        objectType: "network_identity",
        objectId: auth.identityId,
        result: "success",
      },
      nowMs(),
    );
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "set-cookie": clearedSessionCookie() },
  });
}

/** Resolve the authenticated context for API handlers (or null for guest). */
export async function authenticate(db: Db, request: Request) {
  return resolveSession(db, cookieToken(request), nowMs());
}

export async function sessionTokenHash(token: string): Promise<string> {
  return sha256Hex(token);
}
