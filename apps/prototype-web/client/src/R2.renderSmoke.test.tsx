/** @vitest-environment jsdom */

/*
 * R2 — حصانة العرض لكل المسارات (render smoke) في الوضعين فاتح/داكن.
 * ---------------------------------------------------------------------------
 * يركّب التطبيق الحقيقي كاملًا (مزوّد الخدمات الحقيقي فوق fake-indexeddb)
 * بعد إتمام الإقلاع الأول (حفظ ملف النشاط)، ثم يمرّ على كل مسار مسجّل في
 * الموجّه ويؤكد أن الصفحة تُعرض بلا انفجار ولا حدود أخطاء. الوضع الداكن
 * يُفعَّل عبر التفضيل المحفوظ الحقيقي (مسار ThemeContext الكامل) — لا
 * بمحاكاة صنف مباشرة. هذا الأساس هو نفسه مصصفة تكافؤ الوضعين في W5.
 */
import "fake-indexeddb/auto";
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import App from "@/App";
import { createBrowserLocalStore } from "@/storage/local/createBrowserLocalStore";
import { ProfileService } from "@/application/profile/profileService";
import { PreferenceService } from "@/application/preferences/preferenceService";

/* jsdom يفتقر إلى matchMedia (يستخدمه ThemeContext ومطابقة التقليل الحركي). */
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

async function completeFirstRun(theme: "light" | "dark") {
  const store = createBrowserLocalStore();
  const profiles = new ProfileService(store);
  const preferences = new PreferenceService(store);
  const saved = await profiles.save("ورشة الاختبار");
  if (!saved.ok) throw new Error("profile save failed: " + saved.message);
  const themed = await preferences.save(theme);
  if (!themed.ok) throw new Error("theme preference save failed: " + themed.message);
}

function navigateTo(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/* كل مسارات الموجّه المسجّلة (55)؛ المسارات ذات المعاملات تُفتح بمعرّف تجريبي —
 * الصفحة تعرض فراغها الصادق (غير موجود/خطأ قراءة) وهو نفسه ضمن العقد. */
const ROUTES: readonly string[] = [
  "/",
  "/orders",
  "/orders/new",
  "/orders/order-x",
  "/orders/order-x/deliver",
  "/orders/draft/draft-x",
  "/orders/draft/draft-x/agreement",
  "/orders/draft/draft-x/cost",
  "/finance",
  "/finance/activity",
  "/finance/statement",
  "/finance/owner-entitlement",
  "/finance/g5/declaration",
  "/finance/new/event-x",
  "/finance/withdraw",
  "/cash",
  "/cash/count",
  "/cash/distribute",
  "/cash/transfer",
  "/cash/wallet/wallet-x",
  "/cash/wallet/wallet-x/adjust",
  "/cash/wallet/wallet-x/opening-later",
  "/cash/wallet/new",
  "/cash/entry/entry-x/reverse",
  "/schedule",
  "/schedule/schedule-x",
  "/inventory",
  "/inventory/material/material-x/confirm",
  "/inventory/material/new",
  "/inventory/movement/movement-x",
  "/inventory/movement/movement-x/reverse",
  "/catalog",
  "/suppliers",
  "/suppliers/purchase/purchase-x",
  "/suppliers/purchase/purchase-x/payment",
  "/assets",
  "/assets/asset-x",
  "/assets/new",
  "/loans",
  "/loans/loan-x",
  "/loans/new",
  "/parties",
  "/collect",
  "/profile",
  "/settings",
  "/tools",
  "/tools/calculator",
  "/tools/estimate/estimate-x",
  "/tools/integrity",
  "/review",
  "/foundation",
  "/direct-sales/new",
  "/direct-sales/sale-x",
  "/share/preview",
  "/setup",
];

async function mountApp() {
  const utils = render(<App />);
  /* الإقلاع: انتظار عبور بوابة الإقلاع (جارٍ فتح مشروعك المحلي… تختفي). */
  await waitFor(
    () => {
      expect(screen.queryByText("جارٍ فتح مشروعك المحلي…")).toBeNull();
    },
    { timeout: 4000 },
  );
  return utils;
}

async function assertRoutePainted(path: string) {
  navigateTo(path);
  await waitFor(
    () => {
      const boundary = document.querySelector(".micro-error-boundary");
      if (boundary) throw new Error("error boundary mounted at " + path);
      const main = document.querySelector("main, section, form");
      expect(main).not.toBeNull();
      expect(document.body.textContent?.length ?? 0).toBeGreaterThan(0);
    },
    { timeout: 4000 },
  );
}

describe("R2 render smoke — every route mounts in both themes", () => {
  beforeAll(async () => {
    await completeFirstRun("light");
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
  });
  afterAll(() => {
    cleanup();
  });

  it("light theme: all registered routes render without crashing", async () => {
    const { unmount } = await mountApp();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    for (const route of ROUTES) {
      await assertRoutePainted(route);
    }
    unmount();
  }, 120_000);

  it("dark theme: all registered routes render without crashing (real preference path)", async () => {
    await completeFirstRun("dark");
    const { unmount } = await mountApp();
    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true), {
      timeout: 4000,
    });
    for (const route of ROUTES) {
      await assertRoutePainted(route);
    }
    unmount();
  }, 120_000);

  it("keyboard operability: interactive elements are native controls and Tab reaches the create FAB", async () => {
    /* jsdom يحتفظ بالموقع بين الاختبارات — نعود للرئيسية قبل التركيب. */
    window.history.pushState({}, "", "/");
    const { unmount } = await mountApp();
    const interactive = Array.from(
      document.querySelectorAll("button, a, input, select, textarea, [tabindex]"),
    );
    expect(interactive.length).toBeGreaterThan(3);
    /* لا عناصر «قابلة للنقر» غير أصلية: أي عنصر يحمل onclick دون أن يكون زرًا/رابطًا
     * يكسر عقد لوحة المفاتيح. */
    const fakeButtons = Array.from(document.querySelectorAll("[onclick]")).filter(
      el => !(el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement),
    );
    expect(fakeButtons).toEqual([]);

    const fab = interactive.find(el => el.getAttribute("aria-label") === "سجّل");
    expect(fab).toBeTruthy();
    const user = userEvent.setup();
    const starting = document.activeElement;
    let guard = 0;
    while (document.activeElement !== fab && guard < 60) {
      await user.tab();
      guard += 1;
    }
    expect(document.activeElement).toBe(fab);
    expect(starting).not.toBe(fab);
    unmount();
  }, 30_000);
});
