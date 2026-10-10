/**
 * R7 / R6-F17-P07 (WS-216 — 2026-10-10): نموذج عرض محرر البيع المباشر —
 * القرار النقي للمحرر (بوابة التحقق، اشتقاق قرار الفرق X-06، تعيين مرجع
 * المنتج من الوصلة العميقة، وتحويل السجل المحمّل إلى قيم النموذج) خلف سطح
 * تطبيقي مالك. كان هذا المنطق داخل pages/DirectSaleEditor.tsx؛ الانتقال هنا
 * يبقي الصفحة ربط React ونسخ الواجهة وقنوات الخدمات فقط.
 *
 * عقد هذه الوحدة:
 *  - لا تخزين ولا React ولا خدمة تُنشأ هنا: مدخلات قيم صرفة ومخرجات قرارات/قيم.
 *  - لا حساب مال: الفرق (revenueMinor - collected) يُستقبل معاملًا محسوبًا
 *    عند صفحته (مرآة F-049 المجمدة تبقى في مكانها) — الوحدة تصنّف وتقرر فقط.
 *  - الأكواد لا النصوص: مرجع القرار (problem codes) — النص العربي نسخة
 *    واجهة تبقى عند الصفحة (لا تُنقل ولا تُنسخ).
 *  - EXE-010 (عكس تحصيل البيع) لا يمر هنا إطلاقًا: مساره في مكوّن القسم
 *    وخدماته كما هو.
 */

import type { CatalogItem } from "@micro-domain/catalog/index.js";
import type { DirectSale, DirectSaleCollectionStatus } from "@micro-domain/direct-sale/index.js";

/** X-06 (و٤): خيار صاحب القرار في فرق القبض عن السعر — النظام ينبّه ولا يقرّر. */
export type DifferenceChoice = "price_cut" | "remaining_debt" | "needs_review";

/** معامل سياق السجل ?product=<id> — يصل من «سجّل بيع هذا المنتج» في الكتالوج. */
export function productParamFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get("product");
  return value && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null;
}

/** بوابة التحقق قبل الإرسال — نفس شروط الصفحة حرفيًا؛ null = صالح للإرسال. */
export type DirectSaleSubmissionProblem =
  "missing_required_fields" | "collected_exceeds_price" | "difference_choice_required";

export type DirectSaleSubmissionInput = {
  note: string;
  validQuantity: boolean;
  quantity: number;
  validRevenue: boolean;
  revenueMinor: number;
  validCollected: boolean;
  resolvedCollected: number;
  costKnown: boolean;
  validCost: boolean;
  costMinor: number;
  /* الفرق معاملًا (يحسبه المستدعي من السعر والمقبوض — مرآة F-049 المجمدة
   * تبقى عند الصفحة): الوحدة تصنّف القرار ولا تحسب المال. */
  difference: number;
  differenceChoice: DifferenceChoice | null;
};

export function validateDirectSaleSubmission(
  input: DirectSaleSubmissionInput,
): DirectSaleSubmissionProblem | null {
  if (
    !input.note.trim() ||
    !input.validQuantity ||
    !Number.isInteger(input.quantity) ||
    input.quantity < 1 ||
    !input.validRevenue ||
    input.revenueMinor <= 0 ||
    !input.validCollected ||
    !Number.isInteger(input.resolvedCollected) ||
    input.resolvedCollected < 0 ||
    (input.costKnown && (!input.validCost || input.costMinor < 0))
  ) {
    return "missing_required_fields";
  }
  if (input.resolvedCollected > input.revenueMinor) {
    return "collected_exceeds_price";
  }
  /* X-06: النظام ينبّه ولا يقرّر — الفرق يوقف الحفظ ويعرض الخيارات الثلاثة. */
  if (input.difference > 0 && input.differenceChoice === null) {
    return "difference_choice_required";
  }
  return null;
}

/** نتيجة قرار الفرق X-06: حالة التحصيل + هل هو «خفّضتُ السعر» الموثق. */
export type DifferenceOutcome = {
  collectionStatus: DirectSaleCollectionStatus;
  priceCut: boolean;
};

