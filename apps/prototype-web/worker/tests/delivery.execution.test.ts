/**
 * Delivery acceptance — execution/confirmation/contact/money axes (contract
 * 21 §3.2-3..6): declarations open requester confirmation (OD14), the OD15
 * contact-attempt guard blocks failure declarations without a recorded
 * attempt, owner silence never auto-closes (OD16), statements confirm in
 * full or record a difference (OD13), ratings follow confirmed delivery
 * (OD17), and driver evidence stays private across roles/accounts.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  apiGet,
  apiPost,
  createWorkspace,
  rawDb,
  signInAs,
  startWorker,
  type WorkerInstance,
} from "./harness.ts";
import { createApprovedDriver, type WorkerRefs, setupExecutionPair } from "./delivery.helpers.ts";

let worker: WorkerInstance;
let ownerCookie: string;
let exOwnerWorkspaceId: string;
let driverCookie: string;
let adminCookie: string;
let otherDriverCookie: string;
let plainUserCookie: string;
let driverProfileId: string;

beforeAll(async () => {
  worker = await startWorker();
  adminCookie = (await signInAs(worker, { sub: "ex-admin", email: "ex-admin@example.test" })).cookieHeader;
  const db = await rawDb(worker);
  const adminIdentity = await db
    .prepare("SELECT id FROM network_identity WHERE email = ?")
    .bind("ex-admin@example.test")
    .first<{ id: string }>();
  await db
    .prepare(
      "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) VALUES (?, 'admin', 'active', 'test', 1)",
    )
    .bind(adminIdentity!.id)
    .run();
  ownerCookie = (await signInAs(worker, { sub: "ex-owner", email: "ex-owner@example.test" })).cookieHeader;
  exOwnerWorkspaceId = await createWorkspace(worker, ownerCookie, "مشروع تنفيذ الحجز");
  const refs: WorkerRefs = { worker, adminCookie };
  const driver = await createApprovedDriver(refs, "ex-driver@example.test", "ex-driver-sub");
  driverCookie = driver.cookie;
  driverProfileId = driver.driverProfileId;
  const other = await createApprovedDriver(refs, "ex-driver2@example.test", "ex-driver2-sub");
  otherDriverCookie = other.cookie;
  plainUserCookie = (await signInAs(worker, { sub: "ex-user", email: "ex-user@example.test" })).cookieHeader;
});

afterAll(async () => {
  await worker.close();
});

async function confirmedRequest(): Promise<string> {
  const requestId = await setupExecutionPair(
    worker,
    ownerCookie,
    driverCookie,
    driverProfileId,
    exOwnerWorkspaceId,
  );
  return requestId;
}

describe("delivery: execution and confirmation axes (OD14/OD16)", () => {
  it("declarations move the execution axis and open requester confirmation", async () => {
    const requestId = await confirmedRequest();
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, { kind: "start" });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, { kind: "arrive" });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "pickup_declared",
    });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "transit_started",
    });
    const delivered = await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "delivery_declared",
    });
    expect(delivered.status).toBe(200);
    const detail = (await (
      await apiGet(worker, ownerCookie, `/api/delivery/requests/${requestId}`)
    ).json()) as {
      execution: { execution: string; confirmation: string; goods: string };
    };
    expect(detail.execution.execution).toBe("delivered_declared");
    expect(detail.execution.confirmation).toBe("awaiting_requester_confirmation");
    expect(detail.execution.goods).toBe("delivery_declared");
  });

  it("the OD15 guard blocks a failure declaration without a recorded contact attempt", async () => {
    const requestId = await confirmedRequest();
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, { kind: "start" });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, { kind: "arrive" });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "pickup_declared",
    });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "transit_started",
    });
    const blocked = await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "delivery_failed",
    });
    expect(blocked.status).toBe(409);
    const body = (await blocked.json()) as { error: { details: { reason: string } } };
    expect(body.error.details.reason).toBe("contact_attempt_required_before_failure");
    // Record the attempt with its outcome, then the failure is declarable
    // (a recorded reason is required — contract 21 §3.2-3).
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "contact_attempt_no_answer",
    });
    const allowed = await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "delivery_failed",
      reason: "لا أحد في العنوان بعد محاولة الاتصال",
    });
    expect(allowed.status).toBe(200);
  });

  it("owner silence keeps the outcome awaiting — no auto-close ever (OD16)", async () => {
    const requestId = await confirmedRequest();
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, { kind: "start" });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, { kind: "arrive" });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "pickup_declared",
    });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "transit_started",
    });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "delivery_declared",
    });
    const db = await rawDb(worker);
    // Simulate any amount of silence: nothing transitions by time alone.
    await db
      .prepare("UPDATE delivery_execution SET updated_at = 1 WHERE request_id = ?")
      .bind(requestId)
      .run();
    const detail = (await (
      await apiGet(worker, ownerCookie, `/api/delivery/requests/${requestId}`)
    ).json()) as {
      execution: { confirmation: string };
    };
    expect(detail.execution.confirmation).toBe("awaiting_requester_confirmation");
    // The driver can still work other bookings (their list is unaffected).
    const driverList = await apiGet(worker, driverCookie, "/api/driver/requests");
    expect(driverList.status).toBe(200);
  });

  it("the owner confirms the outcome and can then rate ONCE (OD17)", async () => {
    const requestId = await confirmedRequest();
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, { kind: "start" });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, { kind: "arrive" });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "pickup_declared",
    });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "transit_started",
    });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "delivery_declared",
    });
    // Rating before confirmation is rejected.
    const early = await apiPost(worker, ownerCookie, `/api/delivery/requests/${requestId}/rate`, {
      stars: 5,
      comment: "ممتاز",
    });
    expect(early.status).toBe(409);
    await apiPost(worker, ownerCookie, `/api/delivery/requests/${requestId}/confirm-outcome`, {});
    const rate = await apiPost(worker, ownerCookie, `/api/delivery/requests/${requestId}/rate`, {
      stars: 5,
      comment: "تعامل ممتاز",
    });
    expect(rate.status).toBe(201);
    const twice = await apiPost(worker, ownerCookie, `/api/delivery/requests/${requestId}/rate`, {
      stars: 1,
    });
    expect(twice.status).toBe(409);
    // The comment stays pending review; stars are visible immediately.
    const directory = (await (await apiGet(worker, ownerCookie, "/api/delivery/drivers")).json()) as {
      drivers: { driverProfileId: string; averageStars: number | null; ratingsCount: number }[];
    };
    const entry = directory.drivers.find(driver => driver.driverProfileId === driverProfileId);
    // OD17: stars are visible immediately — a pending (unmoderated) rating
    // counts; only a REJECTED rating is removed from the public aggregate.
    expect(entry?.ratingsCount).toBe(1);
    expect(entry?.averageStars).toBe(5);
  });
});

describe("delivery: statements confirm in full or record a difference (OD13 + MD-04/MD-05)", () => {
  it("one awaiting statement per pair/day; full confirmation; supplements carry only new items", async () => {
    /* MD-04 (Post-Group 6 Wave 3): العناصر والإجمالي تُشتق خادميًّا — الحجز
     * المؤكد المُسلّم ذو التحصيل المتفق عليه وحده يدخل الكشف؛ لا يُقبل
     * وصف ولا مبلغ من العميل. */
    const requestId = await setupExecutionPair(
      worker,
      ownerCookie,
      driverCookie,
      driverProfileId,
      exOwnerWorkspaceId,
      { collectionMinor: "7500" },
    );
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, { kind: "start" });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, { kind: "arrive" });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "pickup_declared",
    });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "transit_started",
    });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "collection_declared",
      amountMinor: "7500",
    });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "delivery_declared",
    });
    const db = await rawDb(worker);
    const ownerIdentity = await db
      .prepare("SELECT id FROM network_identity WHERE email = ?")
      .bind("ex-owner@example.test")
      .first<{ id: string }>();
    // The server derives the items; a client-supplied amount is ignored.
    const submit = await apiPost(worker, driverCookie, "/api/driver/statements", {
      requesterIdentityId: ownerIdentity!.id,
      items: [{ requestId, description: "مبلغ مزعوم من العميل", amountMinor: "100" }],
    });
    expect(submit.status).toBe(201);
    const submitBody = (await submit.json()) as { statement: { totalMinor: string } };
    expect(submitBody.statement.totalMinor).toBe("7500");
    // Submission advances the money axis of exactly the statement's items
    // (OD13 §3.2-6).
    const moneyAfterSubmit = (await (
      await apiGet(worker, ownerCookie, `/api/delivery/requests/${requestId}`)
    ).json()) as { execution: { money: string } };
    expect(moneyAfterSubmit.execution.money).toBe("statement_submitted");
    const duplicate = await apiPost(worker, driverCookie, "/api/driver/statements", {
      requesterIdentityId: ownerIdentity!.id,
      items: [{ requestId, description: "محاولة ثانية", amountMinor: "100" }],
    });
    expect(duplicate.status).toBe(409);
    const statements = (await (await apiGet(worker, ownerCookie, "/api/delivery/statements")).json()) as {
      statements: { id: string; status: string; totalMinor: string }[];
    };
    const awaiting = statements.statements.find(statement => statement.status === "awaiting_confirmation");
    expect(awaiting).toBeDefined();
    expect(awaiting!.totalMinor).toBe("7500");
    await apiPost(worker, ownerCookie, `/api/delivery/statements/${awaiting!.id}/confirm`, {
      decision: "full",
    });
    // Full confirmation advances the money axis to its recorded outcome.
    const moneyAfterConfirm = (await (
      await apiGet(worker, ownerCookie, `/api/delivery/requests/${requestId}`)
    ).json()) as { execution: { money: string } };
    expect(moneyAfterConfirm.execution.money).toBe("full_receipt_confirmed");
    // A supplement whose parent is not a confirmed statement of the same
    // pair/day is rejected (§3.2-6 — supplements follow a confirmed parent).
    const badParent = await apiPost(worker, driverCookie, "/api/driver/statements", {
      requesterIdentityId: ownerIdentity!.id,
      supplementOf: "stmt-does-not-exist",
    });
    expect(badParent.status).toBe(409);
    const badParentBody = (await badParent.json()) as { error: { details: { reason: string } } };
    expect(badParentBody.error.details.reason).toBe("invalid_supplement_parent");
    // A statement to a requester with no booking relationship with this
    // driver is rejected (no cross-inbox statement spam).
    const plainIdentity = await db
      .prepare("SELECT id FROM network_identity WHERE email = ?")
      .bind("ex-user@example.test")
      .first<{ id: string }>();
    const noRelationship = await apiPost(worker, driverCookie, "/api/driver/statements", {
      requesterIdentityId: plainIdentity!.id,
    });
    expect(noRelationship.status).toBe(409);
    const noRelationshipBody = (await noRelationship.json()) as { error: { details: { reason: string } } };
    expect(noRelationshipBody.error.details.reason).toBe("no_booking_relationship");
    // With every eligible booking already stated, an honest empty rejection.
    const nothingLeft = await apiPost(worker, driverCookie, "/api/driver/statements", {
      requesterIdentityId: ownerIdentity!.id,
    });
    expect(nothingLeft.status).toBe(409);
    const nothingLeftBody = (await nothingLeft.json()) as { error: { details: { reason: string } } };
    expect(nothingLeftBody.error.details.reason).toBe("no_eligible_bookings");
    const difference = await apiPost(
      worker,
      ownerCookie,
      `/api/delivery/statements/${awaiting!.id}/confirm`,
      { decision: "full" },
    );
    expect(difference.status).toBe(409); // already decided — never partial rewrites
  });

  it("MD-04: a delivered booking without an agreed collection never enters a statement", async () => {
    const requestId = await confirmedRequest();
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, { kind: "start" });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, { kind: "arrive" });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "pickup_declared",
    });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "transit_started",
    });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "delivery_declared",
    });
    const db = await rawDb(worker);
    const ownerIdentity = await db
      .prepare("SELECT id FROM network_identity WHERE email = ?")
      .bind("ex-owner@example.test")
      .first<{ id: string }>();
    const submit = await apiPost(worker, driverCookie, "/api/driver/statements", {
      requesterIdentityId: ownerIdentity!.id,
    });
    expect(submit.status).toBe(409);
    const body = (await submit.json()) as { error: { details: { reason: string } } };
    expect(body.error.details.reason).toBe("no_eligible_bookings");
  });
});

