/** @vitest-environment jsdom */
/* S06 (UNIT-015 CONS-DEC04/SDF-064 + UNIT-019 ORG-011/D07): رحلات DOM
 * مركزة لخيارَي المحرر الجديدين — سؤال الفاتورة المشتركة (المدفوع فعليًا
 * + من تحمّل الباقي بتأكيد صريح) وخيار «يتكرر» داخل المصروف (التذكير
 * القادم + الإعداد المترابط مع الحفظ بنتيجة جزئية صادقة واستئناف الناقص). */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { FormDraftService } from "@/application/drafts/formDraftService";
import { createFormDraftHarness } from "@/application/drafts/formDraftTestHarness";
import type { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import FinancialEventEditor from "./FinancialEventEditor";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({ navigate: vi.fn() }));
const routeParams = vi.hoisted(() => ({ type: "operating_expense_cash" }));

vi.mock("wouter", () => ({
  useSearch: () => "",
  useLocation: () => ["/finance/new/operating_expense_cash", wouterMocks.navigate],
  useParams: () => ({ type: routeParams.type }),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

const baseEvent: FinancialEvent = {
  id: "event-1",
  type: "operating_expense_cash",
  currency: "JOD",
  amountMinor: 3_000,
  occurredOn: "2026-10-20",
  recordedAt: "2026-10-20T09:00:00.000Z",
  idempotencyKey: "finance-ui-key",
  note: "فاتورة كهرباء",
  counterparty: null,
  relatedEventId: null,
  expenseContext: {
    relationship: "shared",
    behavior: "variable",
    purpose: "project_general",
    knowledge: "known",
    sharedProjectShare: { basis: "agreed_fixed_share", note: null },
    categoryLabel: null,
  },
  correctionType: null,
  correctionOfEventId: null,
  correctionReason: null,
  cashDeltaMinor: -3_000,
  payableDeltaMinor: 0,
  ownerCapitalDeltaMinor: 0,
  operatingExpenseDeltaMinor: 3_000,
};

function renderEditor(
  overrides: {
    record?: ReturnType<typeof vi.fn>;
    recordSharedBill?: ReturnType<typeof vi.fn>;
    setupFromExpense?: ReturnType<typeof vi.fn>;
    wallets?: { id: string; name: string; kind: string }[];
    store?: MemoryLocalStore;
  } = {},
) {
  const record = overrides.record ?? vi.fn();
  const recordSharedBill = overrides.recordSharedBill ?? vi.fn();
  const setupFromExpense = overrides.setupFromExpense ?? vi.fn();
  const store = overrides.store ?? createFormDraftHarness().store;
  mockedUsePrototypeServices.mockReturnValue({
    projectFinance: {
      record,
      recordSharedBill,
      listSettleablePayables: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      listEvents: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      readPosition: vi.fn().mockResolvedValue({ ok: true, value: { amanahHeldMinor: 0 } }),
      distributeUnallocated: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    },
    cashContinuity: {
      overview: vi.fn().mockResolvedValue({
        ok: true,
        value: { wallets: overrides.wallets ?? [] },
      }),
    },
    recurringExpenses: {
      findUnhandledOccurrenceForDate: vi.fn().mockResolvedValue({ ok: true, value: null }),
      setupFromExpense,
    },
    dataVersion: 0,
    notifyDataChanged: vi.fn(),
    formDrafts: new FormDraftService(store),
  } as unknown as ReturnType<typeof usePrototypeServices>);
  render(
    <UnsavedChangesProvider navigate={() => undefined}>
      <FinancialEventEditor />
    </UnsavedChangesProvider>,
  );
  return { record, recordSharedBill, setupFromExpense, store };
}

async function openSharedFixedForm() {
  fireEvent.click(await screen.findByText("أضف سياقًا للمصروف"));
  fireEvent.change(screen.getByDisplayValue("للمشروع بالكامل"), { target: { value: "shared" } });
}

describe("S06 — الفاتورة المشتركة فوق الحصة في المحرر (CONS-DEC04 / SDF-064)", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockClear();
    routeParams.type = "operating_expense_cash";
    window.localStorage.clear();
  });
  afterEach(() => cleanup());

  it("المشاركة النقدية تسأل المدفوع فعليًا، والفارق فوق الحصة يوجب تأكيد تحمّل المالك", async () => {
    const { record, recordSharedBill } = renderEditor({});
    await openSharedFixedForm();
    await userEvent.setup().type(screen.getByLabelText("المبلغ بالدينار الأردني"), "30");
    expect(await screen.findByLabelText("المدفوع فعليًا من صندوق المشروع")).toBeTruthy();
    await userEvent.setup().type(screen.getByLabelText("المدفوع فعليًا من صندوق المشروع"), "60");
    /* الفارق 30 ظاهر بتأكيد صريح — لا افتراض نظام. */
    const confirmLabel = await screen.findByText(/الفارق 30.00 د.أ فوق حصة المشروع على المالك/);
    expect(confirmLabel).toBeTruthy();
    await userEvent
      .setup()
      .type(screen.getByPlaceholderText("مثال: دفعت توصيل الطلبات للأسبوع"), "فاتورة البيت والمحل");
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
    /* بلا تأكيد: لا حفظ — رسالة صريحة بمن تحمّل الباقي. */
    await waitFor(() =>
      expect(screen.getByText(/أكّد أن المالك تحمّل الباقي ليُسجل سحبًا شخصيًا بنفس الحفظ/)).toBeTruthy(),
    );
    expect(recordSharedBill).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    /* التأكيد الصريح: نية واحدة بحدثين. */
    recordSharedBill.mockResolvedValueOnce({
      ok: true,
      value: {
        expense: { ...baseEvent },
        ownerPart: {
          ...baseEvent,
          id: "event-owner-part",
          type: "owner_withdrawal_cash",
          amountMinor: 3_000,
        },
        ownerPartFailure: null,
      },
    });
    fireEvent.click(screen.getByText(/الفارق 30.00 د.أ فوق حصة المشروع على المالك/));
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
    await waitFor(() => expect(recordSharedBill).toHaveBeenCalledOnce());
    expect(record).not.toHaveBeenCalled();
    const payload = recordSharedBill.mock.calls[0]?.[0] as {
      amountMinor: number;
      sharedExpense?: { paidAmountMinor?: number };
    };
    expect(payload.amountMinor).toBe(3_000);
    expect(payload.sharedExpense?.paidAmountMinor).toBe(6_000);
  });

  it("المدفوع أقل من الحصة يُرفض قبل أي كتابة — لا دفع جزئي بلا عقد", async () => {
    const { record, recordSharedBill } = renderEditor({});
    await openSharedFixedForm();
    await userEvent.setup().type(screen.getByLabelText("المبلغ بالدينار الأردني"), "30");
    await userEvent.setup().type(screen.getByLabelText("المدفوع فعليًا من صندوق المشروع"), "20");
    await userEvent
      .setup()
      .type(screen.getByPlaceholderText("مثال: دفعت توصيل الطلبات للأسبوع"), "أقل من الحصة");
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
    await waitFor(() =>
      expect(screen.getByText(/المدفوع فعليًا لا يمكن أن يقل عن حصة المشروع/)).toBeTruthy(),
    );
    expect(record).not.toHaveBeenCalled();
    expect(recordSharedBill).not.toHaveBeenCalled();
  });

  it("دفع الحصة فقط يبقى بالمسار العادي — بلا حقل مدفوع مؤثر ولا سحب", async () => {
    const { record, recordSharedBill } = renderEditor({});
    await openSharedFixedForm();
    await userEvent.setup().type(screen.getByLabelText("المبلغ بالدينار الأردني"), "30");
    await userEvent
      .setup()
      .type(screen.getByPlaceholderText("مثال: دفعت توصيل الطلبات للأسبوع"), "حصة المحل فقط");
    record.mockResolvedValueOnce({ ok: true, value: { ...baseEvent } });
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
    await waitFor(() => expect(record).toHaveBeenCalledOnce());
    expect(recordSharedBill).not.toHaveBeenCalled();
  });

  it("معاينة الأثر تعرض الحقيقة الكاملة للفاتورة فوق الحصة بمعاينة واحدة", async () => {
    renderEditor({});
    await openSharedFixedForm();
    await userEvent.setup().type(screen.getByLabelText("المبلغ بالدينار الأردني"), "30");
    await userEvent.setup().type(screen.getByLabelText("المدفوع فعليًا من صندوق المشروع"), "60");
    await waitFor(() => expect(screen.getByText(/ينقص الكاش 60.00 د.أ/)).toBeTruthy());
    expect(screen.getByText(/منها 30.00 د.أ حصة المشروع و30.00 د.أ دُفعت فوق حصته/)).toBeTruthy();
    expect(screen.getByText(/يُسجَّل سحب شخصي 30.00 د.أ على المالك/)).toBeTruthy();
  });
});

