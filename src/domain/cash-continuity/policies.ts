import { fieldLabelAr } from "../shared/index.js";
import type {
  CashContinuityEntry,
  CashContinuityEntryType,
  CashWallet,
  CreateCashEntryInput,
  CreateCashWalletInput,
} from "./types.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ENTRY_TYPES = [
  "opening_balance",
  "cash_adjustment",
  "transfer_out",
  "transfer_in",
  "reversal",
  "allocation",
] as const;
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
    ...(input.openingStatus === "unknown" ? { openingStatus: "unknown" as const } : {}),
  });
}

/* المجموعة ٢ (§9.1): مصدر التخصيص — وصل قراءة فقط في سجل المحفظة؛ يُقبل في
 * حركات التخصيص حصرًا ومعه نوع مصدر معلوم، وبلا معرّف لا يُقبل نوع. */
const SOURCE_REF_KINDS = ["sale", "expense", "collection", "order"] as const;
type SourceRefKind = (typeof SOURCE_REF_KINDS)[number];

function normalizeSourceRef(input: CreateCashEntryInput): {
  sourceRefId: string | null;
  sourceRefKind: SourceRefKind | null;
} {
  const sourceRefId = input.sourceRefId?.trim() || null;
  const sourceRefKind = (input.sourceRefKind as SourceRefKind | null) ?? null;
  if (sourceRefId && !sourceRefKind) throw new Error("ربط المصدر يتطلب نوع السجل المصدر.");
  if (!sourceRefId && sourceRefKind) throw new Error("نوع المصدر بلا سجل مصدر غير صالح.");
  if (sourceRefKind && !SOURCE_REF_KINDS.includes(sourceRefKind))
    throw new Error("نوع مصدر التخصيص غير صالح.");
  return { sourceRefId, sourceRefKind };
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
  if (!ENTRY_TYPES.includes(input.type)) throw new Error("نوع الحركة غير صالح.");
  if (input.type === "allocation" && transferId) throw new Error("حركة التخصيص ليست تحويلًا بين محفظتين.");
  if (input.type === "allocation" && reversesEntryId) throw new Error("حركة التخصيص ليست تراجعًا.");
  if (input.type === "opening_balance" && input.cashDeltaMinor < 0)
    throw new Error("رصيد الافتتاح لا يمكن أن يكون سالبًا.");
  if (input.type === "cash_adjustment" && !reason) throw new Error("تسوية الكاش تتطلب سببًا موثقًا.");
  if ((input.type === "transfer_out" || input.type === "transfer_in") && !transferId)
    throw new Error("حركة التحويل تتطلب معرف تحويل صريحًا.");
  if ((input.type === "transfer_out" || input.type === "transfer_in") && reason)
    throw new Error("حركة التحويل لا تحمل سبب تصحيح.");
  if (input.type === "reversal" && (!reason || !reversesEntryId))
    throw new Error("التراجع يتطلب سببًا وحركة أصل صريحة.");
  if (input.type === "transfer_out" && input.cashDeltaMinor > 0)
    throw new Error("اتجاه التحويل لا يطابق الحركة؛ أدخل مبلغ تحويل موجبًا.");
  if (input.type === "transfer_in" && input.cashDeltaMinor < 0)
    throw new Error("اتجاه التحويل لا يطابق الحركة؛ أدخل مبلغ تحويل موجبًا.");
  if (input.type !== "reversal" && reversesEntryId) throw new Error("الربط بحركة أصل يخص سجلات التراجع فقط.");
  if (input.type !== "allocation" && (input.sourceRefId?.trim() || input.sourceRefKind))
    throw new Error("ربط المصدر يخص حركات التخصيص فقط.");
  const { sourceRefId, sourceRefKind } = normalizeSourceRef(input);
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
    ...(sourceRefId
      ? { sourceRefId, sourceRefKind: sourceRefKind as NonNullable<typeof sourceRefKind> }
      : {}),
  });
}

export function summarizeCashContinuity(entries: readonly CashContinuityEntry[]) {
  return entries.reduce((total, entry) => total + entry.cashDeltaMinor, 0);
}
