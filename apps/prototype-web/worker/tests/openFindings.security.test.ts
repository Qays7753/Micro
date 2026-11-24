/**
 * Open-findings remediation (2026-11-23 — WS-254/DOC-044, the owner's
 * OPEN-FINDINGS-AND-PROTOTYPE-CODE-PROMPT): one focused regression test per
 * implemented fix, each exercising the risky behavior directly:
 *  - AUTHZ-04: creating a delivery request requires the caller's ACTIVE
 *    OWNER role in the named workspace (contract 21 binds delivery_request
 *    to the project owner; an active non-owner membership is an honest 403,
 *    not a silent pass);
 *  - AUTHZ-05: the market supplier-profile save enforces the same
 *    membership ROLE dimension server-side (one owner per project, no team
 *    roles — the owner's final decisions);
 *  - SRV-02: the Manage command surfaces read request bodies through the
 *    bounded readers — an oversized declared body is refused BEFORE any
 *    buffering (including through the idempotency command wrapper), while
 *    the migration apply route keeps its own documented larger envelope
 *    ceiling so an honest export-sized body still reaches its auth gate.
 *  - SRV-02 (follow-up remediation 2026-11-24 — the owner's
 *    FOLLOW-UP-REMEDIATION-PROMPT-EN): the bounded body door is now
 *    STREAMING — the byte cap is enforced while the request stream is
 *    consumed (the reader is CANCELLED at the cap so the excess bytes are
 *    never pulled or buffered), the byte count is correct for multi-byte
 *    text (a body whose character count fits but whose UTF-8 byte count
 *    exceeds the cap is refused), lying/missing content-length and chunked
 *    streams are capped mid-stream, and every body-read surface (JSON,
 *    command/idempotency, migration, media, push-subscription) goes through
 *    the one door — no second unbounded clone/read path remains.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiPost, createWorkspace, rawDb, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import { createApprovedDriver } from "./delivery.helpers.ts";
import { readBodyBytesWithin, readBodyTextWithin } from "../router.ts";

let worker: WorkerInstance;
let adminCookie: string;
let ownerCookie: string;
let ownerWorkspaceId: string;
let memberCookie: string;
let driverProfileId: string;

/** The shared valid directed-request body (OD03) for the named workspace. */
function deliveryRequestBody(workspaceId: string): Record<string, unknown> {
  return {
    driverProfileId,
    needType: "deliver_to_customer",
    loadClass: "small",
    weightBand: "under_10kg",
    pieceCount: 1,
    pricingMode: "prepriced",
    offeredFareMinor: "300",
    workspaceId,
    payload: {
      pickup: {
        governorate: "عمان",
        area: "جبل الحسين",
        name: "ورشة المصدر",
        phone: "+962795555001",
        address: "شارع 1",
      },
      dropoff: {
        governorate: "عمان",
        area: "وسط البلد",
        name: "زبون نهائي",
        phone: "+962795555002",
        address: "بناية 2",
      },
    },
  };
}

beforeAll(async () => {
  worker = await startWorker();
  adminCookie = (await signInAs(worker, { sub: "of-admin", email: "of-admin@example.test" })).cookieHeader;
  // Grant the platform-admin membership (the reviewer role lives in
  // network_membership, not workspace_member — same seeding as the delivery
  // and security suites).
  const adminDb = await rawDb(worker);
  const adminIdentity = await adminDb
    .prepare("SELECT id FROM network_identity WHERE email = ?")
    .bind("of-admin@example.test")
    .first<{ id: string }>();
  await adminDb
    .prepare(
      "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) VALUES (?, 'admin', 'active', 'test', 1) ON CONFLICT (identity_id, role) DO UPDATE SET status='active'",
    )
    .bind(adminIdentity!.id)
    .run();
  ownerCookie = (await signInAs(worker, { sub: "of-owner", email: "of-owner@example.test" })).cookieHeader;
  ownerWorkspaceId = await createWorkspace(worker, ownerCookie, "مشروع النتائج المفتوحة");
  memberCookie = (await signInAs(worker, { sub: "of-member", email: "of-member@example.test" })).cookieHeader;
  // The NON-owner ACTIVE membership the role gate must refuse: seeded
  // directly because no invitation surface exists (final decision أ-4) — the
  // schema's own role CHECK ('owner','supplier','driver') still permits such
  // a row, and AUTHZ-04/05 must not depend on today's data never containing
  // one. 'supplier' is the realistic future member role (contract 18 §2).
  const db = await rawDb(worker);
  const memberIdentity = await db
    .prepare("SELECT id FROM network_identity WHERE email = ?")
    .bind("of-member@example.test")
    .first<{ id: string }>();
  const ownerIdentity = await db
    .prepare("SELECT id FROM network_identity WHERE email = ?")
    .bind("of-owner@example.test")
    .first<{ id: string }>();
  await db
    .prepare(
      "INSERT INTO workspace_member (workspace_id, identity_id, role, status, granted_by_identity_id, granted_at) VALUES (?, ?, 'supplier', 'active', ?, 1)",
    )
    .bind(ownerWorkspaceId, memberIdentity!.id, ownerIdentity!.id)
    .run();
  const driver = await createApprovedDriver(
    { worker, adminCookie },
    "of-driver@example.test",
    "of-driver-sub",
  );
  driverProfileId = driver.driverProfileId;
});

