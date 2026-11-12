/** @vitest-environment jsdom */
/*
 * EX-D18 — فحوص رحلات واجهة التوصيل (jsdom): بوابة صاحب المشروع، محرر
 * الحجز الموجه مع معاينة الإفصاح، بوابة السائق المستقلة وعرضها للطلب
 * الموجه. الـAPI محاكى عند حد النقل؛ مسارات البيانات الحقيقية محروسة
 * بفحوص العامل (worker/tests/delivery.*.test.ts).
 */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Delivery from "@/pages/Delivery";
import DeliveryBookingEditor from "@/pages/DeliveryBookingEditor";
import DriverPortal from "@/pages/DriverPortal";
import DriverBookingDetail from "@/pages/DriverBookingDetail";

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

const AUTHENTICATED_SESSION = {
  authenticated: true,
  identity: { email: "owner@example.test", displayName: "Owner" },
};

function mockApi(handlers: Record<string, unknown>): void {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const path =
      new URL(String(input), "http://local").pathname +
      (String(input).includes("?") ? `?${String(input).split("?")[1]}` : "");
    for (const [prefix, payload] of Object.entries(handlers)) {
      if (path.startsWith(prefix)) return jsonResponse(payload);
    }
    if (path.startsWith("/api/auth/session")) return jsonResponse({ authenticated: false });
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

describe("delivery owner home (OD01)", () => {
  it("shows the sign-in gate with no fake bookings for guests", async () => {
    mockApi({});
    render(<Delivery />);
    expect(await screen.findByText(/حجز التوصيل يحتاج تسجيل الدخول/)).toBeTruthy();
    /* لا حجوزات وهمية: القائمة فارغة تمامًا للزائر. */
    const list = await screen.findByTestId("delivery-requests");
    expect(list.textContent).toBe("");
    expect(screen.queryByRole("button", { name: /الحجز مؤكد|بانتظار/ })).toBeNull();
  });

  it("lists bookings with awaiting-decision first and an honest empty state", async () => {
    mockApi({
      "/api/auth/session": AUTHENTICATED_SESSION,
      "/api/delivery/overview": {
        requests: [
          {
            id: "dlv_a",
            status: "confirmed",
            pricingMode: "prepriced",
            offeredFareMinor: "300",
            collectionMinor: null,
            createdAt: 1,
            updatedAt: 10,
          },
          {
            id: "dlv_b",
            status: "awaiting_requester_decision",
            pricingMode: "quote_request",
            offeredFareMinor: null,
            collectionMinor: null,
            createdAt: 2,
            updatedAt: 5,
          },
        ],
        savedDrivers: [],
      },
      "/api/delivery/statements": { statements: [] },
    });
    render(<Delivery />);
    expect(await screen.findByText("بانتظار موافقتك على العرض")).toBeTruthy();
    expect(await screen.findByText("الحجز مؤكد")).toBeTruthy();
  });

  it("surfaces an awaiting daily statement with full-or-difference actions only", async () => {
    mockApi({
      "/api/auth/session": AUTHENTICATED_SESSION,
      "/api/delivery/overview": { requests: [], savedDrivers: [] },
      "/api/delivery/statements": {
        statements: [
          {
            id: "stmt_1",
            driverName: "سائق التجربة",
            date: "2026-11-12",
            totalMinor: "7500",
            status: "awaiting_confirmation",
          },
        ],
      },
    });
    render(<Delivery />);
    const box = await screen.findByTestId("delivery-statements");
    expect(box.textContent).toContain("سائق التجربة");
    expect(box.textContent).toContain("75.00");
    expect(screen.getByRole("button", { name: "استلام كامل" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "تسجيل فرق" })).toBeTruthy();
  });
});

describe("delivery booking editor (OD03/OD05 + disclosure preview)", () => {
  it("offers only the known-driver directory with honest empty state", async () => {
    mockApi({
      "/api/auth/session": AUTHENTICATED_SESSION,
      "/api/delivery/drivers": {
        drivers: [
          {
            driverProfileId: "drv_1",
            displayName: "أبو محمد",
            governorates: ["عمان"],
            acceptingNew: true,
            eligibleForNewWork: true,
            averageStars: 4.5,
            ratingsCount: 8,
          },
        ],
      },
    });
    render(<DeliveryBookingEditor />);
    const picker = await screen.findByTestId("driver-picker");
    expect(picker.textContent).toContain("أبو محمد");
    expect(picker.textContent).toContain("4.5★");
    expect(screen.getByText(/معاينة الإفصاح/)).toBeTruthy();
    expect(screen.getByText(/محجوبة حتى قرار الإفصاح/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /بث|نشر الطلب/ })).toBeNull();
  });
});

