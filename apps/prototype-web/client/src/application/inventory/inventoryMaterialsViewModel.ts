/**
 * R7 / R6-F17-P09 (WS-216 — 2026-10-10): سطح استعلام صفحة مواد المخزون —
 * القراءة الرباعية للصفحة (الرصيد/الحركات/النقص/حالة التفعيل) خلف سطح
 * تطبيقي مالك في بيت المخزون. كان هذا المنطق داخل pages/InventoryMaterials.tsx؛
 * الصفحة تبقي ربط React وقنوات التفعيل/الإخراج/الإيقاف/إعادة المتابعة/حل
 * النقص ونسخ الواجهة. حراس low-stock/adjustment/purchishing محفوظون —
 * نفس مجموعة القراءات وترتيبها وفشلها الجماعي الصادق.
 *
 * عقد هذه الوحدة: قراءات فقط عبر الخدمة الكنسية (inventoryMaterialService)؛
 * لا تخزين مباشر ولا React ولا حساب مال.
 */

import type { InventoryMaterialService } from "./inventoryMaterialService";
import type { InventoryOverview } from "./inventoryMaterialModel";
import type { InventoryActivationState } from "./inventoryMaterialModel";
import type { InventoryMovement, InventoryShortage } from "@micro-domain/inventory-material/index.js";

/** حالة صفحة المواد — الفصل الصادق: فشل أي قراءة من الأربع يوجّه للخطأ
 *  الصادق مع إعادة المحاولة (نمط الصفحة الأصلي حرفيًا). */
export type InventoryMaterialsState =
  | { phase: "loading" }
  | { phase: "error" }
  | {
      phase: "ready";
      overview: InventoryOverview;
      movements: readonly InventoryMovement[];
      shortages: readonly InventoryShortage[];
      activation: InventoryActivationState;
    };

/** القراءة الرباعية للصفحة — نفس الوعد الأصلي: Promise.all واحد فوق
 *  overview/movements/shortages/activation؛ نجاحها معًا أو خطأ صادق واحد. */
export async function readInventoryMaterialsPage(deps: {
  inventory: InventoryMaterialService;
}): Promise<InventoryMaterialsState> {
  const [overview, movements, shortages, activation] = await Promise.all([
    deps.inventory.overview(),
    deps.inventory.movements(),
    deps.inventory.shortages(),
    deps.inventory.readActivation(),
  ]);
  if (!overview.ok || !movements.ok || !shortages.ok || !activation.ok) {
    return { phase: "error" };
  }
  return {
    phase: "ready",
    overview: overview.value,
    movements: movements.value,
    shortages: shortages.value,
    activation: activation.value,
  };
}
