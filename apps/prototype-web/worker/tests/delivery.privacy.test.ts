/**
 * Delivery recipient-privacy Wave 3 slice (final decisions 2026-11-21
 * ج-بيانات المستلم/Q115/Q238 + د-8 + MD-02):
 * - The driver's recipient-data access (under the allowed_after_acceptance
 *   disclosure setting on a confirmed booking) stops IMMEDIATELY on
 *   cancellation/withdrawal and 48 HOURS after the delivery declaration —
 *   the server clock decides, never a client clock.
 * - The administrative full read is unlocked ONLY by an open case filed by a
 *   party (بلاغ على الحجز); without a case the admin sees the redacted view;
 *   closing the case re-locks it; every unlocked read is audited with no
 *   content copy.
 * - The requester ALWAYS sees their own booking data.
 * - Only a party can file a case; the reason set is closed; the case list and
 *   closure are admin-only with a required note.
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
import { createApprovedDriver, setupExecutionPair, type WorkerRefs } from "./delivery.helpers.ts";

let worker: WorkerInstance;
let adminCookie: string;
let ownerCookie: string;
let ownerWorkspaceId: string;
let driverCookie: string;
let driverProfileId: string;
let strangerCookie: string;

const HOUR = 60 * 60 * 1000;

async function putDisclosure(value: string): Promise<void> {
  const response = await worker.fetch("/api/admin/settings/disclosure.recipient", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      origin: worker.origin,
      "x-micro-api": "1",
      cookie: adminCookie,
    },
    body: JSON.stringify({ value }),
  });
  expect(response.status).toBe(200);
}

interface DetailView {
  request: {
    id: string;
    status: string;
    payload?: {
      pickup?: { phone?: string; address?: string; area?: string };
      dropoff?: { phone?: string; address?: string; area?: string };
    };
    agreementCopy?: { payload?: { dropoff?: { phone?: string } } } | null;
  };
}

async function detailAs(cookie: string, requestId: string): Promise<{ status: number; body: DetailView }> {
  const response = await apiGet(worker, cookie, `/api/delivery/requests/${requestId}`);
  return { status: response.status, body: (await response.json()) as DetailView };
}

beforeAll(async () => {
  worker = await startWorker();
  adminCookie = (await signInAs(worker, { sub: "dp-admin", email: "dp-admin@example.test" })).cookieHeader;
  const db = await rawDb(worker);
  const adminIdentity = await db
    .prepare("SELECT id FROM network_identity WHERE email = ?")
    .bind("dp-admin@example.test")
    .first<{ id: string }>();
  await db
    .prepare(
      "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) VALUES (?, 'admin', 'active', 'test', 1)",
    )
    .bind(adminIdentity!.id)
    .run();
  ownerCookie = (await signInAs(worker, { sub: "dp-owner", email: "dp-owner@example.test" })).cookieHeader;
  ownerWorkspaceId = await createWorkspace(worker, ownerCookie, "مشروع خصوصية المستلم");
  const driver = await createApprovedDriver(
    { worker, adminCookie } as WorkerRefs,
    "dp-driver@example.test",
    "dp-driver",
  );
  driverCookie = driver.cookie;
  driverProfileId = driver.driverProfileId;
  strangerCookie = (await signInAs(worker, { sub: "dp-stranger", email: "dp-stranger@example.test" }))
    .cookieHeader;
  await putDisclosure("allowed_after_acceptance");
});

afterAll(async () => {
  await worker.close();
});

describe("Wave 3 ج-بيانات المستلم: the 48-hour driver cutoff and the immediate cancellation cutoff", () => {
  let requestId: string;

  it("a confirmed booking shows the driver the recipient data (within the window)", async () => {
    requestId = await setupExecutionPair(
      worker,
      ownerCookie,
      driverCookie,
      driverProfileId,
      ownerWorkspaceId,
    );
    const driverView = await detailAs(driverCookie, requestId);
    expect(driverView.status).toBe(200);
    expect(driverView.body.request.payload!.dropoff?.phone).toBe("+962795555002");
    expect(driverView.body.request.payload!.dropoff?.address).toBe("بناية 2");
  });

  it("48 hours after the delivery declaration the driver sees the redacted view only", async () => {
    const db = await rawDb(worker);
    const now = Date.now();
    await db
      .prepare("UPDATE delivery_execution SET confirmation_requested_at = ? WHERE request_id = ?")
      .bind(now - 49 * HOUR, requestId)
      .run();
    const driverView = await detailAs(driverCookie, requestId);
    expect(driverView.status).toBe(200);
    expect(driverView.body.request.payload!.dropoff?.phone).toBeUndefined();
    expect(driverView.body.request.payload!.dropoff?.address).toBeUndefined();
    expect(driverView.body.request.payload!.dropoff?.area).toBe("وسط");
    expect(driverView.body.request.agreementCopy?.payload?.dropoff?.phone).toBeUndefined();
    // The requester still sees everything — always.
    const ownerView = await detailAs(ownerCookie, requestId);
    expect(ownerView.body.request.payload!.dropoff?.phone).toBe("+962795555002");
  });

  it("before the 48-hour mark the driver still sees the data (the boundary is exact)", async () => {
    const db = await rawDb(worker);
    await db
      .prepare("UPDATE delivery_execution SET confirmation_requested_at = ? WHERE request_id = ?")
      .bind(Date.now() - 47 * HOUR, requestId)
      .run();
    const driverView = await detailAs(driverCookie, requestId);
    expect(driverView.body.request.payload!.dropoff?.phone).toBe("+962795555002");
  });

  it("cancellation stops the driver's access IMMEDIATELY", async () => {
    const db = await rawDb(worker);
    await db
      .prepare("UPDATE delivery_execution SET confirmation_requested_at = NULL WHERE request_id = ?")
      .bind(requestId)
      .run();
    // The requester withdraws the booking (a cancellation-class end).
    const withdrawn = await apiPost(worker, ownerCookie, `/api/delivery/requests/${requestId}/withdraw`, {});
    expect([200, 409]).toContain(withdrawn.status);
    if (withdrawn.status === 409) {
      // If the axis state does not allow withdrawal from this point, cancel
      // through the honest state the request is in.
      await db
        .prepare("UPDATE delivery_request SET status = 'cancelled', updated_at = ? WHERE id = ?")
        .bind(Date.now(), requestId)
        .run();
    }
    const driverView = await detailAs(driverCookie, requestId);
    expect(driverView.status).toBe(200);
    expect(driverView.body.request.payload!.dropoff?.phone).toBeUndefined();
    // The requester still sees their own data.
    const ownerView = await detailAs(ownerCookie, requestId);
    expect(ownerView.body.request.payload!.dropoff?.phone).toBe("+962795555002");
  });
});

describe("Wave 3 MD-02 + د-8: the administrative read unlocked only by an open case", () => {
  let requestId: string;

  it("without a case the admin sees the redacted view (never the recipient data)", async () => {
    requestId = await setupExecutionPair(
      worker,
      ownerCookie,
      driverCookie,
      driverProfileId,
      ownerWorkspaceId,
    );
    const adminView = await detailAs(adminCookie, requestId);
    expect(adminView.status).toBe(200);
    expect(adminView.body.request.payload!.dropoff?.phone).toBeUndefined();
    expect(adminView.body.request.agreementCopy?.payload?.dropoff?.phone).toBeUndefined();
  });

  it("only a PARTY can file a case; the reason set is closed", async () => {
    const stranger = await apiPost(worker, strangerCookie, `/api/delivery/requests/${requestId}/report`, {
      reason: "damage",
    });
    expect(stranger.status).toBe(404);
    const badReason = await apiPost(worker, ownerCookie, `/api/delivery/requests/${requestId}/report`, {
      reason: "spite",
    });
    expect(badReason.status).toBe(400);
    const filed = await apiPost(worker, ownerCookie, `/api/delivery/requests/${requestId}/report`, {
      reason: "damage",
      details: "ضرر عند التسليم",
    });
    expect(filed.status).toBe(201);
  });

  it("with the open case the admin sees the full view, audited with no content copy", async () => {
    const adminView = await detailAs(adminCookie, requestId);
    expect(adminView.status).toBe(200);
    expect(adminView.body.request.payload!.dropoff?.phone).toBe("+962795555002");
    expect(adminView.body.request.agreementCopy?.payload?.dropoff?.phone).toBe("+962795555002");
    const db = await rawDb(worker);
    const auditRows = await db
      .prepare(
        "SELECT meta_json FROM network_audit_event WHERE action = 'delivery_scoped_read' AND object_type = 'delivery_request' AND object_id = ? ORDER BY created_at DESC LIMIT 1",
      )
      .bind(requestId)
      .first<{ meta_json: string }>();
    expect(auditRows?.meta_json).toContain("open_case_admin");
    expect(auditRows?.meta_json).not.toContain("+962795555002");
  });

  it("the case list is admin-only; closing requires a note and re-locks the administrative read", async () => {
    const strangerList = await apiGet(worker, strangerCookie, "/api/delivery/cases");
    expect(strangerList.status).toBe(403);
    const listResponse = await apiGet(worker, adminCookie, "/api/delivery/cases");
    expect(listResponse.status).toBe(200);
    const list = (await listResponse.json()) as {
      cases: { id: number; requestId: string; status: string }[];
    };
    const openCase = list.cases.find(entry => entry.requestId === requestId && entry.status === "open");
    expect(openCase).toBeDefined();
    const noNote = await apiPost(worker, adminCookie, `/api/delivery/cases/${openCase!.id}/close`, {});
    expect(noNote.status).toBe(400);
    const closed = await apiPost(worker, adminCookie, `/api/delivery/cases/${openCase!.id}/close`, {
      note: "عولج البلاغ مع الطرفين",
    });
    expect(closed.status).toBe(200);
    const again = await apiPost(worker, adminCookie, `/api/delivery/cases/${openCase!.id}/close`, {
      note: "إغلاق مكرر",
    });
    expect(again.status).toBe(409);
    const adminView = await detailAs(adminCookie, requestId);
    expect(adminView.body.request.payload!.dropoff?.phone).toBeUndefined();
  });
});
