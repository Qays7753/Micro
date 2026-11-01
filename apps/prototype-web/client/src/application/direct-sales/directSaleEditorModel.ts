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

/* S11-MR-001 (UNIT-005 A2/س2 + B3-F02): وضع الدفع الصريح عند الإنشاء —
 * «الكامل ظاهر مقترح؛ الجزء يكشف المبلغ، والدين صريح من الخيار فيجهز
 * تعريفه دون سؤال فرق ثانٍ». الوضع نية مالك صريحة لا قيمة مالية: القيمة
 * المالية تُشتق عند الحفظ من الوضع والمدخلات، ولا يُفسَّر فراغ أبدًا صفرًا. */
export type PaymentMode = "full" | "partial" | "none";

export function isPaymentMode(value: unknown): value is PaymentMode {
  return value === "full" || value === "partial" || value === "none";
}

/** المقبوض الفعّال من الوضع: كامل = الإجمالي، جزء = المُدخل، لا قبض = صفر
 * صريح باختيار المالك («لم أستلم») — لا نص غير صالح يمر من هنا أبدًا. */
export function resolveCollectedForMode(
  mode: PaymentMode,
  revenueMinor: number,
  partialCollectedMinor: number,
): number {
  if (mode === "full") return revenueMinor;
  if (mode === "none") return 0;
  return partialCollectedMinor;
}

/** قرار الفرق الفعّال: الكامل بلا فرق أصلًا؛ والدين معنى الوضع الصريح ما لم
 * يختر المالك حالة مختلفة (تخفيض/مراجعة) — لا سؤال دين ثانٍ بعد اختياره. */
export function effectiveDifferenceChoice(
  mode: PaymentMode,
  differenceChoice: DifferenceChoice | null,
): DifferenceChoice | null {
  if (mode === "full") return null;
  return differenceChoice ?? "remaining_debt";
}

/** هجرة مسودة ما قبل الأوضاع (شكل collectedEmpty القديم) إلى وضع الدفع —
 * المسودة القديمة لم تمر باتفاق الوضع الصريح، ففرقها الموجب «غير محسوم»
 * ولا يُمنح معنى دين بصمت: يظل قراره معلقًا حتى يختاره المالك بنفسه. */
export type PaymentModeMigration = {
  mode: PaymentMode;
  undecidedDifference: boolean;
};

export function paymentModeFromDraft(saved: Record<string, unknown>): PaymentModeMigration {
  if (isPaymentMode(saved.paymentMode))
    return { mode: saved.paymentMode, undecidedDifference: saved.differenceUndecided === true };
  const collectedEmpty = saved.collectedEmpty !== false;
  if (collectedEmpty) return { mode: "full", undecidedDifference: false };
  const collectedMinor = Number(saved.collectedMinor);
  const revenueMinor = Number(saved.revenueMinor);
  if (!Number.isFinite(collectedMinor)) return { mode: "full", undecidedDifference: false };
  if (collectedMinor <= 0)
    return {
      mode: Number.isFinite(revenueMinor) && revenueMinor > 0 ? "none" : "full",
      undecidedDifference: Number.isFinite(revenueMinor) && revenueMinor > 0,
    };
  if (Number.isFinite(revenueMinor) && collectedMinor >= revenueMinor)
    return { mode: "full", undecidedDifference: false };
  return { mode: "partial", undecidedDifference: true };
}

/** معامل سياق السجل ?product=<id> — يصل من «سجّل بيع هذا المنتج» في الكتالوج. */
export function productParamFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get("product");
  return value && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null;
}

/** بوابة التحقق قبل الإرسال — نفس شروط الصفحة حرفيًا؛ null = صالح للإرسال. */
export type DirectSaleSubmissionProblem =
  | "missing_required_fields"
  | "collected_exceeds_price"
  | "partial_amount_required"
  | "partial_amount_equals_total"
  | "difference_choice_required";

