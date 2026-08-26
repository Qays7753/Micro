import { materialUnits, type CreateInventoryMovementInput, type CreateMaterialInput, type InventoryMovement, type Material, type MaterialInventoryPosition } from "./types.js";

const nonEmpty = (value: string, label: string) => { if (!value.trim()) throw new Error(`${label} مطلوب.`); return value.trim(); };
const validDate = (value: string, label: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T12:00:00.000Z`))) throw new Error(`${label} غير صالح.`); return value; };
const integer = (value: number, label: string) => { if (!Number.isInteger(value)) throw new Error(`${label} يجب أن يكون رقمًا صحيحًا.`); return value; };
const positive = (value: number, label: string) => { if (integer(value, label) <= 0) throw new Error(`${label} يجب أن يكون أكبر من صفر.`); return value; };
const validWasteContext = (value: unknown) => {
  if (!value || typeof value !== "object") return false;
  const context = value as Record<string, unknown>;
  if (context.kind === "order") return typeof context.orderId === "string" && context.orderId.trim().length > 0;
  if (context.kind === "catalog_item") return typeof context.catalogItemId === "string" && context.catalogItemId.trim().length > 0;
  if (context.kind === "catalog_template") return typeof context.catalogItemId === "string" && context.catalogItemId.trim().length > 0 && typeof context.templateId === "string" && context.templateId.trim().length > 0;
  if (context.kind === "general_project") return true;
  return context.kind === "unallocated" && (context.allocationNote === null || typeof context.allocationNote === "string") && (context.allocationNote === null || context.allocationNote.trim().length > 0);
};

export function createMaterial(input: CreateMaterialInput): Material { return { id: nonEmpty(input.id, "معرف المادة"), name: nonEmpty(input.name, "اسم المادة"), unit: materialUnits.includes(input.unit) ? input.unit : (() => { throw new Error("وحدة المادة غير مدعومة."); })(), createdAt: input.createdAt, createdOperationKey: nonEmpty(input.createdOperationKey, "مفتاح العملية") }; }

export function createInventoryMovement(input: CreateInventoryMovementInput): InventoryMovement {
  const type = input.type; const quantityDeltaMilli = integer(input.quantityDeltaMilli, "كمية الحركة"); const valueDeltaMinor = integer(input.valueDeltaMinor, "قيمة الحركة");
  const wasteContext = type === "waste" ? (input.wasteContext ?? { kind: "general_project" as const }) : null;
  if (quantityDeltaMilli === 0 || valueDeltaMinor === 0) throw new Error("كمية وقيمة حركة المادة يجب أن تكونا غير صفريتين.");
  const needsReason = type === "waste" || type === "adjustment" || type === "reversal";
  if (type === "opening" || type === "purchase_receipt") { if (quantityDeltaMilli < 0 || valueDeltaMinor < 0) throw new Error("حركة الإضافة يجب أن تزيد الكمية والقيمة."); }
  if (type === "consumption" || type === "waste") { if (quantityDeltaMilli > 0 || valueDeltaMinor > 0) throw new Error("حركة الإخراج يجب أن تنقص الكمية والقيمة."); }
  if (type === "purchase_receipt" && !input.purchaseId) throw new Error("استلام الشراء يحتاج مرجع شراء مواد.");
  if (type === "consumption" && !input.orderId) throw new Error("استهلاك المادة يحتاج مرجع طلب.");
  if (needsReason && !input.reason?.trim()) throw new Error("سبب الحركة مطلوب.");
  if (type === "reversal" && !input.reversesMovementId) throw new Error("العكس يحتاج مرجع الحركة الأصلية.");
  if (type !== "reversal" && input.reversesMovementId) throw new Error("مرجع العكس خاص بحركة العكس فقط.");
  if ((type === "waste" && !validWasteContext(wasteContext)) || (type !== "waste" && input.wasteContext !== undefined && input.wasteContext !== null)) throw new Error("سياق الهدر غير صالح أو مستخدم خارج حركة الهدر.");
  return { id: nonEmpty(input.id, "معرف الحركة"), materialId: nonEmpty(input.materialId, "المادة"), type, occurredOn: validDate(input.occurredOn, "تاريخ الحركة"), recordedAt: input.recordedAt, quantityDeltaMilli, valueDeltaMinor, note: nonEmpty(input.note, "بيان الحركة"), reason: input.reason?.trim() || null, operationKey: nonEmpty(input.operationKey, "مفتاح العملية"), purchaseId: input.purchaseId ?? null, orderId: input.orderId ?? null, reversesMovementId: input.reversesMovementId ?? null, wasteContext };
}

export function isCostBackedConsumption(movement: InventoryMovement): boolean { return movement.type === "consumption" && movement.orderId !== null && Number.isInteger(movement.quantityDeltaMilli) && movement.quantityDeltaMilli < 0 && Number.isInteger(movement.valueDeltaMinor) && movement.valueDeltaMinor < 0; }

export function summarizeMaterialInventory(materialId: string, movements: readonly InventoryMovement[]): MaterialInventoryPosition { const selected = movements.filter((movement) => movement.materialId === materialId); return { materialId, quantityMilli: selected.reduce((sum, movement) => sum + movement.quantityDeltaMilli, 0), valueMinor: selected.reduce((sum, movement) => sum + movement.valueDeltaMinor, 0), movementCount: selected.length }; }
export function consumptionValueMinor(quantityMilli: number, position: MaterialInventoryPosition): number { positive(quantityMilli, "كمية الاستهلاك"); if (quantityMilli > position.quantityMilli) throw new Error("كمية المادة غير كافية للحركة المطلوبة."); if (quantityMilli === position.quantityMilli) return position.valueMinor; const result = Math.round((quantityMilli * position.valueMinor) / position.quantityMilli); if (result <= 0 || result >= position.valueMinor) throw new Error("لا يمكن توزيع قيمة المادة المتاحة بهذه الكمية."); return result; }
export function assertInventoryRemainsNonNegative(materialId: string, movements: readonly InventoryMovement[]): MaterialInventoryPosition { const position = summarizeMaterialInventory(materialId, movements); if (position.quantityMilli < 0 || position.valueMinor < 0) throw new Error("لا يمكن أن تصبح كمية المادة أو قيمتها سالبة."); return position; }
