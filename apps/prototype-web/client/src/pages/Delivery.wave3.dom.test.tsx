/** @vitest-environment jsdom */
/*
 * Post-Group 6 Wave 3 (القرار النهائي 2026-11-21 — Q73/Q75/Q100/Q268/G09):
 * فحوص DOM لمحرر الحجز والصفحات المتأثرة — فئات الحمل وشرائح الوزن، نوع
 * «حجز لفترة» بنافذته الإلزامية، موافقة كشف بيانات المستلم (MD-01)، علامة
 * «يغطي مسارك» وترتيب الدليل (Q73)، وتنبيه الحجوزات المتداخلة (Q268).
 * الـAPI محاكى عند حد النقل؛ السلوك الخادمي محروس بفحوص العامل.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import DeliveryBookingEditor from "@/pages/DeliveryBookingEditor";
import DeliveryBookingDetail from "@/pages/DeliveryBookingDetail";
import DriverBookingDetail from "@/pages/DriverBookingDetail";
import Profile from "@/pages/Profile";

const wouterMocks = vi.hoisted(() => ({ location: "/delivery", search: "" }));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, vi.fn()],
  useParams: () => ({}),
  useSearch: () => wouterMocks.search,
}));
/* ملف الحساب يقرأ خدمات النموذج الأولي — تُحاكى عند الحد نفسه كما في
 * Profile.ui.test.tsx (قسم التنبيهات لا يمسها). */
vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn().mockReturnValue({
    ownerProfile: {
      ensureLocal: vi
        .fn()
        .mockResolvedValue({ ok: true, value: { ownerId: "owner-x", displayName: null, email: null } }),
      read: vi.fn(),
      save: vi
        .fn()
        .mockResolvedValue({ ok: true, value: { ownerId: "owner-x", displayName: "ليان", email: null } }),
    },
    profiles: {
      load: vi.fn().mockResolvedValue({
        ok: true,
        value: { activityName: "مشغل الاختبار", currency: "JOD" },
      }),
    },
    cashContinuity: {
      ensureOpening: vi.fn(),
      overview: vi.fn().mockResolvedValue({ ok: true, value: { wallets: [{ name: "الصندوق" }] } }),
    },
    preferences: {
      load: vi.fn(),
      save: vi.fn(),
      readLastVerifiedExport: vi.fn().mockResolvedValue({ ok: true, value: null }),
    },
    dataVersion: { current: 0 },
    notifyDataChanged: vi.fn(),
  }),
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
  workspaces: [{ id: "ws_1", displayName: "مشروع الاختبار" }],
};

