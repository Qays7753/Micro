/**
 * Material change to a CONFIRMED booking (contract 21 §3.2-2, OD11 — §17-8
 * closure): versioned proposal/acceptance. The accepted agreement stays
 * effective and immutable until the OTHER party explicitly accepts; reject
 * and withdraw are explicit; history is preserved; the proposer never decides
 * his own proposal; the row columns stay coherent with the amended copy.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiGet, apiPost, rawDb, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import { createApprovedDriver, type WorkerRefs, setupExecutionPair } from "./delivery.helpers.ts";

let worker: WorkerInstance;
let adminCookie: string;
let ownerCookie: string;
let driverCookie: string;
let driverProfileId: string;
let plainUserCookie: string;

beforeAll(async () => {
  worker = await startWorker();
  adminCookie = (await signInAs(worker, { sub: "ch-admin", email: "ch-admin@example.test" })).cookieHeader;
  const db = await rawDb(worker);
  const adminIdentity = await db
    .prepare("SELECT id FROM network_identity WHERE email = ?")
    .bind("ch-admin@example.test")
    .first<{ id: string }>();
  await db
    .prepare(
      "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) VALUES (?, 'admin', 'active', 'test', 1)",
    )
    .bind(adminIdentity!.id)
    .run();
  ownerCookie = (await signInAs(worker, { sub: "ch-owner", email: "ch-owner@example.test" })).cookieHeader;
  const refs: WorkerRefs = { worker, adminCookie };
  const driver = await createApprovedDriver(refs, "ch-driver@example.test", "ch-driver-sub");
  driverCookie = driver.cookie;
  driverProfileId = driver.driverProfileId;
  plainUserCookie = (await signInAs(worker, { sub: "ch-user", email: "ch-user@example.test" })).cookieHeader;
});

afterAll(async () => {
  await worker.close();
});

async function confirmedBooking(): Promise<string> {
  return setupExecutionPair(worker, ownerCookie, driverCookie, driverProfileId);
}

interface ChangeProposalRow {
  id: string;
  status: string;
  proposedBy: string;
  resultingVersion: number | null;
}

async function detailFor(requestId: string, cookie: string) {
  return (await (await apiGet(worker, cookie, `/api/delivery/requests/${requestId}`)).json()) as {
    request: {
      offeredFareMinor: string | null;
      payload: Record<string, unknown>;
      agreementCopy: Record<string, unknown> | null;
    };
    agreementVersion: number;
    changeProposals: ChangeProposalRow[];
    events: { axis: string; type: string; from: string | null; to: string | null }[];
  };
}

/** The worker error body nests reasons under `error.details`. */
async function reasonOf(response: Response): Promise<string | undefined> {
  const body = (await response.json()) as { error?: { details?: { reason?: string } } };
  return body.error?.details?.reason;
}

