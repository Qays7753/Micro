/* Wave F شريحة ٣ (ADR-014 — تقسيم مسؤولية داخلي، 2026-10-04): عائلة دورة
 * حياة سجل المادة (المجموعة ٢ عقد ٢٨) — الرحلة الموجهة للإنشاء بقرار متابعة
 * ومعرفة رصيد بداية، وإيقاف المتابعة بعواقبه المعلنة، وإعادة التفعيل بلا
 * ثقة صامتة برقم قديم، وتأكيد الرصيد بحركة موثقة — انتقلت حرفيًا إلى هذا
 * البيت الشقيق؛ الخدمة تفوّض هنا. سجل المادة يُدار هنا؛ الحركات تُكتب عبر
 * مسارها المحروس في البيت الشقيق inventoryMaterialWrites. */
import {
  assertInventoryRemainsNonNegative,
  consumptionValueMinor,
  createInventoryMovement,
  createMaterial,
  materialIsTracked,
  positionCostKnowledge,
  summarizeMaterialInventory,
  type InventoryMovement,
  type Material,
  type MaterialOpeningKnowledge,
} from "@micro-domain/inventory-material/index.js";
import { errorMessageOf, validationFailure } from "@/application/resultCodes";
import type { Clock } from "@/application/time/clock";
import type { PrototypeLocalStore } from "@/storage/local/types";
import type { InventoryMaterialStore } from "@/storage/local/capabilities/inventoryMaterialStore";

/** R3 (R3-SC-07): عدسة الوحدة — المادة وحركاتها في التزام ذرّي. */
export type InventoryMaterialLifecycleStore = Pick<
  InventoryMaterialStore,
  "listMaterials" | "listInventoryMovements" | "commitInventory"
>;
import {
  ammanLocalDate,
  id,
  materialById,
  movementByOperationKey,
  writeStorageFailure,
  type ConfirmOpeningInput,
  type InventoryResult,
  type OpenMaterialInput,
  type RetrackMaterialInput,
  type UntrackMaterialInput,
} from "./inventoryMaterialModel";

export async function openMaterial(
  store: InventoryMaterialLifecycleStore,
  now: Clock,
  input: OpenMaterialInput,
): Promise<InventoryResult<{ material: Material; opening: InventoryMovement | null }>> {
  const [materials, movements] = await Promise.all([store.listMaterials(), store.listInventoryMovements()]);
  if (!materials.ok || !movements.ok) return writeStorageFailure();
  const repeated = materials.value.find(material => material.createdOperationKey === input.operationKey);
  if (repeated)
    return {
      ok: true,
      value: {
        material: repeated,
        opening: movementByOperationKey(movements.value, input.operationKey) ?? null,
      },
      reused: true,
    };
  try {
    /* المجموعة ٢ (عقد ٢٨): الرحلة الموجهة — قرار متابعة + معرفة رصيد البداية.
     * غير المتتبَّعة: بلا حركة وبلا رصيد؛ مؤكد موجب: حركة بداية؛ غير محدد/صفر
     * مؤكد: بلا حركة — الصفر المعلن حالة معرفة لا حركة. */
    const isTracked = input.tracking === "tracked";
    const confirmed = input.opening.quantityState === "confirmed";
    const quantityMilli = input.opening.quantityMilli;
    const costKnown =
      isTracked && confirmed && (quantityMilli ?? 0) > 0 && input.opening.costState === "known";
    if (!isTracked && input.opening.quantityState === "confirmed")
      throw new Error("المادة غير المتتبَّعة لا تحتاج رصيد بداية — أنشئها للتكلفة فقط أو فعّل المتابعة.");
    if (confirmed && (quantityMilli === null || quantityMilli === undefined))
      throw new Error("الرصيد المؤكد يحتاج كمية معلومة.");
    if (confirmed && (quantityMilli as number) < 0) throw new Error("الكمية لا يمكن أن تكون سالبة.");
    if (
      costKnown &&
      (!Number.isInteger(input.opening.valueMinor) || (input.opening.valueMinor as number) <= 0)
    )
      throw new Error("قيمة الرصيد المعروفة يجب أن تكون رقمًا موجبًا — أو اختر «غير محدد بعد».");
    const openingKnowledge: MaterialOpeningKnowledge | null = isTracked
      ? {
          quantityState: input.opening.quantityState,
          quantityMilli: confirmed ? (quantityMilli as number) : null,
          costState: costKnown ? "known" : "unknown",
          valueMinor: costKnown ? (input.opening.valueMinor as number) : null,
          confirmedOn: confirmed ? input.opening.confirmedOn : null,
          sourceNote: input.opening.sourceNote?.trim() || null,
        }
      : null;
    const material = createMaterial({
      id: id("material"),
      name: input.name,
      unit: input.unit,
      createdAt: now(),
      createdOperationKey: input.operationKey,
      tracking: {
        status: isTracked ? "tracked" : "untracked",
        decidedOn: isTracked && confirmed ? input.opening.confirmedOn : null,
        reason: null,
      },
      opening: openingKnowledge,
    });
    const opening =
      isTracked && confirmed && (quantityMilli as number) > 0
        ? createInventoryMovement({
            id: id("opening-material"),
            materialId: material.id,
            type: "opening",
            occurredOn: input.opening.confirmedOn ?? ammanLocalDate(now()),
            recordedAt: now(),
            quantityDeltaMilli: quantityMilli as number,
            valueDeltaMinor: costKnown ? (input.opening.valueMinor as number) : 0,
            note: input.note,
            operationKey: input.operationKey,
            costKnowledge: costKnown ? "known" : "unknown",
          })
        : null;
    const saved = await store.commitInventory(material, opening ? [opening] : []);
    return saved.ok ? { ok: true, value: { material, opening } } : writeStorageFailure();
  } catch (error) {
    return validationFailure(errorMessageOf(error, "بيانات المادة غير صالحة."));
  }
}

