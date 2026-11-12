/** @vitest-environment jsdom */
/*
 * EX-D18 (2026-11-12) — فحوص مباشرة للأسطح التي كشفتها راتشة خريطة
 * الاختبارات (RV3-NF-7/D-15): تفاصيل الحجز (المالك)، دليل السائقين، محرر
 * إعلان السوق، طابور مراجعة السوق — ثم إغلاق فجوات §17 (جلسة 2026-11-12
 * الثالثة): طابور مراجعة التوصيل، إجابة محاولة الاتصال (OD15)، والتحديث
 * الرقمي المباشر للسعر (OD-09). الـAPI محاكى عند حد النقل؛ السلوك الخادمي
 * محروس بفحوص العامل.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import DeliveryBookingDetail from "@/pages/DeliveryBookingDetail";
import DeliveryDrivers from "@/pages/DeliveryDrivers";
import DeliveryReviewQueue from "@/pages/DeliveryReviewQueue";
import MarketListingEditor from "@/pages/MarketListingEditor";
import MarketReview from "@/pages/MarketReview";
import MarketVendorWorkspace from "@/pages/MarketVendorWorkspace";

const wouterMocks = vi.hoisted(() => ({ location: "/delivery", search: "" }));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, vi.fn()],
  useParams: () => ({}),
  useSearch: () => wouterMocks.search,
}));

const fetchMock = vi.fn();

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => data,
    text: async () => JSON.stringify(data),
    clone() {
      return this;
    },
  } as unknown as Response;
}

function mockApi(handlers: Record<string, unknown>): void {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const path = new URL(String(input), "http://local").pathname;
    for (const [prefix, payload] of Object.entries(handlers)) {
      if (path.startsWith(prefix)) return jsonResponse(payload);
    }
    if (path.startsWith("/api/auth/session")) return jsonResponse({ authenticated: true });
    return jsonResponse({}, 404);
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("delivery owner booking detail (direct)", () => {
  it("renders the frozen agreement route and the labeled timeline", async () => {
    wouterMocks.location = "/delivery/booking/req_1";
    mockApi({
      "/api/delivery/requests/req_1": {
        request: {
          id: "req_1",
          status: "confirmed",
          pricingMode: "prepriced",
          offeredFareMinor: "30000",
          collectionMinor: null,
          collectionContent: null,
          responseDeadlineAt: null,
          payload: {
            pickup: { governorate: "عمان" },
            dropoff: { governorate: "الزرقاء" },
            schedule: { date: "2026-11-20", pickupWindow: "10:00-12:00" },
            load: { description: "صناديق", parcels: 6 },
          },
          agreementCopy: null,
          createdAt: 1,
        },
        quote: null,
        execution: {
          execution: "in_transit",
          confirmation: "none",
          contact: "not_attempted",
          goods: "with_driver",
          money: "none",
        },
        events: [{ axis: "request", type: "driver_accepted", from: null, to: null, at: 1_800_000_000_000 }],
        requester: { id: "idn_1", displayName: "Owner" },
        driver: { id: "drv_1", profile: { displayName: "سائق" } },
        viewerRole: "requester",
      },
    });
    render(<DeliveryBookingDetail />);
    expect(await screen.findByText("الحجز مؤكد")).toBeTruthy();
    expect(await screen.findByText(/عمان/)).toBeTruthy();
    expect(await screen.findByText(/الزرقاء/)).toBeTruthy();
    expect(await screen.findByText(/قبل السائق/)).toBeTruthy();
  });
});

describe("delivery drivers directory (direct)", () => {
  it("renders the approved directory with the saved-driver state", async () => {
    wouterMocks.location = "/delivery/drivers";
    mockApi({
      "/api/delivery/drivers": {
        drivers: [
          {
            driverProfileId: "drv_1",
            displayName: "أبو محمد",
            governorates: ["عمان"],
            acceptingNew: true,
            eligibleForNewWork: true,
            averageStars: 5,
            ratingsCount: 2,
          },
        ],
      },
      "/api/delivery/overview": { requests: [], savedDrivers: [{ driverProfileId: "drv_1", profile: {} }] },
    });
    render(<DeliveryDrivers />);
    expect(await screen.findByText("أبو محمد")).toBeTruthy();
    expect(await screen.findByText(/إلغاء الحفظ/)).toBeTruthy();
  });
});

describe("market listing editor (direct)", () => {
  it("edit mode loads the existing draft work copy — never a duplicate", async () => {
    wouterMocks.location = "/market/vendor/lst_1";
    mockApi({
      "/api/market/meta": { categories: [], governorates: [] },
      "/api/market/vendor/listings/lst_1": {
        listing: {
          id: "lst_1",
          status: "draft",
          revisionStatus: "none",
          title: "أكواب تغليف",
          category: "packaging",
          governorate: "عمان",
          description: "وصف قائم",
          contact: { type: "phone", value: "+962790000001" },
          pricing: { mode: "fixed", priceMicroJod: "1500000", basis: { units: "12", unit: "حبة" } },
          quantity: { unit: "حبة", minQuantityMilli: "24000", stepMilli: "12000", unpacked: true },
          mediaIds: [],
        },
      },
    });
    render(
      <UnsavedChangesProvider navigate={() => {}}>
        <MarketListingEditor />
      </UnsavedChangesProvider>,
    );
    const title = await screen.findByDisplayValue("أكواب تغليف");
    expect(title).toBeTruthy();
    // the exact reviewed price (1.5 JOD) and quantity (24) come back as strings
    expect(await screen.findByDisplayValue("1.5")).toBeTruthy();
    expect(await screen.findByDisplayValue("24")).toBeTruthy();
    expect(await screen.findByText("تعديل إعلان")).toBeTruthy();
  });
});

describe("market review queue (direct)", () => {
  it("renders labeled profile fields and statuses — never raw JSON", async () => {
    wouterMocks.location = "/market/review";
    mockApi({
      "/api/market/review/queue": {
        profiles: [
          {
            id: "sp_1",
            work_copy_json: JSON.stringify({
              displayName: "مورد التجربة",
              contactPhone: "+962790000009",
              governorate: "إربد",
            }),
            submitted_at: 1,
          },
        ],
        listings: [
          {
            id: "lst_9",
            title: "إعلان قيد المراجعة",
            status: "submitted",
            revision_status: "none",
            work_copy_json: "{}",
          },
        ],
        media: [],
        reports: [{ id: 1, object_id: "lst_9", reason: "misleading", details: null }],
      },
    });
    render(<MarketReview />);
    expect(await screen.findByText(/مورد التجربة/)).toBeTruthy();
    expect(await screen.findByText(/مضلل/)).toBeTruthy();
    // the raw JSON blob must never reach the reviewer
    expect(screen.queryByText(/work_copy_json/)).toBeNull();
    expect(screen.queryByText(/\{/)).toBeNull();
  });
});

describe("delivery review queue (direct — §17-1 closure)", () => {
  it("renders labeled drivers, evidence, vehicles, and rating comments — never raw JSON", async () => {
    wouterMocks.location = "/delivery/review";
    mockApi({
      "/api/delivery/review/queue": {
        drivers: [
          {
            id: "drv_pending_1",
            work_copy_json: JSON.stringify({
              displayName: "سائق التجربة",
              phone: "+962790000012",
              serviceAreas: ["عمان", "الزرقاء"],
            }),
            submitted_at: 1,
          },
        ],
        evidence: [
          {
            id: "ev_1",
            driver_profile_id: "drv_pending_1",
            category: "license",
            status: "pending",
            expires_at: null,
            media_id: "med_1",
          },
        ],
        vehicles: [
          {
            id: "veh_1",
            driver_profile_id: "drv_pending_1",
            info_json: JSON.stringify({ plate: "23-4567", vehicleType: "شاحنة صغيرة" }),
            status: "pending",
          },
        ],
        ratingComments: [
          { id: "rt_1", request_id: "req_1", stars: 5, comment: "سريع وأمين", status: "pending_review" },
        ],
      },
    });
    render(<DeliveryReviewQueue />);
    expect(await screen.findByText(/سائق التجربة/)).toBeTruthy();
    expect(await screen.findByText(/رخصة قيادة/)).toBeTruthy();
    expect(await screen.findByText(/23-4567/)).toBeTruthy();
    expect(await screen.findByText(/سريع وأمين/)).toBeTruthy();
    // the honest dependency note for driver approval (OD22)
    expect(await screen.findByText(/مركبة معتمدة وإثباتَي الهوية والرخصة/)).toBeTruthy();
    // raw JSON never reaches the reviewer
    expect(screen.queryByText(/work_copy_json/)).toBeNull();
    expect(screen.queryByText(/info_json/)).toBeNull();
  });
});

describe("owner contact-attempt answer (direct — OD15 §17-3 closure)", () => {
  it("shows the two explicit answer buttons when the driver recorded a contact attempt", async () => {
    wouterMocks.location = "/delivery/booking/req_2";
    mockApi({
      "/api/delivery/requests/req_2": {
        request: {
          id: "req_2",
          status: "confirmed",
          pricingMode: "prepriced",
          offeredFareMinor: "30000",
          collectionMinor: null,
          collectionContent: null,
          responseDeadlineAt: null,
          payload: {},
          agreementCopy: null,
          createdAt: 1,
        },
        quote: null,
        execution: {
          execution: "undeliverable_declared",
          confirmation: "none",
          contact: "attempt_no_answer",
          goods: "with_driver",
          money: "none",
        },
        events: [],
        requester: { id: "idn_1", displayName: "Owner" },
        driver: { id: "drv_1", profile: { displayName: "سائق" } },
        viewerRole: "requester",
      },
    });
    render(<DeliveryBookingDetail />);
    expect(await screen.findByTestId("contact-answer")).toBeTruthy();
    expect(await screen.findByText("تم التواصل فعلًا")).toBeTruthy();
    expect(await screen.findByText("لم يتم التواصل")).toBeTruthy();
    // the honest status line from the canonical labels
    expect(await screen.findByText(/حاول الاتصال بك دون رد/)).toBeTruthy();
  });
});

describe("vendor direct price update (direct — OD-09 §17-2 closure)", () => {
  it("prefills the current fixed price and posts the exact micro value on save", async () => {
    wouterMocks.location = "/market/vendor";
    const posted: { url: string; body: string }[] = [];
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), "http://local").pathname;
      if (init?.method === "POST" && path.includes("/direct-update")) {
        posted.push({ url: path, body: String(init.body) });
        return jsonResponse({ ok: true });
      }
      if (path.startsWith("/api/market/vendor/overview")) {
        return jsonResponse({
          vendor: { status: "approved", supplierProfileId: "sp_1" },
          vendorReviewReason: null,
          profileFields: { displayName: "مورد", contactPhone: "+962790000000", governorate: "عمان" },
          listings: [
            {
              id: "lst_pub",
              title: "أكواب منشورة",
              status: "approved_for_publish",
              revisionStatus: "none",
              freshness: "fresh",
              availabilityStatus: "available",
              priceMode: "fixed",
              priceMicroJod: "1500000",
              updatedAt: 1,
            },
          ],
        });
      }
      if (path.startsWith("/api/auth/session")) return jsonResponse({ authenticated: true });
      return jsonResponse({}, 404);
    });
    render(
      <UnsavedChangesProvider navigate={() => {}}>
        <MarketVendorWorkspace />
      </UnsavedChangesProvider>,
    );
    fireEvent.click(await screen.findByText("تحديث السعر"));
    // prefill = the current reviewed price (1.5 JOD), never a blank guess
    expect(await screen.findByDisplayValue("1.5")).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue("1.5"), { target: { value: "2.25" } });
    fireEvent.click(await screen.findByText("حفظ السعر"));
    await waitFor(() => {
      expect(posted).toHaveLength(1);
      expect(posted[0]?.url).toContain("/api/market/vendor/listings/lst_pub/direct-update");
      expect(posted[0]?.body).toContain("2250000");
    });
    // the moderation-event honesty note is visible
    expect(await screen.findByText(/حدث إشرافي/)).toBeTruthy();
  });
});