afterAll(async () => {
  await worker.close();
});

describe("AUTHZ-04 — delivery request creation requires the ACTIVE OWNER role", () => {
  it("refuses an active NON-owner member of the named workspace with 403 workspace_role_forbidden", async () => {
    const response = await apiPost(
      worker,
      memberCookie,
      "/api/delivery/requests",
      deliveryRequestBody(ownerWorkspaceId),
    );
    expect(response.status).toBe(403);
    const body = (await response.json()) as {
      error: { code: string; details?: { reason?: string; requiredRole?: string } };
    };
    expect(body.error.code).toBe("workspace_role_forbidden");
    expect(body.error.details?.reason).toBe("membership_role_insufficient");
    expect(body.error.details?.requiredRole).toBe("owner");
    // Nothing was created by the refused member.
    const db = await rawDb(worker);
    const requests = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM delivery_request WHERE requester_identity_id = (SELECT id FROM network_identity WHERE email = ?)",
      )
      .bind("of-member@example.test")
      .first<{ n: number }>();
    expect(Number(requests?.n ?? 0)).toBe(0);
  });

  it("the workspace OWNER still creates the same directed request (the control case)", async () => {
    const response = await apiPost(
      worker,
      ownerCookie,
      "/api/delivery/requests",
      deliveryRequestBody(ownerWorkspaceId),
    );
    expect(response.status).toBe(201);
  });
});

