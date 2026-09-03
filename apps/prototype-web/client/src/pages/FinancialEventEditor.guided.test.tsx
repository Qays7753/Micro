/** @vitest-environment jsdom */
/* المجموعة ١ (الإدخال المالي الموجّه): رحلة المحرر الموجهة — سؤال وجهة الصرف،
 * التصنيف ومقترحاته، بطاقة مراجعة التوزيع، معاينة الأثر المشتقة، صدق فشل
 * النسبة بعد الحفظ، والمسودة المحفوظة (استرجاع/تجاهل/مسح بعد الحفظ). */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const labeledHistoryEvent: FinancialEvent = {
  id: "history-1",
  type: "operating_expense_cash",
  currency: "JOD",
  amountMinor: 500,
  occurredOn: "2026-08-20",
  recordedAt: "2026-08-20T09:00:00.000Z",
  idempotencyKey: "history-1",
  note: "أكياس",
  counterparty: null,
  relatedEventId: null,
  expenseContext: {
    relationship: "project",
    behavior: "variable",
    purpose: "project_general",
    knowledge: "known",
    sharedProjectShare: null,
    categoryLabel: "تغليف",
  },
  correctionType: null,
  correctionOfEventId: null,
  correctionReason: null,
  cashDeltaMinor: -500,
  payableDeltaMinor: 0,
  ownerCapitalDeltaMinor: 0,
  operatingExpenseDeltaMinor: 500,
};

function storedEvent(amountMinor: number): FinancialEvent {
  return {
    ...labeledHistoryEvent,
    id: "event-1",
    idempotencyKey: "finance-ui-key",
    note: "توصيل الطلبات",
    occurredOn: "2026-09-03",
    amountMinor,
    cashDeltaMinor: -amountMinor,
    operatingExpenseDeltaMinor: amountMinor,
    expenseContext: { ...labeledHistoryEvent.expenseContext!, categoryLabel: null },
  };
}

const wallets = [
  { id: "drawer", name: "الدرج", kind: "cash_drawer" },
  { id: "bank", name: "حساب البنك", kind: "bank_account" },
];

function renderEditor(overrides: { record?: ReturnType<typeof vi.fn>; wallets?: typeof wallets } = {}) {
  const record = overrides.record ?? vi.fn();
  mockedUsePrototypeServices.mockReturnValue({
    projectFinance: {
      record,
      listSettleablePayables: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      listEvents: vi.fn().mockResolvedValue({ ok: true, value: [labeledHistoryEvent] }),
      readPosition: vi.fn().mockResolvedValue({ ok: true, value: { amanahHeldMinor: 0 } }),
      distributeUnallocated: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    },
    cashContinuity: {
      overview: vi.fn().mockResolvedValue({
        ok: true,
        value: { wallets: overrides.wallets ?? [] },
      }),
    },
    dataVersion: 0,
    notifyDataChanged: vi.fn(),
  } as unknown as ReturnType<typeof usePrototypeServices>);
  render(
    <UnsavedChangesProvider navigate={() => undefined}>
      <FinancialEventEditor />
    </UnsavedChangesProvider>,
  );
  return { record };
}

