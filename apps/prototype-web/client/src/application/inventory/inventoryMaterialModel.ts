/* Wave F شريحة ٣ (ADR-014 — تقسيم مسؤولية داخلي، 2026-10-04): بيت نموذج
 * المخزون الورقي — أنواع السطح الثلاثة والعشرون ومعينات الملف المشتركة
 * (id/storageFailure/ammanLocalDate) انتقلت حرفيًا من inventoryMaterialService.ts
 * إلى هذا البيت الشقيق في application/inventory/ نفسه؛ الخدمة تبقى الواجهة
 * والهوية (عقد ٢٨ — منسّق تطبيق فوق سياسات المجال) وتعيد تصدير الأنواع كما
 * هي فلا يتغير أي مستورد من نحو السبعين. لا تغيير دلالة ولا صيغة ولا هوية
 * أخطاء — نقل نصّي فقط. */
import {
  type InventoryMovement,
  type InventoryShortage,
  type LowStockAlertState,
  type Material,
  type MaterialUnit,
  type WasteContext,
} from "@micro-domain/inventory-material/index.js";
import type { CatalogItem, CatalogTemplate } from "@micro-domain/catalog/index.js";
import { localDateInAmman } from "@micro-domain/shared/index.js";
import { STORAGE_ERROR } from "@/application/resultCodes";

export type InventoryResult<T> =
  | { ok: true; value: T; reused?: boolean }
  | { ok: false; code: "validation_error" | "storage_error"; message: string };
/* المجموعة ٢ (عقد ٢٨): القراءة المشتقة للمادة — المعرفة (كمية/تكلفة) وحقول النقص
 * والانتظار تُشتق من الحركات والسجلات، لا تُخزن. */
export type InventoryMaterialOverview = Material & {
  quantityMilli: number;
  valueMinor: number;
  movementCount: number;
  quantityKnowledge: "known" | "unconfirmed";
  costKnowledge: "known" | "partial" | "unknown";
  openShortageCount: number;
  awaitingReceiptPurchaseCount: number;
  awaitingReceiptRemainingMinor: number;
  /* Stage 2 — OPS-002: حالة تنبيه انخفاض المخزون — مشتقة عند القراءة من
   * الحد المعلن في التفضيلات والمعرفة الكمية نفسها؛ لا تُخزن أبدًا. */
  lowStock: LowStockAlertState;
  /* الحد المعلن نفسه (بالملي) كما قُرئ من التفضيلات — للعرض المفهوم فقط. */
  lowStockThresholdMilli: number | null;
};
export type InventoryOverview = {
  materials: readonly InventoryMaterialOverview[];
  movementCount: number;
};
/* القرار ٩: التفعيل صريح مؤرّخ — الموضع غير نشط قبله. الإرث الموجود (مواد أو حركات
 * بلا سجل) يُقرأ تفعيله من أقدم دليل، لأن حمل مستخدم قائم على بوابة جديدة يعيد
 * إنتاج period_result بصيغة ثانية (القرار ٧). */
export type InventoryActivationState = {
  activatedOn: string | null;
  source: "declared" | "derived" | null;
};
export type InventoryActivationInput = { operationKey: string };
export type OrderActualMaterialComparisonReviewReason =
  /* لقطة التكلفة ليست «معروفة» — جانب المخطط غير نهائي (عقد ١٣ سطر ٣٦). */
  | "snapshot_knowledge"
  /* تكلفة استهلاك مسجل غير معروفة — جانب المنفذ أقل من الحقيقة (عقد ٢٨ §٥). */
  | "actual_cost_unknown";
