/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
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

  it("loads a saved sale and submits its corrected values", async () => {
    const update = vi.fn().mockResolvedValue({ ok: true, value: sale });
    const notifyDataChanged = vi.fn();
    mockedUsePrototypeServices.mockReturnValue({
      directSales: {
        get: vi.fn().mockResolvedValue({ ok: true, value: sale }),
        update,
      },
      notifyDataChanged,
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(<DirectSaleEditor />);

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
      directSales: {
        get: vi.fn().mockResolvedValue({ ok: true, value: sale }),
        cancel,
      },
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(<DirectSaleEditor />);

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
      expect(cancel).toHaveBeenCalledWith("sale-1", "سُجل البيع بالخطأ", expect.any(String)),
    );
  });
});