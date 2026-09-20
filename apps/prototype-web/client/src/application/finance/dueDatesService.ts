/**
 * Stage 2 — OPS-001 (tracker): خدمة مواعيد الاستحقاق والتقادم الأساسي — قراءة
 * فقط فوق السجلات القائمة؛ فتح أي قراءة لا يكتب سجلًا ماليًا ولا يمس Cost
 * Snapshot تاريخية ولا يغيّر أي Writer قائمًا.
 *
 * • الذمم الدائنة (ما عليك للموردين): التاريخ من dueOn المخزّن للشراء —
 *   محفوظ أو «غير محدد» صراحةً (عقد ٩)؛ التقادم يميز المتأخر عن الحالي دون
 *   اختراع تاريخ، والشراء المسدّد خارج القراءة.
 * • الذمم القابلة للتحصيل (ما لك عند الناس): لا يوجد حقل تاريخ استحقاق
 *   محفوظ لها في المخطط المجمد (35/27) — فتُصرَّح «بلا تاريخ» والمبلغ يبقى
 *   ظاهرًا: غياب التاريخ ليس غياب الدين.
 */
import type { PrototypeLocalStore } from "@/storage/local/types";
import type { CollectionService } from "@/application/collections/collectionService";
import { localDateInAmman } from "@micro-domain/shared/index.js";
import { classifyDueDate, dueAgingBucket, type DueAgingBucket, type DueDateState } from "./dueDateAging";

export type PayableDueRow = {
  purchaseId: string;
  supplierName: string;
  payableMinor: number;
  /** تاريخ الاستحقاق المحلي المخزّن (YYYY-MM-DD) أو null = غير محدد صراحةً. */
  dueOn: string | null;
  dueState: DueDateState;
  agingBucket: DueAgingBucket;
};

export type PayablesAgingTotals = {
  overdueMinor: number;
  currentMinor: number;
  unknownMinor: number;
  overdueCount: number;
  currentCount: number;
  unknownCount: number;
};

export type PayablesAgingOverview = {
  rows: readonly PayableDueRow[];
  totals: PayablesAgingTotals;
};

export type ReceivableDueRow = {
  sourceKind: "order" | "direct_sale";
  sourceId: string;
  personName: string;
  outstandingMinor: number;
  /** لا حقل تاريخ استحقاق محفوظ لذمم التحصيل — «بلا تاريخ» مصرّح به لا تاريخ اليوم. */
  dueOn: null;
  dueState: "none";
};

export type DueDatesResult<T> =
  { ok: true; value: T } | { ok: false; code: "storage_error"; message: string };

export class DueDatesService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly collections: CollectionService,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  /** تقادم الذمم الدائنة المفتوحة: متأخر / حالي / مجهول التاريخ، بمبالغها. */
  async readPayablesAging(): Promise<DueDatesResult<PayablesAgingOverview>> {
    const purchases = await this.store.listSupplierPurchases();
    if (!purchases.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة مشتريات الموردين المحلية." };
    const today = localDateInAmman(this.now());
    const rows: PayableDueRow[] = [];
    for (const purchase of purchases.value) {
      if (purchase.payableMinor <= 0) continue;
      const dueState = classifyDueDate(purchase.dueOn, today);
      rows.push({
        purchaseId: purchase.id,
        supplierName: purchase.supplierName,
        payableMinor: purchase.payableMinor,
        dueOn: purchase.dueOn,
        dueState,
        agingBucket: dueAgingBucket(dueState),
      });
    }
    return { ok: true, value: { rows, totals: agingTotalsOf(rows) } };
  }

  /** ذمم التحصيل بحالتها الصادقة الوحيدة: «بلا تاريخ استحقاق» — والمبالغ تُقرأ. */
  async readReceivablesDueState(): Promise<DueDatesResult<readonly ReceivableDueRow[]>> {
    const sources = await this.collections.listReceivableSources();
    if (!sources.ok) return { ok: false, code: "storage_error", message: sources.message };
    const rows = sources.value.map(source => ({
      sourceKind: source.kind,
      sourceId: source.id,
      personName: source.personName,
      outstandingMinor: source.outstandingMinor,
      dueOn: null,
      dueState: "none" as const,
    }));
    return { ok: true, value: rows };
  }
}

function agingTotalsOf(rows: readonly PayableDueRow[]): PayablesAgingTotals {
  const totals: PayablesAgingTotals = {
    overdueMinor: 0,
    currentMinor: 0,
    unknownMinor: 0,
    overdueCount: 0,
    currentCount: 0,
    unknownCount: 0,
  };
  for (const row of rows) {
    if (row.agingBucket === "overdue") {
      totals.overdueMinor += row.payableMinor;
      totals.overdueCount += 1;
    } else if (row.agingBucket === "current") {
      totals.currentMinor += row.payableMinor;
      totals.currentCount += 1;
    } else {
      totals.unknownMinor += row.payableMinor;
      totals.unknownCount += 1;
    }
  }
  return totals;
}
