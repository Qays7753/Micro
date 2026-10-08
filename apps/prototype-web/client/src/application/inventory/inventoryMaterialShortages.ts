/* Wave F شريحة ٣ (ADR-014 — تقسيم مسؤولية داخلي، 2026-10-04): مسار النقص
 * الموثق (المجموعة ٢ عقد ٢٨ / D-027) — سجل النقص الصريح بديل الرصيد السالب،
 * والاستهلاك مع النقص في معاملة ذرّية واحدة، وحل النقص بقرار المالك لا
 * تلقائيًا، وقراءة السجلات — انتقل حرفيًا إلى هذا البيت الشقيق؛ الخدمة
 * تفوّض هنا. المتاح يبقى كما هو حتى يقرر المالك. */
import {
  applyInventoryShortageResolution,
  assertInventoryRemainsNonNegative,
  consumptionValueMinor,
  createInventoryMovement,
  createInventoryShortage,
  materialIsTracked,
  positionCostKnowledge,
  type InventoryMovement,
  type InventoryShortage,
} from "@micro-domain/inventory-material/index.js";
import { errorMessageOf, storageFailure, validationFailure } from "@/application/resultCodes";
import type { Clock } from "@/application/time/clock";
import type { PrototypeLocalStore } from "@/storage/local/types";
import type { InventoryMaterialStore } from "@/storage/local/capabilities/inventoryMaterialStore";

/** R3 (R3-SC-07): عدسة الوحدة — النقص وكلوحه وقراءته وكتابته الذرّية. */
export type InventoryMaterialShortagesStore = Pick<
  InventoryMaterialStore,
  "listMaterials" | "listInventoryMovements" | "listInventoryShortages" | "commitInventoryWithShortage"
>;
import {
  id,
  materialById,
  movementByOperationKey,
  shortageByOperationKey,
  writeStorageFailure,
  type ConsumeMaterialInput,
  type InventoryResult,
  type RecordShortageInput,
  type ResolveShortageInput,
} from "./inventoryMaterialModel";

/* المجموعة ٢ (عقد ٢٨ / D-027): تسجيل نقص صريح — بديل الرصيد السالب الموثّق.
 * طلب الكمية أكبر من المتاح يُوثَّق نقصًا، والمتاح يبقى كما هو حتى يقرر المالك. */
export async function recordShortage(
  store: InventoryMaterialShortagesStore,
  now: Clock,
  input: RecordShortageInput,
): Promise<InventoryResult<InventoryShortage>> {
  const [materials, movements, shortages] = await Promise.all([
    store.listMaterials(),
    store.listInventoryMovements(),
    store.listInventoryShortages(),
  ]);
  if (!materials.ok || !movements.ok || !shortages.ok) return writeStorageFailure();
  const repeated = shortageByOperationKey(shortages.value, input.operationKey);
  if (repeated) return { ok: true, value: repeated, reused: true };
  const material = materialById(materials.value, input.materialId);
  if (!material) return validationFailure("اختر مادة موجودة قبل تسجيل النقص.");
  if (!materialIsTracked(material))
    return validationFailure("المادة غير متتبَّعة — النقص حالة تتبع؛ فعّل المتابعة أولًا.");
  const position = assertInventoryRemainsNonNegative(input.materialId, movements.value);
  if (input.requestedQuantityMilli <= position.quantityMilli)
    return validationFailure("الكمية متوفرة فعلًا — سجّل استهلاكًا عاديًا، لا نقصًا.");
  try {
    const shortage = createInventoryShortage({
      id: id("shortage"),
      materialId: input.materialId,
      requestedQuantityMilli: input.requestedQuantityMilli,
      availableQuantityMilli: position.quantityMilli,
      shortageQuantityMilli: input.requestedQuantityMilli - position.quantityMilli,
      occurredOn: input.occurredOn,
      recordedAt: now(),
      note: input.note,
      orderId: input.orderId,
      operationKey: input.operationKey,
    });
    const saved = await store.commitInventoryWithShortage(null, [], shortage);
    return saved.ok ? { ok: true, value: shortage } : writeStorageFailure();
  } catch (error) {
    return validationFailure(errorMessageOf(error, "بيانات سجل النقص غير صالحة."));
  }
}

/* المجموعة ٢ (عقد ٢٨ / D-027): استهلاك المتاح + توثيق النقص معًا — معاملة ذرّية
 * واحدة (حركة + سجل نقص) فلا حالة بينية أبدًا. */
