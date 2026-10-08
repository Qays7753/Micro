/* Wave F شريحة ٣ (ADR-014 — تقسيم مسؤولية داخلي، 2026-10-04): مسارات خروج
 * الهدر — الهدر بخياره على النتيجة (عقد الإغلاق العميق — عقد ١: عند معرفة
 * التكلفة يُسجَّل حدث خسارة غير نقدية مرتبط بالحركة في معاملة ذرّية واحدة)
 * وإخراج المتبقي كاملًا (القرار ٢٠ — حركة هدر بكمية المتبقي وقيمته، لا حذفًا
 * ولا شطبًا) — انتقلا حرفيًا إلى هذا البيت الشقيق؛ الخدمة تفوّض هنا.
 * سياقات الهدر (طلب/مرجع عمل/قالب) تُتحقق قبل الكتابة كما كانت. */
import {
  assertInventoryRemainsNonNegative,
  consumptionValueMinor,
  createInventoryMovement,
  materialIsTracked,
  positionCostKnowledge,
  type InventoryMovement,
} from "@micro-domain/inventory-material/index.js";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";
import { errorMessageOf, validationFailure } from "@/application/resultCodes";
import type { Clock } from "@/application/time/clock";
import type { PrototypeLocalStore } from "@/storage/local/types";
import type { InventoryMaterialStore } from "@/storage/local/capabilities/inventoryMaterialStore";

/** R3 (R3-SC-07): عدسة الوحدة — الهدر بمصادره (طلب/مرجع/قالب). */
export type InventoryMaterialWasteStore = Pick<
  InventoryMaterialStore,
  "listMaterials" | "listInventoryMovements" | "commitInventory" | "commitInventoryWithEvents"
> &
  Pick<PrototypeLocalStore, "getOrder" | "getCatalogItem" | "getCatalogTemplate">;
import {
  id,
  materialById,
  movementByOperationKey,
  writeStorageFailure,
  type ExtractRemainderInput,
  type InventoryResult,
  type WasteMaterialInput,
} from "./inventoryMaterialModel";

export async function wasteMaterial(
  store: InventoryMaterialWasteStore,
  now: Clock,
  input: WasteMaterialInput,
): Promise<InventoryResult<InventoryMovement>> {
  return outbound(store, now, { ...input, type: "waste" });
}

/* القرار ٢٠ (عقد ١١ المعدَّل): فعل صريح «أخرِج المتبقي» يسجّل حركة هدر بكمية المتبقي
 * كاملة وقيمته كاملة — لا حذفًا ولا شطبًا. المخزون يبلغ صفرًا صادقًا والقيمة تظهر
 * حيث تنتمي: الهدر. والفعل عام — يخدم إخراج مادة تلفت كلها لا الفتات وحده. */
export async function extractRemainder(
  store: InventoryMaterialWasteStore,
  now: Clock,
  input: ExtractRemainderInput,
): Promise<InventoryResult<InventoryMovement>> {
  const [materials, movements] = await Promise.all([store.listMaterials(), store.listInventoryMovements()]);
  if (!materials.ok || !movements.ok) return writeStorageFailure();
  const repeated = movementByOperationKey(movements.value, input.operationKey);
  if (repeated) return { ok: true, value: repeated, reused: true };
  const material = materialById(materials.value, input.materialId);
  if (!material) return validationFailure("اختر مادة موجودة قبل إخراج الفاقد.");
  /* SA-5 (F2): الإخراج حركة هدر — المادة غير المتتبَّعة لا تُخرج رصيدًا. */
  if (!materialIsTracked(material))
    return validationFailure("المادة غير متتبَّعة — فعّل متابعتها أولًا قبل إخراج الفاقد.");
  try {
    const position = assertInventoryRemainsNonNegative(input.materialId, movements.value);
    if (position.quantityMilli <= 0) throw new Error("لا متبقي من هذه المادة لإخراجه.");
    /* المجموعة ٢ (عقد ٢٨): موضع نقي بتكلفة غير معروفة — الإخراج بقيمة صفر موسومة
     * «غير معروفة» لا برفض (كسابقة الاستهلاك). */
    const costUnknown =
      position.valueMinor <= 0 && positionCostKnowledge(movements.value, input.materialId) === "unknown";
    if (position.valueMinor <= 0 && !costUnknown) throw new Error("لا متبقي من هذه المادة لإخراجه.");
    const movement = createInventoryMovement({
      id: id("extract-waste"),
      materialId: input.materialId,
      type: "waste",
      occurredOn: input.occurredOn,
      recordedAt: now(),
      quantityDeltaMilli: -position.quantityMilli,
      valueDeltaMinor: -position.valueMinor,
      note: "إخراج الفاقد — كامل المتبقي بقيمته",
      reason: input.reason,
      operationKey: input.operationKey,
      wasteContext: { kind: "general_project" },
      costKnowledge: costUnknown ? "unknown" : "known",
    });
    const saved = await store.commitInventory(null, [movement]);
    return saved.ok ? { ok: true, value: movement } : writeStorageFailure();
  } catch (error) {
    return validationFailure(errorMessageOf(error, "بيانات إخراج الفاقد غير صالحة."));
  }
}

