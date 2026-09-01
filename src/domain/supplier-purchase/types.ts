/** Material purchases affect cash/payables only until inventory consumption is implemented. All money is JOD minor units. */
export type SupplierPurchaseStatus = "unpaid" | "partially_paid" | "paid";
export type SupplierPurchasePayment = {
  id: string;
  amountMinor: number;
  occurredOn: string;
  recordedAt: string;
  idempotencyKey: string;
  note: string;
};
/* المجموعة ٢ (§10.4): تراجع موثق عن دفعة مورد — يستعيد ما بقي للمورد ويُرجع أثر
 * الكاش؛ لا يُحذف الدفع الأصلي بل تبقى علاقة التدقيق صريحة عبر paymentId. */
export type SupplierPurchasePaymentReversal = {
  id: string;
  paymentId: string;
  amountMinor: number;
  reason: string;
  occurredOn: string;
  recordedAt: string;
  idempotencyKey: string;
};
/* المجموعة ٢ (§10.4): مراجعة موثقة لتعديل الشراء — القيم قبل التصحيح محفوظة
 * في المراجعة نفسها، والسجل الأصلي لا يُمسح. */
export type SupplierPurchaseRevision = {
  kind: "edit";
  idempotencyKey: string;
  createdAt: string;
  reason: string;
  beforeTotalMinor: number;
  beforeInitialPaidMinor: number;
  beforeSupplierName: string;
  beforeNote: string;
  beforePurchasedOn: string;
  beforeDueOn: string | null;
};
export type SupplierPurchase = {
  id: string;
  supplierName: string;
  note: string;
  purchasedOn: string;
  dueOn: string | null;
  totalMinor: number;
  paidMinor: number;
  payableMinor: number;
  status: SupplierPurchaseStatus;
  idempotencyKey: string;
  payments: readonly SupplierPurchasePayment[];
  /** تراجعات موثقة عن دفعات لاحقة — السجلات القديمة بلاها تُقرأ فارغة. */
  paymentReversals?: readonly SupplierPurchasePaymentReversal[];
  /** مراجعات موثقة لتعديل الشراء — القديمة بلاها تُقرأ فارغة. */
  revisions?: readonly SupplierPurchaseRevision[];
  createdAt: string;
  updatedAt: string;
};
export type CreateSupplierPurchaseInput = {
  id: string;
  supplierName: string;
  note: string;
  purchasedOn: string;
  dueOn?: string | null;
  totalMinor: number;
  initialPaidMinor: number;
  recordedAt: string;
  idempotencyKey: string;
};
export type RecordSupplierPurchasePaymentInput = {
  id: string;
  amountMinor: number;
  occurredOn: string;
  recordedAt: string;
  idempotencyKey: string;
  note: string;
};
/* المجموعة ٢ (§10.4): تعديل موثق لسجل الشراء — التكلفة والدفع الأولي والبيانات. */
export type UpdateSupplierPurchaseInput = {
  supplierName: string;
  note: string;
  purchasedOn: string;
  dueOn?: string | null;
  totalMinor: number;
  initialPaidMinor: number;
  recordedAt: string;
  idempotencyKey: string;
  reason: string;
};
export type ReverseSupplierPurchasePaymentInput = {
  id: string;
  paymentId: string;
  reason: string;
  occurredOn: string;
  recordedAt: string;
  idempotencyKey: string;
};