const DIRECTORY = {
  drivers: [
    {
      driverProfileId: "drv_cover",
      displayName: "سائق مغطٍ",
      governorates: ["عمان", "الزرقاء"],
      acceptingNew: true,
      eligibleForNewWork: true,
      averageStars: 4.5,
      ratingsCount: 8,
      coversRoute: true,
    },
    {
      driverProfileId: "drv_out",
      displayName: "سائق خارج التغطية",
      governorates: ["العقبة"],
      acceptingNew: true,
      eligibleForNewWork: true,
      averageStars: null,
      ratingsCount: 0,
      coversRoute: false,
    },
  ],
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

describe("Wave 3 booking editor (Q73/Q75/Q100/MD-01)", () => {
  it("shows the load class and weight band selects with the four/final-decision options", async () => {
    mockApi({
      "/api/auth/session": AUTHENTICATED_SESSION,
      "/api/delivery/drivers": DIRECTORY,
    });
    render(
      <UnsavedChangesProvider navigate={() => {}}>
        <DeliveryBookingEditor />
      </UnsavedChangesProvider>,
    );
    const loadClass = await screen.findByTestId("load-class");
    expect(loadClass.textContent).toContain("صغير — يُحمل باليد");
    expect(loadClass.textContent).toContain("متوسط — صندوق سيارة");
    expect(loadClass.textContent).toContain("كبير — بكب");
    expect(loadClass.textContent).toContain("كبير جدًا — فان");
    const weightBand = screen.getByTestId("weight-band");
    expect(weightBand.textContent).toContain("أقل من 10 كغ");
    expect(weightBand.textContent).toContain("من 10 إلى 50 كغ");
    expect(weightBand.textContent).toContain("أكثر من 50 كغ");
  });

  it("the period type swaps the goods fields for the mandatory start/end window", async () => {
    mockApi({
      "/api/auth/session": AUTHENTICATED_SESSION,
      "/api/delivery/drivers": DIRECTORY,
    });
    render(
      <UnsavedChangesProvider navigate={() => {}}>
        <DeliveryBookingEditor />
      </UnsavedChangesProvider>,
    );
    await screen.findByTestId("load-class");
    fireEvent.change(screen.getByDisplayValue("توصيل للزبون").closest("select")!, {
      target: { value: "period_booking" },
    });
    expect(screen.getByTestId("period-start")).toBeTruthy();
    expect(screen.getByTestId("period-end")).toBeTruthy();
    expect(screen.queryByTestId("load-class")).toBeNull();
    expect(screen.queryByTestId("weight-band")).toBeNull();
  });

  it("the covering driver comes first with the badge; picking an outside driver shows the honest notice", async () => {
    mockApi({
      "/api/auth/session": AUTHENTICATED_SESSION,
      "/api/delivery/drivers": DIRECTORY,
    });
    render(
      <UnsavedChangesProvider navigate={() => {}}>
        <DeliveryBookingEditor />
      </UnsavedChangesProvider>,
    );
    const picker = await screen.findByTestId("driver-picker");
    /* Q73: السائق المغطي يتصدر القائمة بعلامة «يغطي مسارك»، والخارج يتبعه —
     * الترتيب هيكلي (العنصران input داخل القائمة بالترتيب نفسه). */
    expect(picker.textContent).toContain("يغطي مسارك");
    const radios = Array.from(picker.querySelectorAll("input[type=radio]")) as HTMLInputElement[];
    expect(radios.length).toBe(2);
    const coveringLabel = radios[0]!.closest("label")!;
    const outsideLabel = radios[1]!.closest("label")!;
    expect(coveringLabel.textContent).toContain("سائق مغطٍ");
    expect(outsideLabel.textContent).toContain("سائق خارج التغطية");
    expect(screen.queryByTestId("outside-coverage-notice")).toBeNull();
    fireEvent.click(outsideLabel);
    expect(screen.getByTestId("outside-coverage-notice").textContent).toContain("خارج تغطية هذا المسار");
    expect(screen.getByTestId("outside-coverage-notice").textContent).toContain("الحجز مسموح");
  });
});

const CONFIRMED_DETAIL = {
  request: {
    id: "dlv_1",
    status: "confirmed",
    pricingMode: "prepriced",
    needType: "deliver_to_customer",
    loadClass: "small",
    weightBand: "under_10kg",
    pieceCount: 2,
    scheduledStartAt: Date.now() + 3_600_000,
    scheduledEndAt: Date.now() + 7_200_000,
    driverHasOtherBookingsInPeriod: true,
    recipientConsentActive: true,
    offeredFareMinor: "300",
    collectionMinor: null,
    collectionContent: null,
    responseDeadlineAt: null,
    payload: {
      pickup: { governorate: "عمان", area: "أ" },
      dropoff: { governorate: "الزرقاء", area: "ب" },
    },
    agreementCopy: null,
    createdAt: Date.now(),
  },
  quote: null,
  execution: {
    execution: "not_started",
    confirmation: "none",
    contact: "not_attempted",
    goods: "at_source",
    money: "none",
    confirmationRequestedAt: null,
  },
  agreementVersion: 1,
  consentProposals: [],
  changeProposals: [],
  events: [],
  requester: { id: "idn_1", displayName: "Owner" },
  driver: { id: "drv_1", profile: { displayName: "سائق" } },
  viewerRole: "requester",
};

describe("Wave 3 booking detail (Q268/MD-01/Q242)", () => {
  it("shows the other-bookings notice (no details) and the consent revoke button", async () => {
    mockApi({
      "/api/auth/session": AUTHENTICATED_SESSION,
      "/api/delivery/requests/dlv_1": CONFIRMED_DETAIL,
    });
    wouterMocks.location = "/delivery/booking/dlv_1";
    render(
      <UnsavedChangesProvider navigate={() => {}}>
        <DeliveryBookingDetail />
      </UnsavedChangesProvider>,
    );
    const notice = await screen.findByTestId("driver-other-bookings");
    expect(notice.textContent).toContain("حجوزات أخرى في نفس الفترة");
    expect(notice.textContent).not.toContain("dlv_");
    expect(screen.getByText(/اسحب موافقة إظهار بيانات المستلم/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /لم يحضر السائق/ })).toBeTruthy();
  });

  it("the expired window shows the explicit «احجز سائقًا آخر» button (G09)", async () => {
    mockApi({
      "/api/auth/session": AUTHENTICATED_SESSION,
      "/api/delivery/requests/dlv_1": {
        ...CONFIRMED_DETAIL,
        request: {
          ...CONFIRMED_DETAIL.request,
          status: "response_expired",
          scheduledStartAt: null,
          scheduledEndAt: null,
          driverHasOtherBookingsInPeriod: false,
          recipientConsentActive: false,
        },
      },
    });
    wouterMocks.location = "/delivery/booking/dlv_1";
    render(
      <UnsavedChangesProvider navigate={() => {}}>
        <DeliveryBookingDetail />
      </UnsavedChangesProvider>,
    );
    expect(await screen.findByTestId("book-another-driver")).toBeTruthy();
    expect(screen.getByRole("button", { name: /احجز سائقًا آخر/ })).toBeTruthy();
  });
});