describe("FinancialEventEditor guided journey (المجموعة ١)", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockClear();
    window.localStorage.clear();
  });
  afterEach(() => cleanup());

  it("asks the wallet question with sheet-identical vocabulary when wallets exist", async () => {
    renderEditor({ wallets });
    expect(await screen.findByText("وجهة الصرف")).toBeTruthy();
    const select = screen.getByDisplayValue("من الكاش غير الموزع");
    expect(screen.getByText("الدرج — تغطية من رصيدها")).toBeTruthy();
    expect(screen.getByText("حساب البنك — تغطية من رصيدها")).toBeTruthy();
    fireEvent.change(select, { target: { value: "bank" } });
    expect(screen.getByDisplayValue("حساب البنك — تغطية من رصيدها")).toBeTruthy();
  });

  it("shows derived category suggestions and commits a selected chip through save", async () => {
    const { record } = renderEditor({ wallets });
    record.mockResolvedValueOnce({ ok: true, value: storedEvent(2500) });
    /* المقترحات: المشتق أولًا (تغليف) ثم البذور — الرقاقات داخل طبقة السياق. */
    const derivedChip = await screen.findByRole("button", { name: "تغليف" });
    expect(screen.getByRole("button", { name: "بنزين" })).toBeTruthy();
    fireEvent.click(derivedChip);
    expect(derivedChip.getAttribute("aria-pressed")).toBe("true");
    await userEvent
      .setup()
      .type(screen.getByLabelText("المبلغ بالدينار الأردني"), "25");
    await userEvent
      .setup()
      .type(screen.getByPlaceholderText("مثال: دفعت توصيل الطلبات للأسبوع"), "توصيل");
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
    await waitFor(() => expect(record).toHaveBeenCalledOnce());
    const payload = record.mock.calls[0]?.[0] as { expenseContext?: { categoryLabel?: string | null } };
    expect(payload.expenseContext?.categoryLabel).toBe("تغليف");
  });

  it("renders the shared allocation review card with reconciled rows before save", async () => {
    renderEditor({});
    fireEvent.click(await screen.findByText("أضف سياقًا للمصروف"));
    fireEvent.change(screen.getByDisplayValue("للمشروع بالكامل"), {
      target: { value: "shared" },
    });
    fireEvent.change(screen.getByDisplayValue("مبلغ حصة معروف"), {
      target: { value: "percentage" },
    });
    await userEvent
      .setup()
      .type(screen.getByLabelText("إجمالي المصروف المشترك"), "100");
    await userEvent
      .setup()
      .type(screen.getByLabelText("نسبة حصة المشروع"), "60");
    expect(screen.getByText("توزيع المصروف المشترك")).toBeTruthy();
    expect(screen.getByText("حصة المشروع (60%)")).toBeTruthy();
    expect(screen.getByText("الباقي خارج حصة المشروع — بيت أو نشاط آخر")).toBeTruthy();
    expect(screen.getByText(/الحصة موزعة بالكامل/)).toBeTruthy();
  });

  it("derives the effect preview from the committed intent — honest negative lines", async () => {
    renderEditor({ wallets });
    await userEvent
      .setup()
      .type(screen.getByLabelText("المبلغ بالدينار الأردني"), "25");
    expect(await screen.findByText("بعد الحفظ:")).toBeTruthy();
    expect(screen.getByText(/ينقص الكاش 25.00 د.أ من الكاش غير الموزع/)).toBeTruthy();
    expect(screen.getByText(/بلا حركة أمانة ولا سحب مالك/)).toBeTruthy();
    /* ناقص قبل الإدخال: النص الثابت المعروف يبقى — لا رقم متوهَّم. */
  });

  it("attributes the wallet after save and surfaces an attribution failure honestly before leaving", async () => {
    const record = vi.fn().mockResolvedValueOnce({ ok: true, value: storedEvent(2500) });
    const distribute = vi.fn().mockResolvedValueOnce({
      ok: false,
      message: "رصيد المحفظة لا يغطي هذا الصرف.",
    });
    mockedUsePrototypeServices.mockReturnValue({
      projectFinance: {
        record,
        listSettleablePayables: vi.fn().mockResolvedValue({ ok: true, value: [] }),
        listEvents: vi.fn().mockResolvedValue({ ok: true, value: [labeledHistoryEvent] }),
        readPosition: vi.fn().mockResolvedValue({ ok: true, value: { amanahHeldMinor: 0 } }),
        distributeUnallocated: distribute,
      },
      cashContinuity: {
        overview: vi.fn().mockResolvedValue({ ok: true, value: { wallets } }),
      },
      dataVersion: 0,
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);
    render(
      <UnsavedChangesProvider navigate={() => undefined}>
        <FinancialEventEditor />
      </UnsavedChangesProvider>,
    );
    fireEvent.change(await screen.findByDisplayValue("من الكاش غير الموزع"), {
      target: { value: "drawer" },
    });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("المبلغ بالدينار الأردني"), "25");
    await user.type(screen.getByPlaceholderText("مثال: دفعت توصيل الطلبات للأسبوع"), "توصيل");
    await user.click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
    await waitFor(() => expect(distribute).toHaveBeenCalledOnce());
    const attribution = distribute.mock.calls[0]?.[0] as {
      walletId: string;
      deltaMinor: number;
      sourceRefKind: string;
      operationKey: string;
    };
    expect(attribution.walletId).toBe("drawer");
    expect(attribution.deltaMinor).toBe(-2500);
    expect(attribution.sourceRefKind).toBe("expense");
    expect(attribution.operationKey).toContain(":attribute");
    /* الصدق: الحدث محفوظ والنص ظاهر قبل الخروج — لا انتقال كاذب ولا تجاهل. */
    expect(await screen.findByText(/نسبته للمحفظة لم تتم/)).toBeTruthy();
    expect(screen.getByText(/المال محفوظ ضمن/)).toBeTruthy();
    expect(wouterMocks.navigate).not.toHaveBeenCalledWith("/finance");
    expect(screen.getByRole("button", { name: "ارجع إلى الوضع المالي" })).toBeTruthy();
  });

  it("keeps the path-guidance notes: suppliers link and the honest future-path line", async () => {
    renderEditor({});
    fireEvent.click(await screen.findByText("أضف سياقًا للمصروف"));
    expect(
      screen.getByText(/سجّله من الموردون والمشتريات — لا كمصروف عادي/),
    ).toBeTruthy();
    expect(screen.getByText(/الأصول طويلة الاستخدام والقروض الشخصية لا تُسجَّل من هنا/)).toBeTruthy();
  });

  it("persists a draft, offers restore on reopen, and never auto-commits", async () => {
    const first = renderEditor({});
    void first;
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("المبلغ بالدينار الأردني"), "30");
    await user.type(screen.getByPlaceholderText("مثال: دفعت توصيل الطلبات للأسبوع"), "مسودة");
    const draftKey = "micro.finance-draft.operating_expense_cash.v1";
    await waitFor(() => expect(window.localStorage.getItem(draftKey)).not.toBeNull());
    cleanup();
    /* إعادة الفتح: عرض الاسترجاع — لا تحويل سجل تلقائي أبدًا. */
    const { record } = renderEditor({});
    expect(await screen.findByText(/مسودة غير محفوظة من إدخال سابق — ترجّعها؟/)).toBeTruthy();
    expect(record).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "استرجع المسودة" }));
    expect((screen.getByLabelText("المبلغ بالدينار الأردني") as HTMLInputElement).value).toContain("30");
    /* الاسترجاع يُعيد القيم والوسخ معًا — المسودة تمثل المدخل الحي فتبقى محفوظة
     * حتى الحفظ أو التجاهل؛ لا تُحذف لمجرد الاسترجاع (نمط Zman نفسه). */
    expect(window.localStorage.getItem(draftKey)).not.toBeNull();
    const savedRecord = vi.fn().mockResolvedValueOnce({ ok: true, value: storedEvent(3000) });
    cleanup();
    renderEditor({ record: savedRecord });
    expect(await screen.findByText(/ترجّعها؟/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "استرجع المسودة" }));
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
    await waitFor(() => expect(savedRecord).toHaveBeenCalledOnce());
    expect(window.localStorage.getItem(draftKey)).toBeNull();
  });

  it("discard clears the draft; a successful save clears it too", async () => {
    const user = userEvent.setup();
    renderEditor({});
    await user.type(screen.getByLabelText("المبلغ بالدينار الأردني"), "30");
    const draftKey = "micro.finance-draft.operating_expense_cash.v1";
    await waitFor(() => expect(window.localStorage.getItem(draftKey)).not.toBeNull());
    cleanup();
    const { record } = renderEditor({});
    record.mockResolvedValueOnce({ ok: true, value: storedEvent(3000) });
    expect(await screen.findByText(/ترجّعها؟/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "تجاهلها" }));
    expect(window.localStorage.getItem(draftKey)).toBeNull();
    await userEvent
      .setup()
      .type(screen.getByLabelText("المبلغ بالدينار الأردني"), "30");
    await userEvent
      .setup()
      .type(screen.getByPlaceholderText("مثال: دفعت توصيل الطلبات للأسبوع"), "حفظ");
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
    await waitFor(() => expect(record).toHaveBeenCalledOnce());
    expect(window.localStorage.getItem(draftKey)).toBeNull();
  });
});