describe("delivery: evidence privacy across roles and accounts (OD28)", () => {
  it("driver evidence images are denied to the owner, strangers, and other drivers", async () => {
    const db = await rawDb(worker);
    const evidence = await db
      .prepare("SELECT media_id FROM driver_evidence WHERE driver_profile_id = ? LIMIT 1")
      .bind(driverProfileId)
      .first<{ media_id: string }>();
    const mediaId = evidence!.media_id;
    for (const cookie of [ownerCookie, plainUserCookie, otherDriverCookie]) {
      const response = await apiGet(worker, cookie, `/api/media/${mediaId}`);
      expect(response.status).toBe(404);
    }
    const driverOwn = await apiGet(worker, driverCookie, `/api/media/${mediaId}`);
    expect(driverOwn.status).toBe(200);
    const adminRead = await apiGet(worker, adminCookie, `/api/media/${mediaId}`);
    expect(adminRead.status).toBe(200);
  });

  it("a driver never sees another driver's bookings (S-10)", async () => {
    const requestId = await confirmedRequest();
    const otherView = await apiGet(worker, otherDriverCookie, `/api/delivery/requests/${requestId}`);
    expect(otherView.status).toBe(404);
    const otherDeclare = await apiPost(
      worker,
      otherDriverCookie,
      `/api/driver/requests/${requestId}/declare`,
      { kind: "start" },
    );
    expect(otherDeclare.status).toBe(404);
  });
});