async function outbound(
  store: InventoryMaterialWasteStore,
  now: Clock,
  input: WasteMaterialInput & { type: "waste" },
): Promise<InventoryResult<InventoryMovement>> {
  const [materials, movements] = await Promise.all([store.listMaterials(), store.listInventoryMovements()]);
  if (!materials.ok || !movements.ok) return writeStorageFailure();
  const repeated = movementByOperationKey(movements.value, input.operationKey);
  if (repeated) return { ok: true, value: repeated, reused: true };
  const material = materialById(materials.value, input.materialId);
  if (!material) return validationFailure("اختر مادة موجودة قبل تسجيل الهدر.");
  /* المجموعة ٢ (عقد ٢٨): الهدر حركة تتبع — المادة غير المتتبَّعة لا تهدر رصيدًا. */
  if (!materialIsTracked(material))
    return validationFailure("المادة غير متتبَّعة — فعّل متابعتها أولًا قبل تسجيل الهدر.");
  const context = input.wasteContext ?? { kind: "general_project" as const };
  if (context.kind === "order") {
    const order = await store.getOrder(context.orderId);
    if (!order.ok) return writeStorageFailure();
    if (!order.value) return validationFailure("الطلب المرتبط بالهدر غير موجود محليًا.");
  }
  if (context.kind === "catalog_item") {
    const item = await store.getCatalogItem(context.catalogItemId);
    if (!item.ok) return writeStorageFailure();
    if (!item.value) return validationFailure("مرجع العمل المرتبط بالهدر غير موجود محليًا.");
  }
  if (context.kind === "catalog_template") {
    const [item, template] = await Promise.all([
      store.getCatalogItem(context.catalogItemId),
      store.getCatalogTemplate(context.templateId),
    ]);
    if (!item.ok || !template.ok) return writeStorageFailure();
    if (!item.value || !template.value || template.value.catalogItemId !== context.catalogItemId)
      return validationFailure("قالب الهدر غير موجود أو لا يتبع مرجع العمل المحدد.");
  }
  try {
    const position = assertInventoryRemainsNonNegative(input.materialId, movements.value);
    const costUnknown = positionCostKnowledge(movements.value, input.materialId) === "unknown";
    const value = consumptionValueMinor(input.quantityMilli, position, costUnknown);
    /* عقد الإغلاق العميق (العقد ١ — الهدر): خيار المالك يُحفظ داخل الحركة —
     * نعم: عند معرفة التكلفة يُسجّل حدث خسارة غير نقدية مرتبط بمفتاح مشتق
     * من مفتاح الحركة نفسها (معًا في معاملة ذرّية واحدة)؛ التكلفة غير
     * المعروفة تبقى «غير محدد بعد» فلا يمس الرقم النتيجة حتى تُحدَّد. */
    const profitImpact = input.profitImpact ?? false;
    const movement = createInventoryMovement({
      id: id("waste"),
      materialId: input.materialId,
      type: input.type,
      occurredOn: input.occurredOn,
      recordedAt: now(),
      quantityDeltaMilli: -input.quantityMilli,
      valueDeltaMinor: -value || 0,
      note: input.note,
      reason: input.reason,
      operationKey: input.operationKey,
      wasteContext: input.wasteContext ?? { kind: "general_project" },
      costKnowledge: value === 0 ? "unknown" : "known",
      wasteProfitImpact: profitImpact,
    });
    if (profitImpact && value > 0) {
      const lossEvent = createFinancialEvent({
        id: id("waste-loss"),
        type: "loss_non_cash",
        amountMinor: value,
        occurredOn: input.occurredOn,
        recordedAt: now(),
        idempotencyKey: `${input.operationKey}:loss`,
        note: `خسارة هدر بلا خروج نقد — ${input.reason.trim()}`,
        counterparty: null,
      });
      const saved = await store.commitInventoryWithEvents(null, [movement], [lossEvent]);
      return saved.ok
        ? { ok: true, value: saved.value.movements[0] ?? movement, reused: saved.value.reused }
        : writeStorageFailure();
    }
    const saved = await store.commitInventory(null, [movement]);
    return saved.ok ? { ok: true, value: movement } : writeStorageFailure();
  } catch (error) {
    return validationFailure(errorMessageOf(error, "بيانات هدر المادة غير صالحة."));
  }
}
