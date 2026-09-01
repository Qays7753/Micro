/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import DirectSaleEditor from "@/pages/DirectSaleEditor";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  location: "/direct-sales/sale-1",
  navigate: vi.fn(),
}));

vi.mock("wouter", () => ({
  useSearch: () => "",
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

const sale: DirectSale = {
  id: "sale-1",
  itemName: "كوب جاهز",
  quantity: 2,
  currency: "JOD",
  revenueMinor: 1200,
  collectedMinor: 1200,
  costMinor: 500,
  profitMinor: 700,
  occurredOn: "2026-08-29",
  recordedAt: "2026-08-29T09:00:00.000Z",
  note: "بيع مباشر",
  idempotencyKey: "sale-create-1",
  status: "active",
  cancelledAt: null,
  cancellationReason: null,
  revisions: [],
};

describe("DirectSaleEditor", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    wouterMocks.location = "/direct-sales/sale-1";
    wouterMocks.navigate.mockReset();
  });

  /* بند ٢٥ (قرارات المالك): دلالة الكمية معلنة — السعر إجمالي البيع كاملًا لا سعر
   * القطعة، والاقتراح من المرجع سعرٌ للقطعة لا يُضرب تلقائيًا مع كمية أكبر. */
  it("declares total-price semantics under the quantity field and never auto-multiplies a per-unit suggestion (item 25)", async () => {
    wouterMocks.location = "/direct-sales/new";
    const catalogItem = {
      id: "ref-1",
      kind: "product",
      name: "كوب جاهز",
      unitLabel: null,
      unitId: null,
      defaultPriceMinor: 600,
      defaultUnitCostMinor: 250,
      active: true,
      createdAt: "2026-08-20T10:00:00.000Z",
      updatedAt: "2026-08-20T10:00:00.000Z",
      createdOperationKey: "catalog-op-1",
    };
    const create = vi.fn().mockResolvedValue({ ok: true, value: { ...sale, id: "sale-new" } });
    mockedUsePrototypeServices.mockReturnValue({
      catalog: {
        list: vi.fn().mockResolvedValue({ ok: true, items: [catalogItem] }),
      },
      directSales: {
        create,
      },
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <DirectSaleEditor />
      </UnsavedChangesProvider>,
    );

    await screen.findByRole("heading", { name: "تسجيل بيع مباشر" });
    /* دلالة الكمية معلنة قبل أي اختيار مرجع. */
    expect(
      screen.getByText(
        (content, element) =>
          element?.tagName === "SMALL" &&
          content.includes("إجمالي البيع كاملًا") &&
          content.includes("لا سعر"),
      ),
    ).toBeTruthy();

    /* كمية ٢ ثم اختيار مرجع له اقتراح سعر: لا تعبئة تلقائية ولا ضرب عن المالك. */
    fireEvent.change(screen.getByLabelText("الكمية"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("ربط مرجع"), { target: { value: "ref-1" } });
    expect(
      await screen.findByText((content, element) => element?.tagName === "SMALL" && content.includes("سعرٌ للقطعة الواحدة")),
    ).toBeTruthy();
    /* السعر الفعلي بقي بيد المالك: لم يُعبّأ رقمًا عنه. */
    expect((screen.getByLabelText("السعر المتفق عليه") as HTMLInputElement).value).toBe("0.00");

    /* كمية ١ مع مرجع له اقتراح: تُعرض التعبئة كاقتراح قابل للتعديل. */
    fireEvent.change(screen.getByLabelText("الكمية"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("ربط مرجع"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("ربط مرجع"), { target: { value: "ref-1" } });
    expect(
      await screen.findByText((content, element) => element?.tagName === "SMALL" && content.includes("سعر مقترح من المرجع")),
    ).toBeTruthy();
  });

  it("loads a saved sale and submits its corrected values", async () => {
    const update = vi.fn().mockResolvedValue({ ok: true, value: sale });
    const notifyDataChanged = vi.fn();
    mockedUsePrototypeServices.mockReturnValue({
      catalog: {
        list: vi.fn().mockResolvedValue({ ok: true, items: [] }),
      },
      directSales: {
        get: vi.fn().mockResolvedValue({ ok: true, value: sale }),
        update,
      },
      notifyDataChanged,
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <DirectSaleEditor />
      </UnsavedChangesProvider>,
    );

    await screen.findByRole("heading", { name: "تصحيح بيع مباشر" });
    expect(screen.getByDisplayValue("كوب جاهز")).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue("كوب جاهز"), { target: { value: "كوب مصحح" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ تصحيح البيع" }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        "sale-1",
        expect.objectContaining({
          itemName: "كوب مصحح",
          quantity: 2,
          revenueMinor: 1200,
          costMinor: 500,
        }),
      ),
    );
    expect(notifyDataChanged).toHaveBeenCalledOnce();
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/orders");
  });

  it("requires a reason and records cancellation without deleting the sale", async () => {
    const cancel = vi.fn().mockResolvedValue({
      ok: true,
      value: { ...sale, status: "cancelled" },
    });
    mockedUsePrototypeServices.mockReturnValue({
      catalog: {
        list: vi.fn().mockResolvedValue({ ok: true, items: [] }),
      },
      directSales: {
        get: vi.fn().mockResolvedValue({ ok: true, value: sale }),
        cancel,
      },
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <DirectSaleEditor />
      </UnsavedChangesProvider>,
    );

    await screen.findByRole("heading", { name: "تصحيح بيع مباشر" });
    fireEvent.click(screen.getByRole("button", { name: "إظهار تأكيد الإلغاء" }));
    fireEvent.click(screen.getByRole("button", { name: "تأكيد إلغاء البيع" }));
    expect(await screen.findByText("اكتب سبب الإلغاء قبل تأكيده.")).toBeTruthy();
    expect(cancel).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("مثال: أُدخل المبلغ بالخطأ"), {
      target: { value: "سُجل البيع بالخطأ" },
    });
    fireEvent.click(screen.getByRole("button", { name: "تأكيد إلغاء البيع" }));

    await waitFor(() =>
      expect(cancel).toHaveBeenCalledWith("sale-1", "سُجل البيع بالخطأ", expect.any(String), 0),
    );
  });
});