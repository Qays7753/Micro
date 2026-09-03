/** @vitest-environment jsdom */
/* المجموعة ١ (تصنيفي للمصاريف — المسار السريع): رقاقة وسم اختيارية بنقرة واحدة
 * تمر عبر الحفظ، وسطر الأثر يصرّح بغياب حركة الأمانة وسحب المالك — المسار
 * السريع يبقى مبلغًا إلزاميًا واحدًا. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { QuickActionSheet } from "@/components/layout/QuickActionSheet";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

if (typeof Element !== "undefined" && !Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

const savedEvent: FinancialEvent = {
  id: "quick-1",
  type: "operating_expense_cash",
  currency: "JOD",
  amountMinor: 2500,
  occurredOn: "2026-09-03",
  recordedAt: "2026-09-03T09:00:00.000Z",
  idempotencyKey: "sheet-expense-1",
  note: "بنزين",
  counterparty: null,
  relatedEventId: null,
  expenseContext: {
    relationship: "project",
    behavior: "unknown",
    purpose: "project_general",
    knowledge: "known",
    sharedProjectShare: null,
    categoryLabel: "بنزين",
  },
  correctionType: null,
  correctionOfEventId: null,
  correctionReason: null,
  cashDeltaMinor: -2500,
  payableDeltaMinor: 0,
  ownerCapitalDeltaMinor: 0,
  operatingExpenseDeltaMinor: 2500,
};

function renderSheet(record: ReturnType<typeof vi.fn>) {
  mockedUsePrototypeServices.mockReturnValue({
    directSales: {
      record: vi.fn().mockResolvedValue({ ok: true, value: { id: "sale-1" } }),
    },
    projectFinance: {
      record,
      readPosition: vi.fn().mockResolvedValue({ ok: true, value: { recordedCashMinor: 25000 } }),
      distributeUnallocated: vi.fn().mockResolvedValue({ ok: true, value: {} }),
      listEvents: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    },
    cashContinuity: {
      overview: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          wallets: [
            { id: "drawer", name: "الدرج", kind: "cash_drawer", balanceMinor: 0, entryCount: 0 },
          ],
        },
      }),
    },
    notifyDataChanged: vi.fn(),
    dataVersion: 0,
  } as unknown as ReturnType<typeof usePrototypeServices>);
  render(<QuickActionSheet open onOpenChange={vi.fn()} onAction={vi.fn()} />);
}

describe("QuickActionSheet expense category chip (المجموعة ١)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("commits the selected optional chip through the quick save — no extra mandatory input", async () => {
    const record = vi.fn().mockResolvedValueOnce({ ok: true, value: savedEvent });
    renderSheet(record);
    fireEvent.click(screen.getByRole("button", { name: /تسجيل مصروف/ }));
    const chip = await screen.findByRole("button", { name: "بنزين" });
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    fireEvent.change(screen.getByLabelText("مبلغ المصروف"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "سجّل المصروف" }));
    await waitFor(() => expect(record).toHaveBeenCalledOnce());
    const payload = record.mock.calls[0]?.[0] as {
      expenseContext?: { categoryLabel?: string | null };
    };
    expect(payload.expenseContext?.categoryLabel).toBe("بنزين");
  });

  it("deselecting the chip saves with a null label — the label stays optional", async () => {
    const record = vi.fn().mockResolvedValueOnce({ ok: true, value: savedEvent });
    renderSheet(record);
    fireEvent.click(screen.getByRole("button", { name: /تسجيل مصروف/ }));
    const chip = await screen.findByRole("button", { name: "بنزين" });
    fireEvent.click(chip);
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    fireEvent.change(screen.getByLabelText("مبلغ المصروف"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "سجّل المصروف" }));
    await waitFor(() => expect(record).toHaveBeenCalledOnce());
    const payload = record.mock.calls[0]?.[0] as {
      expenseContext?: { categoryLabel?: string | null };
    };
    expect(payload.expenseContext?.categoryLabel).toBeNull();
  });

  it("effect line declares the honest negatives: no amanah and no owner draw", async () => {
    const record = vi.fn().mockResolvedValueOnce({ ok: true, value: savedEvent });
    renderSheet(record);
    fireEvent.click(screen.getByRole("button", { name: /تسجيل مصروف/ }));
    fireEvent.change(screen.getByLabelText("مبلغ المصروف"), { target: { value: "25" } });
    expect(await screen.findByText(/بلا حركة أمانة ولا سحب مالك/)).toBeTruthy();
    expect(screen.getByText(/سينقص الكاش 25.00 د.أ/)).toBeTruthy();
  });
});
