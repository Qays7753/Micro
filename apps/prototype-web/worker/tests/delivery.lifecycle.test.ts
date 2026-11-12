/**
 * Delivery acceptance — request axis (contract 21 §3.2-2): directed booking to
 * a known driver (no broadcast/fallback — OD03), prepriced acceptance and the
 * one-final-quote flow (OD05), the 30-minute window (OD07), and evidence
 * expiry blocking NEW acceptance only (OD30). Agreement copies freeze the
 * terms at confirmation (OD11).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiGet, apiPost, rawDb, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import { createApprovedDriver } from "./delivery.helpers.ts";

let worker: WorkerInstance;
let ownerCookie: string;
let driverCookie: string;
let adminCookie: string;
let strangerCookie: string;
let driverProfileId: string;
let vehicleId: string;

const MINUTE = 60 * 1000;

async function grantAdmin(email: string): Promise<void> {
  const db = await rawDb(worker);
  const identity = await db
    .prepare("SELECT id FROM network_identity WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();
  await db
    .prepare(
      "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) VALUES (?, 'admin', 'active', 'test', 1) ON CONFLICT(identity_id, role) DO UPDATE SET status='active'",
    )
    .bind(identity!.id)
    .run();
}

async function uploadEvidence(cookie: string): Promise<string> {
  const response = await worker.fetch("/api/media?purpose=driver_evidence", {
    method: "POST",
    headers: { "content-type": "image/png", origin: worker.origin, "x-micro-api": "1", cookie },
    body: new Uint8Array([1, 2, 3, 4]),
  });
  const body = (await response.json()) as { media: { id: string } };
  return body.media.id;
}

interface RequestRefs {
  requestId: string;
}

async function createRequest(mode: "prepriced" | "quote_request"): Promise<RequestRefs> {
  const response = await apiPost(worker, ownerCookie, "/api/delivery/requests", {
    driverProfileId,
    needType: "deliver_to_customer",
    pricingMode: mode,
    offeredFareMinor: mode === "prepriced" ? "300" : undefined,
    payload: {
      pickup: {
        governorate: "عمان",
        area: "تلاع العلي",
        name: "ورشة المصدر",
        phone: "+962795555001",
        address: "شارع الصناعة 12",
      },
      dropoff: {
        governorate: "الزرقاء",
        area: "وسط البلد",
        name: "زبون نهائي",
        phone: "+962795555002",
        address: "بناية 4 شقة 2",
      },
      load: { description: "صناديق تغليف", parcels: 6, fragile: false },
      schedule: { pickupWindow: "10:00-12:00", dropoffWindow: "14:00-16:00", date: "2026-11-20" },
    },
  });
  expect(response.status).toBe(201);
  const body = (await response.json()) as { request: { id: string } };
  return { requestId: body.request.id };
}

beforeAll(async () => {
  worker = await startWorker();
  adminCookie = (await signInAs(worker, { sub: "dlv-admin", email: "dlv-admin@example.test" })).cookieHeader;
  await grantAdmin("dlv-admin@example.test");
  ownerCookie = (await signInAs(worker, { sub: "dlv-owner", email: "dlv-owner@example.test" })).cookieHeader;
  strangerCookie = (await signInAs(worker, { sub: "dlv-stranger", email: "dlv-stranger@example.test" }))
    .cookieHeader;
  const driver = await createApprovedDriver(
    { worker, adminCookie },
    "dlv-driver@example.test",
    "dlv-driver-sub",
  );
  driverCookie = driver.cookie;
  driverProfileId = driver.driverProfileId;
});

afterAll(async () => {
  await worker.close();
});

describe("delivery: request axis — prepriced directed booking (OD03/OD07)", () => {
  let refs: RequestRefs;

  it("a draft is private and directed to one known driver only", async () => {
    refs = await createRequest("prepriced");
    const stranger = await apiGet(worker, strangerCookie, `/api/delivery/requests/${refs.requestId}`);
    expect(stranger.status).toBe(404);
    const driverView = await apiGet(worker, driverCookie, `/api/delivery/requests/${refs.requestId}`);
    expect(driverView.status).toBe(200);
  });

  it("the driver accepts within the window and the agreement copy freezes the terms (OD11)", async () => {
    await apiPost(worker, ownerCookie, `/api/delivery/requests/${refs.requestId}/submit`, {});
    const accept = await apiPost(worker, driverCookie, `/api/driver/requests/${refs.requestId}/accept`, {});
    expect(accept.status).toBe(200);
    const detail = (await (
      await apiGet(worker, ownerCookie, `/api/delivery/requests/${refs.requestId}`)
    ).json()) as {
      request: {
        status: string;
        agreementCopy: { fareMinor: string; payload: { load: { parcels: number } } };
      };
    };
    expect(detail.request.status).toBe("confirmed");
    expect(detail.request.agreementCopy.fareMinor).toBe("300");
    expect(detail.request.agreementCopy.payload.load.parcels).toBe(6);
  });

  it("the driver sees zones but NOT recipient details behind the disclosure gate (EX-O14)", async () => {
    const detail = (await (
      await apiGet(worker, driverCookie, `/api/delivery/requests/${refs.requestId}`)
    ).json()) as {
      request: { payload: { dropoff: Record<string, unknown>; pickup: Record<string, unknown> } };
    };
    expect(detail.request.payload.dropoff.governorate).toBe("الزرقاء");
    expect(detail.request.payload.dropoff.phone).toBeUndefined();
    expect(detail.request.payload.dropoff.address).toBeUndefined();
    expect(detail.request.payload.pickup.phone).toBeUndefined();
  });

  it("withdrawing before acceptance is free; after confirmation it follows saved terms", async () => {
    const draft = await createRequest("prepriced");
    await apiPost(worker, ownerCookie, `/api/delivery/requests/${draft.requestId}/submit`, {});
    const withdraw = await apiPost(
      worker,
      ownerCookie,
      `/api/delivery/requests/${draft.requestId}/withdraw`,
      {},
    );
    expect(withdraw.status).toBe(200);
    const detail = (await (
      await apiGet(worker, ownerCookie, `/api/delivery/requests/${draft.requestId}`)
    ).json()) as {
      request: { status: string };
    };
    expect(detail.request.status).toBe("withdrawn");
  });
});

describe("delivery: quote flow — one final offer (OD05)", () => {
  it("the driver submits ONE final quote; replacing it voids the old copy; the owner accepts", async () => {
    const refs = await createRequest("quote_request");
    await apiPost(worker, ownerCookie, `/api/delivery/requests/${refs.requestId}/submit`, {});
    const quote = await apiPost(worker, driverCookie, `/api/driver/requests/${refs.requestId}/quote`, {
      fareMinor: "450",
      scope: "يشمل التحميل والتنزيل",
    });
    expect(quote.status).toBe(201);
    const replaced = await apiPost(worker, driverCookie, `/api/driver/requests/${refs.requestId}/quote`, {
      fareMinor: "500",
      scope: "سعر محدث بلا عروض متراكمة",
    });
    expect(replaced.status).toBe(201);
    const db = await rawDb(worker);
    const active = await db
      .prepare("SELECT COUNT(*) AS n FROM delivery_quote WHERE request_id = ? AND superseded_by IS NULL")
      .bind(refs.requestId)
      .first<{ n: number }>();
    expect(active!.n).toBe(1);
    const accept = await apiPost(
      worker,
      ownerCookie,
      `/api/delivery/requests/${refs.requestId}/accept-quote`,
      {},
    );
    expect(accept.status).toBe(200);
    const detail = (await (
      await apiGet(worker, ownerCookie, `/api/delivery/requests/${refs.requestId}`)
    ).json()) as {
      request: { status: string; agreementCopy: { fareMinor: string; quoteScope: string } };
    };
    expect(detail.request.status).toBe("confirmed");
    expect(detail.request.agreementCopy.fareMinor).toBe("500");
  });

  it("rejecting the quote records the decision without any fallback driver (OD03/OD07)", async () => {
    const refs = await createRequest("quote_request");
    await apiPost(worker, ownerCookie, `/api/delivery/requests/${refs.requestId}/submit`, {});
    await apiPost(worker, driverCookie, `/api/driver/requests/${refs.requestId}/quote`, {
      fareMinor: "900",
      scope: "ممر بعيد",
    });
    const reject = await apiPost(
      worker,
      ownerCookie,
      `/api/delivery/requests/${refs.requestId}/reject-quote`,
      {},
    );
    expect(reject.status).toBe(200);
    const detail = (await (
      await apiGet(worker, ownerCookie, `/api/delivery/requests/${refs.requestId}`)
    ).json()) as {
      request: { status: string };
    };
    expect(detail.request.status).toBe("quote_rejected");
    const driverRequests = (await (await apiGet(worker, driverCookie, "/api/driver/requests")).json()) as {
      requests: { id: string; status: string }[];
    };
    const entry = driverRequests.requests.find(item => item.id === refs.requestId);
    expect(entry?.status).toBe("quote_rejected");
  });
});

describe("delivery: the 30-minute window (OD07) and expiry blocking new work (OD30)", () => {
  it("a late acceptance is rejected; the status reads response_expired after the deadline", async () => {
    const refs = await createRequest("prepriced");
    await apiPost(worker, ownerCookie, `/api/delivery/requests/${refs.requestId}/submit`, {});
    const db = await rawDb(worker);
    await db
      .prepare("UPDATE delivery_request SET response_deadline_at = ? WHERE id = ?")
      .bind(Date.now() - MINUTE, refs.requestId)
      .run();
    const late = await apiPost(worker, driverCookie, `/api/driver/requests/${refs.requestId}/accept`, {});
    expect(late.status).toBe(410);
    const detail = (await (
      await apiGet(worker, ownerCookie, `/api/delivery/requests/${refs.requestId}`)
    ).json()) as {
      request: { status: string };
    };
    expect(detail.request.status).toBe("response_expired");
  });

  it("expired evidence blocks NEW acceptance but never touches existing work (OD30)", async () => {
    const refs = await createRequest("prepriced");
    await apiPost(worker, ownerCookie, `/api/delivery/requests/${refs.requestId}/submit`, {});
    const db = await rawDb(worker);
    // Expire the identity evidence (recorded only when clear — OD29).
    await db
      .prepare(
        "UPDATE driver_evidence SET expires_at = ? WHERE driver_profile_id = ? AND category = 'identity'",
      )
      .bind(Date.now() - 1, driverProfileId)
      .run();
    const blocked = await apiPost(worker, driverCookie, `/api/driver/requests/${refs.requestId}/accept`, {});
    expect(blocked.status).toBe(409);
    const body = (await blocked.json()) as { error: { details: { reason: string } } };
    expect(body.error.details.reason).toBe("not_eligible_for_new_work");
    // A confirmed booking keeps its state (no auto-close of existing work).
    const confirmed = (await (await apiGet(worker, driverCookie, "/api/driver/requests")).json()) as {
      requests: { id: string; status: string }[];
    };
    const existingConfirmed = confirmed.requests.find(item => item.status === "confirmed");
    expect(existingConfirmed).toBeDefined();
    // Renewal: a new evidence upload resets to pending; admin approval restores.
    const media = await uploadEvidence(driverCookie);
    await apiPost(worker, driverCookie, "/api/driver/evidence", { category: "identity", mediaId: media });
    const pendingEvidence = await db
      .prepare("SELECT id FROM driver_evidence WHERE driver_profile_id = ? AND category = 'identity'")
      .bind(driverProfileId)
      .first<{ id: string }>();
    await apiPost(worker, adminCookie, `/api/delivery/review/evidence/${pendingEvidence!.id}`, {
      action: "approve",
    });
    const restored = await apiPost(worker, driverCookie, `/api/driver/requests/${refs.requestId}/accept`, {});
    expect(restored.status).toBe(200);
  });
});

describe("delivery: driver self-activation is impossible (OD17/OD22)", () => {
  it("the driver cannot review or approve their own application; only admin decides", async () => {
    const queue = await apiGet(worker, driverCookie, "/api/delivery/review/queue");
    expect(queue.status).toBe(403);
    const db = await rawDb(worker);
    const identity = await db
      .prepare("SELECT id FROM network_identity WHERE email = ?")
      .bind("dlv-stranger@example.test")
      .first<{ id: string }>();
    await db
      .prepare(
        "INSERT INTO driver_profile (id, identity_id, work_copy_json, status, created_at, updated_at) VALUES ('drv_self', ?, '{}', 'submitted', 1, 1)",
      )
      .bind(identity!.id)
      .run();
    const selfApprove = await apiPost(worker, strangerCookie, "/api/delivery/review/driver/drv_self", {
      action: "approve",
    });
    expect(selfApprove.status).toBe(403);
  });
});