export type OrderActualMaterialComparison = {
  orderId: string;
  status: "not_recorded" | "recorded" | "needs_review";
  plannedMaterialMinor: number;
  actualMaterialMinor: number | null;
  actualQuantityMilli: number | null;
  varianceMinor: number | null;
  consumptionCount: number;
  /* المجموعة ٢ (عقد ٢٨): معرفة تكلفة الاستهلاك الفعلي — استهلاك بتكلفة غير معروفة
   * لا يظهر 0.00 واثقًا في مقارنة الطلب. */
  actualCostKnowledge: "known" | "unknown" | null;
  /* Stage 2 — OPS-007 (عقد ١٣ سطر ٣٦): «فرق المادة مع سبب نقص المعرفة» — أسباب
   * needs_review تُصرَّح في نموذج القراءة نفسه لا تُترك نبرة بطاقة فقط؛ فارغة عند
   * not_recorded/recorded. القراءة فقط — لا أثر تخزيني. */
  reviewReasons: readonly OrderActualMaterialComparisonReviewReason[];
};
export type InventoryReferences = {
  materials: readonly Material[];
  /* المجموعة ٢ (عقد ٢٨): كل المواد (مربوطة الشراء تشمل غير المتتبَّعة). */
  allMaterials: readonly Material[];
  purchases: readonly {
    id: string;
    supplierName: string;
    note: string;
    totalMinor: number;
    materialId: string | null;
    expectedQuantityMilli: number | null;
  }[];
  orders: readonly { id: string; itemName: string; customerName: string }[];
  /* المجموعة ٣ (عقد D6): المبيعات المباشرة النشطة — مرجع استهلاك صريح كالطلب. */
  sales: readonly { id: string; itemName: string; revenueMinor: number }[];
  catalogItems: readonly CatalogItem[];
  catalogTemplates: readonly CatalogTemplate[];
  /* المجموعة ٢ (عقد ٢٨): الرصيد الحي لكل مادة متتبَّعة — لتحذير النقص قبل الحفظ. */
  materialPositions: readonly {
    materialId: string;
    quantityMilli: number;
    valueMinor: number;
    costKnowledge: "known" | "partial" | "unknown";
  }[];
};
/* المجموعة ٢ (عقد ٢٨): معرفة رصيد البداية في رحلة الإنشاء/التأكيد. */
export type MaterialOpeningInput = {
  quantityState: "unconfirmed" | "confirmed";
  quantityMilli: number | null;
  costState: "known" | "unknown";
  valueMinor: number | null;
  confirmedOn: string | null;
  sourceNote: string | null;
};
export type OpenMaterialInput = {
  name: string;
  unit: MaterialUnit;
  /* المجموعة ٢ (عقد ٢٨): قرار المتابعة صريح لكل مادة. */
  tracking: "tracked" | "untracked";
  opening: MaterialOpeningInput;
  note: string;
  operationKey: string;
};
export type ReceivePurchaseInput = {
  materialId: string;
  purchaseId: string;
  quantityMilli: number;
  valueMinor: number;
  /* المجموعة ٢ (عقد ٢٨): قيمة الاستلام قد تكون غير معروفة — قيمة صفرية موسومة. */
  costKnowledge?: "known" | "unknown";
  occurredOn: string;
  note: string;
  operationKey: string;
};
export type ConsumeMaterialInput = {
  materialId: string;
  /* المجموعة ٢ (عقد ٢٨): الاستهلاك لطلب محدد أو لعمل المشروع (بسبب/بيان). */
  orderId: string | null;
  /* المجموعة ٣ (عقد D6): استهلاك مرتبط ببيع مباشر — مرجع صريح كالطلب. */
  saleId?: string | null;
  reason: string | null;
  quantityMilli: number;
  occurredOn: string;
  note: string;
  operationKey: string;
};
export type WasteMaterialInput = {
  materialId: string;
  quantityMilli: number;
  occurredOn: string;
  note: string;
  reason: string;
  operationKey: string;
  wasteContext?: WasteContext | null;
  /* عقد الإغلاق العميق (العقد ١ — الهدر): خيار المالك — هل يُعتبر الهدر خسارة
   * تؤثر على نتيجة المشروع (فعند معرفة التكلفة يُسجّل حدث خسارة غير نقدية
   * مرتبطًا بالحركة) أم إفصاحًا وحده بلا أثر على الربح. */
  profitImpact?: boolean;
};
/* القرار ٢٠: «أخرِج المتبقي» — المادة والسبب فقط؛ الكمية والقيمة تأتيان من المتبقي كاملًا. */
export type ExtractRemainderInput = {
  materialId: string;
  occurredOn: string;
  reason: string;
  operationKey: string;
};
export type AdjustMaterialInput = {
  materialId: string;
  quantityDeltaMilli: number;
  valueMinorWhenIncrease: number | null;
  /* المجموعة ٢ (عقد ٢٨): زيادة بتكلفة غير معروفة — قيمة صفرية موسومة لا مبلغ معلن. */
  increaseCostKnowledge?: "known" | "unknown";
  occurredOn: string;
  note: string;
  reason: string;
  operationKey: string;
};
export type ReverseInventoryInput = {
  movementId: string;
  occurredOn: string;
  reason: string;
  operationKey: string;
};
/* المجموعة ٢ (عقد ٢٨ / D-027): سجل النقص وإحصاءات الاستلام. */
export type RecordShortageInput = {
  materialId: string;
  requestedQuantityMilli: number;
  orderId: string | null;
  occurredOn: string;
  note: string;
  operationKey: string;
};
export type ResolveShortageInput = {
  shortageId: string;
  resolutionNote: string;
  resolvedOn: string;
};
export type PurchaseReceiptStatus = {
  purchaseId: string;
  totalMinor: number;
  expectedQuantityMilli: number | null;
  materialId: string | null;
  receivedValueMinor: number;
  remainingValueMinor: number;
  receivedQuantityMilli: number | null;
  remainingQuantityMilli: number | null;
  receipts: readonly {
    id: string;
    materialId: string;
    quantityMilli: number;
    valueMinor: number;
    occurredOn: string;
    reversed: boolean;
  }[];
};
export type UntrackMaterialInput = {
  materialId: string;
  reason: string | null;
  operationKey: string;
};
export type RetrackMaterialInput = { materialId: string; operationKey: string };
export type ConfirmOpeningInput = {
  materialId: string;
  actualQuantityMilli: number;
  costKnown: boolean;
  valueMinor: number | null;
  occurredOn: string;
  note: string;
  sourceNote: string | null;
  operationKey: string;
};
export type PeriodWasteReading = {
  count: number;
  valueMinor: number;
  hasUnknownCost: boolean;
};