describe("Wave 3 driver booking detail (Q106/MD-04)", () => {
  it("offers the written-reason cancel before pickup only", async () => {
    mockApi({
      "/api/auth/session": AUTHENTICATED_SESSION,
      "/api/delivery/requests/dlv_1": {
        ...CONFIRMED_DETAIL,
        viewerRole: "driver",
      },
    });
    wouterMocks.location = "/driver/booking/dlv_1";
    render(
      <UnsavedChangesProvider navigate={() => {}}>
        <DriverBookingDetail />
      </UnsavedChangesProvider>,
    );
    const cancelSection = await screen.findByTestId("driver-cancel-before-pickup");
    expect(cancelSection.textContent).toContain("سبب الإلغاء");
    expect(screen.getByRole("button", { name: /ألغِ الحجز قبل الاستلام/ })).toBeTruthy();
  });

  it("after pickup the cancel section disappears (البلاغ أو الدعم فقط)", async () => {
    mockApi({
      "/api/auth/session": AUTHENTICATED_SESSION,
      "/api/delivery/requests/dlv_1": {
        ...CONFIRMED_DETAIL,
        execution: { ...CONFIRMED_DETAIL.execution, execution: "picked_up" },
        viewerRole: "driver",
      },
    });
    wouterMocks.location = "/driver/booking/dlv_1";
    render(
      <UnsavedChangesProvider navigate={() => {}}>
        <DriverBookingDetail />
      </UnsavedChangesProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText(/التنفيذ والتصريحات/)).toBeTruthy();
    });
    expect(screen.queryByTestId("driver-cancel-before-pickup")).toBeNull();
  });
});

describe("Wave 3 profile push section (G09)", () => {
  it("renders the best-effort wording and the iPhone home-screen hint", async () => {
    mockApi({
      "/api/auth/session": AUTHENTICATED_SESSION,
    });
    render(
      <UnsavedChangesProvider navigate={() => {}}>
        <Profile />
      </UnsavedChangesProvider>,
    );
    const section = await screen.findByTestId("push-notifications-section");
    expect(section.textContent).toContain("محاولة إرسال بلا ضمان وصول");
    expect(section.textContent).toContain("لا رسائل SMS أبدًا");
    expect(section.textContent).toContain("الشاشة الرئيسية");
    expect(screen.getByRole("button", { name: /فعّل تنبيهات هذا الجهاز/ })).toBeTruthy();
  });
});
