import { roundHalfUp } from "../shared/index.js";
import {
  materialUnits,
  type CreateInventoryMovementInput,
  type CreateInventoryShortageInput,
  type CreateMaterialInput,
  type InventoryMovement,
  type InventoryShortage,
  type Material,
  type MaterialInventoryPosition,
  type MaterialOpeningKnowledge,
  type MaterialTrackingState,
  type ResolveInventoryShortageInput,
} from "./types.js";

const nonEmpty = (value: string, label: string) => {
  if (!value.trim()) throw new Error(`${label} مطلوب.`);
  return value.trim();
};
const validDate = (value: string, label: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T12:00:00.000Z`)))
    throw new Error(`${label} غير صالح.`);
  return value;
};
const integer = (value: number, label: string) => {
  if (!Number.isInteger(value)) throw new Error(`${label} يجب أن يكون رقمًا صحيحًا.`);
  return value;
};
const positive = (value: number, label: string) => {
  if (integer(value, label) <= 0) throw new Error(`${label} يجب أن يكون أكبر من صفر.`);
  return value;
};
const validWasteContext = (value: unknown) => {
  if (!value || typeof value !== "object") return false;
  const context = value as Record<string, unknown>;
  if (context.kind === "order")
    return typeof context.orderId === "string" && context.orderId.trim().length > 0;
  if (context.kind === "catalog_item")
    return typeof context.catalogItemId === "string" && context.catalogItemId.trim().length > 0;
  if (context.kind === "catalog_template")
    return (
      typeof context.catalogItemId === "string" &&
      context.catalogItemId.trim().length > 0 &&
      typeof context.templateId === "string" &&
      context.templateId.trim().length > 0
    );
  if (context.kind === "general_project") return true;
  return (
    context.kind === "unallocated" &&
    (context.allocationNote === null || typeof context.allocationNote === "string") &&
    (context.allocationNote === null || context.allocationNote.trim().length > 0)
  );
};

/* المجموعة ٢ (عقد ٢٨): قرار المتابعة لكل مادة — غياب الحقل يعني متتبَّعة (إرث محفوظ). */
export function materialIsTracked(material: Material): boolean {
  return !material.tracking || material.tracking.status === "tracked";
}
/* المجموعة ٢ (عقد ٢٨): معرفة الكمية — «غير محدد بعد» فقط حين يُعلن صراحةً؛
 * غياب معرفة البداية = معروف (إرث) لا «غير محدد» — يمنع إرباك كل المواد القديمة. */
export function materialQuantityKnowledge(material: Material): "known" | "unconfirmed" {
  return material.opening?.quantityState === "unconfirmed" ? "unconfirmed" : "known";
}
const isString = (value: unknown): value is string => typeof value === "string";
const isNonNegativeInteger = (value: unknown): boolean =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;
const validDateOrNull = (value: unknown): boolean =>
  value === null || (isString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value));
const validTrackingState = (value: unknown): value is MaterialTrackingState => {
  if (!value || typeof value !== "object") return false;
  const tracking = value as Record<string, unknown>;
  if (tracking.status !== "tracked" && tracking.status !== "untracked") return false;
  if (tracking.reason !== null && !isString(tracking.reason)) return false;
  return validDateOrNull(tracking.decidedOn);
};
const validOpeningQuantity = (opening: Record<string, unknown>): boolean =>
  opening.quantityState === "unconfirmed"
    ? opening.quantityMilli === null || opening.quantityMilli === undefined
    : isNonNegativeInteger(opening.quantityMilli);
const validOpeningCost = (opening: Record<string, unknown>): boolean =>
  opening.costState === "known"
    ? isNonNegativeInteger(opening.valueMinor)
    : opening.valueMinor === null || opening.valueMinor === undefined;
const validOpeningKnowledge = (value: unknown): value is MaterialOpeningKnowledge => {
  if (!value || typeof value !== "object") return false;
  const opening = value as Record<string, unknown>;
  if (opening.quantityState !== "unconfirmed" && opening.quantityState !== "confirmed") return false;
  if (!validOpeningQuantity(opening)) return false;
  if (opening.costState !== "known" && opening.costState !== "unknown") return false;
  if (!validOpeningCost(opening)) return false;
  if (!validDateOrNull(opening.confirmedOn)) return false;
  return opening.sourceNote === null || isString(opening.sourceNote);
};

export function createMaterial(input: CreateMaterialInput): Material {
  if (input.tracking !== undefined && input.tracking !== null && !validTrackingState(input.tracking))
    throw new Error("حالة متابعة المادة غير صالحة.");
  if (input.opening !== undefined && input.opening !== null && !validOpeningKnowledge(input.opening))
    throw new Error("معرفة رصيد بداية المادة غير صالحة.");
  return {
    id: nonEmpty(input.id, "معرف المادة"),
    name: nonEmpty(input.name, "اسم المادة"),
    unit: materialUnits.includes(input.unit)
      ? input.unit
      : (() => {
          throw new Error("وحدة المادة غير مدعومة.");
        })(),
    createdAt: input.createdAt,
    createdOperationKey: nonEmpty(input.createdOperationKey, "مفتاح العملية"),
    tracking: input.tracking ?? null,
    opening: input.opening ?? null,
  };
}

export function createInventoryMovement(input: CreateInventoryMovementInput): InventoryMovement {
  const type = input.type;
  const quantityDeltaMilli = integer(input.quantityDeltaMilli, "كمية الحركة");
  const valueDeltaMinor = integer(input.valueDeltaMinor, "قيمة الحركة");
  const costKnowledge = input.costKnowledge ?? "known";
  const wasteContext = type === "waste" ? (input.wasteContext ?? { kind: "general_project" as const }) : null;
  if (quantityDeltaMilli === 0) throw new Error("كمية حركة المادة يجب أن تكون غير صفرية.");
  /* المجموعة ٢ (عقد ٢٨): القيمة الصفرية مسموحة فقط مع تكلفة «غير معروفة» —
   * صفر معلن الالتباس لا «مجانية»؛ و«غير معروفة» لا تحمل قيمة غير صفرية. */
  if (valueDeltaMinor === 0 && costKnowledge !== "unknown")
    throw new Error("كمية وقيمة حركة المادة يجب أن تكونا غير صفريتين، أو علّم التكلفة غير معروفة.");
  if (valueDeltaMinor !== 0 && costKnowledge === "unknown")
    throw new Error("حركة التكلفة غير المعروفة تُسجَّل بقيمة صفر موسومة «غير معروفة»، لا بقيمة معلنة.");
  const needsReason = type === "waste" || type === "adjustment" || type === "reversal";
  if (type === "opening" || type === "purchase_receipt") {
    if (quantityDeltaMilli < 0 || valueDeltaMinor < 0)
      throw new Error("حركة الإضافة يجب أن تزيد الكمية والقيمة.");
  }
  if (type === "consumption" || type === "waste") {
    if (quantityDeltaMilli > 0 || valueDeltaMinor > 0)
      throw new Error("حركة الإخراج يجب أن تنقص الكمية والقيمة.");
  }
  if (type === "purchase_receipt" && !input.purchaseId)
    throw new Error("استلام الشراء يحتاج مرجع شراء مواد.");
  /* المجموعة ٢ (عقد ٢٨): الاستهلاك لطلب محدد أو بيان صريح لعمل المشروع —
   * الاستهلاك بلا مرجع ولا بيان حركة مجهولة تُرفض. المجموعة ٣ (عقد D6):
   * البيع المباشر مرجع صريح كذلك — استهلاك مرتبط ببيع لا يحتاج بيانًا إضافيًا. */
  if (type === "consumption" && !input.orderId && !input.saleId && !input.reason?.trim())
    throw new Error("استهلاك المادة يحتاج مرجع طلب أو بيع مباشر أو بيانًا واضحًا للاستهلاك.");
  if (needsReason && !input.reason?.trim()) throw new Error("سبب الحركة مطلوب.");
  if (type === "reversal" && !input.reversesMovementId) throw new Error("التراجع يحتاج مرجع الحركة الأصلية.");
  if (type !== "reversal" && input.reversesMovementId) throw new Error("مرجع التراجع خاص بحركة التراجع فقط.");
  if (
    (type === "waste" && !validWasteContext(wasteContext)) ||
    (type !== "waste" && input.wasteContext !== undefined && input.wasteContext !== null)
  )
    throw new Error("سياق الهدر غير صالح أو مستخدم خارج حركة الهدر.");
  return {
    id: nonEmpty(input.id, "معرف الحركة"),
    materialId: nonEmpty(input.materialId, "المادة"),
    type,
    occurredOn: validDate(input.occurredOn, "تاريخ الحركة"),
    recordedAt: input.recordedAt,
    quantityDeltaMilli,
    valueDeltaMinor,
    note: nonEmpty(input.note, "بيان الحركة"),
    reason: input.reason?.trim() || null,
    operationKey: nonEmpty(input.operationKey, "مفتاح العملية"),
    purchaseId: input.purchaseId ?? null,
    orderId: input.orderId ?? null,
    saleId: input.saleId?.trim() || null,
    reversesMovementId: input.reversesMovementId ?? null,
    wasteContext,
    costKnowledge,
  };
}

export function isCostBackedConsumption(movement: InventoryMovement): boolean {
  return (
    movement.type === "consumption" &&
    movement.orderId !== null &&
    Number.isInteger(movement.quantityDeltaMilli) &&
    movement.quantityDeltaMilli < 0 &&
    Number.isInteger(movement.valueDeltaMinor) &&
    movement.valueDeltaMinor < 0
  );
}

export function summarizeMaterialInventory(
  materialId: string,
  movements: readonly InventoryMovement[],
): MaterialInventoryPosition {
  const selected = movements.filter(movement => movement.materialId === materialId);
  return {
    materialId,
    quantityMilli: selected.reduce((sum, movement) => sum + movement.quantityDeltaMilli, 0),
    valueMinor: selected.reduce((sum, movement) => sum + movement.valueDeltaMinor, 0),
    movementCount: selected.length,
  };
}
export function consumptionValueMinor(
  quantityMilli: number,
  position: MaterialInventoryPosition,
  positionCostUnknown = false,
): number {
  positive(quantityMilli, "كمية الاستهلاك");
  if (quantityMilli > position.quantityMilli) throw new Error("كمية المادة غير كافية للحركة المطلوبة.");
  /* المجموعة ٢ (عقد ٢٨): الموضع النقي بتكلفة غير معروفة (قيمة صفر موسومة) —
   * الاستهلاك يخرج بقيمة صفر موسومة «غير معروفة»، لا برفض القرار ٢٠.
   * الموضع المخلوط/المعروف يبقى تحت الرياضيات والقرار ٢٠ كاملًا. */
  if (positionCostUnknown && position.valueMinor === 0) return 0;
  if (quantityMilli === position.quantityMilli) return position.valueMinor;
  const result = roundHalfUp(quantityMilli * position.valueMinor, position.quantityMilli);
  if (result === null || result <= 0 || result >= position.valueMinor)
    /* القرار ٢٠: الرفض يبقى، والفعل المعلن بعده «أخرِج المتبقي» — هدر بقيمة المتبقي كاملة لا شطب. */
    throw new Error(
      "حصة القيمة لا يمكن تمثيلها بهذه الكمية — سجّل حركة أصغر، أو أخرِج المتبقي كاملًا كإخراج فاقد بقيمته.",
    );
  return result;
}
/* المجموعة ٢ (عقد ٢٨): هل الموضع نقي التكلفة غير المعروفة؟ — قيمة صفرية مع
 * حركات موسومة «غير معروفة» فقط. المختلط أو المعروف يبقى كامل الرياضيات. */
export function positionCostKnowledge(
  movements: readonly InventoryMovement[],
  materialId: string,
): "known" | "partial" | "unknown" {
  const selected = movements.filter(movement => movement.materialId === materialId);
  const valueMinor = selected.reduce((sum, movement) => sum + movement.valueDeltaMinor, 0);
  const hasUnknown = selected.some(movement => movement.costKnowledge === "unknown");
  if (!hasUnknown) return "known";
  return valueMinor > 0 ? "partial" : "unknown";
}
export function assertInventoryRemainsNonNegative(
  materialId: string,
  movements: readonly InventoryMovement[],
): MaterialInventoryPosition {
  const position = summarizeMaterialInventory(materialId, movements);
  if (position.quantityMilli < 0 || position.valueMinor < 0)
    throw new Error("لا يمكن أن تصبح كمية المادة أو قيمتها سالبة.");
  return position;
}

/* المجموعة ٢ (عقد ٢٨ / D-027): سجل النقص — بديل الرصيد السالب الصريح الموثّق. */
export function createInventoryShortage(input: CreateInventoryShortageInput): InventoryShortage {
  const requested = positive(input.requestedQuantityMilli, "الكمية المطلوبة");
  const available = integer(input.availableQuantityMilli, "الكمية المتاحة");
  if (available < 0) throw new Error("الكمية المتاحة لا يمكن أن تكون سالبة.");
  const shortage = input.shortageQuantityMilli;
  if (!Number.isInteger(shortage) || shortage <= 0)
    throw new Error("كمية النقص يجب أن تكون رقمًا صحيحًا موجبًا.");
  if (requested - available !== shortage)
    throw new Error("كمية النقص يجب أن تساوي الفرق بين المطلوب والمتاح.");
  return {
    id: nonEmpty(input.id, "معرف سجل النقص"),
    materialId: nonEmpty(input.materialId, "المادة"),
    requestedQuantityMilli: requested,
    availableQuantityMilli: available,
    shortageQuantityMilli: shortage,
    occurredOn: validDate(input.occurredOn, "تاريخ سجل النقص"),
    recordedAt: input.recordedAt,
    note: nonEmpty(input.note, "بيان النقص"),
    orderId: input.orderId?.trim() || null,
    operationKey: nonEmpty(input.operationKey, "مفتاح العملية"),
    status: "open",
    resolvedOn: null,
    resolutionNote: null,
  };
}
export function applyInventoryShortageResolution(
  shortage: InventoryShortage,
  input: ResolveInventoryShortageInput,
): InventoryShortage {
  if (shortage.status === "resolved") throw new Error("سجل النقص محسول سابقًا — لا يُحل مرتين.");
  return {
    ...shortage,
    status: "resolved",
    resolvedOn: validDate(input.resolvedOn, "تاريخ حل النقص"),
    resolutionNote: nonEmpty(input.resolutionNote, "بيان حل النقص"),
  };
}
