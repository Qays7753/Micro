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

import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
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
 *  إلى الاستلام — المادة غير المتتبَّعة تبقى على مسارها المعلن فلا زر مضللًا. */
export function isLinkedMaterialTracked(materialOptions: readonly Material[], materialId: string): boolean {
  return (
    !!materialId &&
    (materialOptions.find(material => material.id === materialId)?.tracking?.status ?? "untracked") !==
      "untracked"
  );
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
