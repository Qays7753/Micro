/** @vitest-environment jsdom */
/* OPS-003 (عقد ٤١ §١٢/§١٤): مسارات DOM العربية لأسطح المصروف المتكرر —
 * الفراغ الصادق، الخطأ المعزول، النص الطويل، لوحة المفاتيح، والحالات
 * الأربع الملزمة بتسمياتها الحرفية: «تم تسجيل المصروف» و«المصروف مسجل
 * مسبقًا لهذه الفترة» و«لم يُسجل المصروف» و«نتيجة التسجيل غير معروفة».
 * لا نجاح مالي يُدَّعى بلا نتيجة متحققة، والمتأخر انتباه لا دين. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { RecurringExpenseService } from "@/application/finance/recurringExpenseService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import {
  markRecurringExpenseConfirmAttempted,
  markRecurringExpenseRecordFailed,
  type RecurringExpenseRuleDraft,
} from "@micro-domain/recurring-expense/index.js";
import FinanceRecurring from "@/pages/FinanceRecurring";
import RecurringExpenseDetail from "@/pages/RecurringExpenseDetail";
import RecurringExpenseEditor from "@/pages/RecurringExpenseEditor";
import { RecurringConfirmPanel } from "@/components/finance/RecurringConfirmPanel";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/finance/recurring",
  params: {} as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useSearch: () => "",
  useParams: () => wouterMocks.params,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-21T08:00:00.000Z"; /* عمّان +03: اليوم 2026-09-21 */

let store: MemoryLocalStore;
let service: RecurringExpenseService;
let finance: ProjectFinancialService;

function buildServices() {
  finance = new ProjectFinancialService(store, () => NOW);
  service = new RecurringExpenseService(store, () => NOW, finance);
  const cashContinuity = new CashContinuityService(store, () => NOW);
  return {
    recurringExpenses: service,
    cashContinuity,
    dataVersion: 0,
    notifyDataChanged: () => undefined,
  } as unknown as ReturnType<typeof usePrototypeServices>;
}

const baseRule = (overrides: Partial<RecurringExpenseRuleDraft> = {}): RecurringExpenseRuleDraft => ({
  effectiveFromPeriod: "2026-09",
  frequency: "monthly",
  interval: 1,
  anchorDate: "2026-09-01",
  dueDay: 5,
  monthEndPolicy: "last_valid_day",
  timezone: "Asia/Amman",
  amountMode: "suggested",
  suggestedAmountMinor: 25_000,
  suggestedWalletId: null,
  categoryLabel: "إيجار",
  changeReason: null,
  ...overrides,
});

async function seedActiveSeries(rule: RecurringExpenseRuleDraft = baseRule(), title = "إيجار المحل الشهري") {
  const created = await service.createDraft({ title, rule });
  if (!created.ok) throw new Error(created.message);
  const activated = await service.activate(created.value.series.id);
  if (!activated.ok) throw new Error(activated.message);
  return created.value.series.id;
}

async function occurrenceOf(seriesId: string, periodKey: string) {
  const detail = await service.readDetail(seriesId);
  if (!detail.ok) throw new Error(detail.message);
  const reading = detail.value.occurrences.find(candidate => candidate.occurrence.periodKey === periodKey);
  if (!reading) throw new Error(`لا فترة ${periodKey}`);
  return reading.occurrence;
}

async function eventsCount() {
  const events = await store.listFinancialEvents();
  if (!events.ok) throw new Error(events.message);
  return events.value.length;
}

