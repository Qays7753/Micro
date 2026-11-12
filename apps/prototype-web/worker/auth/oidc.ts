/**
 * Google OIDC sign-in through the Micro identity (contract 18; OD-05/OD21).
 *
 * Flow: authorization-code with server-side token exchange over TLS. The ID
 * token comes directly from Google's token endpoint over an authenticated
 * TLS channel, so signature verification is not re-done locally (RFC 9700
 * direct-access guidance); the payload is still strictly validated:
 * issuer, audience, expiry, nonce, and email_verified. No cryptography is
 * implemented by hand here.
 */

import { decodeBase64Url, randomToken, sha256Hex } from "../crypto.ts";
import { GOOGLE_AUTH_ENDPOINT, GOOGLE_ISSUERS, GOOGLE_TOKEN_ENDPOINT, OAUTH_FLOW_TTL_MS } from "../env.ts";
import { HttpError } from "../http.ts";
import type { Db } from "../db/d1.ts";

export interface OAuthFlowRecord {
  state_hash: string;
  nonce: string;
  return_to: string;
  expires_at: number;
}

export interface GoogleIdTokenPayload {
  iss?: string;
  aud?: string;
  exp?: number;
  nonce?: string;
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export interface TokenExchangeResult {
  idTokenPayload: GoogleIdTokenPayload;
}

/** Injectable outbound fetch (tests substitute a synthetic Google). */
export type OutboundFetch = (url: string, init: RequestInit) => Promise<Response>;

export function defaultOutboundFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, init);
}

export interface OAuthFlowBinding {
  state: string;
  nonce: string;
  /** Value of the short-lived browser-binding cookie to set. */
  flowCookie: string;
}

/** Persist a new flow bound to the initiating browser (anti login-CSRF). */
export async function createOAuthFlow(db: Db, returnTo: string, now: number): Promise<OAuthFlowBinding> {
  const state = randomToken(24);
  const nonce = randomToken(24);
  const flowCookie = randomToken(24);
  // Opportunistic purge: unconsumed/expired flows are the one unbounded
  // anonymous write vector — sweep them on every new flow.
  await db.prepare("DELETE FROM oauth_flow WHERE expires_at <= ?").bind(now).run();
  await db
    .prepare(
      "INSERT INTO oauth_flow (state_hash, nonce, return_to, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(await sha256Hex(`${state}:${flowCookie}`), nonce, returnTo, now, now + OAUTH_FLOW_TTL_MS)
    .run();
  return { state, nonce, flowCookie };
}

/** Consume a flow by state + browser binding (single-use, atomic delete). */
export async function consumeOAuthFlow(
  db: Db,
  state: string,
  flowCookie: string | undefined,
  now: number,
): Promise<OAuthFlowRecord | null> {
  if (flowCookie === undefined) return null;
  const stateHash = await sha256Hex(`${state}:${flowCookie}`);
  const result = await db
    .prepare(
      "DELETE FROM oauth_flow WHERE state_hash = ? AND expires_at > ? RETURNING nonce, return_to, expires_at",
    )
    .bind(stateHash, now)
    .first<Record<string, unknown>>();
  if (!result) return null;
  return {
    state_hash: stateHash,
    nonce: String(result.nonce),
    return_to: String(result.return_to),
    expires_at: Number(result.expires_at),
  };
}

/** Google authorization redirect URL for the micro callback. */
export function googleAuthorizeUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  nonce: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/** Exchange the code at Google's token endpoint (server-to-server, TLS). */
export async function exchangeCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
  outbound: OutboundFetch,
): Promise<TokenExchangeResult> {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const response = await outbound(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response.ok) throw new HttpError(401, "unauthorized", { reason: "token_exchange_failed" });
  const tokenJson = (await response.json()) as { id_token?: string };
  if (typeof tokenJson.id_token !== "string") {
    throw new HttpError(401, "unauthorized", { reason: "id_token_missing" });
  }
  return { idTokenPayload: decodeIdTokenPayload(tokenJson.id_token) };
}

/** Decode a JWT payload segment (base64url JSON) without signature math. */
export function decodeIdTokenPayload(idToken: string): GoogleIdTokenPayload {
  const segments = idToken.split(".");
  if (segments.length !== 3) throw new HttpError(401, "unauthorized", { reason: "id_token_malformed" });
  return JSON.parse(decodeBase64Url(segments[1]!)) as GoogleIdTokenPayload;
}

/** Strict payload validation (issuer/audience/expiry/nonce/verified email). */
export function validateIdTokenPayload(
  payload: GoogleIdTokenPayload,
  expected: { clientId: string; nonce: string; now: number },
): { sub: string; email: string; name: string; picture: string | null } {
  const problems: string[] = [];
  if (!GOOGLE_ISSUERS.includes(payload.iss as (typeof GOOGLE_ISSUERS)[number])) problems.push("iss");
  if (payload.aud !== expected.clientId) problems.push("aud");
  if (typeof payload.exp !== "number" || payload.exp * 1000 <= expected.now) problems.push("exp");
  if (payload.nonce !== expected.nonce) problems.push("nonce");
  if (payload.email_verified !== true) problems.push("email_verified");
  if (typeof payload.sub !== "string" || payload.sub.length === 0) problems.push("sub");
  if (typeof payload.email !== "string" || !payload.email.includes("@")) problems.push("email");
  if (problems.length > 0) throw new HttpError(401, "unauthorized", { reason: problems.join(",") });
  return {
    sub: payload.sub!,
    email: payload.email!.toLowerCase(),
    name: typeof payload.name === "string" && payload.name.length > 0 ? payload.name : payload.email!,
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}
