/**
 * R10-B4/F-021 (2026-10-12): معاينات قراءة صرفة لنواة المدفوع/المستحق لشراء
 * المورد — في وحدة شقيقة منفصلة عن policies.ts عمدًا: الصفحة الكسولة وحدها
 * تستهلكها فتُحزم مع chunk الشراء لا مع حزمة الدخول. تتبع حرفيًا نواة
 * مسارات الكتابة (paidAfterEditFor / effectivePaid المستوردين أدناه) — لا
 * صيغة ثانية تتباعد ولا كتابة أبدًا.
 */
import type { SupplierPurchase, SupplierPurchasePayment } from "./types.js";
import { effectivePaid, paidAfterEditFor } from "./policies.js";

/** معاينة تعديل الشراء: المدفوع/المستحق بعد الإجمالي والدفع الأولي الجديدين. */
export function previewSupplierPurchaseEdit(
  purchase: SupplierPurchase,
  input: { totalMinor: number; initialPaidMinor: number },
): { paidAfterMinor: number; payableAfterMinor: number } {
  const paidAfterMinor = paidAfterEditFor(purchase, input);
  return { paidAfterMinor, payableAfterMinor: input.totalMinor - paidAfterMinor };
}

/** معاينة تراجع دفعة لاحقة — مطابقة لمسار reverseSupplierPurchasePayment. */
export function previewSupplierPurchasePaymentReversal(
  purchase: SupplierPurchase,
  payment: SupplierPurchasePayment,
): { paidAfterMinor: number; payableAfterMinor: number } {
  const paidAfterMinor = effectivePaid(purchase) - payment.amountMinor;
  return { paidAfterMinor, payableAfterMinor: purchase.totalMinor - paidAfterMinor };
}
