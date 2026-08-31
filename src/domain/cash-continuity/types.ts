/** Cash continuity tracks declared wallet balances and safe corrections; it never classifies revenue, expense, or owner capital. */
export type CashWalletKind = "cash_drawer" | "bank_account" | "digital_wallet" | "other";
/* «تخصيص» = توزيع صريح من الكاش غير الموزع إلى محفظة (موجب) أو تغطية صرف منها (سالب).
 * إجمالي الكاش المسجل لا يتغير؛ تنتقل القيمة بين «غير الموزع» ورصيد المحفظة فقط. */
export type CashContinuityEntryType =
  "opening_balance" | "cash_adjustment" | "transfer_out" | "transfer_in" | "reversal" | "allocation";
export type CashWalletOpeningStatus = "known" | "unknown";
export type CashWallet = {
  id: string;
  name: string;
  kind: CashWalletKind;
  createdAt: string;
  createdOperationKey: string;
  /** «unknown» = أُنشئت المحفظة برصيد لم يُعرف بعد؛ يظهر «غير محدد» لا صفرًا حتى يُدخل رصيد موثق. */
  openingStatus?: CashWalletOpeningStatus;
};
export type CashContinuityEntry = {
  id: string;
  walletId: string;
  type: CashContinuityEntryType;
  occurredOn: string;
  recordedAt: string;
  cashDeltaMinor: number;
  note: string;
  reason: string | null;
  operationKey: string;
  transferId: string | null;
  reversesEntryId: string | null;
};
export type CreateCashWalletInput = {
  id: string;
  name: string;
  kind: CashWalletKind;
  createdAt: string;
  createdOperationKey: string;
  /** «unknown» = محفظة بلا رصيد معلن بعد — تُعرض «غير محدد» لا صفرًا. */
  openingStatus?: CashWalletOpeningStatus;
};
export type CreateCashEntryInput = {
  id: string;
  walletId: string;
  type: CashContinuityEntryType;
  occurredOn: string;
  recordedAt: string;
  cashDeltaMinor: number;
  note: string;
  reason?: string | null;
  operationKey: string;
  transferId?: string | null;
  reversesEntryId?: string | null;
};
