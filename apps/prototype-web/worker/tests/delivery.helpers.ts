/**
 * Shared Delivery test helpers: build a fully approved driver (person +
 * vehicle + evidence via the real API + admin review) and set up a confirmed
 * booking for execution-axis tests.
 */
import { expect } from "vitest";
import { apiPost, rawDb, signInAs, type WorkerInstance } from "./harness.ts";

export interface WorkerRefs {
  worker: WorkerInstance;
  adminCookie: string;
}

async function uploadMedia(refs: WorkerRefs, cookie: string, purpose: string): Promise<string> {
  const response = await refs.worker.fetch(`/api/media?purpose=${purpose}`, {
    method: "POST",
    headers: { "content-type": "image/png", origin: refs.worker.origin, "x-micro-api": "1", cookie },
    body: new Uint8Array([1, 2, 3, 4]),
  });
  const body = (await response.json()) as { media: { id: string } };
  return body.media.id;
}

/** Build an approved driver (OD22: person AND vehicle AND valid evidence). */
export async function createApprovedDriver(
  refs: WorkerRefs,
  email: string,
  sub: string,
): Promise<{ cookie: string; driverProfileId: string }> {
  const session = await signInAs(refs.worker, { sub, email });
  const cookie = session.cookieHeader;
  const profileResponse = await apiPost(refs.worker, cookie, "/api/driver/profile", {
    displayName: `سائق ${email}`,
    phone: "+962790000010",
    serviceAreas: ["عمان"],
  });
  const profile = (await profileResponse.json()) as { driverProfileId: string };
  const proofMedia = await uploadMedia(refs, cookie, "driver_vehicle_proof");
  await apiPost(refs.worker, cookie, "/api/driver/vehicle", {
    plate: `أ ب ${Math.floor(Math.random() * 99999)}`,
    vehicleType: "فان صغير",
    ownershipProofMediaId: proofMedia,
  });
  const identityMedia = await uploadMedia(refs, cookie, "driver_evidence");
  const licenseMedia = await uploadMedia(refs, cookie, "driver_evidence");
  await apiPost(refs.worker, cookie, "/api/driver/evidence", {
    category: "identity",
    mediaId: identityMedia,
  });
  await apiPost(refs.worker, cookie, "/api/driver/evidence", { category: "license", mediaId: licenseMedia });
  await apiPost(refs.worker, cookie, "/api/driver/submit", {});
  const db = await rawDb(refs.worker);
  const evidenceRows = (
    await db
      .prepare("SELECT id FROM driver_evidence WHERE driver_profile_id = ?")
      .bind(profile.driverProfileId)
      .all<{ id: string }>()
  ).results;
  for (const evidence of evidenceRows) {
    await apiPost(refs.worker, refs.adminCookie, `/api/delivery/review/evidence/${evidence.id}`, {
      action: "approve",
    });
  }
  const vehicleRow = await db
    .prepare("SELECT id FROM driver_vehicle WHERE driver_profile_id = ?")
    .bind(profile.driverProfileId)
    .first<{ id: string }>();
  await apiPost(refs.worker, refs.adminCookie, `/api/delivery/review/vehicle/${vehicleRow!.id}`, {
    action: "approve",
  });
  const approve = await apiPost(
    refs.worker,
    refs.adminCookie,
    `/api/delivery/review/driver/${profile.driverProfileId}`,
    { action: "approve" },
  );
  expect(approve.status).toBe(200);
  await apiPost(refs.worker, cookie, "/api/driver/accepting-new", { accepting: true });
  return { cookie, driverProfileId: profile.driverProfileId };
}

/** Create + submit + accept a prepriced directed request (confirmed booking). */
export async function setupExecutionPair(
  worker: WorkerInstance,
  ownerCookie: string,
  driverCookie: string,
  driverProfileId: string,
): Promise<string> {
  const created = await apiPost(worker, ownerCookie, "/api/delivery/requests", {
    driverProfileId,
    needType: "deliver_to_customer",
    pricingMode: "prepriced",
    offeredFareMinor: "300",
    payload: {
      pickup: {
        governorate: "عمان",
        area: "تلاع العلي",
        name: "ورشة",
        phone: "+962795555001",
        address: "شارع 1",
      },
      dropoff: {
        governorate: "الزرقاء",
        area: "وسط",
        name: "زبون",
        phone: "+962795555002",
        address: "بناية 2",
      },
      load: { description: "صناديق", parcels: 3, fragile: false },
      schedule: { pickupWindow: "09:00-11:00", dropoffWindow: "13:00-15:00", date: "2026-11-21" },
    },
  });
  expect(created.status).toBe(201);
  const { request } = (await created.json()) as { request: { id: string } };
  await apiPost(worker, ownerCookie, `/api/delivery/requests/${request.id}/submit`, {});
  const accepted = await apiPost(worker, driverCookie, `/api/driver/requests/${request.id}/accept`, {});
  expect(accepted.status).toBe(200);
  return request.id;
}