beforeEach(() => {
  store = new MemoryLocalStore();
  wouterMocks.navigate.mockClear();
  wouterMocks.params = {};
  wouterMocks.location = "/finance/recurring";
  mockedUsePrototypeServices.mockReturnValue(buildServices());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("OPS-003 — قائمة المصاريف المتكررة (DOM)", () => {
  it("الفراغ الصادق: لا تذكيرات بعد، بلا اختراع سجلات، مع ملاحظة القراءة فقط وزر الإنشاء", async () => {
    render(<FinanceRecurring />);
    expect(await screen.findByText("لا تذكيرات متكررة بعد")).toBeTruthy();
    expect(screen.getByRole("button", { name: /تذكير مصروف متكرر جديد/ })).toBeTruthy();
    expect(screen.getByRole("note").textContent).toContain("التسجيل المالي يحدث فقط من مراجعة الفترة");
    expect(await eventsCount()).toBe(0);
  });

  it("بطاقة السلسلة النشطة: أقرب موعد وعدّ العولج، والموقوفة تُعلن الاستئناف المستقبلي", async () => {
    const seriesId = await seedActiveSeries();
    /* توليد الفترات أولًا (قراءة واحدة) ثم الإيقاف — الموقوفة لا تولّد جديدًا. */
    await service.readDetail(seriesId);
    await service.pause(seriesId);
    render(<FinanceRecurring />);
    const card = await screen.findByText("إيجار المحل الشهري");
    expect(card.closest("article")).toBeTruthy();
    expect(screen.getByText("موقوف مؤقتًا")).toBeTruthy();
    expect(screen.getByText(/الاستئناف نشاط مستقبلي/)).toBeTruthy();
    expect(screen.getByText(/أقرب موعد تذكير/)).toBeTruthy();
    expect(screen.getByText(/عولج/)).toBeTruthy();
  });

  it("النص الطويل (٨٠ حرفًا) يُعرض كاملًا بلا بتر — dir=auto يحفظ الاتجاه", async () => {
    const longTitle = "إيجار".repeat(16); /* ٨٠ حرفًا بالضبط */
    await seedActiveSeries(baseRule(), longTitle);
    render(<FinanceRecurring />);
    const title = await screen.findByText(longTitle);
    expect(title.getAttribute("dir")).toBe("auto");
  });
});

describe("OPS-003 — تفصيل التذكير وفتراته (DOM)", () => {
  it("الفترة المتأخرة انتباه لا دين: التسمية صادقة والفتح لا يكتب أي حدث مالي", async () => {
    const seriesId = await seedActiveSeries();
    wouterMocks.params = { id: seriesId };
    render(<RecurringExpenseDetail />);
    expect(await screen.findByText("متأخر — انتباه لا دين")).toBeTruthy();
    expect(await eventsCount()).toBe(0);
  });

  it("التأكيد الصريح يعرض «تم تسجيل المصروف» بحدث واحد، والمفتاح الحتمي يمنع الثانية", async () => {
    const seriesId = await seedActiveSeries();
    const occurrence = await occurrenceOf(seriesId, "2026-09");
    wouterMocks.params = { id: seriesId };
    render(<RecurringExpenseDetail />);
    const user = userEvent.setup();
    /* فترتا سبتمبر (المتأخرة) وأكتوبر (القادمة) مفتوحتان — الأولى بالترتيب سبتمبر. */
    const recordButtons = await screen.findAllByRole("button", { name: "سجّل مصروف هذه الفترة" });
    expect(recordButtons.length).toBe(2);
    await user.click(recordButtons[0]!);
    await user.click(await screen.findByRole("button", { name: "أكّد تسجيل المصروف" }));
    expect(await screen.findByText(/تم تسجيل المصروف — بتاريخ حدوثه/)).toBeTruthy();
    expect(await eventsCount()).toBe(1);
    /* نتيجة إعادة التأكيد على نفس الفترة عبر اللوحة: إعادة استخدام صادقة. */
    const again = await service.confirm(occurrence.id, {
      type: "operating_expense_cash",
      amountMinor: 25_000,
      occurredOn: "2026-09-21",
      note: "إيجار سبتمبر",
      expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
    });
    expect(again.ok && again.value.status).toBe("reused");
    expect(await eventsCount()).toBe(1);
  });

  it("«نتيجة التسجيل غير معروفة»: علامة سؤال محايدة وزر تحقق لا يزعم نجاحًا بلا نتيجة", async () => {
    const seriesId = await seedActiveSeries();
    const occurrence = await occurrenceOf(seriesId, "2026-09");
    const attempted = markRecurringExpenseConfirmAttempted(occurrence, NOW);
    const committed = await store.commitRecurringExpenseOccurrenceDecision(occurrence, attempted);
    expect(committed.ok).toBe(true);
    wouterMocks.params = { id: seriesId };
    render(<RecurringExpenseDetail />);
    /* التسمية الملزمة تظهر مرتين بصدق: سطر الحالة وعلامة الحياد. */
    const labels = await screen.findAllByText("نتيجة التسجيل غير معروفة");
    expect(labels.length).toBeGreaterThanOrEqual(1);
    const chip = labels.find(element => element.className.includes("chip"));
    expect(chip).toBeTruthy();
    const check = screen.getByRole("button", { name: "تحقق من النتيجة" });
    expect(check.tagName).toBe("BUTTON");
    fireEvent.click(check);
    /* لا حدث بالمفتاح => لا يُزعم تسجيل — الحالة باقية كما هي بلا ادعاء. */
    expect(await eventsCount()).toBe(0);
    expect(screen.getAllByText("نتيجة التسجيل غير معروفة").length).toBeGreaterThanOrEqual(1);
  });

  it("«لم يُسجل المصروف» لحالة الفشل الموثق مع مساب إعادة صريح", async () => {
    const seriesId = await seedActiveSeries();
    const occurrence = await occurrenceOf(seriesId, "2026-09");
    /* المسار القانوني: محاولة ثم فشل معروف موثق (planned → recording → record_failed). */
    const attempted = markRecurringExpenseConfirmAttempted(occurrence, NOW);
    const marker = await store.commitRecurringExpenseOccurrenceDecision(occurrence, attempted);
    expect(marker.ok).toBe(true);
    const failed = markRecurringExpenseRecordFailed(attempted, "تعذر الحفظ المحلي", NOW);
    const committed = await store.commitRecurringExpenseOccurrenceDecision(attempted, failed);
    expect(committed.ok).toBe(true);
    wouterMocks.params = { id: seriesId };
    render(<RecurringExpenseDetail />);
    expect(await screen.findByText("لم يُسجل المصروف")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "سجّل مصروف هذه الفترة" }).length).toBe(2);
    expect(await eventsCount()).toBe(0);
  });

  it("سؤال الشهر القصير صريح: جواب «تخطَّ هذا الشهر» قرار موثق بلا أي حدث مالي", async () => {
    const seriesId = await seedActiveSeries(
      baseRule({
        effectiveFromPeriod: "2026-08",
        anchorDate: "2026-08-31",
        dueDay: 31,
        monthEndPolicy: "ask",
      }),
    );
    wouterMocks.params = { id: seriesId };
    render(<RecurringExpenseDetail />);
    expect(await screen.findByText(/يوم 31 لا يوجد في فترة 2026-09/)).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "تخطَّ هذا الشهر" }));
    await waitFor(async () => {
      const detail = await service.readDetail(seriesId);
      const september = detail.ok
        ? detail.value.occurrences.find(candidate => candidate.occurrence.periodKey === "2026-09")
        : undefined;
      expect(september?.occurrence.status).toBe("skipped");
    });
    expect(await eventsCount()).toBe(0);
  });

  it("الإلغاء الموثق بسبب: يلغي المستقبلية غير المقَرَّرة فقط ولا يمس المقَرَّرة", async () => {
    const seriesId = await seedActiveSeries(
      baseRule({ effectiveFromPeriod: "2026-08", anchorDate: "2026-08-05" }),
    );
    const september = await occurrenceOf(seriesId, "2026-09");
    const confirmed = await service.confirm(september.id, {
      type: "operating_expense_cash",
      amountMinor: 25_000,
      occurredOn: "2026-09-04",
      note: "إيجار سبتمبر",
      expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
    });
    expect(confirmed.ok).toBe(true);
    wouterMocks.params = { id: seriesId };
    render(<RecurringExpenseDetail />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "ألغِ تذكير المستقبل" }));
    await user.type(screen.getByLabelText("سبب الإلغاء"), "أغلقت المحل");
    await user.click(screen.getByRole("button", { name: "أكّد إلغاء تذكير المستقبل" }));
    await waitFor(async () => {
      const detail = await service.readDetail(seriesId);
      expect(detail.ok && detail.value.series.status).toBe("cancelled");
    });
    const after = await service.readDetail(seriesId);
    const statuses = new Map(
      after.ok ? after.value.occurrences.map(r => [r.occurrence.periodKey, r.occurrence.status]) : [],
    );
    expect(statuses.get("2026-09")).toBe("recorded");
    expect(statuses.get("2026-10")).toBe("cancelled");
    expect(await eventsCount()).toBe(1);
  });

  it("«تم تسجيل المصروف — ثم عُكس بتراجع موثق»: العرض مشتق والفترة لا تُفتح", async () => {
    const seriesId = await seedActiveSeries();
    const occurrence = await occurrenceOf(seriesId, "2026-09");
    const confirmed = await service.confirm(occurrence.id, {
      type: "operating_expense_cash",
      amountMinor: 25_000,
      occurredOn: "2026-09-04",
      note: "إيجار سبتمبر",
      expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
    });
    if (!confirmed.ok) throw new Error(confirmed.message);
    if (confirmed.value.status === "record_failed") throw new Error(confirmed.value.message);
    const reversed = await finance.reverse({
      sourceEventId: confirmed.value.event.id,
      occurredOn: "2026-09-22",
      reason: "دخل مزدوج بالخطأ",
      idempotencyKey: "reverse-dom-1",
    });
    expect(reversed.ok).toBe(true);
    wouterMocks.params = { id: seriesId };
    render(<RecurringExpenseDetail />);
    expect(await screen.findByText("تم تسجيل المصروف — ثم عُكس بتراجع موثق")).toBeTruthy();
    /* فترة سبتمبر المقَرّرة المعكوسة بلا زر تسجيل؛ أكتوبر القادمة زرها باقٍ. */
    const septemberRow = screen.getByText(/فترة 2026-09 — موعد التذكير/).closest("article");
    expect(within(septemberRow!).queryByRole("button", { name: "سجّل مصروف هذه الفترة" })).toBeNull();
    expect(within(septemberRow!).getByRole("button", { name: /افتح سجل الأحداث/ })).toBeTruthy();
  });

  it("لوحة المفاتيح: أزرار القرار أزرار حقيقية قابلة للتركيز غير معطلة", async () => {
    const seriesId = await seedActiveSeries();
    wouterMocks.params = { id: seriesId };
    render(<RecurringExpenseDetail />);
    const record = (await screen.findAllByRole("button", { name: "سجّل مصروف هذه الفترة" }))[0]!;
    expect(record.tagName).toBe("BUTTON");
    expect(record.getAttribute("disabled")).toBeNull();
    record.focus();
    expect(document.activeElement).toBe(record);
  });

  it("الخطأ المعزول: فشل القراءة بطاقة صادقة وزر إعادة محاولة حقيقي", async () => {
    const seriesId = await seedActiveSeries();
    const failing = buildServices();
    failing.recurringExpenses = {
      readDetail: vi
        .fn()
        .mockResolvedValue({ ok: false, code: "storage_error", message: "تعذّرت قراءة فترات التذكير." }),
    } as unknown as RecurringExpenseService;
    mockedUsePrototypeServices.mockReturnValue(failing);
    wouterMocks.params = { id: seriesId };
    render(<RecurringExpenseDetail />);
    expect(await screen.findByText("تعذّرت قراءة فترات التذكير.")).toBeTruthy();
    const retry = screen.getByRole("button", { name: "إعادة المحاولة" });
    expect(retry.tagName).toBe("BUTTON");
    expect(retry.getAttribute("disabled")).toBeNull();
  });
});

