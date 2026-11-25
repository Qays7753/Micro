/**
 * M1.1 (§14.3 / IMPACT S1 — أمر تنفيذ المرحلة ١، 2026-11-26): محرك لقطة
 * التكلفة انتقل حرفيًا من `src/domain/craft-order/policies.ts` بلا أي
 * تغيير سلوك — نفس الجسد، نفس التقريب، نفس الرسائل. أدواتي (Tools)
 * مستقلة عن مجال طلبات الصنعة (§14.3: لا اعتماد على كود مجال مانج/الطلب).
 * `craft-order/policies.ts` يستورد ما يحتاجه من هنا (التجميد، اشتقاق
 * الفجوات، تحقق الكمية) — جسد واحد لا نسخة ثانية (ACD015/DUP-015).
 */
import type {
  CostSnapshot,
  CostSnapshotInput,
  KnowledgeGap,
  KnowledgeState,
  MaterialCostItem,
} from "./types.js";
import {
  JOD,
  ammanDateOrNull,
  assertNonNegativeInteger,
  ceilRatio,
  fieldLabelAr,
  isValidLocalDate,
  isValidTimestamp,
  localDatePlusDays,
  quantityMilliExact,
  roundHalfUp,
} from "../shared/index.js";

/* يستوردها craft-order لأبوابه غير الحسابية (createCraftOrder /
 * reviseOrderCost / knowledgeGapsOf) — تصدير ضروري للتوافق، لا نسخ ثانية. */
export function assertValidQuantity(value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("أدخل الكمية رقمًا أكبر من صفر.");
  }
  if (quantityMilliExact(value) === null) {
    throw new Error("أدخل الكمية بدقة أجزاء من ألف؛ الدقة الأعلى غير ممثلة في هذا الإصدار.");
  }
}

/* R2 (M-04/D6، 2026-10-08): فصل عقدَي التاريخ — priceDate حقل تاريخ محلي
 * حقيقي (كان Date.parse فيقبل الطوابع الزمنية في حقل تقويمي)؛ createdAt
 * طابع زمني (فحص متكافل مع السلوك القديم حرفيًا). */
function assertValidLocalDate(value: string, field: string): void {
  if (!isValidLocalDate(value)) {
    throw new Error(`أدخل ${fieldLabelAr(field)} تاريخًا صحيحًا.`);
  }
}

function assertValidTimestamp(value: string, field: string): void {
  if (!isValidTimestamp(value)) {
    throw new Error(`أدخل ${fieldLabelAr(field)} تاريخًا صحيحًا.`);
  }
}

/* المجموعة ٩ (STR-029): تاريخ الصلاحية سؤال يوم تقويمي عند المالك (عمّان)
 * — متغيّر الفارغ الكنسي من وحدة وقت الأعمال، لا نسخة محلية. */
const ammanLocalDate = ammanDateOrNull;
/* R2 (M-02/X1، 2026-10-08): إزاحة أيام من نواة الحساب الخالص — كانت
 * Date.UTC رقمية (تعيد السنوات < 0100 إلى 1900+). حد التمثيل يعود
 * بالمدخل نفسه (fail-open مطابق لمسار ammanLocalDate الفارغ أعلاه). */
function localDateMinusDays(localDate: string, days: number): string {
  return localDatePlusDays(localDate, -days) ?? localDate;
}

function assertFreshnessDays(value: number | null | undefined): void {
  if (value !== null && value !== undefined && (!Number.isInteger(value) || value < 0)) {
    throw new Error("أدخل أيام صلاحية السعر رقمًا صحيحًا غير سالب.");
  }
}

function cloneCostSnapshotInput(input: CostSnapshotInput): CostSnapshotInput {
  return {
    ...input,
    materialItems: input.materialItems.map(item => ({ ...item })),
    time: input.time ? { ...input.time } : null,
  };
}

/* يستوردها craft-order لتجميد لقطات الطلب — جسد واحد هنا. */
export function freezeCostSnapshot(snapshot: CostSnapshot): CostSnapshot {
  const input = cloneCostSnapshotInput(snapshot.input);
  input.materialItems.forEach(item => Object.freeze(item));
  Object.freeze(input.materialItems);
  if (input.time) Object.freeze(input.time);
  Object.freeze(input);
  return Object.freeze({ ...snapshot, input }) as CostSnapshot;
}

