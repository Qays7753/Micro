/** @vitest-environment jsdom */
/**
 * EX-D21 (Phase B — 2026-11-14): DOM coverage for the universal Ask Micro
 * entry surface — honest unconfigured state, permission-scoped context,
 * guest gate, and the 501 honest answer path. Plus the AppHeader driver
 * context entry (EX-D19) and the StartupGate connected-route exemption.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AppHeader } from "@/components/layout/AppHeader";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AskMicro from "@/pages/AskMicro";
import { StartupGate, isConnectedRoute, isPublicLocalRecoveryRoute } from "@/app/StartupGate";

/* Services mock: ThemeProvider reads theme preferences through the services
 * context — stub it the same way Nav001.dom.test.tsx does. */
vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

/* wouter mock (same hoisted pattern as MarketDeliverySurfaces.dom.test.tsx). */
const locationState = { location: "/ask" as string };
vi.mock("wouter", () => ({
  useLocation: () => [locationState.location, vi.fn()],
  useSearch: () => "",
  Link: () => null,
}));

interface FetchCall {
  path: string;
  init?: RequestInit;
}

let posted: FetchCall[] = [];
const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const GUEST_SESSION = { authenticated: false };
const OWNER_SESSION = {
  authenticated: true,
  identity: { email: "owner@example.test", displayName: "المالك" },
  isAdmin: false,
  workspaces: [
    {
      id: "ws_1",
      displayName: "مشروع المالك",
      role: "owner",
      capabilities: { market: true, delivery: true },
    },
  ],
  vendor: null,
  driver: null,
};
const DRIVER_SESSION = {
  authenticated: true,
  identity: { email: "driver@example.test", displayName: "السائق" },
  isAdmin: false,
  workspaces: [],
  vendor: null,
  driver: {
    status: "approved",
    eligibleForNewWork: true,
    acceptingNew: true,
    evidenceValid: true,
    vehicleApproved: true,
  },
};

const UNCONFIGURED_STATUS = {
  available: true,
  configured: false,
  context: {
    principal: { displayName: "المالك", email: "owner@example.test" },
    roles: { owner: true, vendor: false, driver: false, admin: false },
    workspaces: OWNER_SESSION.workspaces,
    permittedRecordSummary: { ownerPendingDecisions: 0, vendorListings: 0, driverOpenTasks: 0 },
  },
};

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

