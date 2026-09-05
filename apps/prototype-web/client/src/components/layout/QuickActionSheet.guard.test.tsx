/** @vitest-environment jsdom */
/* المجموعة ١ (Scope B): حماية مدخل ورقة الإضافة — سؤال هادئ من خيارين عند الإغلاق
 * وبها رقم مكتوب؛ لا إغلاق صامت ولا فقد بلا قرار. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { QuickActionSheet } from "@/components/layout/QuickActionSheet";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

/* vaul يحتاج pointer capture في jsdom — نفس بوليفيل اختبارات الحوار القائمة. */
if (typeof Element !== "undefined" && !Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

function mockSheetServices(saleOk = true) {
  return {
    directSales: {
      record: vi
        .fn()
        .mockResolvedValue(
          saleOk ? { ok: true, value: { id: "sale-1" } } : { ok: false, message: "فشل التسجيل" },
        ),
    },
    projectFinance: {
      readPosition: vi.fn().mockResolvedValue({ ok: true, value: { recordedCashMinor: 2500 } }),
      distributeUnallocated: vi.fn().mockResolvedValue({ ok: true, value: {} }),
      /* المجموعة ١ (تصنيفي للمصاريف): مقترحات الوسم قراءة مشتقة. */
      listEvents: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    },
    cashContinuity: {
      overview: vi.fn().mockResolvedValue({ ok: true, value: { wallets: [] } }),
    },
    notifyDataChanged: vi.fn(),
    dataVersion: 0,
  } as unknown as ReturnType<typeof usePrototypeServices>;
}

describe("QuickActionSheet quiet unsaved-input guard", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mockedUsePrototypeServices.mockReset();
  });

  it("closing with a typed amount asks the two-choice question, not silent reset", async () => {
    const onOpenChange = vi.fn();
    mockedUsePrototypeServices.mockReturnValue(mockSheetServices());
    render(<QuickActionSheet open onOpenChange={onOpenChange} onAction={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /تسجيل بيع/ }));
    fireEvent.change(await screen.findByLabelText(/ما الذي بعته؟/), { target: { value: "كوب قهوة" } });

    fireEvent.click(screen.getByRole("button", { name: "إغلاق" }));

    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText(/في رقم مكتوب — تسجّله أو تتجاهله؟/)).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("the discard choice closes the sheet and resets the form", async () => {
    const onOpenChange = vi.fn();
    mockedUsePrototypeServices.mockReturnValue(mockSheetServices());
    render(<QuickActionSheet open onOpenChange={onOpenChange} onAction={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /تسجيل بيع/ }));
    fireEvent.change(await screen.findByLabelText(/ما الذي بعته؟/), { target: { value: "كوب قهوة" } });
    fireEvent.click(screen.getByRole("button", { name: "إغلاق" }));
    fireEvent.click(await screen.findByRole("button", { name: "تجاهل ما كتبت" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("the record choice saves the sale and shows the receipt", async () => {
    const onOpenChange = vi.fn();
    const services = mockSheetServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<QuickActionSheet open onOpenChange={onOpenChange} onAction={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /تسجيل بيع/ }));
    const amount = await screen.findByLabelText("مبلغ البيع");
    fireEvent.change(amount.querySelector("input") ?? amount, { target: { value: "12.50" } });
    fireEvent.click(screen.getByRole("button", { name: "إغلاق" }));
    fireEvent.click(await screen.findByRole("button", { name: "سجّله الآن" }));

    await waitFor(() => expect(services.directSales.record).toHaveBeenCalled());
    expect(await screen.findByText(/وصل التسجيل/)).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("clean form closes immediately without any question", async () => {
    const onOpenChange = vi.fn();
    mockedUsePrototypeServices.mockReturnValue(mockSheetServices());
    render(<QuickActionSheet open onOpenChange={onOpenChange} onAction={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /تسجيل مصروف/ }));
    await screen.findByLabelText("مبلغ المصروف");
    fireEvent.click(screen.getByRole("button", { name: "إغلاق" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("expense typed note also asks before closing", async () => {
    const onOpenChange = vi.fn();
    mockedUsePrototypeServices.mockReturnValue(mockSheetServices());
    render(<QuickActionSheet open onOpenChange={onOpenChange} onAction={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /تسجيل مصروف/ }));
    fireEvent.change(await screen.findByLabelText(/البند/), { target: { value: "أكياس تغليف" } });
    fireEvent.click(screen.getByRole("button", { name: "إغلاق" }));

    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