/* المجموعة ٢ (عقد ٢٨): إيقاف المتابعة بعواقب معلنة — الحركات كلها تبقى، والرصيد
 * يجمَّد في السجل، وإعادة التفعيل تعيده «غير محدد بعد» حتى يؤكده المالك. */
export async function untrackMaterial(
  store: InventoryMaterialLifecycleStore,
  now: Clock,
  input: UntrackMaterialInput,
): Promise<InventoryResult<Material>> {
  const materialsResult = await store.listMaterials();
  if (!materialsResult.ok) return writeStorageFailure();
  const material = materialsResult.value.find(candidate => candidate.id === input.materialId);
  if (!material) return validationFailure("لم نجد المادة التي تريد إيقاف متابعتها.");
  if (!materialIsTracked(material)) return { ok: true, value: material, reused: true };
  const updated: Material = {
    ...material,
    tracking: {
      status: "untracked",
      decidedOn: ammanLocalDate(now()),
      reason: input.reason?.trim() || null,
    },
  };
  const saved = await store.commitInventory(updated, []);
  return saved.ok ? { ok: true, value: updated } : writeStorageFailure();
}

/* المجموعة ٢ (عقد ٢٨): إعادة التفعيل — الرصيد المحفوظ يعود «غير محدد بعد» حتى
 * يؤكده المالك من جديد؛ لا ثقة صامتة برقم قديم. */
export async function retrackMaterial(
  store: InventoryMaterialLifecycleStore,
  now: Clock,
  input: RetrackMaterialInput,
): Promise<InventoryResult<Material>> {
  const materialsResult = await store.listMaterials();
  if (!materialsResult.ok) return writeStorageFailure();
  const material = materialsResult.value.find(candidate => candidate.id === input.materialId);
  if (!material) return validationFailure("لم نجد المادة التي تريد تفعيل متابعتها.");
  if (materialIsTracked(material)) return { ok: true, value: material, reused: true };
  const updated: Material = {
    ...material,
    tracking: { status: "tracked", decidedOn: ammanLocalDate(now()), reason: null },
    opening: {
      quantityState: "unconfirmed",
      quantityMilli: null,
      costState: "unknown",
      valueMinor: null,
      confirmedOn: null,
      sourceNote: null,
    },
  };
  const saved = await store.commitInventory(updated, []);
  return saved.ok ? { ok: true, value: updated } : writeStorageFailure();
}

