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
