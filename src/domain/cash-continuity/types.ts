/** Cash continuity tracks declared wallet balances and safe corrections; it never classifies revenue, expense, or owner capital. */
/* R4-B2 (STR-623/STR-608 — قرار موثق 2026-10-08): قائمة أنواع المحفظة وقت
 * التشغيل من مالكها الكنوني — نفس نمط SOURCE_REF_KINDS في هذا الملف وقوائم
 * materialUnits/catalogItemKinds/expenseBudget* في المجال. فُتحت بوابة STR-608
 * (هامش الميزانية يسمح + قرار موثق): المستهلك الحدودي (guidedOpeningImport)
 * يستوردها بدل طاقم محلي محروس، فيصبح الانحراف مستحيلًا بالبناء. */
export const cashWalletKinds = ["cash_drawer", "bank_account", "digital_wallet", "other"] as const;
export type CashWalletKind = (typeof cashWalletKinds)[number];
/* «تخصيص» = توزيع صريح من الكاش غير الموزع إلى محفظة (موجب) أو تغطية صرف منها (سالب).
 * إجمالي الكاش المسجل لا يتغير؛ تنتقل القيمة بين «غير الموزع» ورصيد المحفظة فقط. */
/* R4-S8/F2b (تدقيق عدائي، 2026-10-08): قائمة أنواع الحركة وقت التشغيل من
 * مالكها الكنوني — كان policies.ts يحمل حرفية موازية للاتحاد النوعي داخل
 * الحزمة نفسها؛ الاشتقاق يغلق باب الانحراف بالبناء (نفس نمط cashWalletKinds
 * وSOURCE_REF_KINDS أعلاه). */
export const cashContinuityEntryTypes = [
  "opening_balance",
  "cash_adjustment",
  "transfer_out",
  "transfer_in",
  "reversal",
  "allocation",
] as const;
export type CashContinuityEntryType = (typeof cashContinuityEntryTypes)[number];
export type CashWalletOpeningStatus = "known" | "unknown";
/* المجموعة ٢ (§9.1): مصدر التخصيص — ربط صريح بين حركة التخصيص في سجل المحفظة
 * والسجل المصدر الذي أنشأ الكاش (بيع/مصروف/تحصيل/طلب)، فيصل صاحب السجل للمصدر
 * من دفتر المحفظة بلا مسار كتابة ثانٍ. حقل اختياري: القديم بلاه يُقرأ فارغًا.
 * FIN-003 (قرار المالك ٢٠٢٦-٠٩-١٦): دفعات المورديم تنسب لمصدرها وقت التسجيل —
 * نوع المصدر «supplier_purchase» يصل دفتر المحفظة بشراء المورد نفسه.
 * EXE-003 (AUD-NEW-03): القائمة القانونية معرّفة هنا مرة واحدة وتُصدَّر —
 * سياسات الدومين وفاحص السلامة MIC-2 وكل مستهلك يستوردونها من هذا المصدر،
 * فلا تنحرف نسخة مكررة عنه بعد اليوم.
 * EXE-009 (OWN-001): تخصيص/تغطية حدث مالك (استثمار أو سحب شخصي) ينسب للحدث
 * نفسه — «owner_event» — فتصل حركة المحفظة بالحدث المالي المصدر. */
export const SOURCE_REF_KINDS = [
  "sale",
  "expense",
  "collection",
  "order",
  "supplier_purchase",
  "owner_event",
] as const;
type CashAllocationSourceKind = (typeof SOURCE_REF_KINDS)[number];
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
