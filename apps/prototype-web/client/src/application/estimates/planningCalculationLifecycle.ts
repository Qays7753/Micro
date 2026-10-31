/**
 * S10 (UNIT-031/032 + SH-14 — أمر b56967d8): دورة حساب T01 المحفوظ داخل
 * الحاسبة — حفظ/فتح/تحديث/نسخة/حذف بهوية ثابتة ونسخة مدخلات ونتيجة تاريخية،
 * عبر النواة الواحدة (calculateCostSnapshot) بلا محرك ثانٍ. الحفظ لا ينشئ
 * أي أثر بيع/مصروف/طلب/مخزون، والفتح لا يعيد تسعير التاريخ بأسعار اليوم.
 *
 * ميزانية الحزمة (سابقة purchases/assets/loans نفسها — بروتوكول
 * FIN-001/OPS-003): هذه الوحدة تستهلك دومين التخطيط فتُحمَّل ديناميكيًا
 * بعد الإقلاع من جذر التركيب؛ لا تدخل كومة الإقلاع (سقف gzip المحروس
 * لا يُرفع). جذر التركيب يستورد التنفيذ مباشرةً — الاستثناء الموثق نفسه.
 */
import { calculateCostSnapshot } from "@micro-domain/craft-order/index.js";
import { calculatePlanningResult } from "@micro-domain/planning/index.js";
import type { PlanningCalculationResult } from "@micro-domain/planning/index.js";
import type { CostEstimate, DraftCostTime } from "@/storage/local/types";
import type {
  PlanningPersistCommission,
  PlanningPersistDiscount,
  PlanningPersistExtraRow,
  PlanningPersistGroup,
} from "@/storage/local/planningCalculationTypes";
import type { CostEstimateStore } from "@/storage/local/capabilities/costEstimateStore";
import type { CostEstimateResult } from "./costEstimateService";
import { errorMessageOf, storageFailure, validationFailure } from "@/application/resultCodes";
import { systemClock, type Clock } from "@/application/time/clock";
import { isValidTimestamp, localDateInAmman } from "@micro-domain/shared/index.js";

/** S10: مدخل حساب التخطيط T01 كما تدخله الحاسبة (بنية التخزين مباشرة). */
export type PlanningSaveInput = {
  title: string;
  groups: readonly PlanningPersistGroup[];
  time: DraftCostTime | null;
  packagingMinor: number;
  wasteMinor: number;
  deliveryMinor: number;
  otherRevenues: readonly PlanningPersistExtraRow[];
  otherExpenses: readonly PlanningPersistExtraRow[];
  discount: PlanningPersistDiscount | null;
  commission: PlanningPersistCommission | null;
};

/** S10: نسخة مدخلات حساب التخطيط عند الحفظ (تترقى مع تغير النموذج). */
export const PLANNING_INPUT_SCHEMA_VERSION = 1;
/** S10: نسخة محرك الحساب المسجلة مع النتيجة التاريخية. */
export const PLANNING_CALCULATION_VERSION = 1;

const id = (prefix: string) =>
  globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** S10: ربط بنية التخزين بمدخل المجال النقي — الربط عند طبقة التطبيق فقط. */
function toDomainPlanningInput(input: PlanningSaveInput, createdAt: string) {
  return {
    title: input.title,
    groups: input.groups.map(group => ({
      id: group.groupId,
      label: group.label,
      offeringType: group.offeringType,
      repeatQuantity: group.repeatQuantity,
      costMode: group.costMode,
      unitComponents: group.unitComponents.map(component => ({
        name: component.name,
        quantity: component.quantity,
        unit: component.unit,
        unitPriceMinor: component.unitPriceMinor,
        confidence: component.confidence,
        ...(component.materialId !== undefined && component.materialId !== null
          ? { materialId: component.materialId }
          : {}),
      })),
      totalCostMinor: group.totalCostMinor,
      sellingPriceMinor: group.sellingPriceMinor,
    })),
    time: input.time ? { ...input.time } : null,
    packagingMinor: input.packagingMinor,
    wasteMinor: input.wasteMinor,
    deliveryMinor: input.deliveryMinor,
    otherRevenues: input.otherRevenues.map(row => ({
      id: row.rowId,
      amountMinor: row.amountMinor,
      description: row.description,
    })),
    otherExpenses: input.otherExpenses.map(row => ({
      id: row.rowId,
      amountMinor: row.amountMinor,
      description: row.description,
    })),
    discount: input.discount,
    commission: input.commission,
    createdAt,
  };
}

/** S10: بناء سجل التقدير الكامل من حساب التخطيط — الحقول القديمة تبقى
 * الإسقاط المسطح المشتق بالنواة الواحدة (المواد الموسعة + الكمية المشتقة)
 * فلا ينكسر أي قارئ قائم، وحقل planning يحمل مصدر التخطيط ونتيجته. */
