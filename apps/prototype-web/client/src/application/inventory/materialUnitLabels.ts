import type { MaterialUnit } from "@micro-domain/inventory-material/index.js";

/* R10-B3/R10B-NF-002 (2026-10-12): التسمية العربية لمعرّف وحدة المادة —
 * ملكية واحدة لبيت المخزون التطبيقي. كانت الخريطة معاد تنفيذها ٦ مرات
 * (+٢ جزئية): المقترحات (materialSuggestions)، ومراجعة التسليم
 * (deliveryReviewService)، و٤ صفحات (InventoryMovementEditor وCatalog
 * وMaterialEditor وInventoryMaterials) — بلا مالك، فتنحرف النسخ بصمت.
 * المفردات نفسها مملوكة للمجال (materialUnits) والعرض العربي هنا؛ وحدة
 * جديدة تُلمس هنا وحدها.
 *
 * عقد الوحدة: نص عرض مشتق فقط — لا تخزين ولا React ولا قاعدة عمل ولا
 * حساب مال. المستهلك التطبيقي يستورد هذا الملف مباشرة (النمط الداخلي
 * القائم)؛ مستهلكو الواجهة عبر باب المخزون `@/application/inventory`
 * (STR-615/R6 — لا استيراد عميقًا من الواجهة). */
const MATERIAL_UNIT_LABELS: Record<MaterialUnit, string> = {
  piece: "قطعة",
  meter: "متر",
  kilogram: "كيلوغرام",
  liter: "لتر",
  other: "وحدة أخرى",
};
export function materialUnitLabel(unit: MaterialUnit): string {
  return MATERIAL_UNIT_LABELS[unit];
}