export type DirectSaleSubmissionInput = {
  note: string;
  validQuantity: boolean;
  quantity: number;
  validRevenue: boolean;
  revenueMinor: number;
  /* S11-MR-001: وضع الدفع الصريح يوجه فحص المقبوض — فحص المبلغ يخص الوضع
   * الجزئي وحده (نص وضع آخر لا يمنع حفظًا صحيحًا)، والفراغ في الجزء رفض
   * لا تفسير مالي. */
  paymentMode: PaymentMode;
  validCollected: boolean;
  collectedEmpty: boolean;
  partialCollectedMinor: number;
  costKnown: boolean;
  validCost: boolean;
  costMinor: number;
  /* الفرق معاملًا (يحسبه المستدعي من السعر والمقبوض الفعّال — مرآة F-049
   * المجمدة تبقى عند الصفحة): الوحدة تصنّف القرار ولا تحسب المال. */
  difference: number;
  differenceChoice: DifferenceChoice | null;
  /* مسودة قديمة الاستعادة بفرق غير محسوم — قرار المعنى مطلوب قبل الحفظ. */
  undecidedDifference: boolean;
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
    (input.costKnown && (!input.validCost || input.costMinor < 0))
  ) {
    return "missing_required_fields";
  }
  /* S11-MR-001 (B3-F03 «عند الجزء؛ >0 وأقل من الإجمالي»): مبلغ الجزء صريح
   * موجب دون الإجمالي — الفراغ/الصفر رفض (ليس قبضًا كاملًا ولا صفرًا)،
   * والمساواة بالإجمالي إشارة إلى وضع الكامل لا خطأ قبض. */
  if (input.paymentMode === "partial") {
    if (
      !input.validCollected ||
      input.collectedEmpty ||
      !Number.isInteger(input.partialCollectedMinor) ||
      input.partialCollectedMinor <= 0
    ) {
      return "partial_amount_required";
    }
    if (input.partialCollectedMinor > input.revenueMinor) return "collected_exceeds_price";
    if (input.partialCollectedMinor === input.revenueMinor) return "partial_amount_equals_total";
  }
  /* X-06 كما كان لمسودة قديمة مستعادة: فرقها لم يُحسم باتفاق صريح — النظام
   * ينبّه ولا يقرّر؛ قرار المعنى شرط الحفظ (الأوضاع الجديدة دينُها صريح
   * من اختيار الدفع فلا يُسأل عنه ثانيةً). */
  if (input.undecidedDifference && input.difference > 0 && input.differenceChoice === null) {
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

/* S11-MR-001 (UNIT-005 A2/س8 — «معاينة قصيرة ملاصقة للحفظ»): أجزاء المعاينة
 * من النية الفعّالة الصحيحة نفسها التي سيُحفظ بها الأمر — لا نص متقادم ولا
 * رقم من مدخل غير صالح؛ الصفحة تنسق الأرقام، والقرار هنا. */
export type DirectSalePreviewParts =
  | { kind: "unavailable" }
  | { kind: "full"; saleMinor: number }
  | { kind: "debt"; saleMinor: number; collectedMinor: number; debtMinor: number; none: boolean }
  | { kind: "review"; saleMinor: number; collectedMinor: number; pendingMinor: number; none: boolean }
  | { kind: "price_cut"; effectiveSaleMinor: number };

export function directSalePreviewParts(input: {
  valid: boolean;
  paymentMode: PaymentMode;
  revenueMinor: number;
  resolvedCollectedMinor: number;
  difference: number;
  effectiveChoice: DifferenceChoice | null;
}): DirectSalePreviewParts {
  if (!input.valid || input.revenueMinor <= 0) return { kind: "unavailable" };
  if (input.difference > 0 && input.effectiveChoice === "price_cut")
    return { kind: "price_cut", effectiveSaleMinor: input.resolvedCollectedMinor };
  if (input.difference > 0 && input.effectiveChoice === "needs_review")
    return {
      kind: "review",
      saleMinor: input.revenueMinor,
      collectedMinor: input.resolvedCollectedMinor,
      pendingMinor: input.difference,
      none: input.resolvedCollectedMinor === 0,
    };
  if (input.difference > 0)
    return {
      kind: "debt",
      saleMinor: input.revenueMinor,
      collectedMinor: input.resolvedCollectedMinor,
      debtMinor: input.difference,
      none: input.resolvedCollectedMinor === 0,
    };
  if (input.paymentMode === "none") return { kind: "full", saleMinor: 0 };
  return { kind: "full", saleMinor: input.revenueMinor };
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
  /* S11-MR-001: الوضع الفعّال للسجل القائم يُشتق من محفوظه — لا افتراض
   * إنشائي («الكامل») على سجل قائم (تعديل فوق الحقيقة المحفوظة). */
  paymentMode: PaymentMode;
  collectedEmpty: boolean;
  collectedMinor: number;
  costKnown: boolean;
  costMinor: number;
  customerName: string;
  /* S05 (DOC-014 / UNIT-037): رابط الطرف المحفوظ المختار وقرار حفظه —
   * يُسترجعان مع المسودة كما كانا (عقد B3: الاستعادة تعيد اختيارها وموافقة
   * حفظها)، ويُثبّتان على المصدر عند الحفظ. */
  customerPartyId: string;
  saveForReuse: boolean;
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
    /* S11-MR-001: وضع السجل من محفوظه — كامل/جزء/لم يُقبض؛ الحفظ يمر
     * بالوضع نفسه فلا يُطبَّق افتراض الإنشاء على سجل قائم. */
    paymentMode:
      sale.collectedMinor === sale.revenueMinor ? "full" : sale.collectedMinor === 0 ? "none" : "partial",
    collectedEmpty: sale.collectedMinor === sale.revenueMinor,
    collectedMinor: sale.collectedMinor,
    costKnown: sale.costMinor !== null,
    costMinor: sale.costMinor ?? 0,
    customerName: sale.customerName ?? "",
    customerPartyId: sale.customerPartyId ?? "",
    saveForReuse: false,
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