describe("OPS-003 — لوحة التأكيد (DOM)", () => {
  it("«المصروف مسجل مسبقًا لهذه الفترة» عند إعادة تأكيد فترة مقَرَّرة: لا حدث ثانٍ", async () => {
    const seriesId = await seedActiveSeries();
    const occurrence = await occurrenceOf(seriesId, "2026-09");
    const first = await service.confirm(occurrence.id, {
      type: "operating_expense_cash",
      amountMinor: 25_000,
      occurredOn: "2026-09-21",
      note: "إيجار سبتمبر",
      expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
    });
    expect(first.ok && first.value.status).toBe("recorded");
    render(
      <RecurringConfirmPanel
        seriesTitle="إيجار المحل الشهري"
        periodKey="2026-09"
        dueOn="2026-09-05"
        amountMode="suggested"
        suggestedAmountMinor={25_000}
        suggestedCategoryLabel="إيجار"
        suggestedWalletId={null}
        occurrenceId={occurrence.id}
        today="2026-09-21"
        onSettled={() => undefined}
      />,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "أكّد تسجيل المصروف" }));
    expect(await screen.findByText(/المصروف مسجل مسبقًا لهذه الفترة/)).toBeTruthy();
    expect(await eventsCount()).toBe(1);
  });

  it("غياب المبلغ رفض صادر بلا كتابة — «لم يُسجل المصروف» لا يظهر لأن شيئًا لم يُدَّع", async () => {
    const seriesId = await seedActiveSeries(baseRule({ amountMode: "manual", suggestedAmountMinor: null }));
    wouterMocks.params = { id: seriesId };
    render(<RecurringExpenseDetail />);
    const user = userEvent.setup();
    await user.click((await screen.findAllByRole("button", { name: "سجّل مصروف هذه الفترة" }))[0]!);
    await user.click(await screen.findByRole("button", { name: "أكّد تسجيل المصروف" }));
    expect(
      await screen.findByText("أدخل مبلغ المصروف قبل التأكيد — الاقتراح ليس مبلغًا نهائيًا بلا مراجعتك."),
    ).toBeTruthy();
    expect(await eventsCount()).toBe(0);
  });

  it("معاينة الأثر قبل التأكيد وتسمية «تاريخ حدوث المصروف» متمايزة عن موعد التذكير", async () => {
    const seriesId = await seedActiveSeries();
    wouterMocks.params = { id: seriesId };
    render(<RecurringExpenseDetail />);
    const user = userEvent.setup();
    await user.click((await screen.findAllByRole("button", { name: "سجّل مصروف هذه الفترة" }))[0]!);
    const panel = screen.getByLabelText("مراجعة وتأكيد فترة المصروف المتكرر");
    expect(within(panel).getByText("تاريخ حدوث المصروف")).toBeTruthy();
    expect(within(panel).getByText(/يختلف عن موعد التذكير المجدول 2026-09-05/)).toBeTruthy();
    expect(within(panel).getByText("بعد الحفظ:")).toBeTruthy();
  });
});

