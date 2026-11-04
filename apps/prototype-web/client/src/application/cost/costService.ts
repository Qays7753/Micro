/**
 * Financial boundary: this service maps draft persistence records to the Domain
 * calculator. React never calculates planned cost, knowledge, or price floor.
 */
import {
  calculateCostSnapshot,
  expandGroupedCostBasis,
  type CostSnapshot,
  type GroupedCostBasisInput,
} from "@micro-domain/craft-order/index.js";
/* R2 (M-06/D6، 2026-10-08): تاريخ السعر اشتقاق تقويمي من لحظة الإنشاء —
 * كان يُحقن الطابع الزمني الكامل في حقل تاريخ محلي (يمر بفحص Date.parse
 * القديم) فيُخزن طابعًا في لقطات الطلبات ويفسد مقارنة الحداثة المسائية. */
import { localDateInAmman } from "@micro-domain/shared/index.js";
import type {
  DraftCostGroupBasis,
  DraftCostSnapshot,
  OrderDraft,
  PrototypeLocalStore,
} from "@/storage/local/types";

/** R3 (بطاقة R3-SC-01/11): عدسة الخدمة — حفظ مسودة التكلفة فقط. */
export type CostServiceStore = Pick<PrototypeLocalStore, "saveDraft">;
import { STORAGE_ERROR, VALIDATION_ERROR, storageFailure } from "@/application/resultCodes";
import { systemClock, type Clock } from "@/application/time/clock";

export type CostEditorInput = Omit<DraftCostSnapshot, "id" | "revision" | "createdAt" | "currency">;
/* S09 (UNIT-008/SH-13 — أمر ad133bae القسم ٢): مدخل المسودة المجمعة — أساس
 * الوحدة الواحدة لكل مجموعة بدل قائمة مواد الطلب كله، وكمية الطلب مشتقة
 * من مجموع التكرارات لا مدخلة. المستويات على نطاق الطلب كما في العقد القائم. */
export type GroupedCostEditorInput = Omit<
  DraftCostSnapshot,
  "id" | "revision" | "createdAt" | "currency" | "materialItems" | "quantity"
> & { groupBasis: readonly DraftCostGroupBasis[] };
export type CostResult =
  | { ok: true; snapshot: CostSnapshot }
  | { ok: false; code: "validation_error" | "storage_error"; message: string };
export type SaveCostResult =
  | { ok: true; snapshot: CostSnapshot; draft: OrderDraft }
  | { ok: false; code: "validation_error" | "storage_error"; message: string };