describe("S06 — خيار «يتكرر» داخل المحرر (UNIT-019 / ORG-011 / D07)", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockClear();
    routeParams.type = "operating_expense_cash";
    window.localStorage.clear();
  });
  afterEach(() => cleanup());

  it("تفعيل الخيار يكشف التذكير القادم افتراضيًا، والحفظ يقيم الإعداد بقصد مترابط", async () => {
    const { record, setupFromExpense } = renderEditor({});
    await userEvent.setup().type(screen.getByLabelText("المبلغ بالدينار الأردني"), "25");
    await userEvent
      .setup()
      .type(screen.getByPlaceholderText("مثال: دفعت توصيل الطلبات للأسبوع"), "إيجار المحل");
    fireEvent.click(await screen.findByText("يتكرر — ذكّرني بهذا المصروف كل شهر"));
    const reminder = await screen.findByLabelText(/التذكير القادم/);
    expect(reminder).toBeTruthy();
    record.mockResolvedValueOnce({ ok: true, value: { ...baseEvent, amountMinor: 2_500 } });
    setupFromExpense.mockResolvedValueOnce({
      ok: true,
      value: { series: { id: "recurring-x", status: "active" }, reused: false },
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
    await waitFor(() => expect(record).toHaveBeenCalledOnce());
    await waitFor(() => expect(setupFromExpense).toHaveBeenCalledOnce());
    const setupPayload = setupFromExpense.mock.calls[0]?.[0] as {
      seriesId: string;
      title: string;
      suggestedAmountMinor: number;
    };
    expect(setupPayload.seriesId).toMatch(/^recurring-/);
    expect(setupPayload.title).toBe("إيجار المحل");
    expect(setupPayload.suggestedAmountMinor).toBe(2_500);
  });

  it("فشل إعداد التذكير بعد ثبوت المصروف نتيجة جزئية صادقة مع استئناف الناقص وحده", async () => {
    const { record, setupFromExpense } = renderEditor({});
    await userEvent.setup().type(screen.getByLabelText("المبلغ بالدينار الأردني"), "25");
    await userEvent
      .setup()
      .type(screen.getByPlaceholderText("مثال: دفعت توصيل الطلبات للأسبوع"), "اشتراك إنترنت");
    fireEvent.click(await screen.findByText("يتكرر — ذكّرني بهذا المصروف كل شهر"));
    record.mockResolvedValueOnce({ ok: true, value: { ...baseEvent, amountMinor: 2_500 } });
    setupFromExpense.mockResolvedValueOnce({ ok: false, code: "storage_error", message: "تعذر محلي مؤقت" });
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
    await waitFor(() =>
      expect(screen.getByText(/حُفظ المصروف، ولم يُحفظ التذكير: تعذر محلي مؤقت/)).toBeTruthy(),
    );
    /* الاستئناف: نفس نية الإعداد (المعرف الحتمي نفسه) بلا إعادة تسجيل المصروف. */
    setupFromExpense.mockResolvedValueOnce({
      ok: true,
      value: { series: { id: "recurring-x", status: "active" }, reused: true },
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "أعد محاولة ضبط التذكير" }));
    await waitFor(() => expect(setupFromExpense).toHaveBeenCalledTimes(2));
    expect(setupFromExpense.mock.calls[1]?.[0]).toEqual(setupFromExpense.mock.calls[0]?.[0]);
    expect(record).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByText(/ضُبط التذكير القادم/)).toBeTruthy());
  });

  it("إلغاء تحديد الخيار قبل الحفظ لا يقيم أي إعداد — لا سلسلة من التبديل", async () => {
    const { record, setupFromExpense } = renderEditor({});
    await userEvent.setup().type(screen.getByLabelText("المبلغ بالدينار الأردني"), "25");
    await userEvent
      .setup()
      .type(screen.getByPlaceholderText("مثال: دفعت توصيل الطلبات للأسبوع"), "مصروف عادي");
    const toggle = await screen.findByText("يتكرر — ذكّرني بهذا المصروف كل شهر");
    fireEvent.click(toggle);
    expect(await screen.findByLabelText(/التذكير القادم/)).toBeTruthy();
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.queryByLabelText(/التذكير القادم/)).toBeNull());
    record.mockResolvedValueOnce({ ok: true, value: { ...baseEvent, amountMinor: 2_500 } });
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
    await waitFor(() => expect(record).toHaveBeenCalledOnce());
    expect(setupFromExpense).not.toHaveBeenCalled();
  });
});
