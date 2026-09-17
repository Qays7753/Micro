/** @vitest-environment jsdom */
/* Wave 4.3 — P-4.3-1 (D1..D5): المنطقة العلوية المفتوحة وقائمة الشعار.
 * ---------------------------------------------------------------------------
 * ١) الشعار زر حقيقي ≥44×44 بـaria-label يفتح قائمة عمودية مرتبطة بالشعار.
 * ٢) عناصر القائمة: الحساب (أو «أكمل إعداد الحساب» حسب الحالة) + بيانات
 *    المشروع + الإعدادات — بوجهاتها الرسمية ووجهة رجوع محفوظة (EXE-016).
 * ٣) الإغلاق: بالنقر خارجها، وبزر Escape مع إعادة التركيز إلى الشعار.
 * ٤) التنقل بلوحة المفاتيح (الأسهم) داخل القائمة.
 * ٥) لا وضع ليلي في المنطقة العلوية (مدخله الوحيد الإعدادات ← المظهر).
 */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { AppHeader } from "@/components/layout/AppHeader";
import { ThemeProvider } from "@/contexts/ThemeContext";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));
const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

function renderHeader(accountComplete: boolean | null, pathname = "/") {
  const navigate = vi.fn();
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
  window.history.pushState({}, "", pathname);
  render(
    <ThemeProvider>
      <AppHeader contextLabel={null} accountComplete={accountComplete} onNavigate={navigate} />
    </ThemeProvider>,
  );
  return navigate;
}

function openMenu() {
  fireEvent.click(screen.getByTestId("micro-logo-menu-button"));
  return screen.getByTestId("micro-logo-menu");
}

describe("Wave 4.3 — P-4.3-1: open top area and logo menu", () => {
  afterEach(() => cleanup());

  it("the logo is a real button with a clear aria-label and opens the vertical menu", () => {
    renderHeader(null);
    const logo = screen.getByTestId("micro-logo-menu-button");
    expect(logo.tagName).toBe("BUTTON");
    expect(logo.getAttribute("aria-label")).toBe("قائمة Micro");
    expect(logo.getAttribute("aria-haspopup")).toBe("menu");
    expect(logo.getAttribute("aria-expanded")).toBe("false");
    const menu = openMenu();
    expect(logo.getAttribute("aria-expanded")).toBe("true");
    expect(menu.getAttribute("role")).toBe("menu");
    expect(menu.textContent).toContain("الحساب والمشروع");
    expect(menu.textContent).toContain("النظام");
    expect(menu.textContent).toContain("بيانات المشروع");
    expect(menu.textContent).toContain("الإعدادات");
  });

  it("account entry label follows the honest state — complete vs أكمل إعداد الحساب", () => {
    renderHeader(false);
    const menu = openMenu();
    expect(menu.textContent).toContain("أكمل إعداد الحساب");
    expect(screen.queryByRole("menuitem", { name: "الحساب" })).toBeNull();
    cleanup();
    renderHeader(true);
    const completeMenu = openMenu();
    expect(screen.getByRole("menuitem", { name: "الحساب" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "أكمل إعداد الحساب" })).toBeNull();
  });

  it("menu items navigate to their official surfaces preserving returnTo (EXE-016)", () => {
    const navigate = renderHeader(true, "/finance");
    const menu = openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "الإعدادات" }));
    expect(navigate).toHaveBeenCalledWith("/settings?returnTo=%2Ffinance");
    expect(screen.queryByTestId("micro-logo-menu")).toBeNull();
    /* الحساب وبيانات المشروع على السلوك نفسه — الوجهات الرسمية نفسها. */
    fireEvent.click(screen.getByTestId("micro-logo-menu-button"));
    fireEvent.click(screen.getByRole("menuitem", { name: "الحساب" }));
    expect(navigate).toHaveBeenCalledWith("/profile?returnTo=%2Ffinance");
    fireEvent.click(screen.getByTestId("micro-logo-menu-button"));
    fireEvent.click(screen.getByRole("menuitem", { name: "بيانات المشروع" }));
    expect(navigate).toHaveBeenCalledWith("/foundation?returnTo=%2Ffinance");
  });

  it("Escape closes the menu and returns focus to the logo button", () => {
    renderHeader(null);
    openMenu();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("micro-logo-menu")).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId("micro-logo-menu-button"));
  });

  it("clicking outside closes the menu; arrow keys cycle focus inside it", () => {
    renderHeader(null);
    openMenu();
    /* النقر خارج القائمة يغلقها — عنصر خلفي في الجسم. */
    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId("micro-logo-menu")).toBeNull();
    /* الأسهم تنقل التركيز دوريًا بين عناصر القائمة. */
    openMenu();
    const items = screen.getAllByRole("menuitem");
    const menu = screen.getByTestId("micro-logo-menu");
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(menu, { key: "End" });
    expect(document.activeElement).toBe(items[items.length - 1]);
    fireEvent.keyDown(menu, { key: "Home" });
    expect(document.activeElement).toBe(items[0]);
  });

  it("no theme toggle and no duplicate dark-mode entry in the open top area (D4)", () => {
    renderHeader(null);
    const header = screen.getByTestId("micro-logo-menu-button").closest("header");
    expect(header).toBeTruthy();
    const buttons = Array.from(header?.querySelectorAll("button") ?? []);
    const labels = buttons.map(button => button.getAttribute("aria-label") ?? button.textContent ?? "");
    for (const label of labels) {
      expect(label).not.toMatch(/المظهر|الليلي|داكن|فاتح/);
    }
    expect(labels).toEqual(
      expect.arrayContaining(["قائمة Micro", "النقل والتوصيل — قريبًا", "اسأل Micro — قريبًا"]),
    );
    expect(labels).toHaveLength(3);
  });
});
