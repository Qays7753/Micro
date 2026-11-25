/**
 * M1.1 (§14.3 / IMPACT S1 — أمر تنفيذ المرحلة ١، 2026-11-26): عائلة «نواة
 * التكلفة» المحايدة. انتقلت هذه الأنواع حرفيًا من
 * `src/domain/craft-order/types.ts` بلا أي تغيير دلالي — أدواتي (Tools)
 * تملك حسابها ولا تعتمد على مجال طلبات الصنعة القائم الذي يُحذف لاحقًا في
 * المرحلة ٦. `craft-order/types.ts` يعيد تصديرها كاملة ليبقى كل مستورد
 * قائم يعمل بلا تعديل (توافق المهمة)، والنص الوحيد للتعريف هنا.
 */
import type { Currency, MoneyMinor } from "../shared/index.js";

export type KnowledgeState = "known" | "estimated" | "partial" | "incomplete" | "stale" | "variable";

/* القرار ٢٢: كل نقص معرفة يحمل علامته — إلزامي (يمنع نتيجة صادقة) أو اختياري (يحسّن الدقة).
 * الحقل إضافي وغير كاسر: النسخ القديمة بلا حقل تُشتق فجواتها من مدخلاتها المحفوظة. */
export type KnowledgeGapId =
  | "no_cost_components"
  | "time_incomplete"
  | "stale_material_price"
  | "estimated_item"
  | "variable_cost_source";
export type KnowledgeGap = { id: KnowledgeGapId; mandatory: boolean };

type CostSource = "user_input" | "historical_price" | "estimate";
type CostConfidence = "known" | "estimated";

export interface MaterialCostItem {
  name: string;
  quantity: number;
  unit: string;
  unitPriceMinor: MoneyMinor;
  priceDate: string;
  source: CostSource;
  confidence: CostConfidence;
  /* المجموعة ٣ (عقد D2): ربط هوية المادة عند التكلفة — هوية فقط لا قيمة حية؛
   * أرقام البند مجمّدة في النسخة كما كانت لحظة الإنشاء. غياب الحقل = بند حر. */
  materialId?: string | null;
}

export interface TimeCost {
  minutes: number | null;
  hourlyRateMinor: MoneyMinor | null;
  confidence: CostConfidence;
}

export interface CostSnapshotInput {
  currency: Currency;
  materialItems: MaterialCostItem[];
  time: TimeCost | null;
  packagingMinor: MoneyMinor;
  deliveryMinor: MoneyMinor;
  wasteMinor: MoneyMinor;
  safetyBufferMinor: MoneyMinor;
  quantity: number;
  createdAt: string;
  source: "draft" | "price_approval" | "order_confirmation" | "revision";
  freshnessDays?: number | null;
}

export interface CostSnapshot {
  id: string;
  currency: Currency;
  materialCostMinor: MoneyMinor;
  timeCostMinor: MoneyMinor;
  packagingMinor: MoneyMinor;
  deliveryMinor: MoneyMinor;
  wasteMinor: MoneyMinor;
  plannedCostMinor: MoneyMinor;
  unitCostMinor: MoneyMinor;
  priceFloorMinor: MoneyMinor;
  quantity: number;
  knowledgeState: KnowledgeState;
  /** القرار ٢٢: القائمة الكاملة للنقص بعلامة إلزامي/اختياري؛ التعداد يبقى «أشدّ نقص». */
  knowledgeGaps?: readonly KnowledgeGap[];
  input: CostSnapshotInput;
  createdAt: string;
}