describe("OPS-003 — محرر التذكير (DOM)", () => {
  it("العنوان الفارغ مرفوض برسالة صادقة بلا أي كتابة", async () => {
    wouterMocks.params = {};
    wouterMocks.location = "/finance/recurring/new";
    render(
      <UnsavedChangesProvider navigate={() => undefined}>
        <RecurringExpenseEditor />
      </UnsavedChangesProvider>,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /احفظ وفعّل التذكير/ }));
    expect(await screen.findByText("اكتب عنوان التذكير أولًا — هو اسمه لا معناه المالي.")).toBeTruthy();
    expect(await eventsCount()).toBe(0);
  });

  it("الحفظ والتفعيل ينشئان السلسلة وينقلان إلى تفصيلها", async () => {
    wouterMocks.params = {};
    wouterMocks.location = "/finance/recurring/new";
    render(
      <UnsavedChangesProvider navigate={() => undefined}>
        <RecurringExpenseEditor />
      </UnsavedChangesProvider>,
    );
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("عنوان التذكير"), "فاتورة الكهرباء");
    await user.click(screen.getByRole("button", { name: /احفظ وفعّل التذكير/ }));
    await waitFor(() => {
      expect(wouterMocks.navigate).toHaveBeenCalled();
    });
    const overview = await service.readOverview();
    const created = overview.ok
      ? overview.value.find(card => card.series.title === "فاتورة الكهرباء")
      : undefined;
    expect(created?.series.status).toBe("active");
    expect(await eventsCount()).toBe(0);
  });
});
