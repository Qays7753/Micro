import { fieldLabelAr } from "../shared/index.js";
import type {
  CreateSupplierPurchaseInput,
  RecordSupplierPurchasePaymentInput,
  SupplierPurchase,
  SupplierPurchasePayment,
  SupplierPurchaseStatus,
} from "./types.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (value: string) =>
  DATE_PATTERN.test(value) && !Number.isNaN(new Date(`${value}T12:00:00.000Z`).valueOf());
const assertText = (value: string, field: string) => {
  if (!value.trim()) throw new Error(`أكمل ${fieldLabelAr(field)} قبل الحفظ.`);
};
const assertPositive = (value: number, field: string) => {
  if (!Number.isInteger(value) || value <= 0)
    throw new Error(`أدخل ${fieldLabelAr(field)} رقمًا صحيحًا موجبًا.`);
};
const assertNonNegative = (value: number, field: string) => {
  if (!Number.isInteger(value) || value < 0)
    throw new Error(`أدخل ${fieldLabelAr(field)} رقمًا صحيحًا غير سالب.`);
};
const statusFor = (totalMinor: number, paidMinor: number): SupplierPurchaseStatus =>
  paidMinor === 0 ? "unpaid" : paidMinor === totalMinor ? "paid" : "partially_paid";
const totalPaid = (payments: readonly SupplierPurchasePayment[]) =>
  payments.reduce((sum, payment) => sum + payment.amountMinor, 0);

export function createSupplierPurchase(input: CreateSupplierPurchaseInput): SupplierPurchase {
  assertText(input.id, "id");
  assertText(input.supplierName, "supplierName");
  assertText(input.note, "note");
  assertText(input.idempotencyKey, "idempotencyKey");
  assertPositive(input.totalMinor, "totalMinor");
  assertNonNegative(input.initialPaidMinor, "initialPaidMinor");
  if (!validDate(input.purchasedOn)) throw new Error("أدخل تاريخ الشراء تاريخًا محليًا صحيحًا.");
  if (input.dueOn && !validDate(input.dueOn)) throw new Error("أدخل تاريخ الاستحقاق تاريخًا محليًا صحيحًا.");
  if (Number.isNaN(Date.parse(input.recordedAt))) throw new Error("أدخل وقت التسجيل وقتًا صحيحًا.");
  if (input.initialPaidMinor > input.totalMinor) throw new Error("المدفوع مبدئيًا لا يمكن أن يتجاوز إجمالي الشراء.");
  const payments: readonly SupplierPurchasePayment[] =
    input.initialPaidMinor > 0
      ? [
          Object.freeze({
            id: `${input.id}:initial`,
            amountMinor: input.initialPaidMinor,
            occurredOn: input.purchasedOn,
            recordedAt: input.recordedAt,
            idempotencyKey: `${input.idempotencyKey}:initial`,
            note: "دفعة عند تسجيل الشراء",
          }),
        ]
      : [];
  const paidMinor = totalPaid(payments);
  return Object.freeze({
    id: input.id,
    supplierName: input.supplierName.trim(),
    note: input.note.trim(),
    purchasedOn: input.purchasedOn,
    dueOn: input.dueOn?.trim() || null,
    totalMinor: input.totalMinor,
    paidMinor,
    payableMinor: input.totalMinor - paidMinor,
    status: statusFor(input.totalMinor, paidMinor),
    idempotencyKey: input.idempotencyKey,
    payments,
    createdAt: input.recordedAt,
    updatedAt: input.recordedAt,
  });
}

export function recordSupplierPurchasePayment(
  purchase: SupplierPurchase,
  input: RecordSupplierPurchasePaymentInput,
): SupplierPurchase {
  assertText(input.id, "id");
  assertText(input.idempotencyKey, "idempotencyKey");
  assertText(input.note, "note");
  assertPositive(input.amountMinor, "amountMinor");
  if (!validDate(input.occurredOn)) throw new Error("أدخل تاريخ الحركة تاريخًا محليًا صحيحًا.");
  if (Number.isNaN(Date.parse(input.recordedAt))) throw new Error("أدخل وقت التسجيل وقتًا صحيحًا.");
  if (purchase.payments.some(payment => payment.idempotencyKey === input.idempotencyKey)) return purchase;
  if (input.amountMinor > purchase.payableMinor)
    throw new Error("الدفعة لا يمكن أن تتجاوز المتبقي المسجل على الشراء.");
  const payment = Object.freeze({
    id: input.id,
    amountMinor: input.amountMinor,
    occurredOn: input.occurredOn,
    recordedAt: input.recordedAt,
    idempotencyKey: input.idempotencyKey,
    note: input.note.trim(),
  });
  const payments = Object.freeze([...purchase.payments, payment]);
  const paidMinor = totalPaid(payments);
  return Object.freeze({
    ...purchase,
    payments,
    paidMinor,
    payableMinor: purchase.totalMinor - paidMinor,
    status: statusFor(purchase.totalMinor, paidMinor),
    updatedAt: input.recordedAt,
  });
}
