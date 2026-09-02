/** @vitest-environment jsdom */

/* U-005 (دورة التدقيق النهائي): محرر البيع المباشر — الحالة المسماة في توحيد
 * تنقّل التفاصيل — يسجّل حارس المدخلات غير المحفوظة: زر الرجوع يفتح حوار
 * الخيارات الثلاثة، والبقاء يحفظ القيمة، والخروج بلا حفظ يتنقل فقط بعد قرار
 * صريح. كانت الوحدة توثّق الحارس كسبب إخفاء الشريط السفلي وهو مسجّل في خمسة
 * محررات فقط — صار مسجّلًا في كل المحررات العميقة. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import DirectSaleEditor from "@/pages/DirectSaleEditor";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({ navigate: vi.fn(), location: "/direct-sales/new" }));

vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => ({}),
  useSearch: () => "",
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-08-29T09:00:00.000Z";

function servicesContext() {
  return {
    directSales: {
      get: vi.fn().mockResolvedValue({ ok: true, value: null }),
      record: vi.fn().mockResolvedValue({ ok: true, value: { id: "new-sale" } }),
      cancel: vi.fn(),
      update: vi.fn(),
    },
    catalog: {
      list: vi.fn().mockResolvedValue({ ok: true, items: [] }),
    },
    /* المجموعة ٣ (Scope D): وجهة القبض والنسبة — الخدمتان موجودتان في السياق الحقيقي دائمًا. */
    cashContinuity: {
      overview: vi.fn().mockResolvedValue({ ok: true, value: { wallets: [] } }),
    },
    projectFinance: {
      distributeUnallocated: vi.fn(),
    },
    notifyDataChanged: vi.fn(),
  };
}

describe("U-005 the direct-sale editor protects unsaved input", () => {
  beforeEach(() => {
    wouterMocks.location = "/direct-sales/new";
    wouterMocks.navigate.mockReset();
    mockedUsePrototypeServices.mockImplementation(
      () => servicesContext() as unknown as ReturnType<typeof usePrototypeServices>,
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("opens the three-choice drawer on back with a dirty form and keeps the value on stay", async () => {
    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <DirectSaleEditor />
      </UnsavedChangesProvider>,
    );
    await screen.findByRole("heading", { name: "تسجيل بيع مباشر" });
    /* المستخدم يكتب بيعًا لم يُحفظ. */
    fireEvent.change(screen.getByLabelText(/ما الذي بعته/), { target: { value: "كوب" } });
    fireEvent.click(screen.getByRole("button", { name: /العمل/ }));
    const drawer = await screen.findByTestId("unsaved-changes-drawer");
    expect(drawer).toBeTruthy();
    expect(screen.getByText("تعديلات غير محفوظة")).toBeTruthy();
    /* البقاء: القيمة باقية ولا تنقل. */
    fireEvent.click(screen.getByRole("button", { name: "ابقَ في الصفحة" }));
    expect((screen.getByLabelText(/ما الذي بعته/) as HTMLInputElement).value).toBe("كوب");
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
  });

  it("navigates away without a prompt when the form is untouched", async () => {
    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <DirectSaleEditor />
      </UnsavedChangesProvider>,
    );
    await screen.findByRole("heading", { name: "تسجيل بيع مباشر" });
    fireEvent.click(screen.getByRole("button", { name: /العمل/ }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledWith("/orders"));
    expect(screen.queryByTestId("unsaved-changes-drawer")).toBeNull();
  });
});