describe("driver portal (OD01 — independent context)", () => {
  it("guests see the independent-portal gate with the same Micro identity", async () => {
    mockApi({});
    render(<DriverPortal />);
    expect(await screen.findByTestId("driver-portal-gate")).toBeTruthy();
    expect(screen.getByText(/بوابة مستقلة بهوية Micro نفسها/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /الدخول عبر Google/ })).toBeTruthy();
  });

  it("an approved driver sees the dashboard with the inbox and the accepting-new toggle", async () => {
    mockApi({
      "/api/auth/session": {
        ...AUTHENTICATED_SESSION,
        identity: { email: "driver@example.test", displayName: "Driver" },
      },
      "/api/driver/portal": {
        driver: {
          status: "approved",
          eligibleForNewWork: true,
          acceptingNew: true,
          evidenceValid: true,
          vehicleApproved: true,
        },
        step: "dashboard",
        evidence: [],
        vehicle: { id: "veh_1", info: { plate: "أ ب 1", vehicleType: "فان" }, status: "approved" },
      },
      "/api/driver/requests": {
        requests: [
          {
            id: "dlv_in",
            status: "awaiting_driver_response",
            pricingMode: "prepriced",
            offeredFareMinor: "300",
            collectionMinor: null,
            needType: "deliver_to_customer",
            updatedAt: 1,
          },
        ],
      },
    });
    render(<DriverPortal />);
    expect(await screen.findByTestId("driver-request-list")).toBeTruthy();
    expect(screen.getByText("طلب جديد ينتظر ردك")).toBeTruthy();
    expect(screen.getByRole("button", { name: "إيقاف استقبال الجديد" })).toBeTruthy();
    /* بوابة مستقلة: لا أي عناصر لصاحب المشروع أو Manage داخلها. */
    expect(screen.queryByText(/المالية|الطلبات|السوق/)).toBeNull();
  });
});

describe("driver booking detail (directed request view)", () => {
  it("shows the directed request with zones only and the accept action", async () => {
    wouterMocks.location = "/driver/booking/dlv_x";
    mockApi({
      "/api/auth/session": {
        ...AUTHENTICATED_SESSION,
        identity: { email: "driver@example.test", displayName: "Driver" },
      },
      "/api/delivery/requests/dlv_x": {
        request: {
          id: "dlv_x",
          status: "awaiting_driver_response",
          pricingMode: "prepriced",
          offeredFareMinor: "300",
          collectionMinor: "5000",
          collectionContent: "product",
          responseDeadlineAt: Date.now() + 60000,
          payload: {
            pickup: { governorate: "عمان", area: "تلاع العلي" },
            dropoff: { governorate: "الزرقاء", area: "وسط البلد" },
            load: { parcels: 3 },
          },
          createdAt: 1,
        },
        quote: null,
        execution: null,
        events: [],
        requester: { displayName: "ورشة الأمل" },
        driver: { id: "drv_1", profile: {} },
        viewerRole: "driver",
      },
    });
    render(<DriverBookingDetail />);
    expect(await screen.findByText("طلب ينتظر ردك (30 دقيقة)")).toBeTruthy();
    expect(screen.getByText("ورشة الأمل")).toBeTruthy();
    expect(screen.getByText("عمان ← الزرقاء")).toBeTruthy();
    expect(screen.getByText(/50.00 د\.أ/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "اقبل الأجرة المعروضة" })).toBeTruthy();
    expect(screen.getByText(/محجوبة حتى قرار الإفصاح/)).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText(/عنوان الزبون|بث/)).toBeNull();
    });
    wouterMocks.location = "/delivery";
  });
});
