/* MIC-8 (المجموعة ٢ — عقد ٢٨): سلامة المخزون والمواد — انتقلت حرفيًا من
 * integrityCheckService.ts في Wave F (ADR-013 — تقسيم مسؤولية داخلي)؛ الفحص
 * قراءة فقط عبر السياق المشترك ولا يكتب ولا يصلح شيئًا تلقائيًا أبدًا.
 *
 * FAIL = انكسار بنيوي (مراجع معلقة، طيّ سالب، تكرار مفاتيح، كسر قاعدة
 * القيمة-الصفرية ⟺ غير-معروفة). WARN = حالة مراجعة مشروعة (نقص مفتوح،
 * رصيد بداية غير مؤكد صراحةً). الإرث بلا وسم المتابعة أو بلا حقل معرفة
 * البداية = متتبَّع/معروف (لا إنذارات كاذبة على المواد القديمة). */
import type { InventoryMovement } from "@micro-domain/inventory-material/index.js";
import {
  fail,
  INTEGRITY_TITLES,
  unavailable,
  type IntegrityCheckContext,
  type IntegrityCheckResult,
} from "./integrityCheckModel";

export async function checkInventoryStructure(ctx: IntegrityCheckContext): Promise<IntegrityCheckResult> {
  const [materialsResult, movementsResult, shortagesResult, purchasesResult, ordersResult] =
    await Promise.all([
      ctx.store.listMaterials(),
      ctx.store.listInventoryMovements(),
      ctx.store.listInventoryShortages(),
      ctx.store.listSupplierPurchases(),
      ctx.store.listOrders(),
    ]);
  if (
    !materialsResult.ok ||
    !movementsResult.ok ||
    !shortagesResult.ok ||
    !purchasesResult.ok ||
    !ordersResult.ok
  )
    return unavailable("MIC-8", "تعذر قراءة سجل المخزون والمواد — أعد المحاولة.");
  const materials = materialsResult.value;
  const movements = movementsResult.value;
  const shortages = shortagesResult.value;
  const materialIds = new Set(materials.map(material => material.id));
  const purchaseIds = new Set(purchasesResult.value.map(purchase => purchase.id));
  const orderIds = new Set(ordersResult.value.map(stored => stored.id));
  const structuralOffenders: string[] = [];
  const reversedTargets = new Set<string>();
  const operationKeys = new Set<string>();
  const structural = (movement: InventoryMovement) => {
    if (!materialIds.has(movement.materialId)) {
      structuralOffenders.push(`حركة-بلا-مادة:${movement.id}`);
      return;
    }
    if (movement.purchaseId !== null && !purchaseIds.has(movement.purchaseId))
      structuralOffenders.push(`استلام-بلا-شراء:${movement.id}`);
    if (movement.orderId !== null && !orderIds.has(movement.orderId))
      structuralOffenders.push(`حركة-بلا-طلب:${movement.id}`);
    /* القيمة الصفرية ⇐ تكلفة غير معروفة — ولا وسم غير معروفة على قيمة معلنة. */
    const costKnowledge = movement.costKnowledge ?? "known";
    if (movement.valueDeltaMinor === 0 && costKnowledge !== "unknown")
      structuralOffenders.push(`قيمة-صفرية-بلا-وسم:${movement.id}`);
    if (movement.valueDeltaMinor !== 0 && costKnowledge === "unknown")
      structuralOffenders.push(`وسم-غير-معروفة-بقيمة:${movement.id}`);
    if (movement.type === "reversal") {
      const target = movement.reversesMovementId ?? "";
      if (target === "" || !movements.some(candidate => candidate.id === target))
        structuralOffenders.push(`تراجع-بلا-أصل:${movement.id}`);
      if (reversedTargets.has(target)) structuralOffenders.push(`تراجع-مزدوج:${target}`);
      reversedTargets.add(target);
    }
  };
  for (const movement of movements) {
    structural(movement);
    if (operationKeys.has(movement.operationKey))
      structuralOffenders.push(`مفتاح-مكرر:${movement.operationKey}`);
    operationKeys.add(movement.operationKey);
  }
  const openShortages = shortages.filter(shortage => shortage.status === "open");
  for (const shortage of shortages) {
    if (!materialIds.has(shortage.materialId)) {
      structuralOffenders.push(`نقص-بلا-مادة:${shortage.id}`);
      continue;
    }
    /* SA-5 (F11): مرجع طلب النقص موصول — إن وُجد. */
    if (shortage.orderId !== null && !orderIds.has(shortage.orderId))
      structuralOffenders.push(`نقص-بلا-طلب:${shortage.id}`);
    if (operationKeys.has(shortage.operationKey))
      structuralOffenders.push(`مفتاح-نقص-مكرر:${shortage.operationKey}`);
    operationKeys.add(shortage.operationKey);
  }
  /* طيّ غير سالب لكل مادة — نتيجة الكتابة المحروسة، كاشنة هنا فقط. */
  for (const material of materials) {
    const selected = movements.filter(movement => movement.materialId === material.id);
    const quantityMilli = selected.reduce((sum, movement) => sum + movement.quantityDeltaMilli, 0);
    const valueMinor = selected.reduce((sum, movement) => sum + movement.valueDeltaMinor, 0);
    if (quantityMilli < 0 || valueMinor < 0) structuralOffenders.push(`طيّ-سالب:${material.id}`);
  }
  if (structuralOffenders.length > 0)
    return fail(
      "MIC-8",
      `بنية المخزون مكسورة في ${structuralOffenders.length} موضعًا — راجع المواد والحركات قبل أي تصحيح.`,
      structuralOffenders,
      null,
      "/inventory",
    );
  if (openShortages.length > 0) {
    const sample = openShortages[0]!;
    const sampleMaterial = materials.find(material => material.id === sample.materialId);
    return {
      id: "MIC-8",
      titleAr: INTEGRITY_TITLES["MIC-8"],
      status: "WARN",
      detailAr: `نقص مخزون مفتوح: ${openShortages.length} سجلًا — أقربها «${sampleMaterial?.name ?? sample.materialId}» بتاريخ ${sample.occurredOn}. سجلات النقص تُحلّ صراحةً عند وصول البديل، ولا تُغلق تلقائيًا.`,
      offenderCount: openShortages.length,
      deepLink: "/inventory",
    };
  }
  const unconfirmedOpening = materials.filter(material => material.opening?.quantityState === "unconfirmed");
  if (unconfirmedOpening.length > 0)
    return {
      id: "MIC-8",
      titleAr: INTEGRITY_TITLES["MIC-8"],
      status: "WARN",
      detailAr: `مواد متتبَّعة برصيد بداية غير مؤكد: ${unconfirmedOpening.length} — أرصدتها معروضة «غير محدد بعد» حتى تؤكدها؛ ليست صفرًا ولا خطأً.`,
      offenderCount: unconfirmedOpening.length,
      deepLink: "/inventory",
    };
  return {
    id: "MIC-8",
    titleAr: INTEGRITY_TITLES["MIC-8"],
    status: "PASS",
    detailAr: "بنية المخزون والمواد سليمة: المراجع موصولة، والطيّ غير سالب، ولا نقص مفتوح.",
  };
}