describe("material change proposals (OD11 — §17-8 closure)", () => {
  it("requester proposes; the agreement copy is untouched until acceptance", async () => {
    const requestId = await confirmedBooking();
    const before = await detailFor(requestId, ownerCookie);
    const propose = await apiPost(worker, ownerCookie, `/api/delivery/requests/${requestId}/change`, {
      changes: { fareMinor: "35000", schedule: { date: "2026-11-25" } },
      note: "تغيير الموعد والسعر",
    });
    expect(propose.status).toBe(201);
    const { proposal } = (await propose.json()) as { proposal: { id: string } };
    const after = await detailFor(requestId, ownerCookie);
    // Nothing changed yet: version, columns, copy — all identical.
    expect(after.agreementVersion).toBe(before.agreementVersion);
    expect(after.request.offeredFareMinor).toBe(before.request.offeredFareMinor);
    expect(after.request.agreementCopy).toEqual(before.request.agreementCopy);
    expect(after.changeProposals.find(p => p.id === proposal.id)?.status).toBe("pending");
    // The other party (driver) got the booking_modified notification.
    const driverNotifications = (await (await apiGet(worker, driverCookie, "/api/notifications")).json()) as {
      notifications: { type: string; targetPath: string }[];
    };
    expect(
      driverNotifications.notifications.some(
        n => n.type === "booking_modified" && n.targetPath === `/driver/booking/${requestId}`,
      ),
    ).toBe(true);
    return proposal.id;
  });

  it("acceptance by the other party applies a NEW version; columns follow; history kept", async () => {
    const requestId = await confirmedBooking();
    const before = await detailFor(requestId, ownerCookie);
    const propose = await apiPost(worker, ownerCookie, `/api/delivery/requests/${requestId}/change`, {
      changes: { fareMinor: "35000", schedule: { date: "2026-11-25" }, pickup: { area: "الهاشمي" } },
    });
    const { proposal } = (await propose.json()) as { proposal: { id: string } };
    const accept = await apiPost(worker, driverCookie, `/api/delivery/requests/${requestId}/change/decide`, {
      proposalId: proposal.id,
      decision: "accept",
    });
    expect(accept.status).toBe(200);
    const after = await detailFor(requestId, ownerCookie);
    expect(after.agreementVersion).toBe(before.agreementVersion + 1);
    expect(after.request.offeredFareMinor).toBe("35000");
    const copy = after.request.agreementCopy as {
      fareMinor: string;
      payload: { schedule?: { date?: string }; pickup?: { area?: string } };
      version: number;
      amendedByProposal: string;
    };
    expect(copy.fareMinor).toBe("35000");
    expect(copy.payload.schedule?.date).toBe("2026-11-25");
    expect(copy.payload.pickup?.area).toBe("الهاشمي");
    expect(copy.version).toBe(after.agreementVersion);
    expect(copy.amendedByProposal).toBe(proposal.id);
    // Events carry the version trail.
    expect(after.events.some(e => e.axis === "agreement" && e.type === "change_proposed")).toBe(true);
    expect(
      after.events.some(
        e =>
          e.axis === "agreement" &&
          e.type === "change_accepted" &&
          e.from === `v${before.agreementVersion}` &&
          e.to === `v${after.agreementVersion}`,
      ),
    ).toBe(true);
    // The driver got the accepted booking_modified notification.
    const driverNotifications = (await (await apiGet(worker, driverCookie, "/api/notifications")).json()) as {
      notifications: { type: string; payload: { accepted?: boolean } }[];
    };
    expect(
      driverNotifications.notifications.some(
        n => n.type === "booking_modified" && n.payload?.accepted === true,
      ),
    ).toBe(true);
    // Double decide refused.
    const again = await apiPost(worker, driverCookie, `/api/delivery/requests/${requestId}/change/decide`, {
      proposalId: proposal.id,
      decision: "accept",
    });
    expect(again.status).toBe(409);
  });

  it("rejection keeps the previous agreement fully in force", async () => {
    const requestId = await confirmedBooking();
    const before = await detailFor(requestId, ownerCookie);
    const propose = await apiPost(worker, ownerCookie, `/api/delivery/requests/${requestId}/change`, {
      changes: { fareMinor: "99000" },
    });
    const { proposal } = (await propose.json()) as { proposal: { id: string } };
    const reject = await apiPost(worker, driverCookie, `/api/delivery/requests/${requestId}/change/decide`, {
      proposalId: proposal.id,
      decision: "reject",
      note: "الأجرة الأصلية ثابتة",
    });
    expect(reject.status).toBe(200);
    const after = await detailFor(requestId, ownerCookie);
    expect(after.agreementVersion).toBe(before.agreementVersion);
    expect(after.request.offeredFareMinor).toBe(before.request.offeredFareMinor);
    expect(after.request.agreementCopy).toEqual(before.request.agreementCopy);
    expect(after.changeProposals.find(p => p.id === proposal.id)?.status).toBe("rejected");
    expect(after.events.some(e => e.axis === "agreement" && e.type === "change_rejected")).toBe(true);
  });

  it("withdrawal is explicit; a second pending proposal is refused", async () => {
    const requestId = await confirmedBooking();
    const first = await apiPost(worker, ownerCookie, `/api/delivery/requests/${requestId}/change`, {
      changes: { fareMinor: "40000" },
    });
    expect(first.status).toBe(201);
    const second = await apiPost(worker, ownerCookie, `/api/delivery/requests/${requestId}/change`, {
      changes: { fareMinor: "41000" },
    });
    expect(second.status).toBe(409);
    expect(await reasonOf(second)).toBe("change_proposal_already_pending");
    const { proposal } = (await first.json()) as { proposal: { id: string } };
    // The driver cannot withdraw the requester's proposal.
    const driverWithdraw = await apiPost(
      worker,
      driverCookie,
      `/api/delivery/requests/${requestId}/change/withdraw`,
      { proposalId: proposal.id },
    );
    expect(driverWithdraw.status).toBe(403);
    const withdraw = await apiPost(
      worker,
      ownerCookie,
      `/api/delivery/requests/${requestId}/change/withdraw`,
      {
        proposalId: proposal.id,
      },
    );
    expect(withdraw.status).toBe(200);
    const after = await detailFor(requestId, ownerCookie);
    expect(after.changeProposals.find(p => p.id === proposal.id)?.status).toBe("withdrawn");
    expect(after.request.agreementCopy).toEqual(
      (await detailFor(requestId, ownerCookie)).request.agreementCopy,
    );
  });

  it("the proposer never decides his own proposal (both directions)", async () => {
    const requesterCase = await confirmedBooking();
    const fromRequester = await apiPost(
      worker,
      ownerCookie,
      `/api/delivery/requests/${requesterCase}/change`,
      {
        changes: { fareMinor: "36000" },
      },
    );
    const { proposal: p1 } = (await fromRequester.json()) as { proposal: { id: string } };
    const ownerDecides = await apiPost(
      worker,
      ownerCookie,
      `/api/delivery/requests/${requesterCase}/change/decide`,
      {
        proposalId: p1.id,
        decision: "accept",
      },
    );
    expect(ownerDecides.status).toBe(403);
    expect(await reasonOf(ownerDecides)).toBe("other_party_decision_required");

    const driverCase = await confirmedBooking();
    const fromDriver = await apiPost(worker, driverCookie, `/api/delivery/requests/${driverCase}/change`, {
      changes: { fareMinor: "37000" },
    });
    const { proposal: p2 } = (await fromDriver.json()) as { proposal: { id: string } };
    const driverDecides = await apiPost(
      worker,
      driverCookie,
      `/api/delivery/requests/${driverCase}/change/decide`,
      {
        proposalId: p2.id,
        decision: "accept",
      },
    );
    expect(driverDecides.status).toBe(403);
    // Unrelated identities see nothing.
    const outsider = await apiGet(worker, plainUserCookie, `/api/delivery/requests/${driverCase}`);
    expect(outsider.status).toBe(404);
  });

  it("a vehicle amendment must point at an approved vehicle of THIS driver", async () => {
    const requestId = await confirmedBooking();
    const db = await rawDb(worker);
    const vehicle = await db
      .prepare("SELECT id FROM driver_vehicle WHERE driver_profile_id = ? AND status = 'approved'")
      .bind(driverProfileId)
      .first<{ id: string }>();
    expect(vehicle).not.toBeNull();
    const propose = await apiPost(worker, driverCookie, `/api/delivery/requests/${requestId}/change`, {
      changes: { vehicleId: vehicle!.id },
    });
    expect(propose.status).toBe(201);
    const { proposal } = (await propose.json()) as { proposal: { id: string } };
    const accept = await apiPost(worker, ownerCookie, `/api/delivery/requests/${requestId}/change/decide`, {
      proposalId: proposal.id,
      decision: "accept",
    });
    expect(accept.status).toBe(200);
    const after = await detailFor(requestId, ownerCookie);
    const copy = after.request.agreementCopy as { vehicle: { id: string } | null };
    expect(copy.vehicle?.id).toBe(vehicle!.id);

    // A made-up vehicle id is refused honestly.
    const other = await confirmedBooking();
    const badVehicle = await apiPost(worker, driverCookie, `/api/delivery/requests/${other}/change`, {
      changes: { vehicleId: "veh_does_not_exist" },
    });
    expect(badVehicle.status).toBe(409);
    expect(await reasonOf(badVehicle)).toBe("vehicle_not_approved_for_driver");
  });

  it("empty and invalid change payloads are honest 400s", async () => {
    const requestId = await confirmedBooking();
    const empty = await apiPost(worker, ownerCookie, `/api/delivery/requests/${requestId}/change`, {
      changes: {},
    });
    expect(empty.status).toBe(400);
    const badFare = await apiPost(worker, ownerCookie, `/api/delivery/requests/${requestId}/change`, {
      changes: { fareMinor: "not_a_number" },
    });
    expect(badFare.status).toBe(400);
    const badCollection = await apiPost(worker, ownerCookie, `/api/delivery/requests/${requestId}/change`, {
      changes: { collectionMinor: "-5" },
    });
    expect(badCollection.status).toBe(400);
    // Non-confirmed bookings refuse change proposals entirely.
    const fresh = await apiPost(worker, ownerCookie, "/api/delivery/requests", {
      driverProfileId,
      needType: "deliver_to_customer",
      pricingMode: "prepriced",
      offeredFareMinor: "300",
      payload: {
        pickup: { governorate: "عمان", area: "أ", name: "x", phone: "+962795555001", address: "y" },
        dropoff: { governorate: "الزرقاء", area: "ب", name: "z", phone: "+962795555002", address: "w" },
        load: { description: "صناديق", parcels: 1 },
        schedule: { date: "2026-11-21", pickupWindow: "09:00", dropoffWindow: "13:00" },
      },
    });
    const { request } = (await fresh.json()) as { request: { id: string } };
    const draftChange = await apiPost(worker, ownerCookie, `/api/delivery/requests/${request.id}/change`, {
      changes: { fareMinor: "1000" },
    });
    expect(draftChange.status).toBe(409);
    expect(await reasonOf(draftChange)).toBe("changes_require_confirmed_booking");
  });
});
