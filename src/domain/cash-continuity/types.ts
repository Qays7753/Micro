/** Cash continuity tracks declared wallet balances and safe corrections; it never classifies revenue, expense, or owner capital. */
export type CashWalletKind = "cash_drawer" | "bank_account" | "digital_wallet" | "other";
/* «تخصيص» = توزيع صريح من الكاش غير الموزع إلى محفظة (موجب) أو تغطية صرف منها (سالب).
 * إجمالي الكاش المسجل لا يتغير؛ تنتقل القيمة بين «غير الموزع» ورصيد المحفظة فقط. */
export type CashContinuityEntryType =
  "opening_balance" | "cash_adjustment" | "transfer_out" | "transfer_in" | "reversal" | "allocation";
export type CashWalletOpeningStatus = "known" | "unknown";
/* المجموعة ٢ (§9.1): مصدر التخصيص — ربط صريح بين حركة التخصيص في سجل المحفظة
 * والسجل المصدر الذي أنشأ الكاش (بيع/مصروف/تحصيل/طلب)، فيصل صاحب السجل للمصدر
 * من دفتر المحفظة بلا مسار كتابة ثانٍ. حقل اختياري: القديم بلاه يُقرأ فارغًا. */
export type CashAllocationSourceKind = "sale" | "expense" | "collection" | "order";
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
  /** حاضر في حركات التخصيص فقط: معرّف السجل المصدر الذي أُنشئ منه الكاش المخصص. */
  sourceRefId?: string | null;
  /** حاضر مع sourceRefId فقط: نوع السجل المصدر — يحدد وجهة الوصلة العميقة. */
  sourceRefKind?: CashAllocationSourceKind | null;
  /* المجموعة ٦ (البند ١ — S2-04أ): ربط سطر المصدر — معرّف حدث القبضة الذي
   * أُنشئ منه هذا التخصيص، فيصبح «تراجع القبضة مع تخصيصها المطابق» قابلًا
   * للتحديد بلا تخمين. حقل اختياري مع sourceRefId؛ القديم بلاه يُقرأ فارغًا. */
  sourceRefLineId?: string | null;
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
  /** اختياري للتخصيص فقط: سجل المصدر الذي أُنشئ منه الكاش. */
  sourceRefId?: string | null;
  sourceRefKind?: CashAllocationSourceKind | null;
  /** اختياري للتخصيص فقط (المجموعة ٦): حدث القبضة المصدر الذي أُنشئ منه الكاش. */
  sourceRefLineId?: string | null;
};
