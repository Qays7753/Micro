import type { CashContinuityEntry, CashContinuityEntryType, CashWallet, CreateCashEntryInput, CreateCashWalletInput } from "./types.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const assertNonBlank = (value: string, field: string) => { if (!value.trim()) throw new Error(`${field} is required`); };
const assertDate = (value: string, field: string) => { if (!DATE_PATTERN.test(value) || Number.isNaN(new Date(`${value}T12:00:00.000Z`).valueOf())) throw new Error(`${field} must be a valid local date`); };
const assertIso = (value: string, field: string) => { if (Number.isNaN(Date.parse(value))) throw new Error(`${field} must be ISO-8601`); };

export function createCashWallet(input: CreateCashWalletInput): CashWallet {
  assertNonBlank(input.id, "id"); assertNonBlank(input.name, "name"); assertNonBlank(input.createdOperationKey, "createdOperationKey"); assertIso(input.createdAt, "createdAt"); if (!( ["cash_drawer", "bank_account", "digital_wallet", "other"] as const).includes(input.kind)) throw new Error("kind is invalid");
  return Object.freeze({ id: input.id, name: input.name.trim(), kind: input.kind, createdAt: input.createdAt, createdOperationKey: input.createdOperationKey });
}

export function createCashContinuityEntry(input: CreateCashEntryInput): CashContinuityEntry {
  assertNonBlank(input.id, "id"); assertNonBlank(input.walletId, "walletId"); assertNonBlank(input.note, "note"); assertNonBlank(input.operationKey, "operationKey"); assertDate(input.occurredOn, "occurredOn"); assertIso(input.recordedAt, "recordedAt"); if (!Number.isInteger(input.cashDeltaMinor) || input.cashDeltaMinor === 0) throw new Error("cashDeltaMinor must be a non-zero integer");
  const reason = input.reason?.trim() || null; const transferId = input.transferId?.trim() || null; const reversesEntryId = input.reversesEntryId?.trim() || null;
  if (!( ["opening_balance", "cash_adjustment", "transfer_out", "transfer_in", "reversal"] as const).includes(input.type)) throw new Error("type is invalid");
  if (input.type === "opening_balance" && input.cashDeltaMinor < 0) throw new Error("opening balance cannot be negative");
  if (input.type === "cash_adjustment" && !reason) throw new Error("cash adjustment requires a reason");
  if ((input.type === "transfer_out" || input.type === "transfer_in") && !transferId) throw new Error("transfer entry requires transferId");
  if ((input.type === "transfer_out" || input.type === "transfer_in") && reason) throw new Error("transfer entry cannot carry a correction reason");
  if (input.type === "reversal" && (!reason || !reversesEntryId)) throw new Error("reversal requires reason and reversesEntryId");
  if (input.type !== "reversal" && reversesEntryId) throw new Error("only reversal may reference reversesEntryId");
  return Object.freeze({ id: input.id, walletId: input.walletId, type: input.type, occurredOn: input.occurredOn, recordedAt: input.recordedAt, cashDeltaMinor: input.cashDeltaMinor, note: input.note.trim(), reason, operationKey: input.operationKey, transferId, reversesEntryId });
}

export function summarizeCashContinuity(entries: readonly CashContinuityEntry[]) { return entries.reduce((total, entry) => total + entry.cashDeltaMinor, 0); }
