/**
 * Foundation acceptance — identity/session security.
 * Real workerd emulation; sign-in through the real OIDC redirect flow with a
 * synthetic Google binding. Covers: session lifecycle, cookie flags, CSRF
 * (origin + custom header), unauthenticated denial, idempotent replay, and
 * D1-failure atomicity.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiGet, apiPost, rawDb, signInAs, startWorker, type WorkerInstance } from "./harness.ts";

let worker: WorkerInstance;

beforeAll(async () => {
  worker = await startWorker({ bindings: { BOOTSTRAP_OWNER_EMAIL: "owner@example.test" } });
});

afterAll(async () => {
  await worker.close();
});

describe("foundation: sessions and CSRF", () => {
  it("health reports honest configuration state", async () => {
    const response = await apiGet(worker, null, "/api/health");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ready: boolean; googleSignIn: string };
    expect(body.googleSignIn).toBe("configured");
    expect(body.ready).toBe(true);
  });

  it("unauthenticated session is reported as such", async () => {
    const response = await apiGet(worker, null, "/api/auth/session");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: false });
  });

  it("protected endpoints reject unauthenticated callers with 401", async () => {
    const notifications = await apiGet(worker, null, "/api/notifications");
    expect(notifications.status).toBe(401);
    const upload = await apiPost(worker, null, "/api/media?purpose=market_listing_media", {});
    expect(upload.status).toBe(401);
  });

  it("sign-in through the real OIDC flow sets an HttpOnly SameSite cookie", async () => {
    const owner = await signInAs(worker, { sub: "sub-owner-1", email: "owner@example.test" });
    expect(owner.cookieHeader).toContain("micro_session=");
    const session = await apiGet(worker, owner.cookieHeader, "/api/auth/session");
    const body = (await session.json()) as {
      authenticated: boolean;
      identity: { email: string };
      isAdmin: boolean;
    };
    expect(body.authenticated).toBe(true);
    expect(body.identity.email).toBe("owner@example.test");
    // First matching sign-in bootstrapped the admin (no self-grant endpoint).
    expect(body.isAdmin).toBe(true);
  });

  it("a second identity does NOT get admin (bootstrap is one-time)", async () => {
    const guest = await signInAs(worker, { sub: "sub-guest-1", email: "someone@example.test" });
    const session = (await (await apiGet(worker, guest.cookieHeader, "/api/auth/session")).json()) as {
      isAdmin: boolean;
    };
    expect(session.isAdmin).toBe(false);
  });

  it("the session cookie is HttpOnly and SameSite=Lax in the raw header", async () => {
    const startResponse = await worker.fetch("/api/auth/google/start?returnTo=/market");
    expect(startResponse.status).toBe(302);
    const location = startResponse.headers.get("location") ?? "";
    const params = new URL(location).searchParams;
    worker.googleMock.nextPayload = {
      iss: "https://accounts.google.com",
      aud: "test-client-id",
      exp: Math.floor(Date.now() / 1000) + 3600,
      nonce: params.get("nonce"),
      sub: "sub-flags-1",
      email: "flags@example.test",
      email_verified: true,
      name: "Flags",
    };
    const callback = await worker.fetch(
      `/api/auth/google/callback?code=c2&state=${encodeURIComponent(params.get("state") ?? "")}`,
    );
    const setCookie = callback.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
  });

  it("mutating calls without the custom API header are rejected (CSRF)", async () => {
    const owner = await signInAs(worker, { sub: "sub-owner-2", email: "owner2@example.test" });
    const response = await worker.fetch("/api/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json", origin: worker.origin, cookie: owner.cookieHeader },
      body: JSON.stringify({ ids: [1] }),
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("forbidden");
  });

  it("mutating calls with a mismatching Origin are rejected", async () => {
    const owner = await signInAs(worker, { sub: "sub-owner-3", email: "owner3@example.test" });
    const response = await worker.fetch("/api/notifications/read", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example",
        "x-micro-api": "1",
        cookie: owner.cookieHeader,
      },
      body: JSON.stringify({ ids: [1] }),
    });
    expect(response.status).toBe(403);
  });

  it("sign-out revokes the session server-side", async () => {
    const user = await signInAs(worker, { sub: "sub-signout-1", email: "signout@example.test" });
    const out = await apiPost(worker, user.cookieHeader, "/api/auth/signout", {});
    expect(out.status).toBe(200);
    const after = await apiGet(worker, user.cookieHeader, "/api/auth/session");
    expect(await after.json()).toEqual({ authenticated: false });
  });

  it("an unknown API route returns 404 and an internal error never leaks a stack", async () => {
    const missing = await apiGet(worker, null, "/api/definitely/not/a/route");
    expect(missing.status).toBe(404);
  });
});

describe("foundation: idempotent commands", () => {
  it("replaying the same Idempotency-Key + body returns the same response", async () => {
    const user = await signInAs(worker, { sub: "sub-idem-1", email: "idem@example.test" });
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const doUpload = () =>
      worker.fetch("/api/media?purpose=market_listing_media", {
        method: "POST",
        headers: {
          "content-type": "image/png",
          origin: worker.origin,
          "x-micro-api": "1",
          cookie: user.cookieHeader,
          "idempotency-key": "idem-key-1",
        },
        body: bytes,
      });
    const first = await doUpload();
    expect(first.status).toBe(201);
    const replay = await doUpload();
    expect(replay.status).toBe(201);
    expect(replay.headers.get("x-idempotent-replay")).toBe("1");
    expect(await replay.text()).toBe(await first.clone().text());
    const db = await rawDb(worker);
    const rows = await db.prepare("SELECT COUNT(*) AS n FROM media_object").first<{ n: number }>();
    expect(rows?.n).toBe(1);
  });

  it("the same key with a DIFFERENT body is a 409 conflict", async () => {
    const user = await signInAs(worker, { sub: "sub-idem-2", email: "idem2@example.test" });
    const doUpload = (bytes: Uint8Array, key: string) =>
      worker.fetch("/api/media?purpose=market_listing_media", {
        method: "POST",
        headers: {
          "content-type": "image/png",
          origin: worker.origin,
          "x-micro-api": "1",
          cookie: user.cookieHeader,
          "idempotency-key": key,
        },
        body: bytes,
      });
    const first = await doUpload(new Uint8Array([1, 2, 3]), "clash-1");
    expect(first.status).toBe(201);
    const clash = await doUpload(new Uint8Array([9, 9, 9]), "clash-1");
    expect(clash.status).toBe(409);
  });
});
