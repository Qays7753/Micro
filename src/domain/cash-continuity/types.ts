/** Cash continuity tracks declared wallet balances and safe corrections; it never classifies revenue, expense, or owner capital. */
export type CashWalletKind = "cash_drawer" | "bank_account" | "digital_wallet" | "other";
export type CashContinuityEntryType = "opening_balance" | "cash_adjustment" | "transfer_out" | "transfer_in" | "reversal";
export type CashWallet = { id: string; name: string; kind: CashWalletKind; createdAt: string; createdOperationKey: string };
export type CashContinuityEntry = { id: string; walletId: string; type: CashContinuityEntryType; occurredOn: string; recordedAt: string; cashDeltaMinor: number; note: string; reason: string | null; operationKey: string; transferId: string | null; reversesEntryId: string | null };
export type CreateCashWalletInput = { id: string; name: string; kind: CashWalletKind; createdAt: string; createdOperationKey: string };
export type CreateCashEntryInput = { id: string; walletId: string; type: CashContinuityEntryType; occurredOn: string; recordedAt: string; cashDeltaMinor: number; note: string; reason?: string | null; operationKey: string; transferId?: string | null; reversesEntryId?: string | null };