describe("AUTHZ-05 — the market supplier-profile save enforces the membership ROLE server-side", () => {
  it("refuses an active NON-owner member binding a supplier profile to the workspace", async () => {
    const response = await apiPost(worker, memberCookie, "/api/market/vendor/profile", {
      displayName: "مورد عضو",
      contactPhone: "+962790000002",
      governorate: "عمان",
      workspaceId: ownerWorkspaceId,
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("workspace_role_forbidden");
  });
});

describe("SRV-02 — the Manage command surfaces read bodies through the bounded readers", () => {
  it("readBodyTextWithin refuses an oversized DECLARED length before the body is ever read (unit)", async () => {
    const oversized = {
      headers: new Headers({ "content-length": String(300 * 1024) }),
      body: new ReadableStream({
        pull(controller) {
          throw new Error("the stream must never be read when the declared length is over the cap");
        },
      }),
    } as unknown as Request;
    await expect(readBodyTextWithin(oversized, 256 * 1024)).rejects.toMatchObject({
      status: 400,
      details: { reason: "body_too_large" },
    });
    // A lying stream (chunked, no usable content-length) with a body over the
    // cap is capped DURING streaming — the refusal fires while the stream is
    // being consumed, not after the whole body is buffered.
    const lying = new Request("http://mf.local/x", {
      method: "POST",
      body: "x".repeat(300 * 1024),
    });
    await expect(readBodyTextWithin(lying, 256 * 1024)).rejects.toMatchObject({
      status: 400,
      details: { reason: "body_too_large" },
    });
    // An honest small body still reads normally.
    const honest = new Request("http://mf.local/x", { method: "POST", body: "صغير" });
    await expect(readBodyTextWithin(honest, 256 * 1024)).resolves.toBe("صغير");
  });

  it("SRV-02 follow-up: the stream is CANCELLED at the byte cap — the excess is never pulled or buffered (unit)", async () => {
    let pulledBytes = 0;
    let cancelled = false;
    const chunk = new Uint8Array(64 * 1024).fill(0x61); // 64 KB chunks
    const totalChunks = 8; // 512 KB total — double the cap below
    let enqueued = 0;
    const finite = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (enqueued >= totalChunks) {
          controller.close();
          return;
        }
        enqueued += 1;
        pulledBytes += chunk.byteLength;
        controller.enqueue(chunk);
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request("http://mf.local/x", {
      method: "POST",
      body: finite,
      duplex: "half",
    } as RequestInit);
    // A stream body carries no usable content-length: only the STREAMING cap
    // can refuse this body — and the refusal must arrive BEFORE the whole
    // 512 KB is consumed (the old buffered-read would consume it all first).
    await expect(readBodyBytesWithin(request, 256 * 1024)).rejects.toMatchObject({
      status: 400,
      details: { reason: "body_too_large", maxBytes: 256 * 1024 },
    });
    // The reader was cancelled (closed at the limit)…
    expect(cancelled).toBe(true);
    // …and the source produced AT MOST the cap plus two chunks of overshoot
    // (the chunk that crossed the cap and at most one prefetched chunk) — a
    // bounded prefix, never the whole 512 KB, and never an unbounded read.
    expect(pulledBytes).toBeGreaterThan(256 * 1024);
    expect(pulledBytes).toBeLessThanOrEqual(256 * 1024 + 2 * 64 * 1024);
  });

  it("SRV-02 follow-up: byte-counting is correct for MULTI-BYTE text — the cap counts UTF-8 bytes, not characters (unit)", async () => {
    const twoByteChar = "ص"; // 1 UTF-16 unit, 2 UTF-8 bytes
    // 100 characters = 100 UTF-16 units BUT 200 UTF-8 bytes: refused at a
    // 100-byte cap even though a character-count check would pass it.
    const charHeavy = new Request("http://mf.local/x", {
      method: "POST",
      body: twoByteChar.repeat(100),
    });
    await expect(readBodyTextWithin(charHeavy, 100)).rejects.toMatchObject({
      status: 400,
      details: { reason: "body_too_large", maxBytes: 100 },
    });
    // EXACTLY at the byte boundary passes: 50 characters = 100 bytes.
    const atBoundary = new Request("http://mf.local/x", {
      method: "POST",
      body: twoByteChar.repeat(50),
    });
    await expect(readBodyTextWithin(atBoundary, 100)).resolves.toBe(twoByteChar.repeat(50));
    // One byte over the boundary is refused.
    const oneOver = new Request("http://mf.local/x", {
      method: "POST",
      body: `${twoByteChar.repeat(50)}x`, // 102 bytes
    });
    await expect(readBodyTextWithin(oneOver, 100)).rejects.toMatchObject({ status: 400 });
  });

  it("SRV-02 follow-up: a chunked multi-chunk stream under the cap reads correctly (ordinary valid body, unit)", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("الجزء الأول"));
        controller.enqueue(encoder.encode(" — الجزء الثاني"));
        controller.enqueue(encoder.encode(" — الجزء الثالث"));
        controller.close();
      },
    });
    const request = new Request("http://mf.local/x", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    await expect(readBodyTextWithin(request, 1024)).resolves.toBe(
      "الجزء الأول — الجزء الثاني — الجزء الثالث",
    );
  });

  it("an oversized Manage command body is refused before buffering THROUGH the idempotency wrapper (integration)", async () => {
    // A real 300 KB body: workerd derives content-length from the actual
    // body, so the declared-length precheck fires inside the command wrapper
    // BEFORE the handler (or any buffering for the request hash) runs.
    const bigBody = JSON.stringify({ nonce: "n".repeat(300 * 1024) });
    const response = await worker.fetch("/api/manage/link/confirm", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: worker.origin,
        "x-micro-api": "1",
        cookie: ownerCookie,
        "idempotency-key": "srv02-oversized-manage-body",
      },
      body: bigBody,
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; details?: { reason?: string } } };
    expect(body.error.code).toBe("bad_request");
    expect(body.error.details?.reason).toBe("body_too_large");
  });

  it("the migration apply route keeps its documented larger envelope ceiling (an export-sized body is NOT refused as too large)", async () => {
    // A body over the canonical 256 KB JSON cap but well under the migration
    // envelope ceiling: the wrapper's cap is the route-registered larger one,
    // so the request proceeds past the body gates to the honest auth gate
    // (this caller is an active NON-owner member naming a workspace → 403
    // workspace_forbidden from the manage owner gate, never 400 body_too_large).
    const envelopeSized = JSON.stringify({
      workspaceId: ownerWorkspaceId,
      proofSecret: "s".repeat(300 * 1024),
    });
    const response = await worker.fetch("/api/manage/migrate/apply", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: worker.origin,
        "x-micro-api": "1",
        cookie: memberCookie,
        "idempotency-key": "srv02-migration-envelope-sized",
      },
      body: envelopeSized,
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("workspace_forbidden");
  });

  it("SRV-02 follow-up: an oversized raw MEDIA upload is refused with the route's documented size error (integration)", async () => {
    // The raw-bytes path (arrayBuffer → now the streaming door) with a body
    // one byte over MAX_MEDIA_BYTES (5 MiB): workerd derives content-length
    // from the fixed body, so the declared-length hint fires early; the
    // route's documented {field:"size", maxBytes} shape is preserved.
    const tooBig = new Uint8Array(5 * 1024 * 1024 + 1);
    const response = await worker.fetch("/api/media?purpose=driver_evidence", {
      method: "POST",
      headers: {
        "content-type": "image/png",
        origin: worker.origin,
        "x-micro-api": "1",
        cookie: ownerCookie,
      },
      body: tooBig,
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: { code: string; details?: { field?: string; maxBytes?: number } };
    };
    expect(body.error.code).toBe("bad_request");
    expect(body.error.details?.field).toBe("size");
    expect(body.error.details?.maxBytes).toBe(5 * 1024 * 1024);
  });

  it("SRV-02 follow-up: a chunked/lying media upload is capped DURING streaming — never buffered whole (integration)", async () => {
    // No usable content-length (a raw stream body): only the STREAMING byte
    // cap can refuse it; the refusal surfaces with the media route's own
    // documented shape. 40 chunks of 256 KB = 10 MiB total (double the 5 MiB
    // cap); reader cancellation itself is proved directly by the unit test above.
    let produced = 0;
    const chunk = new Uint8Array(256 * 1024).fill(0x89); // 256 KB chunks
    const totalChunks = 40;
    let enqueued = 0;
    const finite = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (enqueued >= totalChunks) {
          controller.close();
          return;
        }
        enqueued += 1;
        produced += chunk.byteLength;
        controller.enqueue(chunk);
      },
    });
    const response = await worker.fetch("/api/media?purpose=driver_evidence", {
      method: "POST",
      headers: {
        "content-type": "image/png",
        origin: worker.origin,
        "x-micro-api": "1",
        cookie: ownerCookie,
      },
      body: finite,
      duplex: "half",
    } as RequestInit);
    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: { code: string; details?: { field?: string; maxBytes?: number } };
    };
    expect(body.error.code).toBe("bad_request");
    expect(body.error.details?.field).toBe("size");
    expect(body.error.details?.maxBytes).toBe(5 * 1024 * 1024);
    /* The transport (undici) wraps the source in its own pipe, so `produced`
     * counts upstream enqueues including implementation-dependent prefetch,
     * not the bytes consumed by the worker-side reader. The direct unit test
     * above proves cancel() and bounds reader consumption. This integration
     * assertion only requires that transport prefetch did not produce the
     * complete body; a fixed byte ceiling varies across runtime versions. */
    expect(produced).toBeLessThan(40 * 256 * 1024);
    expect(produced).toBeGreaterThanOrEqual(5 * 1024 * 1024);
  });

  it("SRV-02 follow-up: an oversized push-subscription body is refused even WITHOUT an idempotency key (integration)", async () => {
    // The push-subscription register handler reads the body itself when no
    // idempotency-key header is sent (the command wrapper only reads the body
    // when a key IS present) — its read is now through the ONE bounded door,
    // so an oversized body without a key is still refused (body_too_large),
    // and the historical lenient empty-object fallback survives for honest
    // small non-JSON bodies.
    const oversized = JSON.stringify({
      endpoint: "https://push.example.test/x",
      keys: "k".repeat(300 * 1024),
    });
    const response = await worker.fetch("/api/auth/push-subscriptions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: worker.origin,
        "x-micro-api": "1",
        cookie: ownerCookie,
      },
      body: oversized,
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: { code: string; details?: { reason?: string } };
    };
    expect(body.error.code).toBe("bad_request");
    expect(body.error.details?.reason).toBe("body_too_large");
  });
});
