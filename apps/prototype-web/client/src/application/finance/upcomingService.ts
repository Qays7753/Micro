/**
 * Stage 2 — OPS-005/OPS-006 (tracker): القارئ الموحّد للقادم والمتأخر — قراءة
 * فقط فوق المصادر القائمة بلا Writer جديد ولا كتابة عند الفتح إطلاقًا.
 *
 * كل نوع تاريخ بمعنى ومصدر معلنين لا يخلط بينها:
 * • مدفوعات الموردين: تاريخ الاستحقاق المخزّن `dueOn` (عقد ٩) وتقادمه من
 *   `DueDatesService` (OPS-001).
 * • الطلبات: الموعد المجدول `scheduledFor` (عقد ١٨ — جدول مشتق) وحالاته من
 *   `ScheduleService.overview` وحده.
 * • ذمم التحصيل والالتزامات المستحقة: لا حقل تاريخ استحقاق مخزّن لها في
 *   المخطط المجمد — تُصرَّح «بلا تاريخ» والمبالغ تُقرأ من مصادرها الرسمية
 *   (ورقة التحصيل، الأحداث المالية)؛ غياب التاريخ ليس غياب الدين.
 * التقادم هنا مبسّط (متأخر/حالي/بلا تاريخ) بلا شرائح 30/60/90 (BE-005 مؤجل)،
 * وكل كتلة تُقرأ مستقلة ففشلها يعزل نفسه ولا يمس بقية الكتل.
 */