function planningRecordFrom(
  base: CostEstimate | null,
  input: PlanningSaveInput,
  planningResult: PlanningCalculationResult,
  kernelSnapshot: ReturnType<typeof calculateCostSnapshot>,
  operationKey: string | null,
  timestamp: string,
): CostEstimate {
  return {
    ...(base ?? {}),
    id: base?.id ?? id("estimate"),
    title: input.title.trim() || base?.title || "حساب بلا عنوان",
    currency: "JOD",
    materialItems: kernelSnapshot.input.materialItems.map(item => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      unitPriceMinor: item.unitPriceMinor,
      confidence: item.confidence,
      ...(item.materialId !== undefined && item.materialId !== null ? { materialId: item.materialId } : {}),
    })),
    time: input.time ? { ...input.time } : null,
    packagingMinor: input.packagingMinor,
    deliveryMinor: input.deliveryMinor,
    wasteMinor: input.wasteMinor,
    safetyBufferMinor: 0,
    quantity: kernelSnapshot.quantity,
    plannedCostMinor: kernelSnapshot.plannedCostMinor,
    unitCostMinor: kernelSnapshot.unitCostMinor,
    priceFloorMinor: kernelSnapshot.priceFloorMinor,
    knowledgeState: planningResult.knowledgeState,
    note: base?.note ?? null,
    createdAt: base?.createdAt ?? timestamp,
    updatedAt: timestamp,
    planning: {
      inputSchemaVersion: PLANNING_INPUT_SCHEMA_VERSION,
      calculationVersion: PLANNING_CALCULATION_VERSION,
      groups: input.groups.map(group => ({
        groupId: group.groupId,
        label: group.label,
        offeringType: group.offeringType,
        repeatQuantity: group.repeatQuantity,
        costMode: group.costMode,
        unitComponents: group.unitComponents.map(component => ({ ...component })),
        totalCostMinor: group.totalCostMinor,
        sellingPriceMinor: group.sellingPriceMinor,
      })),
      time: input.time ? { ...input.time } : null,
      packagingMinor: input.packagingMinor,
      wasteMinor: input.wasteMinor,
      deliveryMinor: input.deliveryMinor,
      otherRevenues: input.otherRevenues.map(row => ({ ...row })),
      otherExpenses: input.otherExpenses.map(row => ({ ...row })),
      discount: input.discount,
      commission: input.commission,
      savedResult: {
        productsCostMinor: planningResult.productsCostMinor,
        sellingTotalMinor: planningResult.sellingTotalMinor,
        expectedTotalMinor: planningResult.expectedTotalMinor,
        pricingCostMinor: planningResult.pricingCostMinor,
        expectedProfitMinor: planningResult.expectedProfitMinor,
        marginPercentCenti: planningResult.marginPercentCenti,
        knowledgeState: planningResult.knowledgeState,
      },
    },
    ...(operationKey !== null ? { createdOperationKey: operationKey } : {}),
  };
}

/** S10: توسيع حساب التخطيط إلى مدخل النواة المسطح — نفس منطق التوسيع في
 * المجال (المجموعات تفصيل/إجمالي) فينتج الإسقاط القديم القابل للقراءة
 * بكل القارئات القائمة؛ لا محرك ثانٍ. */
function kernelSnapshotOfPlanning(
  domainGroups: ReturnType<typeof toDomainPlanningInput>["groups"],
  input: PlanningSaveInput,
  timestamp: string,
): ReturnType<typeof calculateCostSnapshot> {
  return calculateCostSnapshot("planning-projection", {
    currency: "JOD",
    materialItems: domainGroups.flatMap(group =>
      group.costMode === "total"
        ? group.totalCostMinor && group.totalCostMinor > 0
          ? [
              {
                name: group.label,
                quantity: 1,
                unit: "الكمية الكاملة",
                unitPriceMinor: group.totalCostMinor,
                priceDate: localDateInAmman(timestamp),
                source: "user_input" as const,
                confidence: "known" as const,
              },
            ]
          : []
        : group.unitComponents
            .filter(component => component.name.trim() && component.unitPriceMinor > 0)
            .map(component => ({
              name: component.name,
              quantity: component.quantity * group.repeatQuantity,
              unit: component.unit,
              unitPriceMinor: component.unitPriceMinor,
              priceDate: localDateInAmman(timestamp),
              source: "user_input" as const,
              confidence: component.confidence,
            })),
    ),
    time: input.time ? { ...input.time } : null,
    packagingMinor: input.packagingMinor,
    deliveryMinor: input.deliveryMinor,
    wasteMinor: input.wasteMinor,
    safetyBufferMinor: 0,
    quantity: domainGroups.reduce((total, group) => total + group.repeatQuantity, 0),
    createdAt: timestamp,
    source: "draft",
  });
}

