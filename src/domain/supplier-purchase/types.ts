/** Material purchases affect cash/payables only until inventory consumption is implemented. All money is JOD minor units. */
export type SupplierPurchaseStatus = "unpaid" | "partially_paid" | "paid";
export type SupplierPurchasePayment = { id: string; amountMinor: number; occurredOn: string; recordedAt: string; idempotencyKey: string; note: string };
export type SupplierPurchase = { id: string; supplierName: string; note: string; purchasedOn: string; dueOn: string | null; totalMinor: number; paidMinor: number; payableMinor: number; status: SupplierPurchaseStatus; idempotencyKey: string; payments: readonly SupplierPurchasePayment[]; createdAt: string; updatedAt: string };
export type CreateSupplierPurchaseInput = { id: string; supplierName: string; note: string; purchasedOn: string; dueOn?: string | null; totalMinor: number; initialPaidMinor: number; recordedAt: string; idempotencyKey: string };
export type RecordSupplierPurchasePaymentInput = { id: string; amountMinor: number; occurredOn: string; recordedAt: string; idempotencyKey: string; note: string };
