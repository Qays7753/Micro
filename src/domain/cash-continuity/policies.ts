import { fieldLabelAr } from "../shared/index.js";
import type {
  CashContinuityEntry,
  CashContinuityEntryType,
  CashWallet,
  CreateCashEntryInput,
  CreateCashWalletInput,
} from "./types.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const assertNonBlank = (value: string, field: string) => {
  if (!value.trim()) throw new Error(`أكمل ${fieldLabelAr(field)} قبل الحفظ.`);
};
const assertDate = (value: string, field: string) => {
  if (!DATE_PATTERN.test(value) || Number.isNaN(new Date(`${value}T12:00:00.000Z`).valueOf()))
    throw new Error(`أدخل ${fieldLabelAr(field)} تاريخًا محليًا صحيحًا.`);
};
const assertIso = (value: string, field: string) => {
  if (Number.isNaN(Date.parse(value))) throw new Error(`أدخل ${fieldLabelAr(field)} وقتًا صحيحًا.`);
};

export function createCashWallet(input: CreateCashWalletInput): CashWallet {
  assertNonBlank(input.id, "id");
  assertNonBlank(input.name, "name");
  assertNonBlank(input.createdOperationKey, "createdOperationKey");
  assertIso(input.createdAt, "createdAt");
  if (!(["cash_drawer", "bank_account", "digital_wallet", "other"] as const).includes(input.kind))
    throw new Error("نوع المحفظة غير صالح.");
  return Object.freeze({
    id: input.id,
    name: input.name.trim(),
    kind: input.kind,
    createdAt: input.createdAt,
    createdOperationKey: input.createdOperationKey,
  });
}

export function createCashContinuityEntry(input: CreateCashEntryInput): CashContinuityEntry {
  assertNonBlank(input.id, "id");
  assertNonBlank(input.walletId, "walletId");
  assertNonBlank(input.note, "note");
  assertNonBlank(input.operationKey, "operationKey");
  assertDate(input.occurredOn, "occurredOn");
  assertIso(input.recordedAt, "recordedAt");
  if (!Number.isInteger(input.cashDeltaMinor) || input.cashDeltaMinor === 0)
    throw new Error("أدخل فرق الكاش رقمًا صحيحًا غير صفري.");
  const reason = input.reason?.trim() || null;
  const transferId = input.transferId?.trim() || null;
  const reversesEntryId = input.reversesEntryId?.trim() || null;
  if (
    !(["opening_balance", "cash_adjustment", "transfer_out", "transfer_in", "reversal"] as const).includes(
      input.type,
    )
  )
    throw new Error("نوع الحركة غير صالح.");
  if (input.type === "opening_balance" && input.cashDeltaMinor < 0)
    throw new Error("رصيد الافتتاح لا يمكن أن يكون سالبًا.");
  if (input.type === "cash_adjustment" && !reason) throw new Error("تسوية الكاش تتطلب سببًا موثقًا.");
  if ((input.type === "transfer_out" || input.type === "transfer_in") && !transferId)
    throw new Error("حركة التحويل تتطلب معرف تحويل صريحًا.");
  if ((input.type === "transfer_out" || input.type === "transfer_in") && reason)
    throw new Error("حركة التحويل لا تحمل سبب تصحيح.");
  if (input.type === "reversal" && (!reason || !reversesEntryId))
    throw new Error("العكس يتطلب سببًا وحركة أصل صريحة.");
  if (input.type === "transfer_out" && input.cashDeltaMinor > 0)
    throw new Error("اتجاه التحويل لا يطابق الحركة؛ أدخل مبلغ تحويل موجبًا.");
  if (input.type === "transfer_in" && input.cashDeltaMinor < 0)
    throw new Error("اتجاه التحويل لا يطابق الحركة؛ أدخل مبلغ تحويل موجبًا.");
  if (input.type !== "reversal" && reversesEntryId)
    throw new Error("الربط بحركة أصل يخص سجلات العكس فقط.");
  return Object.freeze({
    id: input.id,
    walletId: input.walletId,
    type: input.type,
    occurredOn: input.occurredOn,
    recordedAt: input.recordedAt,
    cashDeltaMinor: input.cashDeltaMinor,
    note: input.note.trim(),
    reason,
    operationKey: input.operationKey,
    transferId,
    reversesEntryId,
  });
}

export function summarizeCashContinuity(entries: readonly CashContinuityEntry[]) {
  return entries.reduce((total, entry) => total + entry.cashDeltaMinor, 0);
}