function hasNoCostComponentInput(input: CostSnapshotInput): boolean {
  return (
    input.materialItems.length === 0 &&
    input.time === null &&
    input.packagingMinor === 0 &&
    input.deliveryMinor === 0 &&
    input.wasteMinor === 0
  );
}
function hasEstimateInput(input: CostSnapshotInput): boolean {
  return (
    input.materialItems.some(item => item.confidence === "estimated") ||
    input.time?.confidence === "estimated"
  );
}
function hasVariableCostInput(input: CostSnapshotInput): boolean {
  return input.materialItems.some(item => item.source === "estimate");
}
function hasIncompleteTimeInput(input: CostSnapshotInput): boolean {
  return (
    input.time === null ||
    input.time.minutes === null ||
    input.time.hourlyRateMinor === null ||
    input.time.minutes === 0 ||
    input.time.hourlyRateMinor === 0
  );
}
function hasStaleMaterialInput(input: CostSnapshotInput): boolean {
  if (input.freshnessDays === null || input.freshnessDays === undefined) return false;
  // Freshness is a calendar-date question in the owner's day (Asia/Amman), not an instant comparison:
  // a price dated today stays fresh even when the snapshot was recorded after Amman midnight.
  const createdLocalDate = ammanLocalDate(input.createdAt);
  if (createdLocalDate === null) return false;
  const oldestAllowed = localDateMinusDays(createdLocalDate, input.freshnessDays);
  return input.materialItems.some(item => item.priceDate < oldestAllowed);
}

function determineKnowledgeState(input: CostSnapshotInput): KnowledgeState {
  if (hasNoCostComponentInput(input)) return "incomplete";
  if (hasIncompleteTimeInput(input)) return "incomplete";
  if (hasStaleMaterialInput(input)) return "stale";
  if (hasVariableCostInput(input)) return "variable";
  if (hasEstimateInput(input)) return "estimated";
  return "known";
}

/** القرار ٢٢: القائمة الكاملة للنقص دفعة واحدة، وكل نقص يحمل علامته —
 * إلزامي (يمنع نتيجة صادقة) أو اختياري (يحسّن الدقة).
 * يستوردها craft-order لقارئ الفجوات الرجعي (knowledgeGapsOf). */
export function deriveKnowledgeGaps(input: CostSnapshotInput): readonly KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  if (hasNoCostComponentInput(input)) gaps.push({ id: "no_cost_components", mandatory: true });
  if (hasIncompleteTimeInput(input)) gaps.push({ id: "time_incomplete", mandatory: true });
  if (hasStaleMaterialInput(input)) gaps.push({ id: "stale_material_price", mandatory: false });
  if (hasEstimateInput(input)) gaps.push({ id: "estimated_item", mandatory: false });
  if (hasVariableCostInput(input)) gaps.push({ id: "variable_cost_source", mandatory: false });
  return gaps;
}

function materialItemCostMinor(item: MaterialCostItem): number {
  if (!item.name.trim() || !item.unit.trim()) {
    throw new Error("أكمل اسم المادة ووحدتها قبل الحساب.");
  }
  if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
    throw new Error(`أدخل كمية المادة ${item.name} رقمًا أكبر من صفر.`);
  }
  assertNonNegativeInteger(item.unitPriceMinor, `سعر وحدة ${item.name}`);
  assertValidLocalDate(item.priceDate, `تاريخ سعر ${item.name}`);
  const quantityMilli = quantityMilliExact(item.quantity);
  if (quantityMilli === null) throw new Error(`أدخل كمية المادة ${item.name} بدقة أجزاء من ألف.`);
  const itemCostMinor = roundHalfUp(quantityMilli * item.unitPriceMinor, 1000);
  if (itemCostMinor === null)
    throw new Error(`تكلفة المادة ${item.name} تتجاوز الدقة الآمنة للأرقام الصحيحة.`);
  return itemCostMinor;
}