/* المجموعة ٢ (عقد ٢٨): تأكيد رصيد — الفرق عن الحركات المحفوظة يُسجَّل بحركة
 * موثقة (بداية إن كانت أول حركة، أو ضبطًا)، والمادة تحمل معرفة مؤكدة. */
export async function confirmMaterialOpening(
  store: InventoryMaterialLifecycleStore,
  now: Clock,
  input: ConfirmOpeningInput,
): Promise<InventoryResult<{ material: Material; movement: InventoryMovement | null }>> {
  const [materials, movements] = await Promise.all([store.listMaterials(), store.listInventoryMovements()]);
  if (!materials.ok || !movements.ok) return writeStorageFailure();
  const material = materialById(materials.value, input.materialId);
  if (!material) return validationFailure("لم نجد المادة التي تريد تأكيد رصيدها.");
  if (!materialIsTracked(material))
    return validationFailure("المادة غير متتبَّعة — فعّل المتابعة أولًا قبل تأكيد الرصيد.");
  const position = summarizeMaterialInventory(material.id, movements.value);
  const delta = input.actualQuantityMilli - position.quantityMilli;
  const repeated = movementByOperationKey(movements.value, input.operationKey);
  if (repeated) return { ok: true, value: { material, movement: repeated }, reused: true };
  if (input.actualQuantityMilli < 0) return validationFailure("الكمية الفعلية لا يمكن أن تكون سالبة.");
  if (input.costKnown && (!Number.isInteger(input.valueMinor) || (input.valueMinor as number) < 0))
    return validationFailure("قيمة الرصيد المعروفة يجب أن تكون رقمًا غير سالب.");
  try {
    let movement: InventoryMovement | null = null;
    if (delta !== 0) {
      const costUnknown = !input.costKnown;
      if (delta > 0) {
        movement = createInventoryMovement({
          id: id(position.movementCount === 0 ? "opening-material" : "adjust-material"),
          materialId: material.id,
          type: position.movementCount === 0 ? "opening" : "adjustment",
          occurredOn: input.occurredOn,
          recordedAt: now(),
          quantityDeltaMilli: delta,
          valueDeltaMinor: costUnknown ? 0 : (input.valueMinor as number),
          note: input.note,
          reason: position.movementCount === 0 ? null : input.note,
          operationKey: input.operationKey,
          costKnowledge: costUnknown ? "unknown" : "known",
        });
      } else {
        const costUnknownPosition = positionCostKnowledge(movements.value, material.id) === "unknown";
        const value = consumptionValueMinor(Math.abs(delta), position, costUnknownPosition);
        movement = createInventoryMovement({
          id: id("adjust-material"),
          materialId: material.id,
          type: "adjustment",
          occurredOn: input.occurredOn,
          recordedAt: now(),
          quantityDeltaMilli: delta,
          valueDeltaMinor: -value || 0,
          note: input.note,
          reason: input.sourceNote?.trim() || input.note,
          operationKey: input.operationKey,
          costKnowledge: value === 0 ? "unknown" : "known",
        });
      }
    }
    const updated: Material = {
      ...material,
      opening: {
        quantityState: "confirmed",
        quantityMilli: input.actualQuantityMilli,
        costState: input.costKnown ? "known" : "unknown",
        valueMinor: input.costKnown ? (input.valueMinor as number) : null,
        confirmedOn: input.occurredOn,
        sourceNote: input.sourceNote?.trim() || null,
      },
    };
    assertInventoryRemainsNonNegative(
      material.id,
      movement ? [...movements.value, movement] : movements.value,
    );
    const saved = await store.commitInventory(updated, movement ? [movement] : []);
    return saved.ok ? { ok: true, value: { material: updated, movement } } : writeStorageFailure();
  } catch (error) {
    return validationFailure(errorMessageOf(error, "بيانات تأكيد الرصيد غير صالحة."));
  }
}