export async function consumeWithShortage(
  store: InventoryMaterialShortagesStore,
  now: Clock,
  input: ConsumeMaterialInput,
): Promise<InventoryResult<{ movement: InventoryMovement | null; shortage: InventoryShortage }>> {
  const [materials, movements, shortages] = await Promise.all([
    store.listMaterials(),
    store.listInventoryMovements(),
    store.listInventoryShortages(),
  ]);
  if (!materials.ok || !movements.ok || !shortages.ok) return writeStorageFailure();
  const repeated = shortageByOperationKey(shortages.value, `${input.operationKey}:shortage`);
  if (repeated) {
    const movement = movementByOperationKey(movements.value, input.operationKey) ?? null;
    return { ok: true, value: { movement, shortage: repeated }, reused: true };
  }
  const material = materialById(materials.value, input.materialId);
  if (!material) return validationFailure("اختر مادة موجودة قبل تسجيل الاستهلاك.");
  if (!materialIsTracked(material))
    return validationFailure("المادة غير متتبَّعة — فعّل متابعتها أولًا قبل تسجيل الاستهلاك.");
  const position = assertInventoryRemainsNonNegative(input.materialId, movements.value);
  if (input.quantityMilli <= position.quantityMilli)
    return validationFailure("الكمية متوفرة — استخدم الاستهلاك العادي، لا مسار النقص.");
  if (position.quantityMilli <= 0) return validationFailure("لا متاح من هذه المادة الآن — سجّل النقص وحده.");
  try {
    const costUnknown = positionCostKnowledge(movements.value, input.materialId) === "unknown";
    const value = consumptionValueMinor(position.quantityMilli, position, costUnknown);
    const movement = createInventoryMovement({
      id: id("consume"),
      materialId: input.materialId,
      type: "consumption",
      occurredOn: input.occurredOn,
      recordedAt: now(),
      quantityDeltaMilli: -position.quantityMilli,
      valueDeltaMinor: -value || 0,
      note: input.note,
      reason: input.reason?.trim() || null,
      operationKey: input.operationKey,
      orderId: input.orderId,
      costKnowledge: value === 0 ? "unknown" : "known",
    });
    const shortage = createInventoryShortage({
      id: id("shortage"),
      materialId: input.materialId,
      requestedQuantityMilli: input.quantityMilli,
      availableQuantityMilli: position.quantityMilli,
      shortageQuantityMilli: input.quantityMilli - position.quantityMilli,
      occurredOn: input.occurredOn,
      recordedAt: now(),
      note: input.note,
      orderId: input.orderId,
      operationKey: `${input.operationKey}:shortage`,
    });
    const saved = await store.commitInventoryWithShortage(null, [movement], shortage);
    return saved.ok ? { ok: true, value: { movement, shortage } } : writeStorageFailure();
  } catch (error) {
    return validationFailure(errorMessageOf(error, "بيانات استهلاك المادة مع النقص غير صالحة."));
  }
}

/* المجموعة ٢ (عقد ٢٨ / D-027): حل النقص صريح وموثّق — لا يُغلق تلقائيًا عند
 * وصول استلام؛ المالك يقرر الحل بعد التحقق. */
export async function resolveShortage(
  store: InventoryMaterialShortagesStore,
  now: Clock,
  input: ResolveShortageInput,
): Promise<InventoryResult<InventoryShortage>> {
  const shortagesResult = await store.listInventoryShortages();
  if (!shortagesResult.ok) return writeStorageFailure();
  const shortage = shortagesResult.value.find(candidate => candidate.id === input.shortageId);
  if (!shortage) return validationFailure("لم نجد سجل النقص الذي تريد حلّه.");
  if (shortage.status === "resolved") return { ok: true, value: shortage, reused: true };
  try {
    const resolved = applyInventoryShortageResolution(shortage, {
      resolvedOn: input.resolvedOn,
      resolutionNote: input.resolutionNote,
    });
    const saved = await store.commitInventoryWithShortage(null, [], resolved);
    return saved.ok ? { ok: true, value: resolved } : writeStorageFailure();
  } catch (error) {
    return validationFailure(errorMessageOf(error, "بيانات حل النقص غير صالحة."));
  }
}

export async function listShortages(
  store: InventoryMaterialShortagesStore,
): Promise<InventoryResult<readonly InventoryShortage[]>> {
  const result = await store.listInventoryShortages();
  return result.ok ? { ok: true, value: result.value } : storageFailure("تعذر قراءة سجلات النقص المحلية.");
}
