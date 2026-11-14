/**
 * R1-17 (أمر المالك 2026-11-14 — Workstream A/DOC-039): ملخصات القرار على
 * بطاقات القوائم — وارد السائق ونظرة المالك يحملان المسار (المحافظتان)
 * والموعد (واسم السائق المعيّن للمالك) قبل فتح التفاصيل؛ والعناوين
 * التفصيلية والأسماء والهواتف والمناطق تبقى حصريًا خلف بوابة الإفصاح
 * (عقد 21 §الخصوصية) — البطاقة لا تحملها أبدًا. الضيف مرفوض، والأجنبي عن
 * الحجز لا يراه (فحوص سالبة).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiGet, apiPost, rawDb, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import { createApprovedDriver } from "./delivery.helpers.ts";

let worker: WorkerInstance;
let adminCookie: string;
let ownerCookie: string;
let driverCookie: string;
let otherDriverCookie: string;
let driverProfileId: string;

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

/** إنشاء + إرسال طلب موجه مسعّر (يبقى بانتظار رد السائق — حالة بطاقة الوارد). */
async function createSubmittedRequest(): Promise<string> {
  const response = await apiPost(worker, ownerCookie, "/api/delivery/requests", {
    driverProfileId,
    needType: "deliver_to_customer",
    pricingMode: "prepriced",
    offeredFareMinor: "300",
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
  const submitted = await apiPost(
    worker,
    ownerCookie,
    `/api/delivery/requests/${body.request.id}/submit`,
    {},
  );
  expect(submitted.status).toBe(200);
  return body.request.id;
}

interface SummaryCard {
  id: string;
  route?: { pickupGovernorate: string | null; dropoffGovernorate: string | null };
  schedule?: { date: string | null; pickupWindow: string | null };
  driverName?: string | null;
}

beforeAll(async () => {
  worker = await startWorker();
  adminCookie = (await signInAs(worker, { sub: "sum-admin", email: "sum-admin@example.test" })).cookieHeader;
  await grantAdmin("sum-admin@example.test");
  ownerCookie = (await signInAs(worker, { sub: "sum-owner", email: "sum-owner@example.test" })).cookieHeader;
  const driver = await createApprovedDriver(
    { worker, adminCookie },
    "sum-driver@example.test",
    "sum-driver-sub",
  );
  driverCookie = driver.cookie;
  driverProfileId = driver.driverProfileId;
  const otherDriver = await createApprovedDriver(
    { worker, adminCookie },
    "sum-other-driver@example.test",
    "sum-other-driver-sub",
  );
  otherDriverCookie = otherDriver.cookie;
});

afterAll(async () => {
  await worker.close();
});

describe("R1-17 — driver inbox summary cards (decision-critical fields before accepting)", () => {
  let requestId: string;

  it("the assigned driver's inbox card carries route and timing from the payload", async () => {
    requestId = await createSubmittedRequest();
    const response = await apiGet(worker, driverCookie, "/api/driver/requests");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { requests: SummaryCard[] };
    const card = body.requests.find(item => item.id === requestId);
    expect(card).toBeDefined();
    expect(card!.route).toEqual({ pickupGovernorate: "عمان", dropoffGovernorate: "الزرقاء" });
    expect(card!.schedule).toEqual({ date: "2026-11-20", pickupWindow: "10:00-12:00" });
  });

  it("the inbox summary never carries detailed addresses, areas, names, or phones (disclosure gate)", async () => {
    const response = await apiGet(worker, driverCookie, "/api/driver/requests");
    const text = JSON.stringify(await response.json());
    expect(text).not.toContain("تلاع العلي");
    expect(text).not.toContain("وسط البلد");
    expect(text).not.toContain("شارع الصناعة");
    expect(text).not.toContain("بناية 4");
    expect(text).not.toContain("ورشة المصدر");
    expect(text).not.toContain("+962795555001");
    expect(text).not.toContain("+962795555002");
  });

  it("another approved driver never sees a request directed to someone else", async () => {
    const response = await apiGet(worker, otherDriverCookie, "/api/driver/requests");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { requests: SummaryCard[] };
    expect(body.requests.find(item => item.id === requestId)).toBeUndefined();
  });

  it("an unauthenticated guest is refused (401) — hiding is not the authorization", async () => {
    const inbox = await worker.fetch("/api/driver/requests", {
      headers: { origin: worker.origin, "x-micro-api": "1" },
    });
    expect(inbox.status).toBe(401);
    const overview = await worker.fetch("/api/delivery/overview", {
      headers: { origin: worker.origin, "x-micro-api": "1" },
    });
    expect(overview.status).toBe(401);
  });
});

describe("R1-17 — owner overview summary cards (route, timing, assigned driver)", () => {
  it("the owner's overview card carries route, timing, and the assigned driver's public name", async () => {
    const response = await apiGet(worker, ownerCookie, "/api/delivery/overview");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { requests: SummaryCard[] };
    const card = body.requests.find(item => item.id !== undefined);
    expect(card).toBeDefined();
    expect(card!.route).toEqual({ pickupGovernorate: "عمان", dropoffGovernorate: "الزرقاء" });
    expect(card!.schedule).toEqual({ date: "2026-11-20", pickupWindow: "10:00-12:00" });
    /* الاسم من النسخة العامة المعتمدة (public_copy_json) — نمط الكشوف نفسه. */
    expect(typeof card!.driverName).toBe("string");
    expect(card!.driverName).toContain("سائق");
  });

  it("the owner overview summary never carries detailed addresses, areas, names, or phones", async () => {
    const response = await apiGet(worker, ownerCookie, "/api/delivery/overview");
    const text = JSON.stringify(await response.json());
    expect(text).not.toContain("تلاع العلي");
    expect(text).not.toContain("وسط البلد");
    expect(text).not.toContain("شارع الصناعة");
    expect(text).not.toContain("بناية 4");
    expect(text).not.toContain("ورشة المصدر");
    expect(text).not.toContain("+962795555001");
    expect(text).not.toContain("+962795555002");
  });

  it("a stranger's overview never includes another requester's booking", async () => {
    const strangerCookie = (
      await signInAs(worker, { sub: "sum-stranger", email: "sum-stranger@example.test" })
    ).cookieHeader;
    const response = await apiGet(worker, strangerCookie, "/api/delivery/overview");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { requests: SummaryCard[] };
    expect(body.requests.length).toBe(0);
  });
});
