/** @vitest-environment jsdom */

/*
 * R3/W5 (D1) — سلوك السمة الدائم: الفاتح افتراضي، والداكن اختيار صريح محفوظ.
 * ---------------------------------------------------------------------------
 * ١) ملف جديد بلا تفضيل محفوظ يفتح على الفاتح — لا يتبع النظام.
 * ٢) التبديل من الإعدادات يفعّل الداكن فورًا: صنف .dark + data-theme + إعادة
 *    كتابة theme-color من التوكن المحسوب.
 * ٣) الاختيار محفوظ: إعادة تركيب كاملة (جلسة جديدة) تعود داكنة.
 * ٤) العودة للفاتح محفوظة أيضًا — التفضيل ملك المالك دائمًا.
 */
import "fake-indexeddb/auto";
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import App from "@/App";
import { createBrowserLocalStore } from "@/storage/local/createBrowserLocalStore";
import { ProfileService } from "@/application/profile/profileService";

function navigateTo(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

async function mountApp() {
  const utils = render(<App />);
  await waitFor(
    () => {
      expect(screen.queryByText("جارٍ فتح مشروعك المحلي…")).toBeNull();
    },
    { timeout: 4000 },
  );
  return utils;
}

describe("R3/W5 theme behavior: light default, explicit persisted dark", () => {
  beforeAll(async () => {
    if (!window.matchMedia) {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: (query: string) => ({
          matches: true /* النظام داكن — ومع ذلك يفتح Micro فاتحًا (الافتراضي) */,
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
    /* ملف نشاط فقط — لا تفضيل سمة محفوظ: الحالة الفرجية الحقيقية. */
    await new ProfileService(createBrowserLocalStore()).save("ورشة الاختبار");
  });
  afterEach(() => cleanup());
  afterAll(() => cleanup());

  it("a fresh profile opens light even when the OS prefers dark", async () => {
    const { unmount } = await mountApp();
    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(false));
    expect(document.documentElement.dataset.theme).toBe("light");
    unmount();
  });

  it("the settings toggle switches to dark and persists across a full remount", async () => {
    window.history.pushState({}, "", "/settings");
    const first = await mountApp();
    await waitFor(() => expect(screen.getByRole("button", { name: /التبديل إلى الداكن/ })).toBeTruthy());
    await userEvent.click(screen.getByRole("button", { name: /التبديل إلى الداكن/ }));
    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true));
    expect(document.documentElement.dataset.theme).toBe("dark");
    /* إعادة كتابة theme-color من التوكن المحسوب تُتحقق في المسار الحقيقي
     * (Chromium في مرحلة الالتقاط) — jsdom لا يحلّ خصائص CSS المخصصة. */
    first.unmount();
    cleanup();

    /* جلسة جديدة على المخزن نفسه: التفضيل المحفوظ يعيد الداكن. */
    const second = await mountApp();
    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true), {
      timeout: 4000,
    });
    second.unmount();
  });

  it("switching back to light is persisted too", async () => {
    window.history.pushState({}, "", "/settings");
    const first = await mountApp();
    await waitFor(() => expect(screen.getByRole("button", { name: /التبديل إلى الفاتح/ })).toBeTruthy());
    await userEvent.click(screen.getByRole("button", { name: /التبديل إلى الفاتح/ }));
    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(false));
    first.unmount();
    cleanup();

    const second = await mountApp();
    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(false));
    expect(document.documentElement.dataset.theme).toBe("light");
    second.unmount();
  });
});