const newId = (prefix: string) =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function toDomainSnapshot(id: string, input: CostEditorInput, createdAt: string): CostSnapshot {
  return calculateCostSnapshot(id, {
    currency: "JOD",
    materialItems: input.materialItems.map(item => ({
      ...item,
      source: "user_input",
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
}

/* S09: التوسيع من أساس المجموعات إلى النواة الواحدة — لا محرك ثانٍ؛
 * التوسيع يضرب أساس الوحدة الواحدة في تكرارها مرة واحدة قبل تقريب النواة. */
function toDomainGroupedSnapshot(id: string, input: GroupedCostEditorInput, createdAt: string): CostSnapshot {
  const grouped: GroupedCostBasisInput = {
    currency: "JOD",
    groups: input.groupBasis.map(group => ({
      id: group.groupId,
      label: group.label,
      repeatQuantity: group.repeatQuantity,
      unitMaterialItems: group.unitMaterialItems.map(item => ({
        ...item,
        source: "user_input",
        priceDate: localDateInAmman(createdAt),
      })),
    })),
    time: input.time,
    packagingMinor: input.packagingMinor,
    deliveryMinor: input.deliveryMinor,
    wasteMinor: input.wasteMinor,
    safetyBufferMinor: input.safetyBufferMinor,
    createdAt,
  };
  return calculateCostSnapshot(id, expandGroupedCostBasis(grouped));
}

function validationMessage(): Extract<CostResult, { ok: false }> {
  return {
    ok: false,
    code: VALIDATION_ERROR,
    message:
      "راجع الكمية وبنود التكلفة والوقت. لا يمكن اعتبار الوقت المفقود صفرًا، ولا تُقبل المبالغ أو الكميات السالبة.",
  };
}

export class CostService {
  constructor(
    private readonly store: CostServiceStore,
    private readonly now: Clock = systemClock,
  ) {}
  preview(input: CostEditorInput): CostResult {
    try {
      return { ok: true, snapshot: toDomainSnapshot("cost-preview", input, this.now()) };
    } catch {
      return validationMessage();
    }
  }
  previewStored(snapshot: DraftCostSnapshot): CostResult {
    try {
      return { ok: true, snapshot: toDomainSnapshot(snapshot.id, snapshot, snapshot.createdAt) };
    } catch {
      return validationMessage();
    }
  }
  /* S09: معاينة المسودة المجمعة بالنواة الواحدة بعد التوسيع. */
  previewGrouped(input: GroupedCostEditorInput): CostResult {
    try {
      return { ok: true, snapshot: toDomainGroupedSnapshot("cost-preview", input, this.now()) };
    } catch {
      return validationMessage();
    }
  }
  async saveSnapshot(draft: OrderDraft, input: CostEditorInput): Promise<SaveCostResult> {
    const timestamp = this.now();
    const id = newId("cost");
    let snapshot: CostSnapshot;
    try {
      snapshot = toDomainSnapshot(id, input, timestamp);
    } catch {
      return validationMessage();
    }
    const record: DraftCostSnapshot = {
      ...input,
      id,
      revision: draft.costSnapshots.length + 1,
      currency: "JOD",
      materialItems: input.materialItems.map(item => ({ ...item })),
      time: input.time ? { ...input.time } : null,
      createdAt: timestamp,
    };
    const saved = await this.store.saveDraft({
      ...draft,
      costSnapshots: [...draft.costSnapshots, record],
      activeCostSnapshotId: id,
      updatedAt: timestamp,
    });
    return saved.ok
      ? { ok: true, snapshot, draft: saved.value }
      : storageFailure("تعذر حفظ نسخة التكلفة. بقيت المدخلات أمامك؛ أعد المحاولة.");
  }
  /* S09 (UNIT-008/SH-13): حفظ نسخة تكلفة مسودة مجمعة — إلحاق مراجعة عند كل
   * حفظ صريح كما في المسار القائم (R2-F04: لا يوجد هنا فحص «لا فرق معنوي» —
   * الحفظ المتكرر بلا تغيير يلحق مراجعة كالسلوك القائم تمامًا) والفعالة
   * تُعيّن؛ اللقطة تحمل المدخل الموسع كقائمة مواد الطلب كله + أساس
   * المجموعات الموثق قبل التوسيع. */
  async saveGroupedSnapshot(draft: OrderDraft, input: GroupedCostEditorInput): Promise<SaveCostResult> {
    const timestamp = this.now();
    const id = newId("cost");
    let snapshot: CostSnapshot;
    try {
      snapshot = toDomainGroupedSnapshot(id, input, timestamp);
    } catch {
      return validationMessage();
    }
    const record: DraftCostSnapshot = {
      id,
      revision: draft.costSnapshots.length + 1,
      currency: "JOD",
      materialItems: snapshot.input.materialItems.map(item => ({
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
      safetyBufferMinor: input.safetyBufferMinor,
      quantity: snapshot.quantity,
      createdAt: timestamp,
      groupBasis: input.groupBasis.map(group => ({
        groupId: group.groupId,
        label: group.label,
        repeatQuantity: group.repeatQuantity,
        unitMaterialItems: group.unitMaterialItems.map(item => ({ ...item })),
      })),
    };
    const saved = await this.store.saveDraft({
      ...draft,
      costSnapshots: [...draft.costSnapshots, record],
      activeCostSnapshotId: id,
      updatedAt: timestamp,
    });
    return saved.ok
      ? { ok: true, snapshot, draft: saved.value }
      : storageFailure("تعذر حفظ نسخة التكلفة. بقيت المدخلات أمامك؛ أعد المحاولة.");
  }
}