beforeEach(() => {
  posted = [];
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockedUsePrototypeServices.mockImplementation(
    () =>
      ({
        preferences: {
          load: async () => ({ ok: true, preference: { theme: "light" } }),
          save: async () => ({ ok: true }),
        },
        dataVersion: 0,
      }) as unknown as ReturnType<typeof usePrototypeServices>,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("ask micro page (EX-D21)", () => {
  it("a guest sees an honest sign-in gate — the entry exists, use requires an account", async () => {
    fetchMock.mockImplementation(async (path: string) => jsonResponse(GUEST_SESSION));
    render(<AskMicro />);
    const gate = await screen.findByTestId("ask-gate");
    expect(gate.textContent).toContain("يحتاج حسابك");
  });

  it("a signed-in owner sees the honest unconfigured state and the server-scoped context", async () => {
    fetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/auth/session")) return jsonResponse(OWNER_SESSION);
      if (path.startsWith("/api/ask/status")) return jsonResponse(UNCONFIGURED_STATUS);
      return jsonResponse({ error: { code: "not_found", message: "غير موجود" } }, 404);
    });
    render(<AskMicro />);
    const surface = await screen.findByTestId("ask-surface");
    const unconfigured = await screen.findByTestId("ask-unconfigured");
    expect(unconfigured.textContent).toContain("غير مهيأة بعد");
    expect(unconfigured.textContent).toContain("لا تُرسل أي بيانات");
    const context = await screen.findByTestId("ask-context");
    expect(context.textContent).toContain("صاحب مشروع");
    expect(context.textContent).toContain("مشروع المالك");
  });

  it("asking without a provider surfaces the server's honest 501 message — no fabricated answer", async () => {
    fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/api/auth/session")) return jsonResponse(OWNER_SESSION);
      if (path.startsWith("/api/ask/status")) return jsonResponse(UNCONFIGURED_STATUS);
      if (path.startsWith("/api/ask")) {
        posted.push({ path, init });
        return jsonResponse(
          {
            error: {
              code: "ask_not_configured",
              message:
                "Ask Micro غير مهيأة بعد: لا يوجد مزود ذكاء اصطناعي معتمد مرتبط. الإعداد خطوة مالك/Manus لاحقة عبر مزود معتمد.",
            },
          },
          501,
        );
      }
      return jsonResponse({ error: { code: "not_found", message: "غير موجود" } }, 404);
    });
    render(<AskMicro />);
    await screen.findByTestId("ask-unconfigured");
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "كم لديّ من قرارات بانتظاري؟" } });
    fireEvent.click(screen.getByRole("button", { name: "اسأل" }));
    await waitFor(() => expect(screen.getByText(/Ask Micro غير مهيأة بعد/)).toBeTruthy());
    expect(posted).toHaveLength(1);
    expect(posted[0]!.init?.body as string).toContain("قرارات بانتظاري");
  });

  /* ── Post-Group 6 continuous completion (§5.3–§5.5): الإجابة بمصادرها
   * والمسودة القابلة للتحرير — لا كتابة قبل التأكيد الصريح، ولا نجاح
   * كاذب عند فشل الخادم. ── */

  const CONFIGURED_STATUS = {
    ...UNCONFIGURED_STATUS,
    configured: true,
  };

  const DRAFT_ANSWER = {
    answer: "أستطيع تجهيز مسودة حجز توصيل — أكمل التفاصيل بنفسك.",
    sources: [
      {
        id: "owner.confirmed_bookings",
        label: "حجوزات مؤكدة جارية",
        value: 1,
        source: "سجل حجوزاتك في التوصيل",
      },
    ],
    draft: {
      kind: "delivery-booking",
      title: "مسودة حجز توصيل",
      fields: [
        {
          name: "needType",
          label: "نوع الطلب",
          type: "enum",
          required: true,
          value: null,
          options: ["deliver_to_customer"],
        },
        {
          name: "pickupGovernorate",
          label: "محافظة الاستلام",
          type: "governorate",
          required: true,
          value: null,
        },
        {
          name: "dropoffGovernorate",
          label: "محافظة التسليم",
          type: "governorate",
          required: true,
          value: null,
        },
        {
          name: "loadClass",
          label: "حجم الحمل",
          type: "enum",
          required: true,
          value: null,
          options: ["small"],
        },
        {
          name: "weightBand",
          label: "شريحة الوزن",
          type: "enum",
          required: true,
          value: null,
          options: ["under_10kg"],
        },
        { name: "pieceCount", label: "عدد القطع", type: "count", required: true, value: null },
        { name: "scheduleDate", label: "تاريخ التنفيذ", type: "date", required: false, value: null },
        {
          name: "pricingMode",
          label: "نمط التسعير",
          type: "enum",
          required: true,
          value: null,
          options: ["quote_request"],
        },
        {
          name: "offeredFareJod",
          label: "الأجر المعروض (دينار)",
          type: "decimal",
          required: true,
          value: null,
        },
      ],
    },
  };

  function mockConfiguredAsk() {
    fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/api/auth/session")) return jsonResponse(OWNER_SESSION);
      if (path.startsWith("/api/ask/status")) return jsonResponse(CONFIGURED_STATUS);
      if (path.startsWith("/api/delivery/drivers")) {
        return jsonResponse({ drivers: [{ driverProfileId: "drv-1", displayName: "سائق الاختبار" }] });
      }
      if (path.startsWith("/api/ask")) {
        posted.push({ path, init });
        return jsonResponse(DRAFT_ANSWER);
      }
      return jsonResponse({ error: { code: "not_found", message: "غير موجود" } }, 404);
    });
  }

  it("the answer renders with its cited sources only (server-computed facts)", async () => {
    mockConfiguredAsk();
    render(<AskMicro />);
    await screen.findByTestId("ask-context");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "سجّل لي حجز توصيلة للزبون غدًا" } });
    fireEvent.click(screen.getByRole("button", { name: "اسأل" }));
    const answer = await screen.findByTestId("ask-answer");
    expect(answer.textContent).toContain("مسودة حجز توصيل");
    const sources = await screen.findByTestId("ask-sources");
    expect(sources.textContent).toContain("حجوزات مؤكدة جارية");
    expect(sources.textContent).toContain("سجل حجوزاتك في التوصيل");
  });

  it("the draft card writes NOTHING until every required field is completed and confirmed (§5.3/§5.4)", async () => {
    mockConfiguredAsk();
    render(<AskMicro />);
    await screen.findByTestId("ask-context");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "سجّل لي حجز توصيلة للزبون غدًا" } });
    fireEvent.click(screen.getByRole("button", { name: "اسأل" }));
    const card = await screen.findByTestId("ask-draft-card");
    expect(card.textContent).toContain("ليست محفوظة");
    /* كل الحقول الإلزامية فارغة عمدًا — القيم التي لم تذكرها في السؤال */
    const confirmButton = screen.getByRole("button", { name: "أنشئ مسودة الحجز" });
    expect(confirmButton.hasAttribute("disabled")).toBe(true);
    /* إكمال الحقول الإلزامية واحدة واحدة ثم التأكيد */
    const driverSelect = await screen.findByLabelText("السائق (إلزامي — تختاره بنفسك)");
    fireEvent.change(driverSelect, { target: { value: "drv-1" } });
    fireEvent.change(screen.getByLabelText("نوع الطلب (إلزامي)"), {
      target: { value: "deliver_to_customer" },
    });
    fireEvent.change(screen.getByLabelText("محافظة الاستلام (إلزامي)"), { target: { value: "عمان" } });
    fireEvent.change(screen.getByLabelText("محافظة التسليم (إلزامي)"), { target: { value: "الزرقاء" } });
    fireEvent.change(screen.getByLabelText("حجم الحمل (إلزامي)"), { target: { value: "small" } });
    fireEvent.change(screen.getByLabelText("شريحة الوزن (إلزامي)"), { target: { value: "under_10kg" } });
    fireEvent.change(screen.getByLabelText("عدد القطع (إلزامي)"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("نمط التسعير (إلزامي)"), { target: { value: "prepriced" } });
    fireEvent.change(screen.getByLabelText("الأجر المعروض (دينار) (إلزامي)"), { target: { value: "5.5" } });
    expect(confirmButton.hasAttribute("disabled")).toBe(false);
    /* لم تُرسل أي كتابة قبل التأكيد الصريح */
    expect(posted.filter(call => call.path.startsWith("/api/delivery/requests"))).toHaveLength(0);
    fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/api/auth/session")) return jsonResponse(OWNER_SESSION);
      if (path.startsWith("/api/ask/status")) return jsonResponse(CONFIGURED_STATUS);
      if (path.startsWith("/api/delivery/drivers")) {
        return jsonResponse({ drivers: [{ driverProfileId: "drv-1", displayName: "سائق الاختبار" }] });
      }
      if (path.startsWith("/api/delivery/requests")) {
        posted.push({ path, init });
        return jsonResponse({ request: { id: "req-ask-1" } }, 201);
      }
      return jsonResponse({ error: { code: "not_found", message: "غير موجود" } }, 404);
    });
    fireEvent.click(confirmButton);
    const saved = await screen.findByTestId("ask-draft-saved");
    expect(saved.textContent).toContain("بعد قبول الخادم");
    /* الكتابة الوحيدة: المسار الكنوني نفسه بسياق المشروع الصريح */
    const writes = posted.filter(call => call.path.startsWith("/api/delivery/requests"));
    expect(writes).toHaveLength(1);
    const body = JSON.parse(String(writes[0]!.init?.body)) as {
      driverProfileId: string;
      workspaceId: string;
      needType: string;
      offeredFareMinor: string;
      pieceCount: number;
    };
    expect(body.driverProfileId).toBe("drv-1");
    expect(body.workspaceId).toBe("ws_1");
    expect(body.needType).toBe("deliver_to_customer");
    expect(body.offeredFareMinor).toBe("550");
    expect(body.pieceCount).toBe(2);
  });

  it("cancelling the draft card sends NO write at all (§5.4)", async () => {
    mockConfiguredAsk();
    render(<AskMicro />);
    await screen.findByTestId("ask-context");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "سجّل لي حجز توصيلة للزبون غدًا" } });
    fireEvent.click(screen.getByRole("button", { name: "اسأل" }));
    await screen.findByTestId("ask-draft-card");
    fireEvent.click(screen.getByRole("button", { name: "إلغاء المسودة" }));
    await waitFor(() => expect(screen.queryByTestId("ask-draft-card")).toBeNull());
    expect(posted.filter(call => call.path.startsWith("/api/delivery/requests"))).toHaveLength(0);
  });

  it("a server failure on confirm shows the honest error — no false saved state (§5.4/§5.5)", async () => {
    mockConfiguredAsk();
    render(<AskMicro />);
    await screen.findByTestId("ask-context");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "سجّل لي حجز توصيلة للزبون غدًا" } });
    fireEvent.click(screen.getByRole("button", { name: "اسأل" }));
    await screen.findByTestId("ask-draft-card");
    const driverSelect = await screen.findByLabelText("السائق (إلزامي — تختاره بنفسك)");
    fireEvent.change(driverSelect, { target: { value: "drv-1" } });
    fireEvent.change(screen.getByLabelText("نوع الطلب (إلزامي)"), { target: { value: "fetch_ready_goods" } });
    fireEvent.change(screen.getByLabelText("محافظة الاستلام (إلزامي)"), { target: { value: "عمان" } });
    fireEvent.change(screen.getByLabelText("محافظة التسليم (إلزامي)"), { target: { value: "إربد" } });
    fireEvent.change(screen.getByLabelText("حجم الحمل (إلزامي)"), { target: { value: "medium" } });
    fireEvent.change(screen.getByLabelText("شريحة الوزن (إلزامي)"), { target: { value: "10_to_50kg" } });
    fireEvent.change(screen.getByLabelText("عدد القطع (إلزامي)"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("نمط التسعير (إلزامي)"), { target: { value: "quote_request" } });
    fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/api/auth/session")) return jsonResponse(OWNER_SESSION);
      if (path.startsWith("/api/ask/status")) return jsonResponse(CONFIGURED_STATUS);
      if (path.startsWith("/api/delivery/drivers")) {
        return jsonResponse({ drivers: [{ driverProfileId: "drv-1", displayName: "سائق الاختبار" }] });
      }
      if (path.startsWith("/api/delivery/requests")) {
        posted.push({ path, init });
        return jsonResponse(
          { error: { code: "conflict", message: "تعذر الإنشاء — السائق غير متاح الآن." } },
          409,
        );
      }
      return jsonResponse({ error: { code: "not_found", message: "غير موجود" } }, 404);
    });
    fireEvent.click(screen.getByRole("button", { name: "أنشئ مسودة الحجز" }));
    await waitFor(() => expect(screen.getByText(/تعذر الإنشاء — السائق غير متاح الآن/)).toBeTruthy());
    /* لا نجاح كاذب: البطاقة باقية والحالة المحفوظة لم تظهر */
    expect(screen.queryByTestId("ask-draft-saved")).toBeNull();
    expect(screen.getByTestId("ask-draft-card")).toBeTruthy();
  });
});

