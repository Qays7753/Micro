/** @vitest-environment jsdom */
/* Wave 4.3 — P-4.3-2: ورقة التسجيل السريع — Enter الآمن والتاريخ القابل
 * للتحرير والتسمية المصححة.
 * ---------------------------------------------------------------------------
 * ١) GAP-4.3-05/F13: النموذجان عنصرا <form> حقيقيان — Enter يسجّل عبر
 *    onSubmit بعد التحقق، ومنع التكرار قائم.
 * ٢) GAP-4.3-06: حقل تاريخ البيع — اليوم افتراضيًا، والماضي مقبول،
 *    والمستقبل مرفوض برسالة صادقة.
 * ٣) GAP-4.3-07: عند الآجل التسمية «سعر البيع الكامل» لا «المبلغ المحصل».
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { QuickActionSheet } from "@/components/layout/QuickActionSheet";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

if (typeof Element !== "undefined" && !Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

function mockSheetServices() {
  return {
    directSales: {
      record: vi.fn().mockResolvedValue({ ok: true, value: { id: "sale-w43" } }),
    },
    projectFinance: {
      readPosition: vi.fn().mockResolvedValue({ ok: true, value: { recordedCashMinor: 2500 } }),
      distributeUnallocated: vi.fn().mockResolvedValue({ ok: true, value: {} }),
      listEvents: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      record: vi.fn().mockResolvedValue({ ok: true, value: { id: "expense-w43" } }),
    },
    cashContinuity: {
      overview: vi.fn().mockResolvedValue({ ok: true, value: { wallets: [] } }),
    },
    notifyDataChanged: vi.fn(),
    dataVersion: 0,
  } as unknown as ReturnType<typeof usePrototypeServices>;
}

async function openSaleForm() {
  fireEvent.click(screen.getByRole("button", { name: /سجّل بيعًا/ }));
  await screen.findByLabelText("مبلغ البيع");
}

function fillAmount(value: string) {
  const amount = screen.getByLabelText("مبلغ البيع");
  fireEvent.change(amount.querySelector("input") ?? amount, { target: { value } });
}

describe("Wave 4.3 — P-4.3-2: quick sheet safe Enter, editable date, corrected label", () => {
  beforeEach(() => {
    mockedUsePrototypeServices.mockReset();
  });
  afterEach(() => cleanup());

  it("GAP-4.3-05: the quick sale sheet is a real form — submitting it records the sale once", async () => {
    const services = mockSheetServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<QuickActionSheet open onOpenChange={vi.fn()} onAction={vi.fn()} />);
    await openSaleForm();
    fillAmount("12.50");
    const form = screen.getByLabelText("مبلغ البيع").closest("form");
    expect(form).toBeTruthy();
    expect(form?.querySelector('button[type="submit"]')).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);
    await waitFor(() => expect(services.directSales.record).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/وصل التسجيل/)).toBeTruthy();
    /* منع التكرار: إرسال ثانٍ متزامن لا يسجل مرة أخرى. */
    fireEvent.submit(form as HTMLFormElement);
    await waitFor(() => expect(services.directSales.record).toHaveBeenCalledTimes(1));
  });

  it("GAP-4.3-05: Enter with an empty amount does not record — validation first", async () => {
    const services = mockSheetServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<QuickActionSheet open onOpenChange={vi.fn()} onAction={vi.fn()} />);
    await openSaleForm();
    const form = screen.getByLabelText("مبلغ البيع").closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("أدخل مبلغ البيع"));
    expect(services.directSales.record).not.toHaveBeenCalled();
  });

  it("GAP-4.3-06: the sale date field defaults to today and accepts a past date", async () => {
    const services = mockSheetServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<QuickActionSheet open onOpenChange={vi.fn()} onAction={vi.fn()} />);
    await openSaleForm();
    fillAmount("10");
    const dateInput = screen.getByLabelText("تاريخ البيع") as HTMLInputElement;
    expect(dateInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    fireEvent.change(dateInput, { target: { value: "2026-09-10" } });
    const form = screen.getByLabelText("مبلغ البيع").closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    await waitFor(() => expect(services.directSales.record).toHaveBeenCalled());
    expect(vi.mocked(services.directSales.record).mock.calls[0][0]).toMatchObject({
      occurredOn: "2026-09-10",
    });
  });

  it("GAP-4.3-06: a future sale date is refused honestly", async () => {
    const services = mockSheetServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<QuickActionSheet open onOpenChange={vi.fn()} onAction={vi.fn()} />);
    await openSaleForm();
    fillAmount("10");
    fireEvent.change(screen.getByLabelText("تاريخ البيع"), { target: { value: "2100-01-01" } });
    const form = screen.getByLabelText("مبلغ البيع").closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("لا يُسجَّل بيع بتاريخ مستقبلي"),
    );
    expect(services.directSales.record).not.toHaveBeenCalled();
  });

  it("GAP-4.3-07: the amount label becomes «سعر البيع الكامل» when credit is chosen", async () => {
    mockedUsePrototypeServices.mockReturnValue(mockSheetServices());
    render(<QuickActionSheet open onOpenChange={vi.fn()} onAction={vi.fn()} />);
    await openSaleForm();
    expect(screen.getByText("المبلغ المحصل بالدينار الأردني")).toBeTruthy();
    const creditToggle = screen.getByLabelText(/هل بقي شيء عليه؟/) as HTMLSelectElement;
    fireEvent.change(creditToggle, { target: { value: "credit" } });
    await waitFor(() => expect(screen.getByText("سعر البيع الكامل بالدينار الأردني")).toBeTruthy());
    expect(screen.queryByText("المبلغ المحصل بالدينار الأردني")).toBeNull();
  });

  it("GAP-4.3-05: the quick expense sheet is a real form too", async () => {
    const services = mockSheetServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<QuickActionSheet open onOpenChange={vi.fn()} onAction={vi.fn()} initialMode="expense-form" />);
    const amount = await screen.findByLabelText(/مبلغ المصروف/);
    fireEvent.change(amount.querySelector("input") ?? amount, { target: { value: "5.25" } });
    /* البند مطلوب في المدخلين (EXE-007) — نملؤه قبل الإرسال. */
    fireEvent.change(screen.getByPlaceholderText("مثال: أكياس تغليف"), { target: { value: "أكياس اختبار" } });
    const form = amount.closest("form");
    expect(form).toBeTruthy();
    expect(form?.querySelector('button[type="submit"]')).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);
    await waitFor(() => expect(services.projectFinance.record).toHaveBeenCalled());
  });
});
