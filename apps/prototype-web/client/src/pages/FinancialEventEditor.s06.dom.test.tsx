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
import { localDatePlusMonthsClamped } from "@micro-domain/shared/index.js";
import { todayInAmman } from "@/application/time";
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
    distributeUnallocated?: ReturnType<typeof vi.fn>;
    wallets?: { id: string; name: string; kind: string }[];
    store?: MemoryLocalStore;
  } = {},
) {
  const record = overrides.record ?? vi.fn();
  const recordSharedBill = overrides.recordSharedBill ?? vi.fn();
  const setupFromExpense = overrides.setupFromExpense ?? vi.fn();
  const distributeUnallocated =
    overrides.distributeUnallocated ?? vi.fn().mockResolvedValue({ ok: true, value: {} });
  const store = overrides.store ?? createFormDraftHarness().store;
  mockedUsePrototypeServices.mockReturnValue({
    projectFinance: {
      record,
      recordSharedBill,
      listSettleablePayables: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      listEvents: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      readPosition: vi.fn().mockResolvedValue({ ok: true, value: { amanahHeldMinor: 0 } }),
      distributeUnallocated,
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
  return { record, recordSharedBill, setupFromExpense, distributeUnallocated, store };
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

  it("إعادة الجزء الشخصي تعيد النية المجمّدة لحظة الفشل — تعديل النموذج بعدها لا يغير السحب (R1-F01)", async () => {
    const { recordSharedBill } = renderEditor({});
    await openSharedFixedForm();
    await userEvent.setup().type(screen.getByLabelText("المبلغ بالدينار الأردني"), "30");
    await userEvent.setup().type(screen.getByLabelText("المدفوع فعليًا من صندوق المشروع"), "60");
    fireEvent.click(screen.getByText(/الفارق 30.00 د.أ فوق حصة المشروع على المالك/));
    await userEvent
      .setup()
      .type(screen.getByPlaceholderText("مثال: دفعت توصيل الطلبات للأسبوع"), "فاتورة كبيرة");
    /* الفشل الجزئي: المصروف حفظ والسحب فشل. */
    recordSharedBill.mockResolvedValueOnce({
      ok: true,
      value: {
        expense: { ...baseEvent },
        ownerPart: null,
        ownerPartFailure: "رصيد المحفظة لا يغطي السحب.",
      },
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
    await waitFor(() => expect(screen.getByText(/لم يكتمل تسجيل الجزء الشخصي/)).toBeTruthy());
    /* المستخدم عدّل حقل المدفوع بعد الفشل — الإعادة لا تقرأ النموذج الحي. */
    const paidField = screen.getByLabelText("المدفوع فعليًا من صندوق المشروع") as HTMLInputElement;
    fireEvent.change(paidField, { target: { value: "90" } });
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
    await userEvent.setup().click(screen.getByRole("button", { name: "أعد محاولة تسجيل الجزء الشخصي" }));
    await waitFor(() => expect(recordSharedBill).toHaveBeenCalledTimes(2));
    const retryPayload = recordSharedBill.mock.calls[1]?.[0] as {
      sharedExpense?: { paidAmountMinor?: number };
    };
    /* النية المجمّدة: المدفوع 60 لا 90 — زوج النية الواحدة لا يُفكك. */
    expect(retryPayload.sharedExpense?.paidAmountMinor).toBe(6_000);
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

/* R3 (مراجعة S06 القرائية ٣ — واجهة/تشغيل/وصول): انحدارات مركزة لتصحيحات
 * المراجع الثالث — مرجع افتراضي التذكير وبوابة الاستئناف (R3-F01)، صدق
 * بانر النتيجة الجزئية (R3-F02)، محفظة النية المجمّدة عند الإعادة
 * (R3-F03)، عهدة الاستئناف أثناء التنفيذ (R3-F04)، تأليف فشلَي النسبة
 * معًا (R3-F06)، والزر الأساسي بعد حفظ ثبت وبقيت الصفحة (R3-F07). قناة
 * الخطأ الصوتية للوحة الربط (R3-F05) تُثبت في ملف تفصيل التذكير. */
describe("S06-R3 — تصحيحات مراجعة الواجهة الثالثة", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockClear();
    routeParams.type = "operating_expense_cash";
    window.localStorage.clear();
  });
  afterEach(() => cleanup());

  it("R3-F01: مصروف مؤرّخ سابقًا — الافتراضي شهر لاحق حقيقي، والبوابة ترفض الشهر الحالي، والاستئناف يقبل التاريخ المصحح", async () => {
    const today = todayInAmman();
    const [year, month] = today.split("-").map(Number);
    const previousPeriod = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
    const corrected = localDatePlusMonthsClamped(today, 2) ?? today;
    const { record, setupFromExpense } = renderEditor({});
    fireEvent.change(screen.getByLabelText(/تاريخ الحدث/), { target: { value: `${previousPeriod}-15` } });
    await userEvent.setup().type(screen.getByLabelText("المبلغ بالدينار الأردني"), "25");
    await userEvent
      .setup()
      .type(screen.getByPlaceholderText("مثال: دفعت توصيل الطلبات للأسبوع"), "فاتورة قديمة");
    fireEvent.click(await screen.findByText("يتكرر — ذكّرني بهذا المصروف كل شهر"));
    const reminder = (await screen.findByLabelText(/التذكير القادم/)) as HTMLInputElement;
    /* الافتراضي المقترح يرضي بوابة الخدمة الكنسية: شهر لاحق لليوم الحقيقي حصرًا. */
    expect(reminder.value.slice(0, 7) > today.slice(0, 7)).toBe(true);
    /* بوابة المحرر باليوم الحقيقي لا بتاريخ الحدث: تذكير الشهر الحالي يُرفض قبل أي كتابة. */
    fireEvent.change(reminder, { target: { value: today } });
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
    await waitFor(() => expect(screen.getByText(/التذكير القادم يجب أن يكون في شهر لاحق/)).toBeTruthy());
    expect(record).not.toHaveBeenCalled();
    /* الاستئناف يقرأ التاريخ من الحقل الحي — لا جمود على تاريخ رفضته الخدمة. */
    fireEvent.change(reminder, { target: { value: corrected } });
    record.mockResolvedValueOnce({ ok: true, value: { ...baseEvent, amountMinor: 2_500 } });
    setupFromExpense.mockResolvedValueOnce({
      ok: false,
      code: "validation_failed",
      message:
        "التذكير القادم يجب أن يكون في شهر لاحق — مصروف هذه الفترة سُجل للتو؛ أول تذكير جديد هو القادم.",
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
    await waitFor(() => expect(record).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByText(/حُفظ المصروف، ولم يُحفظ التذكير/)).toBeTruthy());
    setupFromExpense.mockResolvedValueOnce({
      ok: true,
      value: { series: { id: "recurring-x", status: "active" }, reused: false },
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "أعد محاولة ضبط التذكير" }));
    await waitFor(() => expect(setupFromExpense).toHaveBeenCalledTimes(2));
    const retryPayload = setupFromExpense.mock.calls[1]?.[0] as { nextReminderDate: string };
    expect(retryPayload.nextReminderDate).toBe(corrected);
    await waitFor(() => expect(screen.getByText(`ضُبط التذكير القادم ${corrected}.`)).toBeTruthy());
  });

  it("R3-F02: فشل السحب الشخصي وحده لا يُنسب زورًا إلى فشل النسبة — الرسالة صادقة بذاتها", async () => {
    const { recordSharedBill } = renderEditor({});
    await openSharedFixedForm();
    await userEvent.setup().type(screen.getByLabelText("المبلغ بالدينار الأردني"), "30");
    await userEvent.setup().type(screen.getByLabelText("المدفوع فعليًا من صندوق المشروع"), "60");
    fireEvent.click(screen.getByText(/الفارق 30.00 د.أ فوق حصة المشروع على المالك/));
    await userEvent
      .setup()
      .type(screen.getByPlaceholderText("مثال: دفعت توصيل الطلبات للأسبوع"), "فاتورة كبيرة");
    recordSharedBill.mockResolvedValueOnce({
      ok: true,
      value: {
        expense: { ...baseEvent },
        ownerPart: null,
        ownerPartFailure: "رصيد المحفظة لا يغطي السحب.",
      },
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
    const banner = await screen.findByText(/لم يكتمل تسجيل الجزء الشخصي/);
    /* بلا محفظة مختارة لم تُطلب النسبة أصلًا — لا إطار يدّعي فشلها ولا مالًا غير موزع. */
    expect(banner.textContent).not.toContain("نسبته للمحفظة لم تتم");
    expect(banner.textContent).not.toContain("الكاش غير الموزع");
  });

  it("R3-F03: إعادة الجزء الشخصي تغطي من محفظة النية المجمّدة لا من المحفظة الحية", async () => {
    const { recordSharedBill, distributeUnallocated } = renderEditor({
      wallets: [
        { id: "drawer", name: "الدرج", kind: "cash" },
        { id: "bank", name: "المصرف", kind: "bank" },
      ],
    });
    await openSharedFixedForm();
    await userEvent.setup().type(screen.getByLabelText("المبلغ بالدينار الأردني"), "30");
    await userEvent.setup().type(screen.getByLabelText("المدفوع فعليًا من صندوق المشروع"), "60");
    fireEvent.click(screen.getByText(/الفارق 30.00 د.أ فوق حصة المشروع على المالك/));
    await userEvent
      .setup()
      .type(screen.getByPlaceholderText("مثال: دفعت توصيل الطلبات للأسبوع"), "فاتورة كبيرة");
    /* محافظ متعددة: اختيار صريح قبل الحفظ (FIN-005). */
    fireEvent.change(await screen.findByLabelText(/مصدر الصرف/), { target: { value: "drawer" } });
    recordSharedBill.mockResolvedValueOnce({
      ok: true,
      value: {
        expense: { ...baseEvent },
        ownerPart: null,
        ownerPartFailure: "رصيد المحفظة لا يغطي السحب.",
      },
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
    await waitFor(() => expect(screen.getByText(/لم يكتمل تسجيل الجزء الشخصي/)).toBeTruthy());
    /* المستخدم غيّر المحفظة الحية بعد الفشل — خصم الإعادة من محفظة النية. */
    fireEvent.change(screen.getByLabelText(/مصدر الصرف/), { target: { value: "bank" } });
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
    await userEvent.setup().click(screen.getByRole("button", { name: "أعد محاولة تسجيل الجزء الشخصي" }));
    /* نداءا النسبة: تغطية الحصة عند الحفظ الأول، ثم تغطية الجزء الشخصي عند
     * الإعادة — الإعادة وحدها هي موضوع الفحص (النداء الأخير). */
    await waitFor(() => expect(distributeUnallocated.mock.calls.length).toBeGreaterThanOrEqual(2));
    const attributionCall = distributeUnallocated.mock.calls.at(-1)?.[0] as {
      walletId: string;
      operationKey: string;
    };
    expect(attributionCall.walletId).toBe("drawer");
    expect(attributionCall.operationKey).toContain(":owner-part:attribute");
  });

  it("R3-F04: النقر المزدوج على استئناف التذكير لا يطلق إعدادين متزامنين", async () => {
    const { record, setupFromExpense } = renderEditor({});
    await userEvent.setup().type(screen.getByLabelText("المبلغ بالدينار الأردني"), "25");
    await userEvent
      .setup()
      .type(screen.getByPlaceholderText("مثال: دفعت توصيل الطلبات للأسبوع"), "اشتراك إنترنت");
    fireEvent.click(await screen.findByText("يتكرر — ذكّرني بهذا المصروف كل شهر"));
    record.mockResolvedValueOnce({ ok: true, value: { ...baseEvent, amountMinor: 2_500 } });
    setupFromExpense.mockResolvedValueOnce({ ok: false, code: "storage_error", message: "تعذر محلي مؤقت" });
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
    await waitFor(() => expect(screen.getByText(/حُفظ المصروف، ولم يُحفظ التذكير/)).toBeTruthy());
    /* الاستئناف الثاني معلّق بيد الاختبار — النقر قبل الهبوط. */
    let releaseSetup!: (value: unknown) => void;
    setupFromExpense.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          releaseSetup = resolve;
        }),
    );
    const retry = screen.getByRole("button", { name: "أعد محاولة ضبط التذكير" });
    fireEvent.click(retry);
    fireEvent.click(retry);
    /* عهدة أثناء التنفيذ: نداء الاستئناف الثاني واحد مهما تكرر النقر قبل الهبوط. */
    await waitFor(() => expect(setupFromExpense).toHaveBeenCalledTimes(2));
    expect(setupFromExpense).toHaveBeenCalledTimes(2);
    releaseSetup({ ok: true, value: { series: { id: "recurring-x", status: "active" }, reused: false } });
    await waitFor(() => expect(screen.getByText(/ضُبط التذكير القادم/)).toBeTruthy());
    expect(setupFromExpense).toHaveBeenCalledTimes(2);
    expect(record).toHaveBeenCalledOnce();
  });

  it("R3-F06: فشل تغطية الحصة والجزء الشخصي معًا — الحقيقتان معًا في نص واحد لا تُبتلع أولاهما", async () => {
    const { recordSharedBill, distributeUnallocated } = renderEditor({
      wallets: [{ id: "drawer", name: "الدرج", kind: "cash" }],
    });
    await openSharedFixedForm();
    await userEvent.setup().type(screen.getByLabelText("المبلغ بالدينار الأردني"), "30");
    await userEvent.setup().type(screen.getByLabelText("المدفوع فعليًا من صندوق المشروع"), "60");
    fireEvent.click(screen.getByText(/الفارق 30.00 د.أ فوق حصة المشروع على المالك/));
    await userEvent
      .setup()
      .type(screen.getByPlaceholderText("مثال: دفعت توصيل الطلبات للأسبوع"), "فاتورة كبيرة");
    /* الحدثان يحفظان، وتغطيتا المحفظة تفشلان معًا (الرصيد لا يكفي أيًّا منهما). */
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
    distributeUnallocated
      .mockResolvedValueOnce({ ok: false, message: "رصيد الدرج لا يكفي الحصة." })
      .mockResolvedValueOnce({ ok: false, message: "الرصيد المتبقي لا يكفي الجزء الشخصي." });
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
    const banner = await screen.findByText(/نسبته للمحفظة لم تتم/);
    expect(banner.textContent).toContain("رصيد الدرج لا يكفي الحصة.");
    expect(banner.textContent).toContain(
      "تغطية الجزء الشخصي من المحفظة: الرصيد المتبقي لا يكفي الجزء الشخصي.",
    );
    expect(banner.textContent).toContain("الكاش غير الموزع");
  });

  it("R3-F07: بعد نتيجة جزئية صُرفت بـ«تم» — الزر الأساسي عودة لا حفظ جديد", async () => {
    const { record, setupFromExpense } = renderEditor({});
    await userEvent.setup().type(screen.getByLabelText("المبلغ بالدينار الأردني"), "25");
    await userEvent
      .setup()
      .type(screen.getByPlaceholderText("مثال: دفعت توصيل الطلبات للأسبوع"), "اشتراك إنترنت");
    fireEvent.click(await screen.findByText("يتكرر — ذكّرني بهذا المصروف كل شهر"));
    record.mockResolvedValueOnce({ ok: true, value: { ...baseEvent, amountMinor: 2_500 } });
    setupFromExpense.mockResolvedValueOnce({ ok: false, code: "storage_error", message: "تعذر محلي مؤقت" });
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
    await waitFor(() => expect(screen.getByText(/حُفظ المصروف، ولم يُحفظ التذكير/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "تم" }));
    await waitFor(() => expect(screen.queryByText(/حُفظ المصروف، ولم يُحفظ التذكير/)).toBeNull());
    /* المصروف محفوظ والصفحة قائمة: الفعل الأساسي عودة — والنقر يخرج بلا نداء جديد للكاتب. */
    const back = screen.getByRole("button", { name: "ارجع إلى المالية" });
    expect(back).toBeTruthy();
    fireEvent.click(back);
    expect(wouterMocks.navigate).toHaveBeenCalled();
    expect(record).toHaveBeenCalledOnce();
    expect(setupFromExpense).toHaveBeenCalledOnce();
  });
});

/* S07 (S06-MR-001): تأكيد «من تحمّل الباقي» مرتبط بقيمة الزوج الكنوني —
 * تغيّر الحصة أو المدفوع بعد التأكيد يُظهره غير معتمد ويُعاد طلبه قبل
 * الحفظ؛ لا يبقى قائمًا لقيمة تغيّرت (المسار الحي الحقيقي للملاحظة). */
describe("S07 — S06-MR-001: بطلان تأكيد الجزء الشخصي عند تغير مدخلات قيمته", () => {
  /* S07 (S06-MR-001): مربع تأكيد تحمّل الباقي — يُحدد عبر نصه داخل ملصقه
   * (توجد مربعات أخرى بالصفحة كخيار «يتكرر») فلا يلتبس به أداؤه. */
  function ownerConfirmCheckbox(): HTMLInputElement {
    const label = screen.getByText(/فوق حصة المشروع على المالك/).closest("label");
    if (!label) throw new Error("لم يُعثر على ملصق تأكيد تحمّل الباقي");
    const input = label.querySelector<HTMLInputElement>("input[type=checkbox]");
    if (!input) throw new Error("لم يُعثر على مربع تأكيد تحمّل الباقي");
    return input;
  }

  beforeEach(() => {
    wouterMocks.navigate.mockClear();
    routeParams.type = "operating_expense_cash";
    window.localStorage.clear();
  });
  afterEach(() => cleanup());

  it("تأكيد عند (حصة 30/مدفوع 60) ثم تغيير الحصة إلى 20 يبطل التأكيد ويمنع الحفظ — إعادة التأكيد تمرره بالقيم الجديدة", async () => {
    const { record, recordSharedBill } = renderEditor({});
    await openSharedFixedForm();
    const amount = screen.getByLabelText("المبلغ بالدينار الأردني");
    const paid = screen.getByLabelText("المدفوع فعليًا من صندوق المشروع");
    await userEvent.setup().type(amount, "30");
    await userEvent.setup().type(paid, "60");
    /* تأكيد صريح فوق (30/60) — الجزء الشخصي 30. */
    const confirmAtThirty = await screen.findByText(/الفارق 30.00 د.أ فوق حصة المشروع على المالك/);
    fireEvent.click(confirmAtThirty);
    expect(ownerConfirmCheckbox().checked).toBe(true);
    /* المستخدم عدّل حصة المشروع إلى 20 بعد التأكيد — الجزء الشخصي صار 40:
     * التأكيد القديم لا يجوز أن يوثّقه؛ المؤشر يظهر غير معتمد. */
    fireEvent.change(screen.getByLabelText("المبلغ بالدينار الأردني"), { target: { value: "20" } });
    /* الحصة الجديدة ظاهرة بمعناها: الفارق 40 (60 − 20) لا 30. */
    await waitFor(() => expect(screen.getByText(/الفارق 40.00 د.أ فوق حصة المشروع على المالك/)).toBeTruthy());
    await waitFor(() => expect(ownerConfirmCheckbox().checked).toBe(false));
    await userEvent
      .setup()
      .type(screen.getByPlaceholderText("مثال: دفعت توصيل الطلبات للأسبوع"), "فاتورة تغيّرت حصتها");
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
    await waitFor(() =>
      expect(screen.getByText(/أكّد أن المالك تحمّل الباقي ليُسجل سحبًا شخصيًا بنفس الحفظ/)).toBeTruthy(),
    );
    expect(recordSharedBill).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    /* إعادة التأكيد فوق القيم الجديدة (20/60) — الجزء 40 — تجيز الحفظ
     * وتمرر زوج التأكيد المطابق مع النية. */
    const confirmAtTwenty = await screen.findByText(/الفارق 40.00 د.أ فوق حصة المشروع على المالك/);
    fireEvent.click(confirmAtTwenty);
    recordSharedBill.mockResolvedValueOnce({
      ok: true,
      value: {
        expense: { ...baseEvent, amountMinor: 2_000 },
        ownerPart: {
          ...baseEvent,
          id: "event-owner-part-2",
          type: "owner_withdrawal_cash",
          amountMinor: 4_000,
        },
        ownerPartFailure: null,
      },
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
    await waitFor(() => expect(recordSharedBill).toHaveBeenCalledOnce());
    const payload = recordSharedBill.mock.calls[0]?.[0] as {
      amountMinor?: number;
      sharedExpense?: { paidAmountMinor?: number };
      ownerPartConfirmation?: { shareAmountMinor: number; paidAmountMinor: number | null };
    };
    expect(payload.amountMinor).toBe(2_000);
    expect(payload.sharedExpense?.paidAmountMinor).toBe(6_000);
    expect(payload.ownerPartConfirmation).toEqual({ shareAmountMinor: 2_000, paidAmountMinor: 6_000 });
  });

  it("تغيير المدفوع بعد التأكيد يبطل التأكيد بنفس القاعدة", async () => {
    const { record, recordSharedBill } = renderEditor({});
    await openSharedFixedForm();
    await userEvent.setup().type(screen.getByLabelText("المبلغ بالدينار الأردني"), "30");
    await userEvent.setup().type(screen.getByLabelText("المدفوع فعليًا من صندوق المشروع"), "60");
    fireEvent.click(await screen.findByText(/الفارق 30.00 د.أ فوق حصة المشروع على المالك/));
    expect(ownerConfirmCheckbox().checked).toBe(true);
    /* المدفوع صار 90 — الجزء 60 لا 30: التأكيد القديم غير نافذ. */
    const paidField = screen.getByLabelText("المدفوع فعليًا من صندوق المشروع") as HTMLInputElement;
    fireEvent.change(paidField, { target: { value: "90" } });
    await waitFor(() => expect(ownerConfirmCheckbox().checked).toBe(false));
    await userEvent
      .setup()
      .type(screen.getByPlaceholderText("مثال: دفعت توصيل الطلبات للأسبوع"), "فاتورة تغيّر مدفوعها");
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ المصروف المصنف" }));
    await waitFor(() =>
      expect(screen.getByText(/أكّد أن المالك تحمّل الباقي ليُسجل سحبًا شخصيًا بنفس الحفظ/)).toBeTruthy(),
    );
    expect(recordSharedBill).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});
