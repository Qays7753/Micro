/**
 * G13 (owner order 7593b9c4 §4 + final decision أ-8: «لا أثر مالي تلقائي:
 * Market وDelivery لا ينشئان أي قيد في Manage — Q68/Q200»): the focused
 * synthetic integration proof that NO Market/Delivery/Ask Micro action can
 * create or alter a Manage financial record, and that the ONLY way a
 * Manage record appears is the owner's OWN explicit write through the
 * normal financial flow (PUT /api/manage/records) with the audited
 * server-side owner gate accepting it — never a side effect, never a
 * cross-account write, never a model/suggestion write.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  apiGet,
  apiPost,
  createWorkspace,
  grantAskConsent,
  rawDb,
  signInAs,
  startWorker,
  type AskProviderMock,
  type WorkerInstance,
} from "./harness.ts";
import { createApprovedDriver, setupExecutionPair, type WorkerRefs } from "./delivery.helpers.ts";

let worker: WorkerInstance;
let adminCookie: string;
let askMock: AskProviderMock;
let refs: WorkerRefs;

beforeEach(async () => {
  askMock = { nextResult: null, received: [] };
  worker = await startWorker({ askProvider: askMock });
  const admin = await signInAs(worker, { sub: "g13-admin", email: "g13-admin@example.test" });
  const db = await rawDb(worker);
  await db
    .prepare(
      "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) " +
        "SELECT id, 'admin', 'active', 'test', 1 FROM network_identity WHERE email = ?",
    )
    .bind("g13-admin@example.test")
    .run();
  adminCookie = admin.cookieHeader;
  refs = { worker, adminCookie };
});

afterEach(async () => {
  await worker.close();
});

/** The exact manage_record state: count + content digest (any alteration shows). */
async function manageState(): Promise<string> {
  const db = await rawDb(worker);
  const rows = await db
    .prepare(
      "SELECT workspace_id, family, record_id, data_json, updated_at FROM manage_record ORDER BY workspace_id, family, record_id",
    )
    .all<Record<string, unknown>>();
  return JSON.stringify(rows.results);
}

async function publishListing(tag: string): Promise<{ vendorCookie: string; listingId: string }> {
  const vendor = await signInAs(worker, { sub: `g13-v-${tag}`, email: `g13-v-${tag}@example.test` });
  const workspaceId = await createWorkspace(worker, vendor.cookieHeader, `مشروع مورد ${tag}`);
  const profileResponse = await apiPost(worker, vendor.cookieHeader, "/api/market/vendor/profile", {
    displayName: `مورد ${tag}`,
    contactPhone: "+962790700001",
    governorate: "عمان",
    supplierType: "manufacturer",
    deliveryOption: "delivery",
    termsAccepted: true,
    workspaceId,
  });
  const profile = (await profileResponse.json()) as { profile: { id: string } };
  const mediaResponse = await worker.fetch("/api/media?purpose=market_listing_media", {
    method: "POST",
    headers: {
      "content-type": "image/png",
      origin: worker.origin,
      "x-micro-api": "1",
      cookie: vendor.cookieHeader,
    },
    body: new Uint8Array([1, 2, 3]),
  });
  const media = (await mediaResponse.json()) as { media: { id: string } };
  const listingResponse = await apiPost(worker, vendor.cookieHeader, "/api/market/vendor/listings", {
    title: `أكياس تغليف ${tag} 50 حبة`,
    category: "packaging",
    governorate: "عمان",
    description: "وصف مادة تغليف كافٍ للطول المطلوب في التحقق الخادمي.",
    contactType: "phone",
    contactValue: "+962790700001",
    pricing: { mode: "fixed", priceMicroJod: "1200000", basis: { units: "50", unit: "حبة" } },
    quantity: { unit: "حبة", minQuantityMilli: "50000", stepMilli: "10000", unpacked: true },
  });
  const listing = (await listingResponse.json()) as { listing: { id: string } };
  await apiPost(worker, vendor.cookieHeader, `/api/market/vendor/listings/${listing.listing.id}/media`, {
    mediaId: media.media.id,
    kind: "cover",
  });
  await apiPost(worker, vendor.cookieHeader, `/api/market/vendor/listings/${listing.listing.id}/submit`, {});
  await apiPost(worker, adminCookie, `/api/market/review/listing/${listing.listing.id}`, {
    action: "approve",
    verificationCall: { done: true, note: "اتصال تحقق أول إعلان — تم" },
  });
  await apiPost(worker, adminCookie, `/api/market/review/media/${media.media.id}`, { action: "approve" });
  void profile;
  return { vendorCookie: vendor.cookieHeader, listingId: listing.listing.id };
}

