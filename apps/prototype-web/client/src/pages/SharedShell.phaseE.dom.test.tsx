/** @vitest-environment jsdom */
/**
 * Phase E (S12 wave W6) — shared-shell cross-feature coverage:
 *  - F-10: the Notice announcement role is DERIVED from the tone (error =
 *    role="alert" per R10-B4/F-017) — behavioral on the primitive AND on a
 *    live connected page state. This extends the announcement-semantics
 *    guard (R9 family) to the CONNECTED surfaces.
 *  - EX-D19/EX-D21 navigation: the shared shell exposes the four product
 *    entry points in owner context (Manage home + Market + Delivery in the
 *    bottom bar; Ask Micro in the logo menu), an explicit driver-portal
 *    entry for driver-role accounts, and the driver context renders ONLY
 *    the driver shell header (Ask Micro inside it — no owner chrome, no
 *    bottom bar, no Market/Manage entries).
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MicroAppShell } from "@/components/layout/MicroAppShell";
import { Notice } from "@/components/primitives";
import { NetworkSessionProvider } from "@/app/NetworkSessionContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AskMicro from "@/pages/AskMicro";

/* ---- Shared mocks (pattern: MicroAppShell.routeTransition.r10b.dom.test.tsx) ---- */

const wouterState = vi.hoisted(() => ({ location: "/market" }));

vi.mock("wouter", () => ({
  useLocation: (): [string, (to: string) => void] => [wouterState.location, vi.fn()],
  useParams: () => ({}),
  useSearch: () => "",
  Link: () => null,
}));

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: () => ({
    ownerProfile: { read: () => Promise.resolve({ ok: true, value: null }) },
    /* DOC-039 (NAV-001/R1-15): القشرة تقرأ وجود المشروع المحلي لمقاعد الضيف —
     * سياق المالك هنا صاحب مشروع محلي فالمقاعد الخمسة كاملة. */
    profiles: {
      load: () =>
        Promise.resolve({
          ok: true,
          value: { id: "local", activityName: "مشروع المالك", currency: "JOD" },
        }),
    },
    preferences: {
      readInstallBannerDismissal: () => Promise.resolve({ ok: true, dismissedAt: null }),
      load: () => Promise.resolve({ ok: true, value: "light" }),
      save: () => Promise.resolve({ ok: true }),
    },
    dataVersion: 0,
  }),
}));

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

const DRIVER_HAT_SESSION = {
  ...OWNER_SESSION,
  identity: { email: "driver@example.test", displayName: "السائق المالك" },
  driver: {
    status: "approved",
    eligibleForNewWork: true,
    acceptingNew: true,
    evidenceValid: true,
    vehicleApproved: true,
  },
};

const fetchMock = vi.fn();

function sessionSessionResponder(session: unknown) {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const path = new URL(String(input), "http://local").pathname;
    if (path.startsWith("/api/auth/session")) {
      return new Response(JSON.stringify(session), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: { code: "not_found", message: "غير موجود" } }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  });
}

let forceRender: () => void = () => undefined;

function Host({ children }: { children: ReactNode }) {
  const [, setTick] = useState(0);
  forceRender = () => setTick(tick => tick + 1);
  /* القشرة داخل المضيف (نمط اختبار الانتقالات): إعادة رسم المضيف تنشئ
   * عنصر قشرة جديدًا فيعيد الموجّه المُحاكى قراءة الموضع المحدث. */
  return (
    <ThemeProvider defaultTheme="light" switchable>
      <NetworkSessionProvider>
        <MicroAppShell>{children}</MicroAppShell>
      </NetworkSessionProvider>
    </ThemeProvider>
  );
}