export const id = (prefix: string) =>
  globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const writeStorageFailure = <T>(): InventoryResult<T> => ({
  ok: false,
  code: STORAGE_ERROR,
  message: "تعذر حفظ حركة المادة محليًا. لم يتم تأكيد نجاح العملية.",
});
/* المجموعة ٩ (STR-029): تاريخ الأعمال من وحدة وقت الأعمال الكنسية —
 * كانت نسخة محلية بلا حارس مدخل؛ متغيّر الرمي لمدخلات موثوقة الإنشاء. */
export const ammanLocalDate = localDateInAmman;
/* المجموعة ٢ (عقد ٢٨): الإيصالات المعكوسة لا تحسب — معرّفات الحركات التي
 * عكستها حركات التراجع؛ كانت كل قراءة مشتقة تحمل نسختها الحرفية من النمط
 * (تكثيف STR-608 مصاحب لتقسيم ADR-014 — القيم والسلوك مطابقان حرفيًا). */
export const reversedMovementIdsOf = (movements: readonly InventoryMovement[]): ReadonlySet<string | null> =>
  new Set(
    movements
      .filter(movement => movement.type === "reversal" && movement.reversesMovementId)
      .map(movement => movement.reversesMovementId),
  );
/* حتمية operationKey (G-003): إيجاد الحركة/السجل بمفتاح العملية — النمط
 * الحرفي نفسه كان يتكرر في كل مسار كتابة (تكثيف STR-608 — سلوك مطابق). */
export const movementByOperationKey = (
  movements: readonly InventoryMovement[],
  operationKey: string,
): InventoryMovement | undefined => movements.find(movement => movement.operationKey === operationKey);
export const shortageByOperationKey = (
  shortages: readonly InventoryShortage[],
  operationKey: string,
): InventoryShortage | undefined => shortages.find(shortage => shortage.operationKey === operationKey);
export const materialById = (materials: readonly Material[], materialId: string): Material | undefined =>
  materials.find(candidate => candidate.id === materialId);
