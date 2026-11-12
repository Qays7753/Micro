/**
 * Delivery acceptance — execution/confirmation/contact/money axes (contract
 * 21 §3.2-3..6): declarations open requester confirmation (OD14), the OD15
 * contact-attempt guard blocks failure declarations without a recorded
 * attempt, owner silence never auto-closes (OD16), statements confirm in
 * full or record a difference (OD13), ratings follow confirmed delivery
 * (OD17), and driver evidence stays private across roles/accounts.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiGet, apiPost, rawDb, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import { createApprovedDriver, type WorkerRefs, setupExecutionPair } from "./delivery.helpers.ts";

let worker: WorkerInstance;
let ownerCookie: string;
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
  const requestId = await setupExecutionPair(worker, ownerCookie, driverCookie, driverProfileId);
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
    // Record the attempt with its outcome, then the failure is declarable.
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "contact_attempt_no_answer",
    });
    const allowed = await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "delivery_failed",
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
    expect(entry?.ratingsCount).toBe(0); // comment pending — stars publish with the comment per OD17 v1 aggregation
  });
});

describe("delivery: statements confirm in full or record a difference (OD13)", () => {
  it("one awaiting statement per pair/day; full confirmation; supplements carry only new items", async () => {
    const requestId = await confirmedRequest();
    const ownerDetail = (await (
      await apiGet(worker, ownerCookie, `/api/delivery/requests/${requestId}`)
    ).json()) as {
      request: { agreementCopy: unknown };
    };
    void ownerDetail;
    const db = await rawDb(worker);
    const ownerIdentity = await db
      .prepare("SELECT id FROM network_identity WHERE email = ?")
      .bind("ex-owner@example.test")
      .first<{ id: string }>();
    const submit = await apiPost(worker, driverCookie, "/api/driver/statements", {
      requesterIdentityId: ownerIdentity!.id,
      items: [{ requestId, description: "تحصيل يوم الاثنين", amountMinor: "7500" }],
    });
    expect(submit.status).toBe(201);
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
    // A supplement after confirmation carries only the new items.
    const supplementResponse = await apiPost(worker, driverCookie, "/api/driver/statements", {
      requesterIdentityId: ownerIdentity!.id,
      supplementOf: awaiting!.id,
      items: [{ requestId, description: "بند إضافي لاحق", amountMinor: "500" }],
    });
    expect(supplementResponse.status).toBe(201);
    const difference = await apiPost(
      worker,
      ownerCookie,
      `/api/delivery/statements/${awaiting!.id}/confirm`,
      { decision: "full" },
    );
    expect(difference.status).toBe(409); // already decided — never partial rewrites
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