import type {
  DueDatesResult,
  DueDatesService,
  PayablesAgingOverview,
} from "@/application/finance/dueDatesService";
import type { CollectionService } from "@/application/collections/collectionService";
import type { ScheduleService } from "@/application/scheduling/scheduleService";
import type { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import type { DueDateState } from "@/application/finance/dueDateAging";

export type UpcomingKind = "supplier_payable" | "receivable" | "order" | "expense_payable";

/** معنى التاريخ المعروض ومصدره — نوع واحد لكل مصدر، لا مزج. */
export type UpcomingDateKind = "supplier_due" | "scheduled_date" | "no_stored_date";

export type UpcomingEntry = {
  id: string;
  kind: UpcomingKind;
  /** جهة الصف من سجله الأصلي (مورد/زبون/اسم القطعة). */
  title: string;
  /** توصيف إضافي من السجل الأصلي إن وجد. */
  note: string | null;
  /** تصنيف المصدر كما يقدمه (ذمم التحصيل مثلًا). */
  qualifier: string | null;
  /** المبلغ حيث له معنى نقدي صادق؛ null للطلبات — موعد تنفيذ لا استحقاق نقدي. */
  amountMinor: number | null;
  dueOn: string | null;
  dateState: DueDateState;
  dateKind: UpcomingDateKind;
  /** يفتح سجل المصدر الأصلي — لا يكتب شيئًا. */
  sourceHref: string;
};

export type UpcomingBlockResult =
  { ok: true; entries: readonly UpcomingEntry[] } | { ok: false; code: "storage_error"; message: string };

export type UpcomingAgingTotals = {
  /** تقادم الذمم الدائنة (OPS-001) أو null إن تعذرت قراءتها. */
  payables: {
    overdueMinor: number;
    currentMinor: number;
    unknownMinor: number;
    overdueCount: number;
    currentCount: number;
    unknownCount: number;
  } | null;
  /** ذمم التحصيل — كلها بلا تاريخ مخزّن؛ المبالغ ظاهرة. */
  receivables: { totalMinor: number; count: number } | null;
  /** الالتزامات المستحقة — كلها بلا تاريخ مخزّن؛ المبالغ ظاهرة. */
  obligations: { totalMinor: number; count: number } | null;
};

export type UpcomingOverview = {
  payables: UpcomingBlockResult;
  receivables: UpcomingBlockResult;
  orders: UpcomingBlockResult;
  obligations: UpcomingBlockResult;
  aging: UpcomingAgingTotals;
};

export class UpcomingService {
  constructor(
    private readonly dueDates: DueDatesService,
    private readonly collections: CollectionService,
    private readonly schedules: ScheduleService,
    private readonly projectFinance: ProjectFinancialService,
  ) {}

  /** القراءة الموحدة: أربع كتل مستقلة + تقادم مبسط من نتائجها — لا كتابة أبدًا. */
  async readOverview(): Promise<UpcomingOverview> {
    const [payablesAging, receivableSources, scheduleOverview, settleablePayables] = await Promise.all([
      this.dueDates.readPayablesAging(),
      this.collections.listReceivableSources(),
      this.schedules.overview(),
      this.projectFinance.listSettleablePayables(),
    ]);

    const payables: UpcomingBlockResult = payablesAging.ok
      ? {
          ok: true,
          entries: payablesAging.value.rows.map(row => ({
            id: row.purchaseId,
            kind: "supplier_payable" as const,
            title: row.supplierName,
            note: null,
            qualifier: null,
            amountMinor: row.payableMinor,
            dueOn: row.dueOn,
            dateState: row.dueState,
            dateKind: "supplier_due" as const,
            sourceHref: `/suppliers/purchase/${row.purchaseId}`,
          })),
        }
      : { ok: false, code: "storage_error", message: payablesAging.message };

    const receivables: UpcomingBlockResult = receivableSources.ok
      ? {
          ok: true,
          entries: receivableSources.value.map(source => ({
            id: source.id,
            kind: "receivable" as const,
            title: source.personName,
            note: source.itemName,
            qualifier: source.qualifier,
            amountMinor: source.outstandingMinor,
            dueOn: null,
            dateState: "none" as const,
            dateKind: "no_stored_date" as const,
            sourceHref: source.sourceHref,
          })),
        }
      : { ok: false, code: "storage_error", message: receivableSources.message };

    const orders: UpcomingBlockResult = scheduleOverview.ok
      ? {
          ok: true,
          entries: [
            ...scheduleOverview.value.overdue,
            ...scheduleOverview.value.today,
            ...scheduleOverview.value.upcoming,
          ].map(({ schedule, order, bucket }) => ({
            id: order.id,
            kind: "order" as const,
            title: order.order.itemName,
            note: order.order.customerName || null,
            qualifier: null,
            amountMinor: null,
            dueOn: schedule.scheduledFor,
            dateState: bucket as DueDateState,
            dateKind: "scheduled_date" as const,
            sourceHref: `/orders/${order.id}`,
          })),
        }
      : { ok: false, code: "storage_error", message: scheduleOverview.message };

    const obligations: UpcomingBlockResult = settleablePayables.ok
      ? {
          ok: true,
          entries: settleablePayables.value.map(({ event, remainingMinor }) => ({
            id: event.id,
            kind: "expense_payable" as const,
            title: event.note ?? "",
            note: null,
            qualifier: null,
            amountMinor: remainingMinor,
            dueOn: null,
            dateState: "none" as const,
            dateKind: "no_stored_date" as const,
            sourceHref: `/finance?event=${event.id}`,
          })),
        }
      : { ok: false, code: "storage_error", message: settleablePayables.message };

    return {
      payables,
      receivables,
      orders,
      obligations,
      aging: agingOf(payablesAging, receivables, obligations),
    };
  }
}

function agingOf(
  payablesAging: DueDatesResult<PayablesAgingOverview>,
  receivables: UpcomingBlockResult,
  obligations: UpcomingBlockResult,
): UpcomingAgingTotals {
  return {
    /* تقادم الذمم الدائنة من مصدره الموحد نفسه (OPS-001) لا حساب ثانٍ. */
    payables: payablesAging.ok ? payablesAging.value.totals : null,
    receivables: totalsOf(receivables),
    obligations: totalsOf(obligations),
  };
}

function totalsOf(block: UpcomingBlockResult): { totalMinor: number; count: number } | null {
  if (!block.ok) return null;
  let totalMinor = 0;
  let count = 0;
  for (const entry of block.entries) {
    if (entry.amountMinor !== null) totalMinor += entry.amountMinor;
    count += 1;
  }
  return { totalMinor, count };
}
