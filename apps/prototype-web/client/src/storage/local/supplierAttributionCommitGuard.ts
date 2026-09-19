import type { CashContinuityEntry } from "@micro-domain/cash-continuity/index.js";
import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import type { SupplierPurchaseCommit, SupplierPurchaseCommitKind } from "./supplierScheduleCommitGuard";

/* G-002 (تدقيق الإدارة المالية المتدرجة 2026-09-19): تخصيص دفعة المورد
 * لمحفظتها كان يُكتب في معاملة ثانية بعد حفظ الدفعة، وإعادة الإرسال بعد فشل
 * أو انقطاع كانت تُرجع «reused» فتتخطى التخصيص إلى الأبد — دفعة بحقل محفظة
 * بلا قيد تغطية مطابق، والمعادلة الكلية متوازنة فيبقى الخلل صامتًا. هذا
 * الحارس النقي يُستدعى داخل معاملة الكتابة الواحدة في المحوّلين لحل التخصيص
 * من الحقيقة المخزّنة نفسها: القيد الموجود بمفتاحه يُعاد كما هو (اكتمال)،
 * والناقص يُشتق من الدفعة المخزّنة (المحفظة والمبلغ والتاريخ والمصدر) فيُشفي
 * داخل المعاملة نفسها، والدفعة بلا محفظة تبقى في غير الموزع بصدق — لا مسار
 * رفض يخترع سياسة ولا تكرار خصم بمفتاحين. */

export type SupplierAttributionResolution =
  | { action: "existing"; entry: CashContinuityEntry }
  | { action: "write"; entry: CashContinuityEntry }
  | { action: "skip" };

/** الدفعة المخزّنة التي يستهدفها هذا الالتزام — الأولية للإنشاء، ومفتاح
 * العملية للدفعة اللاحقة. */
function storedPaymentFor(
  kind: SupplierPurchaseCommitKind,
  purchase: SupplierPurchase,
  idempotencyKey: string,
) {
  if (kind === "create") return purchase.payments.find(payment => payment.id === `${purchase.id}:initial`);
  if (kind === "payment") return purchase.payments.find(payment => payment.idempotencyKey === idempotencyKey);
  return undefined;
}

/** حل تخصيص المحفظة لدفعة مورد داخل معاملة الالتزام الواحدة.
 * fresh: الشراء الوارد هو المرجع (التخصيص كما بنته الخدمة من المدخلات نفسها).
 * reused: الشراء المخزّن هو المرجع — التخصيص الناقص يُشتق منه حرفيًا
 * (المحفظة والمبلغ والتاريخ والمعرّف)، فلا يُكرر ولا يُنسب لغير المخزّن. */
export function resolveSupplierPaymentAttribution(input: {
  kind: SupplierPurchaseCommitKind;
  idempotencyKey: string;
  attribution: CashContinuityEntry | null;
  /** الشراء المرجعي: الوارد في المسار الجديد، المخزّن في مسار إعادة الاستخدام. */
  purchase: SupplierPurchase;
  storedEntries: readonly CashContinuityEntry[];
}): SupplierAttributionResolution {
  const { kind, idempotencyKey, attribution, purchase, storedEntries } = input;
  if (attribution === null) return { action: "skip" };
  const existing = storedEntries.find(entry => entry.operationKey === attribution.operationKey);
  if (existing) return { action: "existing", entry: existing };
  const payment = storedPaymentFor(kind, purchase, idempotencyKey);
  if (!payment) return { action: "skip" };
  const walletId = payment.walletId?.trim() || null;
  if (!walletId) return { action: "skip" };
  /* الاشتقاق من الحقيقة المرجعية نفسها: المبلغ من الدفعة، والمصدر من
   * الشراء، والمحفظة من الدفعة — والمفتاح الحتمي من محاولة الخدمة. */
  return {
    action: "write",
    entry: {
      ...attribution,
      walletId,
      cashDeltaMinor: -payment.amountMinor,
      occurredOn: payment.occurredOn,
      sourceRefId: purchase.id,
      sourceRefKind: "supplier_purchase",
    },
  };
}
