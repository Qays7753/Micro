/**
 * S10 (UNIT-031/032 + SH-14 — أمر b56967d8): أنواع حساب T01 المحفوظة في
 * عائلة cost-estimates — بيت أنواع مستقل داخل بيت التخزين (راتشة الحجم:
 * الأنواع الجديدة في ملفها النقي لا تضخم types.ts). هيكل تخزين مستقل عن
 * أنواع المجال؛ الربط عند طبقة التطبيق كما في أساس المجموعات S09.
 */
import type { CostEstimateKnowledge, DraftCostMaterial, DraftCostTime } from "./costItemTypes";

/* S10 (UNIT-031/032): المدخلات التخطيطية المحفوظة لحساب T01 — هيكل تخزين
 * مستقل عن أنواع المجال (الربط عند طبقة التطبيق كما في أساس المجموعات S09). */
export type PlanningPersistGroup = {
  groupId: string;
  label: string;
  offeringType: "product" | "service";
  repeatQuantity: number;
  costMode: "details" | "total";
  unitComponents: readonly DraftCostMaterial[];
  totalCostMinor: number | null;
  sellingPriceMinor: number | null;
};

export type PlanningPersistExtraRow = {
  rowId: string;
  amountMinor: number;
  description: string | null;
};

export type PlanningPersistDiscount =
  { mode: "amount"; amountMinor: number } | { mode: "percent"; percentCenti: number };

export type PlanningPersistCommission =
  | { mode: "amount"; amountMinor: number }
  | { mode: "percent"; percentCenti: number; basis: "products_after_discount" | "order_total" };

export type PlanningCalculationFields = {
  inputSchemaVersion: number;
  calculationVersion: number;
  groups: readonly PlanningPersistGroup[];
  time: DraftCostTime | null;
  packagingMinor: number;
  wasteMinor: number;
  deliveryMinor: number;
  otherRevenues: readonly PlanningPersistExtraRow[];
  otherExpenses: readonly PlanningPersistExtraRow[];
  discount: PlanningPersistDiscount | null;
  commission: PlanningPersistCommission | null;
  /* النتيجة التاريخية لحظة الحفظ — تُعرض كما حُفظت ولا تعاد تسعيرها
   * بأسعار اليوم عند الفتح (UNIT-032 B1). */
  savedResult: {
    productsCostMinor: number;
    sellingTotalMinor: number | null;
    expectedTotalMinor: number | null;
    pricingCostMinor: number;
    expectedProfitMinor: number | null;
    marginPercentCenti: number | null;
    knowledgeState: CostEstimateKnowledge;
  };
};
