/** @vitest-environment jsdom */
/*
 * EX-D18 (2026-11-12) — فحوص مباشرة للأسطح الأربع التي كشفتها راتشة خريطة
 * الاختبارات (RV3-NF-7/D-15) بلا اختبار يستوردها مباشرة: تفاصيل الحجز
 * (المالك)، دليل السائقين، محرر إعلان السوق، وطابور مراجعة السوق. الـAPI
 * محاكى عند حد النقل؛ السلوك الخادمي محروس بفحوص العامل.
 */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import DeliveryBookingDetail from "@/pages/DeliveryBookingDetail";
import DeliveryDrivers from "@/pages/DeliveryDrivers";
import MarketListingEditor from "@/pages/MarketListingEditor";
import MarketReview from "@/pages/MarketReview";

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
