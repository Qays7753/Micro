/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import FinancialEventEditor from "./FinancialEventEditor";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("wouter", () => ({
  useSearch: () => "",
  useLocation: () => ["/finance/new/operating_expense_cash", wouterMocks.navigate],
  useParams: () => ({ type: "operating_expense_cash" }),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

function storedEvent(amountMinor: number): FinancialEvent {
  return {
    id: "event-1",
    type: "operating_expense_cash",
    currency: "JOD",
    amountMinor,
    occurredOn: "2026-08-29",
    recordedAt: "2026-08-29T09:00:00.000Z",
    idempotencyKey: "finance-ui-key",
    note: "توصيل الطلبات",
    counterparty: null,
    relatedEventId: null,
    expenseContext: { relationship: "project", behavior: "variable", purpose: "order", knowledge: "known" },
    correctionType: null,
    correctionOfEventId: null,
    correctionReason: null,
    cashDeltaMinor: -amountMinor,
    payableDeltaMinor: 0,
    ownerCapitalDeltaMinor: 0,
    operatingExpenseDeltaMinor: amountMinor,
  };
}

describe("FinancialEventEditor save honesty (U-02)", () => {
  const record = vi.fn();

  beforeEach(() => {
    wouterMocks.navigate.mockClear();
    record.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  function renderEditor() {
    record.mockResolvedValueOnce({ ok: true, value: storedEvent(2500) });
    record.mockResolvedValueOnce({ ok: true, value: storedEvent(2500), reused: true });
    mockedUsePrototypeServices.mockReturnValue({
      projectFinance: {
        record,
        listSettleablePayables: vi.fn().mockResolvedValue({ ok: true, value: [] }),
        /* المجموعة ١: مقترحات التصنيف + وجهة الصرف — قراءتان مشتقتان فقط. */
        listEvents: vi.fn().mockResolvedValue({ ok: true, value: [] }),
        readPosition: vi.fn().mockResolvedValue({ ok: true, value: { amanahHeldMinor: 0 } }),
      },
      cashContinuity: {
        overview: vi.fn().mockResolvedValue({ ok: true, value: { wallets: [] } }),
      },
      dataVersion: 0,
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);
    render(
      <UnsavedChangesProvider navigate={() => undefined}>
        <FinancialEventEditor />
      </UnsavedChangesProvider>,
    );
  }

  async function fillAndSave(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText("المبلغ بالدينار الأردني"), "25");
    await user.type(screen.getByPlaceholderText("مثال: دفعت توصيل الطلبات للأسبوع"), "توصيل الطلبات");
    await user.click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
  }

  it("navigates to the finance ledger after the first successful save", async () => {
    const user = userEvent.setup();
    renderEditor();
    await fillAndSave(user);
    expect(record).toHaveBeenCalledOnce();
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/finance");
  });

  it("tells the truth when a second save hits the same idempotency key: the edit was NOT saved", async () => {
    const user = userEvent.setup();
    renderEditor();
    await fillAndSave(user);
    await user.click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
    expect(record).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/لم يُحفظ التعديل/)).toBeTruthy();
    expect(screen.getByText(/تراجع عن الحدث الأصلي وسجّل حدثًا جديدًا/)).toBeTruthy();
    expect(wouterMocks.navigate).toHaveBeenCalledTimes(1);
  });
});

describe("FinancialEventEditor note requirement (U-04)", () => {
  const record = vi.fn();

  beforeEach(() => {
    wouterMocks.navigate.mockClear();
    record.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows an Arabic message when the note is empty instead of reaching the domain", async () => {
    const user = userEvent.setup();
    mockedUsePrototypeServices.mockReturnValue({
      projectFinance: {
        record,
        listSettleablePayables: vi.fn().mockResolvedValue({ ok: true, value: [] }),
        /* المجموعة ١: مقترحات التصنيف + وجهة الصرف — قراءتان مشتقتان فقط. */
        listEvents: vi.fn().mockResolvedValue({ ok: true, value: [] }),
        readPosition: vi.fn().mockResolvedValue({ ok: true, value: { amanahHeldMinor: 0 } }),
      },
      cashContinuity: {
        overview: vi.fn().mockResolvedValue({ ok: true, value: { wallets: [] } }),
      },
      dataVersion: 0,
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);
    render(
      <UnsavedChangesProvider navigate={() => undefined}>
        <FinancialEventEditor />
      </UnsavedChangesProvider>,
    );
    await user.type(screen.getByLabelText("المبلغ بالدينار الأردني"), "25");
    await user.click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
    expect(screen.getByText("اكتب ما حدث قبل الحفظ؛ الوصف جزء من السجل المالي.")).toBeTruthy();
    expect(record).not.toHaveBeenCalled();
  });
});
