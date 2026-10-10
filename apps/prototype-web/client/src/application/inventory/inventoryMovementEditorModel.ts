/**
 * R7 / R6-F17-P08 (WS-216 — 2026-10-10): نموذج عرض محرر حركة المخزون —
 * القرار النقي للمحرر (تحليل روابط الوصلة العميقة للطلب/البيع/الشراء/
 * المادة، بوابة التحقيل المطابقة لنوع الحركة، واشتقاق سياق الهدر) خلف
 * سطح تطبيقي مالك في بيت المخزون. كان هذا المنطق داخل
 * pages/InventoryMovementEditor.tsx؛ الصفحة تبقي ربط React ونسخ الواجهة
 * وقنوات الخدمات. سلوك InventoryAdjustExe012 وOps001 محفوظ حرفيًا —
 * نفس شروط القرار التي كانت الصفحة تنفذها.
 *
 * عقد هذه الوحدة: لا تخزين ولا React ولا حساب مال — أكواد قرارات وقيم
 * تمر كما هي؛ النصوص العربية نسخة واجهة تبقى عند الصفحة.
 */

const ID_SHAPE = /^[A-Za-z0-9_-]{1,64}$/;

/** المجموعة ١/٢/٣: روابط الوصلة العميقة — تحفظ سياق المصدر الأصلي
 *  (الطلب، البيع المباشر، جسر الاستلام من الشراء، والمادة الصريحة). */
export type MovementLinkParams = {
  linkedOrderId: string | null;
  linkedSaleId: string | null;
  linkedPurchaseId: string | null;
  linkedMaterialId: string | null;
};

export function parseMovementLinkParams(search: string | null): MovementLinkParams {
  const query = new URLSearchParams(search ?? "");
  const shape = (value: string | null) => (value && ID_SHAPE.test(value) ? value : null);
  return {
    linkedOrderId: shape(query.get("order")),
    linkedSaleId: shape(query.get("sale")),
    linkedPurchaseId: shape(query.get("purchase")),
    linkedMaterialId: shape(query.get("material")),
  };
}

/** بوابة التحقق المطابقة لنوع الحركة — أكواد بالترتيب نفسه؛ النص عند الصفحة. */
export type MovementSubmissionProblem =
  | "missing_fields"
  | "receipt_needs_purchase"
  | "consume_needs_order"
  | "consume_needs_sale"
  | "consume_project_needs_note"
  | "movement_needs_reason"
  | "waste_needs_order"
  | "waste_needs_catalog_item"
  | "waste_needs_template";

export type MovementSubmissionInput = {
  safeType: "receipt" | "consume" | "waste" | "adjust" | null;
  referencesLoaded: boolean;
  materialId: string;
  quantityValid: boolean;
  quantityMilli: number;
  note: string;
  valueValid: boolean;
  purchaseId: string;
  costKnown: boolean;
  valueMinor: number;
  consumeTarget: "order" | "sale" | "project";
  orderId: string;
  saleId: string;
  reason: string;
  wasteContextKind: "order" | "catalog_item" | "catalog_template" | "unallocated" | "general_project";
  wasteOrderId: string;
  wasteCatalogItemId: string;
  wasteTemplateId: string;
};

export function validateMovementSubmission(input: MovementSubmissionInput): MovementSubmissionProblem | null {
  if (
    !input.safeType ||
    !input.referencesLoaded ||
    !input.materialId ||
    !input.quantityValid ||
    input.quantityMilli <= 0 ||
    !input.note.trim() ||
    !input.valueValid
  ) {
    return "missing_fields";
  }
  if (input.safeType === "receipt" && (!input.purchaseId || (input.costKnown && input.valueMinor <= 0))) {
    return "receipt_needs_purchase";
  }
  if (input.safeType === "consume" && input.consumeTarget === "order" && !input.orderId) {
    return "consume_needs_order";
  }
  if (input.safeType === "consume" && input.consumeTarget === "sale" && !input.saleId) {
    return "consume_needs_sale";
  }
  if (input.safeType === "consume" && input.consumeTarget === "project" && !input.note.trim()) {
    return "consume_project_needs_note";
  }
  if ((input.safeType === "waste" || input.safeType === "adjust") && !input.reason.trim()) {
    return "movement_needs_reason";
  }
  if (input.safeType === "waste" && input.wasteContextKind === "order" && !input.wasteOrderId) {
    return "waste_needs_order";
  }
  if (input.safeType === "waste" && input.wasteContextKind === "catalog_item" && !input.wasteCatalogItemId) {
    return "waste_needs_catalog_item";
  }
  if (
    input.safeType === "waste" &&
    input.wasteContextKind === "catalog_template" &&
    (!input.wasteCatalogItemId || !input.wasteTemplateId)
  ) {
    return "waste_needs_template";
  }
  return null;
}

/** سياق الهدر كما يُرسل مع الحركة — نفس اشتقاق الصفحة حرفيًا (العائلة
 *  الخمس الكاملة: طلب/مرجع عمل/قالب/غير موزَّع بملاحظته/مشروع عام). */
export type WasteContext =
  | { kind: "order"; orderId: string }
  | { kind: "catalog_item"; catalogItemId: string }
  | { kind: "catalog_template"; catalogItemId: string; templateId: string }
  | { kind: "unallocated"; allocationNote: string | null }
  | { kind: "general_project" };

export function deriveWasteContext(input: {
  wasteContextKind: "order" | "catalog_item" | "catalog_template" | "unallocated" | "general_project";
  wasteOrderId: string;
  wasteCatalogItemId: string;
  wasteTemplateId: string;
  wasteAllocationNote: string;
}): WasteContext {
  switch (input.wasteContextKind) {
    case "order":
      return { kind: "order", orderId: input.wasteOrderId };
    case "catalog_item":
      return { kind: "catalog_item", catalogItemId: input.wasteCatalogItemId };
    case "catalog_template":
      return {
        kind: "catalog_template",
        catalogItemId: input.wasteCatalogItemId,
        templateId: input.wasteTemplateId,
      };
    case "unallocated":
      return { kind: "unallocated", allocationNote: input.wasteAllocationNote.trim() || null };
    default:
      return { kind: "general_project" };
  }
}
