/** @vitest-environment jsdom */

/*
 * NAV-001/R1-15 (أمر المالك 2026-11-14 — Workstream A/DOC-039): مقاعد
 * «المالية» و«الطلبات» وجهات المالك وحده — تُخفى عن الضيف غير الموثق بلا
 * مشروع محلي على الجهاز. المالك المحلي والمستخدم الموثق يبقيان المقاعد
 * الخمسة كاملة (أمر المالك: لا تُزال المداخل المشتركة عن الموثقين)،
 * والحالة المجهولة أثناء الإقلاع تعرض الخمسة أيضًا — لا يومض إخفاء أمام
 * المالك. بوابة السائق مستقلة أصلًا بلا شريط سفلي (OD01) فلا تُمس هنا.
 * الإنكار الخادمي للمال بنيوي: لا يوجد مسار مالي شبكي واحد (اختبار عزل
 * العامل foundation.isolation) — الإخفاء تنقّل لا تخويل.
 */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { useNetworkSession } from "@/app/useNetworkSession";
import { MicroAppShell } from "@/components/layout/MicroAppShell";
import { ThemeProvider } from "@/contexts/ThemeContext";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));
vi.mock("@/app/useNetworkSession", () => ({
  useNetworkSession: vi.fn(),
}));
const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const mockedUseNetworkSession = vi.mocked(useNetworkSession);

const wouterMocks = vi.hoisted(() => ({
  location: "/market",
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, vi.fn()],
  useParams: () => ({}),
  useSearch: () => "",
}));

beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

type ProfileValue = { activityName: string } | null;

function renderShellWith(
  profileValue: ProfileValue,
  sessionState: { loading: boolean; authenticated: boolean },
) {
  mockedUsePrototypeServices.mockReturnValue({
    ownerProfile: { read: async () => ({ ok: true, value: null }) },
    profiles: { load: async () => ({ ok: true, value: profileValue }) },
    preferences: {
      load: async () => ({ ok: true, preference: { theme: "light" } }),
      save: async () => ({ ok: true }),
      readInstallBannerDismissal: async () => ({ ok: true, value: true }),
      saveInstallBannerDismissal: async () => ({ ok: true }),
    },
    dataVersion: 0,
  } as unknown as ReturnType<typeof usePrototypeServices>);
  mockedUseNetworkSession.mockReturnValue({
    session: { authenticated: sessionState.authenticated },
    loading: sessionState.loading,
    failed: false,
    refresh: async () => undefined,
    signIn: () => undefined,
    signOutAndRefresh: async () => undefined,
  } as unknown as ReturnType<typeof useNetworkSession>);
  return render(
    <ThemeProvider>
      <MicroAppShell>{<p>سطح الاختبار</p>}</MicroAppShell>
    </ThemeProvider>,
  );
}

const SEAT_LABELS = ["المالية", "الطلبات", "الرئيسية", "التوصيل", "السوق"] as const;

function visibleSeatCount(): number {
  return SEAT_LABELS.filter(label => screen.queryByRole("button", { name: new RegExp(label) }) !== null)
    .length;
}

async function visibleSeatCountSettled(): Promise<number> {
  await waitFor(() => {
    /* انتظار استقرار القراءات غير المتزامنة (المشروع + الجلسة) */
    expect(screen.queryByRole("navigation")).not.toBeNull();
  });
  return visibleSeatCount();
}

describe("NAV-001/R1-15 — guest hides owner-only Finance/Orders seats; everyone else keeps all five", () => {
  afterEach(() => {
    cleanup();
  });

  it("an unauthenticated guest with no local project sees only the common three seats", async () => {
    renderShellWith(null, { loading: false, authenticated: false });
    const count = await visibleSeatCountSettled();
    expect(count).toBe(3);
    expect(screen.queryByRole("button", { name: /المالية/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /الطلبات/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /الرئيسية/ })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /التوصيل/ })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /السوق/ })).not.toBeNull();
  });

  it("the local owner (project exists, not signed in) keeps all five seats", async () => {
    renderShellWith({ activityName: "مشروع الاختبار" }, { loading: false, authenticated: false });
    const count = await visibleSeatCountSettled();
    expect(count).toBe(5);
  });

  it("an authenticated user keeps all five seats even without a local project", async () => {
    renderShellWith(null, { loading: false, authenticated: true });
    const count = await visibleSeatCountSettled();
    expect(count).toBe(5);
  });

  it("while the session is still loading (unknown state) all five seats stay visible — no flash-hide", async () => {
    renderShellWith(null, { loading: true, authenticated: false });
    const count = await visibleSeatCountSettled();
    expect(count).toBe(5);
  });
});
