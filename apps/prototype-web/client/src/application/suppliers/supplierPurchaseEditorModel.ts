/**
 * R7 / R6-F17-P04 (WS-216 — 2026-10-10): نموذج عرض محرر شراء المورّد —
 * القرار النقي للمحرر (قاعدة مصدر الصرف FIN-003، بوابات التحقق للشراء/
 * الدفعة/التعديل، خريطة السجل المحمّل، وفحص المادة المتتبَّعة EXE-011)
 * خلف سطح تطبيقي مالك في بيت الموردين. كان هذا المنطق داخل
 * pages/SupplierPurchaseEditor.tsx؛ الصفحة تبقي ربط React ونسخ الواجهة
 * وقنوات الخدمات، ومعاينات editPreview/reversalPreview (مرايا F-049
 * المجمدة الخمس) في مكانها كما يحرسها moneyLayerGuard.
 *
 * عقد هذه الوحدة: لا تخزين ولا React ولا حساب مال — أكواد قرارات والقيم
 * تمر كما هي؛ النصوص العربية نسخة واجهة تبقى عند الصفحة (عقد ٠٧ نصوصه
 * عند سطحه). علاقة عقد 07 (الشراء لا يصبح COGS) يحرسها الدومين والخدمة —
 * لا تمسها الوحدة إطلاقًا.
 */

import type { SupplierPurchase, SupplierPurchaseLine } from "@micro-domain/supplier-purchase/index.js";
import { materialIsTracked } from "@micro-domain/inventory-material/index.js";
import type { Material } from "@micro-domain/inventory-material/index.js";

/* R10-B3/R10B-NF-001 (2026-10-11): القيمة الحارسة والقاعدة الموحدة
 * 0/1/متعدد صارت ملكية واحدة في application/finance/paymentSourcePolicy.ts
 * — كانت منسوختين هنا وفي components/finance/expenseFormModel.ts باسمين.
 *  الأسماء أدناه إعادة تصدير توافقًا لمستهلكي هذه الوحدة (لا مصدر حقيقة
 *  ثانٍ). */
import {
  PAYMENT_SOURCE_UNSET,
  paymentSourcePayload,
  resolveDefaultPaymentSource,
} from "@/application/finance/paymentSourcePolicy";
export { PAYMENT_SOURCE_UNSET as UNSET_PAYMENT_SOURCE, resolveDefaultPaymentSource };
export { paymentSourcePayload as paymentWalletPayload };

/** بوابة تحقق تسجيل الشراء — أكواد؛ النص عند الصفحة. */
export type PurchaseSubmissionProblem = "total_invalid" | "initial_exceeds_total" | "payment_source_required";

export function validatePurchaseSubmission(input: {
  validMoney: boolean;
  totalMinor: number;
  initialPaidMinor: number;
  walletCount: number;
  paymentWalletId: string;
}): PurchaseSubmissionProblem | null {
  if (!input.validMoney || input.totalMinor <= 0 || input.initialPaidMinor < 0) return "total_invalid";
  if (input.initialPaidMinor > input.totalMinor) return "initial_exceeds_total";
  /* FIN-003: مصدر الدفعة الأولية — إلزامي صريح عند تعدد المحافظ. */
  if (input.initialPaidMinor > 0 && input.walletCount > 1 && input.paymentWalletId === PAYMENT_SOURCE_UNSET)
    return "payment_source_required";
  return null;
}

/** بوابة تحقق الدفعة على سجل قائم — أكواد؛ النص عند الصفحة. */
export type PaymentSubmissionProblem = "payment_invalid" | "payment_source_required";

export function validatePaymentSubmission(input: {
  validMoney: boolean;
  paymentMinor: number;
  walletCount: number;
  paymentWalletId: string;
}): PaymentSubmissionProblem | null {
  if (input.paymentMinor <= 0 || !input.validMoney) return "payment_invalid";
  if (input.walletCount > 1 && input.paymentWalletId === PAYMENT_SOURCE_UNSET)
    return "payment_source_required";
  return null;
}

/** بوابة تحقق تعديل الشراء القائم — نفس شرط الإجمالي؛ الكمية تُفحص معه. */
export type PurchaseEditProblem = "total_invalid";

export function validatePurchaseEditSubmission(input: {
  validMoney: boolean;
  totalMinor: number;
  initialPaidMinor: number;
  quantityValid: boolean;
}): PurchaseEditProblem | null {
  if (!input.validMoney || input.totalMinor <= 0 || input.initialPaidMinor < 0 || !input.quantityValid)
    return "total_invalid";
  return null;
}

/** EXE-011 (PUR-001/AUD-NEW-08): حفظ شراء مرتبط بمادة متتبَّعة يعرض استمرارًا
 *  إلى الاستلام — المادة غير المتتبَّعة تبقى على مسارها المعلن فلا زر مضللًا.
 * S07 (R1-F01): الحكم الواحد هو معيّن المجال الكنوني نفسه (غياب tracking =
 * متتبَّعة للإرث القائم) — المهايئ لا يعيد اشتقاق سياسة التتبع ولا
 * يناقض حد الكتابة أبدًا؛ S07 يجعل هذا المعيّن حاسمًا لمعالجة البند
 * (period_material/tracked_material) فيجب أن يطابق المجال حرفيًا. */