/** Enable the connected Manage store for the workspace and complete the
 * double-proof owner link (the normal setup path) so the owner's explicit
 * financial writes are legal — exactly the M3 flow the manage tests use. */
async function enableManageStore(worker: WorkerInstance, cookie: string, workspaceId: string): Promise<void> {
  const db = await rawDb(worker);
  await db.prepare("UPDATE workspace SET manage_enabled = 1 WHERE id = ?").bind(workspaceId).run();
  const start = await apiPost(worker, cookie, "/api/manage/link/start", {
    proofSecret: "g13-proof-0123456789abcdef0123456789abcdef",
  });
  const started = (await start.json()) as { nonce: string };
  const confirm = await apiPost(worker, cookie, "/api/manage/link/confirm", { nonce: started.nonce });
  expect(confirm.status).toBe(200);
}

function managePut(
  worker: WorkerInstance,
  cookie: string,
  family: string,
  id: string,
  body: { data: unknown; workspaceId?: string },
): Promise<Response> {
  return worker.fetch(`/api/manage/records/${family}/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json", origin: worker.origin, "x-micro-api": "1", cookie },
    body: JSON.stringify(body),
  });
}

describe("G13: no automatic financial effect from Market/Delivery/Ask Micro", () => {
  it("NO market or delivery or ask action ever creates or alters a manage_record", async () => {
    const owner = await signInAs(worker, { sub: "g13-owner", email: "g13-owner@example.test" });
    const ownerWorkspaceId = await createWorkspace(worker, owner.cookieHeader, "مشروع G13");
    await grantAskConsent(worker, owner.cookieHeader);
    const driver = await createApprovedDriver(refs, "g13-driver@example.test", "g13-driver");
    const { vendorCookie, listingId } = await publishListing("a");

    /* Seed ONE manage record through the ONLY legal path first (the owner's
     * explicit write through the normal financial flow) so the assertion
     * covers ALTERATION too, not just creation from empty. */
    await enableManageStore(worker, owner.cookieHeader, ownerWorkspaceId);
    const seeded = await managePut(worker, owner.cookieHeader, "financial-events", "fe-seed", {
      data: { type: "expense", amountJod: "12.5", date: "2026-11-22", note: "سجل مالي صريح" },
      workspaceId: ownerWorkspaceId,
    });
    expect(seeded.status).toBe(200);

    const before = await manageState();

    /* ── Market actions (the full public + party surface) ── */
    await apiGet(worker, null, "/api/market/listings");
    await apiGet(worker, null, `/api/market/listings/${listingId}`);
    await apiGet(worker, null, "/api/market/meta");
    await apiPost(worker, owner.cookieHeader, "/api/market/quantity-check", {
      listingId,
      requestedMilli: "60000",
    });
    await apiPost(worker, owner.cookieHeader, `/api/market/listings/${listingId}/reveal-phone`, {});
    await apiPost(worker, owner.cookieHeader, `/api/market/saved/${listingId}`, {});
    await apiPost(worker, owner.cookieHeader, "/api/market/report", {
      listingId,
      reason: "spam",
      details: "بلاغ اختبار",
    });
    /* The vendor's own workspace actions (his listings — his own manage store
     * must stay untouched by his MARKET activity). */
    await apiGet(worker, vendorCookie, "/api/market/vendor/overview");
    await apiPost(worker, vendorCookie, "/api/market/vendor/listings", {
      title: "إعلان ثانٍ بعد النشر لا يمس المال",
      category: "packaging",
      governorate: "عمان",
      description: "وصف كافٍ للطول المطلوب في التحقق الخادمي للاختبار.",
      contactType: "phone",
      contactValue: "+962790700001",
      pricing: { mode: "fixed", priceMicroJod: "700000", basis: { units: "30", unit: "حبة" } },
      quantity: { unit: "حبة", minQuantityMilli: "30000", stepMilli: "5000", unpacked: true },
    });

    /* ── Delivery actions (booking lifecycle with money fields) ── */
    const bookingId = await setupExecutionPair(
      worker,
      owner.cookieHeader,
      driver.cookie,
      driver.driverProfileId,
      ownerWorkspaceId,
      { collectionMinor: "150" },
    );
    await apiPost(worker, driver.cookie, `/api/driver/requests/${bookingId}/declare`, { amountMinor: "150" });
    await apiPost(worker, driver.cookie, "/api/driver/statements", {
      requesterWorkspaceId: ownerWorkspaceId,
      statementDate: "2026-11-22",
      items: [{ requestId: bookingId, collectedMinor: "150" }],
      totalMinor: "150",
    });
    await apiPost(worker, owner.cookieHeader, `/api/delivery/requests/${bookingId}/rate`, {
      stars: 5,
      comment: "ممتاز",
    });

    /* ── Ask Micro actions (status + question with a draft proposal) ── */
    await apiGet(worker, owner.cookieHeader, "/api/ask/status");
    askMock.nextResult = {
      answerText: "جاهز لتجهيز مسودة حجز — أكملها بنفسك.",
      citedFactIds: ["owner.confirmed_bookings"],
      draft: {
        kind: "delivery-booking",
        title: "مسودة حجز توصيل",
        fields: [
          /* §10.2-7-6 (2026-11-22): the strict per-kind schema requires the
           * CANONICAL enum options — the provider cannot narrow the user's
           * choices to a subset (anti-framing); the fixture now carries the
           * full canonical sets. */
          {
            name: "needType",
            label: "نوع الطلب",
            type: "enum",
            required: true,
            value: null,
            options: ["deliver_to_customer", "fetch_ready_goods"],
          },
          {
            name: "pickupGovernorate",
            label: "محافظة الاستلام",
            type: "governorate",
            required: true,
            value: null,
          },
          {
            name: "dropoffGovernorate",
            label: "محافظة التسليم",
            type: "governorate",
            required: true,
            value: null,
          },
          {
            name: "pricingMode",
            label: "نمط التسعير",
            type: "enum",
            required: true,
            value: null,
            options: ["prepriced", "quote_request"],
          },
        ],
      },
    };
    const ask = await apiPost(worker, owner.cookieHeader, "/api/ask", { question: "سجّل لي حجز توصيلة" });
    expect(ask.status).toBe(200);
    const askBody = (await ask.json()) as { draft?: unknown };
    expect(askBody.draft).toBeDefined();
    /* Even the ask-draft's canonical confirm (a DELIVERY create — proven in
     * the ask tests) is exercised here to show it touches no manage record. */
    const second = await apiPost(worker, owner.cookieHeader, "/api/delivery/requests", {
      driverProfileId: driver.driverProfileId,
      needType: "deliver_to_customer",
      loadClass: "small",
      weightBand: "under_10kg",
      pieceCount: 1,
      pricingMode: "prepriced",
      offeredFareMinor: "200",
      workspaceId: ownerWorkspaceId,
      payload: { pickup: { governorate: "عمان" }, dropoff: { governorate: "الزرقاء" } },
    });
    expect(second.status).toBe(201);

    /* ── The assertion: byte-identical manage state after ALL of it ── */
    const after = await manageState();
    expect(after).toBe(before);
  });

  it("the ONLY write path is the owner's explicit manage write — a cross-account attempt is refused and writes nothing", async () => {
    const owner = await signInAs(worker, { sub: "g13-owner2", email: "g13-owner2@example.test" });
    const ownerWorkspaceId = await createWorkspace(worker, owner.cookieHeader, "مشروع المالك الثاني");
    const stranger = await signInAs(worker, { sub: "g13-stranger", email: "g13-stranger@example.test" });
    const strangerWorkspaceId = await createWorkspace(worker, stranger.cookieHeader, "مشروع غريب");
    const before = await manageState();
    /* The stranger targets the owner's workspace explicitly — the audited
     * owner gate refuses (a cross-project context is an honest 403). */
    await enableManageStore(worker, owner.cookieHeader, ownerWorkspaceId);
    await enableManageStore(worker, stranger.cookieHeader, strangerWorkspaceId);
    const refused = await managePut(worker, stranger.cookieHeader, "financial-events", "fe-x", {
      data: { type: "expense", amountJod: "99" },
      workspaceId: ownerWorkspaceId,
    });
    expect(refused.status).toBe(403);
    /* And the stranger's own store write is HIS explicit action on HIS
     * workspace — the normal flow; it must not touch the owner's records. */
    const ownWrite = await managePut(worker, stranger.cookieHeader, "financial-events", "fe-own", {
      data: { type: "expense", amountJod: "5", date: "2026-11-22" },
      workspaceId: strangerWorkspaceId,
    });
    expect(ownWrite.status).toBe(200);
    const after = await manageState();
    expect(after).not.toBe(before);
    /* The delta is EXACTLY the stranger's own single record — nothing else. */
    const db = await rawDb(worker);
    const rows = await db
      .prepare("SELECT workspace_id, record_id FROM manage_record")
      .all<{ workspace_id: string; record_id: string }>();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0]!.record_id).toBe("fe-own");
    expect(rows.results[0]!.workspace_id).not.toBe(ownerWorkspaceId);
  });
});