/* المجموعة ١١ (11-0 — سياسة EXACT_VALUES_NO_SILENT_ROUNDING): سقف تكلفة
 * الوحدة على النسبة الدقيقة بالملي — ceilRatio(plannedCost×1000،
 * quantityMilli) — بدل قسمة الفاصلة العائمة التي ترفع حدها الأعلى عند
 * الكسور العشرية (كانت 21/0.7 تعطي 31 والصحيح 30). المسارات الإنتاجية
 * (كميات صحيحة) بلا أي تغيير: قسمة صحيح/صحيح دقيقة في FP أصلا. الدقة
 * غير الآمنة تُرفض صريحة لا تُقرَّب. */
function unitCostCeilingMinor(plannedCostMinor: number, quantity: number): number {
  const quantityMilli = quantityMilliExact(quantity);
  const numerator = plannedCostMinor * 1000;
  if (quantityMilli === null || !Number.isSafeInteger(numerator) || numerator < 0) {
    throw new Error("تكلفة الوحدة تتجاوز الدقة الآمنة للأرقام الصحيحة؛ لم يُقرّب الرقم.");
  }
  const unitCostMinor = ceilRatio(numerator, quantityMilli);
  if (unitCostMinor === null) {
    throw new Error("تكلفة الوحدة تتجاوز الدقة الآمنة للأرقام الصحيحة؛ لم يُقرّب الرقم.");
  }
  return unitCostMinor;
}

export function calculateCostSnapshot(id: string, input: CostSnapshotInput): CostSnapshot {
  if (!id.trim()) throw new Error("أكمل معرّف نسخة التكلفة قبل الحساب.");
  if (input.currency !== JOD) throw new Error("العملة المدعومة في هذا الإصدار هي الدينار الأردني فقط.");
  assertValidQuantity(input.quantity);
  assertValidTimestamp(input.createdAt, "createdAt");
  assertFreshnessDays(input.freshnessDays);
  assertNonNegativeInteger(input.packagingMinor, "packagingMinor");
  assertNonNegativeInteger(input.deliveryMinor, "deliveryMinor");
  assertNonNegativeInteger(input.wasteMinor, "wasteMinor");
  assertNonNegativeInteger(input.safetyBufferMinor, "safetyBufferMinor");

  const materialCostMinor = input.materialItems.reduce(
    (total, item) => total + materialItemCostMinor(item),
    0,
  );

  const timeCostMinor = input.time
    ? (() => {
        const { minutes, hourlyRateMinor } = input.time!;
        if (minutes !== null && (!Number.isFinite(minutes) || minutes < 0)) {
          throw new Error("أدخل دقائق الوقت رقمًا غير سالب.");
        }
        if (hourlyRateMinor !== null) {
          assertNonNegativeInteger(hourlyRateMinor, "hourlyRateMinor");
        }
        if (minutes === null || hourlyRateMinor === null) return 0;
        const timeCostMinor = roundHalfUp(minutes * hourlyRateMinor, 60);
        if (timeCostMinor === null) throw new Error("تكلفة الوقت تتجاوز الدقة الآمنة للأرقام الصحيحة.");
        return timeCostMinor;
      })()
    : 0;

  const plannedCostMinor =
    materialCostMinor + timeCostMinor + input.packagingMinor + input.deliveryMinor + input.wasteMinor;
  const unitCostMinor = unitCostCeilingMinor(plannedCostMinor, input.quantity);
  const priceFloorMinor = unitCostMinor + input.safetyBufferMinor;

  return freezeCostSnapshot({
    id,
    currency: input.currency,
    materialCostMinor,
    timeCostMinor,
    packagingMinor: input.packagingMinor,
    deliveryMinor: input.deliveryMinor,
    wasteMinor: input.wasteMinor,
    plannedCostMinor,
    unitCostMinor,
    priceFloorMinor,
    quantity: input.quantity,
    knowledgeState: determineKnowledgeState(input),
    knowledgeGaps: deriveKnowledgeGaps(input),
    input: cloneCostSnapshotInput(input),
    createdAt: input.createdAt,
  });
}