export function isLinkedMaterialTracked(materialOptions: readonly Material[], materialId: string): boolean {
  if (!materialId) return false;
  const linked = materialOptions.find(material => material.id === materialId);
  return linked !== undefined && materialIsTracked(linked);
}

/** خريطة السجل المحمّل إلى قيم نموذج التحرير — نفس تعبئة الصفحة حرفيًا. */
export type SupplierPurchaseFormValues = {
  supplierName: string;
  note: string;
  purchasedOn: string;
  dueOn: string;
  totalMinor: number;
  initialPaidMinor: number;
  materialId: string;
  expectedQuantityMilli: number;
};

export function supplierPurchaseToFormValues(purchase: SupplierPurchase): SupplierPurchaseFormValues {
  /* وضع التعديل يبدأ معبّأً بقيم الشراء الحالية — البديل هو ما يُصحّح. */
  const initial = purchase.payments.find(payment => payment.id === `${purchase.id}:initial`);
  return {
    /* S05 (DOC-014 / UNIT-037): null = بلا مورد مسجل — النموذج يعرضه فراغًا. */
    supplierName: purchase.supplierName ?? "",
    note: purchase.note,
    purchasedOn: purchase.purchasedOn,
    dueOn: purchase.dueOn ?? "",
    totalMinor: purchase.totalMinor,
    initialPaidMinor: initial?.amountMinor ?? 0,
    /* المجموعة ٢ (عقد ٢٨): ربط المادة والكمية المتوقعة من السجل. */
    materialId: purchase.materialId ?? "",
    expectedQuantityMilli: purchase.expectedQuantityMilli ?? 0,
  };
}

/* S07 (UNIT-027 D01 / UNIT-028 D02 المعتمد): بنود الفاتورة من نموذج المحرر —
 * قرار عرض خلف بيت الموردين التطبيقي (لا حساب مال في TSX): البند الأول هو
 * ربط المادة الحالي بقيمته، والبنود الإضافية يدخلها المالك لفاتورة متعددة
 * المواد؛ المعالجة مشتقة من حالة تتبع المادة الحية (متتبعة → tracked_material
 * تكلفتها عند الاستعمال؛ غير متتبعة/بلا مادة → period_material تكلفتها مرة
 * على فترة الشراء) — الخدمة تطابقها مع الحالة الحية عند حد الكتابة نفسه.
 * الشكل الذاتي للبنود (فرادة الهوية، موجبية القيمة، المجموع ≤ الإجمالي)
 * تحرسه السياسة النقية عند الإنشاء/التعديل؛ هنا نعرض مجموعًا صادقًا فقط. */
export type PurchaseLineDraft = {
  materialId: string;
  expectedQuantityMilli: number;
  valueMinor: number;
  costKnown: boolean;
};

export type PurchaseLinesDerivation =
  { ok: true; lines: readonly SupplierPurchaseLine[] } | { ok: false; problem: "lines_exceed_total" };

export function derivePurchaseLines(input: {
  firstLine: PurchaseLineDraft;
  extraLines: readonly PurchaseLineDraft[];
  totalMinor: number;
  /* S07: فهارس البنود المرتبطة بمادة متتبَّعة (البند الأول من ربط النموذج،
   * والإضافية بموادها) — تحسبها الصفحة من حالة تتبع المادة الحية. */
  trackedLineIndexes: ReadonlySet<number>;
  existingLineIds?: readonly string[];
}): PurchaseLinesDerivation {
  const drafts = [input.firstLine, ...input.extraLines];
  const existingIds = input.existingLineIds ?? [];
  let knownValueSum = 0;
  const lines: SupplierPurchaseLine[] = drafts.map((draft, index) => {
    /* S07: معالجة البند تتبع حالة تتبع مادته — متتبعة → tracked_material
     * (تكلفة عند الاستعمال)؛ بلا مادة/غير متتبعة → period_material (تكلفة
     * فترة الشراء مرة وفق D02). */
    const treatment: SupplierPurchaseLine["treatment"] = input.trackedLineIndexes.has(index)
      ? "tracked_material"
      : "period_material";
    const valueKnown = draft.costKnown && draft.valueMinor > 0;
    if (valueKnown) knownValueSum += draft.valueMinor;
    return {
      lineId: existingIds[index] ?? `pl-${index + 1}`,
      materialId: draft.materialId || null,
      expectedQuantityMilli: draft.expectedQuantityMilli > 0 ? draft.expectedQuantityMilli : null,
      valueMinor: valueKnown ? draft.valueMinor : null,
      costKnowledge: valueKnown ? "known" : "unknown",
      treatment,
    };
  });
  if (knownValueSum > input.totalMinor) return { ok: false, problem: "lines_exceed_total" };
  return { ok: true, lines };
}

/* S07: مجموع قيم البنود المعلومة للعرض الصادق في النموذج — لا يخصم شيئًا،
 * يعرض فقط (المجمع الفعلي عند السياسة النقية). */
export function sumKnownLineValuesMinor(drafts: readonly PurchaseLineDraft[]): number {
  return drafts.reduce(
    (sum, draft) => sum + (draft.costKnown && draft.valueMinor > 0 ? draft.valueMinor : 0),
    0,
  );
}