describe("app header driver context entry (EX-D19)", () => {
  it("a driver-role account sees the explicit بوابة السائق entry; others do not", () => {
    const navigate = vi.fn();
    const { unmount } = render(
      <ThemeProvider>
        <AppHeader contextLabel={null} accountComplete={null} hasDriverRole onNavigate={navigate} />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByTestId("micro-logo-menu-button"));
    expect(screen.getByRole("menuitem", { name: "بوابة السائق" })).toBeTruthy();
    unmount();

    render(
      <ThemeProvider>
        <AppHeader contextLabel={null} accountComplete={null} onNavigate={navigate} />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByTestId("micro-logo-menu-button"));
    expect(screen.queryByRole("menuitem", { name: "بوابة السائق" })).toBeNull();
  });
});

describe("startup gate connected-route exemption (EX-D19)", () => {
  it("connected routes are exempt from local Manage setup; Manage surfaces are not", () => {
    expect(isPublicLocalRecoveryRoute("/setup")).toBe(true);
    expect(isPublicLocalRecoveryRoute("/settings")).toBe(true);
    expect(isConnectedRoute("/market")).toBe(true);
    expect(isConnectedRoute("/market/listing/x")).toBe(true);
    expect(isConnectedRoute("/delivery")).toBe(true);
    expect(isConnectedRoute("/driver")).toBe(true);
    expect(isConnectedRoute("/ask")).toBe(true);
    /* أسطح Manage المحلية تبقى خلف إعداد المشروع المحلي. */
    expect(isConnectedRoute("/")).toBe(false);
    expect(isConnectedRoute("/finance")).toBe(false);
    expect(isConnectedRoute("/orders")).toBe(false);
    expect(isConnectedRoute("/tools/calculator")).toBe(false);
    expect(isConnectedRoute("/profile")).toBe(false);
  });
});