export function resolveDifferenceOutcome(
  difference: number,
  differenceChoice: DifferenceChoice | null,
): DifferenceOutcome {
  const priceCut = difference > 0 && differenceChoice === "price_cut";
  const collectionStatus =
    difference > 0
      ? differenceChoice === "remaining_debt"
        ? "partial_debt"
        : differenceChoice === "needs_review"
          ? "partial_needs_review"
          : "collected_in_full"
      : "collected_in_full";
  return { collectionStatus, priceCut };
}

/** تعيين المرجع المقترح من ?product= مرة واحدة عند الإنشاء — قرار الصفحة
 *  يصبح قيمة: أي حقل يُقترح وبأي إشعار، بلا أي setState هنا. */
export type ProductParamCurrent = {
  editing: boolean;
  alreadyApplied: boolean;
  itemName: string;
  revenueMinor: number;
  quantity: number;
  costKnown: boolean;
};

export type ProductParamProposal =
  | { kind: "none" }
  | { kind: "unavailable" }
  | { kind: "inactive_reference" }
  | {
      kind: "apply";
      catalogItemId: string;
      itemName: string | null;
      revenueMinor: number | null;
      cost: { known: true; minor: number } | null;
      suggestedReferenceId: string;
    };

export function proposeProductParam(
  items: readonly CatalogItem[],
  search: string,
  current: ProductParamCurrent,
): ProductParamProposal {
  /* الوصلة العميقة تُطبق مرة واحدة عند الإنشاء — المرجع الموقوف لا يُعبّأ
   * (إشعار صادق)، والمحذوف يُهمل بهدوء؛ كلاهما يستهلك الطلب مرة واحدة
   * (unavailable/inactive تعلّمان الطلب منفّذًا كالأصل — لا إشعار متكرر). */
  const requestedProduct =
    !current.editing && !current.alreadyApplied ? productParamFromSearch(search) : null;
  if (!requestedProduct) return { kind: "none" };
  const selected = items.find(item => item.id === requestedProduct) ?? null;
  if (!selected) return { kind: "unavailable" };
  if (!selected.active) return { kind: "inactive_reference" };
  return {
    kind: "apply",
    catalogItemId: selected.id,
    /* التعبئة المقترحة لا تدوس على ما كتبه المستخدم: الاسم فقط إن كان الحقل
     * فارغًا أو مطابقًا لاسم مرجع آخر، والسعر/التكلفة فقط عند قيمها البداية. */
    itemName:
      !current.itemName.trim() || items.some(reference => reference.name === current.itemName.trim())
        ? selected.name
        : null,
    revenueMinor:
      selected.defaultPriceMinor != null && current.revenueMinor === 0 && current.quantity === 1
        ? selected.defaultPriceMinor
        : null,
    cost:
      selected.defaultUnitCostMinor != null && current.quantity === 1 && !current.costKnown
        ? { known: true, minor: selected.defaultUnitCostMinor }
        : null,
    suggestedReferenceId: selected.id,
  };
}

/** تحويل السجل المحمّل إلى قيم نموذج التحرير — نفس خريطة الصفحة حرفيًا؛
 *  الصفحة تطبق القيم على حالتها (بما فيها قرار الفرق من حالة التحصيل). */
export type DirectSaleFormValues = {
  itemName: string;
  quantity: number;
  revenueMinor: number;
  collectedEmpty: boolean;
  collectedMinor: number;
  costKnown: boolean;
  costMinor: number;
  customerName: string;
  catalogItemId: string;
  occurredOn: string;
  note: string;
  differenceChoice: DifferenceChoice | null;
};

export function directSaleToFormValues(sale: DirectSale): DirectSaleFormValues {
  return {
    itemName: sale.itemName,
    quantity: sale.quantity,
    revenueMinor: sale.revenueMinor,
    /* المقبوض المحفوظ يساوي السعر = قبض كامل (الحقلة الفارغة تعني السعر). */
    collectedEmpty: sale.collectedMinor === sale.revenueMinor,
    collectedMinor: sale.collectedMinor,
    costKnown: sale.costMinor !== null,
    costMinor: sale.costMinor ?? 0,
    customerName: sale.customerName ?? "",
    catalogItemId: sale.catalogItemId ?? "",
    occurredOn: sale.occurredOn,
    note: sale.note,
    differenceChoice:
      sale.collectionStatus === "partial_debt"
        ? "remaining_debt"
        : sale.collectionStatus === "partial_needs_review"
          ? "needs_review"
          : null,
  };
}