/** S10: الحساب المزدوج المصدر الواحد — النتيجة التخطيطية من المجال
 * والإسقاط المسطح من النواة نفسها؛ الخطأ واحد برسالة المجال العربية. */
function computePlanningPair(
  input: PlanningSaveInput,
  timestamp: string,
  resultId: string,
): { planningResult: PlanningCalculationResult; kernelSnapshot: ReturnType<typeof calculateCostSnapshot> } {
  const domainInput = toDomainPlanningInput(input, timestamp);
  return {
    planningResult: calculatePlanningResult(resultId, domainInput),
    kernelSnapshot: kernelSnapshotOfPlanning(domainInput.groups, input, timestamp),
  };
}

export class PlanningCalculationLifecycleService {
  constructor(
    private readonly store: CostEstimateStore,
    private readonly now: Clock = systemClock,
  ) {}

  /** S10: معاينة حساب التخطيط T01 حية بلا تخزين — النواة الواحدة نفسها. */
  previewPlanning(input: PlanningSaveInput): CostEstimateResult<PlanningCalculationResult> {
    const createdAt = this.now();
    if (!isValidTimestamp(createdAt)) return validationFailure("وقت الحساب غير صالح — أعد المحاولة.");
    try {
      return {
        ok: true,
        value: calculatePlanningResult("planning-preview", toDomainPlanningInput(input, createdAt)),
      };
    } catch (error) {
      return validationFailure(errorMessageOf(error, "مدخلات الحساب غير صالحة."));
    }
  }

  /**
   * S10 (UNIT-032): حفظ حساب تخطيط T01 جديد — فعل صريح بهوية جديدة.
   * مفتاح النية نفسه (الضغط المتكرر/إعادة المحاولة) يعيد الحساب المحفوظ
   * نفسه بلا نسخة ثانية (نمط createdOperationKey في الكتالوج S09).
   * صفر أثر أعمال: لا بيع ولا مصروف ولا طلب ولا مخزون.
   */
  async savePlanning(
    input: PlanningSaveInput,
    operationKey: string | null = null,
  ): Promise<CostEstimateResult<CostEstimate>> {
    const timestamp = this.now();
    if (!isValidTimestamp(timestamp)) return validationFailure("وقت الحساب غير صالح — أعد المحاولة.");
    let pair: ReturnType<typeof computePlanningPair>;
    try {
      pair = computePlanningPair(input, timestamp, "planning-save");
    } catch (error) {
      return validationFailure(errorMessageOf(error, "مدخلات الحساب غير صالحة."));
    }
    const { planningResult, kernelSnapshot } = pair;
    /* النية نفسها = النتيجة نفسها بلا كتابة ثانية — إثبات الهوية من السجل. */
    if (operationKey !== null) {
      const existing = await this.store.listCostEstimates();
      if (!existing.ok) return storageFailure("تعذر قراءة الحسابات المحفوظة.");
      const sameIntent = existing.value.find(estimate => estimate.createdOperationKey === operationKey);
      if (sameIntent) return { ok: true, value: sameIntent, reused: true };
    }
    const record = planningRecordFrom(null, input, planningResult, kernelSnapshot, operationKey, timestamp);
    const saved = await this.store.saveCostEstimate(record);
    return saved.ok ? { ok: true, value: saved.value } : storageFailure("تعذر حفظ الحساب.");
  }

  /**
   * S10: تحديث حساب تخطيط محفوظ — يحدث السجل نفسه بهويته وتاريخ إنشائه
   * (لا نسخة جديدة لكل ضغطة)؛ «حفظ نسخة» فعل منفصل عبر savePlanning.
   */
  async updatePlanning(
    existingId: string,
    input: PlanningSaveInput,
  ): Promise<CostEstimateResult<CostEstimate>> {
    const current = await this.store.getCostEstimate(existingId);
    if (!current.ok) return storageFailure("تعذر قراءة الحساب.");
    if (!current.value) return validationFailure("الحساب غير موجود — قد حُذف؛ احفظه كحساب جديد.");
    const timestamp = this.now();
    if (!isValidTimestamp(timestamp)) return validationFailure("وقت الحساب غير صالح — أعد المحاولة.");
    let pair: ReturnType<typeof computePlanningPair>;
    try {
      pair = computePlanningPair(input, timestamp, "planning-update");
    } catch (error) {
      return validationFailure(errorMessageOf(error, "مدخلات الحساب غير صالحة."));
    }
    const { planningResult, kernelSnapshot } = pair;
    const record = planningRecordFrom(current.value, input, planningResult, kernelSnapshot, null, timestamp);
    const saved = await this.store.saveCostEstimate(record);
    return saved.ok ? { ok: true, value: saved.value } : storageFailure("تعذر تحديث الحساب.");
  }
}
