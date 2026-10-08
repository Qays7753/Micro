/**
 * Standalone cost estimates (PA-006 + «أدواتي»): a thinking tool before any commitment.
 * Saving an estimate never creates a financial event, an inventory movement, or an order.
 */
import { calculateCostSnapshot } from "@micro-domain/craft-order/index.js";
import type { CostEstimate, DraftCostMaterial, DraftCostTime } from "@/storage/local/types";
import type { CostEstimateStore } from "@/storage/local/capabilities/costEstimateStore";
import {
  STORAGE_ERROR,
  VALIDATION_ERROR,
  errorMessageOf,
  storageFailure,
  validationFailure,
} from "@/application/resultCodes";
import { systemClock, type Clock } from "@/application/time/clock";
import { isValidTimestamp, localDateInAmman } from "@micro-domain/shared/index.js";

export type CostEstimateResult<T> =
  | { ok: true; value: T; reused?: boolean }
  | { ok: false; code: "validation_error" | "storage_error"; message: string };

export type CostEstimateInput = {
  title: string;
  materialItems: readonly DraftCostMaterial[];
  time: DraftCostTime | null;
  packagingMinor: number;
  deliveryMinor: number;
  wasteMinor: number;
  safetyBufferMinor: number;
  quantity: number;
  note: string | null;
};

const id = (prefix: string) =>
  globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export class CostEstimateService {
  constructor(
    private readonly store: CostEstimateStore,
    private readonly now: Clock = systemClock,
  ) {}

  /** حساب حي بلا تخزين — نفس سياسة calculateCostSnapshot في حماية المالك. */
  preview(input: CostEstimateInput): CostEstimateResult<{
    plannedCostMinor: number;
    unitCostMinor: number;
    priceFloorMinor: number;
    knowledgeState: string;
  }> {
    const createdAt = this.now();
    /* R2 (M-06): تحقق مسبق بالعربية قبل اشتقاق عمّان — كي لا يتسرب
     * «Invalid instant» الإنجليزي إلى رسالة المستخدم عند طابق معطوب. */
    if (!isValidTimestamp(createdAt)) return validationFailure("وقت الحساب غير صالح — أعد المحاولة.");
    try {
      const snapshot = calculateCostSnapshot(id("estimate-preview"), {
        currency: "JOD",
        materialItems: input.materialItems.map(item => ({
          ...item,
          source: "user_input" as const,
          /* R2 (M-06/D6، 2026-10-08): تاريخ سعر تقويمي (تاريخ أعمال عمّان
           * للطابق) بدل الطابع الكامل — يطابق عقد الحداثة نفسه. */
          priceDate: localDateInAmman(createdAt),
        })),
        time: input.time,
        packagingMinor: input.packagingMinor,
        deliveryMinor: input.deliveryMinor,
        wasteMinor: input.wasteMinor,
        safetyBufferMinor: input.safetyBufferMinor,
        quantity: input.quantity,
        createdAt,
        source: "draft",
      });
      return {
        ok: true,
        value: {
          plannedCostMinor: snapshot.plannedCostMinor,
          unitCostMinor: snapshot.unitCostMinor,
          priceFloorMinor: snapshot.priceFloorMinor,
          knowledgeState: snapshot.knowledgeState,
        },
      };
    } catch (error) {
      return validationFailure(errorMessageOf(error, "مدخلات الحساب غير صالحة."));
    }
  }

  async list(): Promise<CostEstimateResult<readonly CostEstimate[]>> {
    const result = await this.store.listCostEstimates();
    return result.ok ? { ok: true, value: result.value } : storageFailure("تعذر قراءة التقديرات المحفوظة.");
  }

  async get(idValue: string): Promise<CostEstimateResult<CostEstimate | null>> {
    const result = await this.store.getCostEstimate(idValue);
    return result.ok ? { ok: true, value: result.value } : storageFailure("تعذر قراءة التقدير.");
  }

  /** حفظ التقدير للمراجعة — أثره صفر على الكاش والأرصدة والمخزون والطلبات. */
  async save(input: CostEstimateInput): Promise<CostEstimateResult<CostEstimate>> {
    const preview = this.preview(input);
    if (!preview.ok) return preview;
    const timestamp = this.now();
    const estimate: CostEstimate = {
      id: id("estimate"),
      title: input.title.trim() || "تقدير بلا عنوان",
      currency: "JOD",
      materialItems: input.materialItems,
      time: input.time,
      packagingMinor: input.packagingMinor,
      deliveryMinor: input.deliveryMinor,
      wasteMinor: input.wasteMinor,
      safetyBufferMinor: input.safetyBufferMinor,
      quantity: input.quantity,
      plannedCostMinor: preview.value.plannedCostMinor,
      unitCostMinor: preview.value.unitCostMinor,
      priceFloorMinor: preview.value.priceFloorMinor,
      knowledgeState: preview.value.knowledgeState as CostEstimate["knowledgeState"],
      note: input.note,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const saved = await this.store.saveCostEstimate(estimate);
    return saved.ok ? { ok: true, value: saved.value } : storageFailure("تعذر حفظ التقدير.");
  }

  async update(existingId: string, input: CostEstimateInput): Promise<CostEstimateResult<CostEstimate>> {
    const current = await this.store.getCostEstimate(existingId);
    if (!current.ok) return storageFailure("تعذر قراءة التقدير.");
    if (!current.value) return validationFailure("التقدير غير موجود.");
    const preview = this.preview(input);
    if (!preview.ok) return preview;
    const updated: CostEstimate = {
      ...current.value,
      title: input.title.trim() || current.value.title,
      materialItems: input.materialItems,
      time: input.time,
      packagingMinor: input.packagingMinor,
      deliveryMinor: input.deliveryMinor,
      wasteMinor: input.wasteMinor,
      safetyBufferMinor: input.safetyBufferMinor,
      quantity: input.quantity,
      plannedCostMinor: preview.value.plannedCostMinor,
      unitCostMinor: preview.value.unitCostMinor,
      priceFloorMinor: preview.value.priceFloorMinor,
      knowledgeState: preview.value.knowledgeState as CostEstimate["knowledgeState"],
      note: input.note,
      updatedAt: this.now(),
    };
    const saved = await this.store.saveCostEstimate(updated);
    return saved.ok ? { ok: true, value: saved.value } : storageFailure("تعذر تحديث التقدير.");
  }

  /** حذف حر: أداة تفكير بلا أثر مالي — يحذف بلا تحفظ ولا يغيّر أي رصيد. */
  async remove(existingId: string): Promise<CostEstimateResult<null>> {
    const result = await this.store.deleteCostEstimate(existingId);
    return result.ok ? { ok: true, value: null } : storageFailure("تعذر حذف التقدير.");
  }
}