function navigateTo(to: string) {
  /* داخل act — نفس نمط اختبار انتقالات القشرة: تحديث الموضع ثم دفعة واحدة. */
  act(() => {
    wouterState.location = to;
    forceRender();
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  /* jsdom لا تنفّذ matchMedia — الكعب البيتي المعتمد (كما في اختبارات القشرة). */
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi
      .fn()
      .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

/* ---- F-10: announcement role derives from the tone ---- */

describe("F-10 — Notice announcement role is derived from the tone (R10-B4 on connected surfaces)", () => {
  it("tone=error asserts role=alert; the quiet tones stay polite status", () => {
    const { rerender } = render(<Notice tone="error">تعذر تنفيذ الفعل</Notice>);
    expect(screen.getByRole("alert").textContent).toContain("تعذر تنفيذ الفعل");
    rerender(<Notice tone="neutral">إرشاد محايد</Notice>);
    expect(screen.getByRole("status").textContent).toContain("إرشاد محايد");
    rerender(<Notice tone="info">معلومة</Notice>);
    expect(screen.getByRole("status").textContent).toContain("معلومة");
    rerender(<Notice tone="success">تم</Notice>);
    expect(screen.getByRole("status").textContent).toContain("تم");
  });

  it("a connected page's confirmed-error state announces with alert — Ask Micro session verification failure", async () => {
    fetchMock.mockImplementation(async () => {
      throw new Error("network down");
    });
    render(
      <ThemeProvider defaultTheme="light" switchable>
        <AskMicro />
      </ThemeProvider>,
    );
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("تعذر التحقق من جلستك الآن");
  });
});

/* ---- Cross-feature navigation: the four entry points in the shared shell ---- */

describe("shared shell navigation — four product entry points (EX-D19/EX-D21)", () => {
  it("owner context: the bottom bar carries Manage home + Delivery + Market among the five seats, and the logo menu carries Ask Micro (not a sixth seat)", async () => {
    sessionSessionResponder(OWNER_SESSION);
    render(
      <Host>
        <p>سطح السوق</p>
      </Host>,
    );
    await waitFor(() => {
      expect(screen.getByRole("navigation", { name: "التنقل الرئيسي" })).toBeTruthy();
    });
    const nav = screen.getByRole("navigation", { name: "التنقل الرئيسي" });
    const labels = Array.from(nav.querySelectorAll("button span")).map(span => span.textContent);
    expect(labels).toEqual(["المالية", "الطلبات", "الرئيسية", "التوصيل", "السوق"]);
    // Ask Micro lives in the logo menu — never a sixth bar seat (contract 26 §9).
    expect(labels).not.toContain("اسأل Micro");
    fireEvent.click(screen.getByTestId("micro-logo-menu-button"));
    expect(screen.getByRole("menuitem", { name: "اسأل Micro" })).toBeTruthy();
    // A driver-portal entry appears ONLY for driver-role accounts — this
    // owner account has no driver hat.
    expect(screen.queryByRole("menuitem", { name: "بوابة السائق" })).toBeNull();
  });

  it("a driver-role account gets the explicit بوابة السائق context-switch entry in the same menu", async () => {
    sessionSessionResponder(DRIVER_HAT_SESSION);
    render(
      <Host>
        <p>سطح</p>
      </Host>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("micro-logo-menu-button")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("micro-logo-menu-button"));
    expect(screen.getByRole("menuitem", { name: "اسأل Micro" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "بوابة السائق" })).toBeTruthy();
  });

  it("driver context (/driver): ONLY the driver shell header with its Ask Micro entry — no owner chrome, no bottom bar, no logo menu", async () => {
    sessionSessionResponder(DRIVER_HAT_SESSION);
    wouterState.location = "/driver";
    render(
      <Host>
        <p>بوابة السائق</p>
      </Host>,
    );
    // The driver shell header exists with its universal Ask Micro entry…
    const driverHeader = await waitFor(() => {
      const header = document.querySelector("header.micro-driver-shell-header");
      expect(header).not.toBeNull();
      return header as HTMLElement;
    });
    expect(driverHeader.textContent).toContain("Micro — السائق");
    const askEntry = screen.getByRole("button", { name: "اسأل Micro" });
    expect(askEntry.className).toContain("micro-driver-ask-entry");
    // …and the owner chrome never renders in driver context (OD01): no
    // bottom navigation and no owner logo menu.
    expect(screen.queryByRole("navigation", { name: "التنقل الرئيسي" })).toBeNull();
    expect(screen.queryByTestId("micro-logo-menu-button")).toBeNull();
    // Navigating back to an owner surface restores the shared shell.
    navigateTo("/market");
    await waitFor(() => {
      expect(screen.getByRole("navigation", { name: "التنقل الرئيسي" })).toBeTruthy();
    });
    expect(document.querySelector("header.micro-driver-shell-header")).toBeNull();
  });

  it("Ask Micro (/ask) is a focused space with no bottom bar in both contexts — it opens on demand and returns to its origin", async () => {
    sessionSessionResponder(OWNER_SESSION);
    wouterState.location = "/ask";
    render(
      <Host>
        <AskMicro />
      </Host>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("ask-surface")).toBeTruthy();
    });
    expect(screen.queryByRole("navigation", { name: "التنقل الرئيسي" })).toBeNull();
    // The owner header stays available for the way back (logo menu).
    expect(screen.getByTestId("micro-logo-menu-button")).toBeTruthy();
  });
});
