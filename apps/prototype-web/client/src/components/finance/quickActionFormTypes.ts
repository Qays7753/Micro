/*
 * W3 — أنواع نماذج الأفعال العابرة (ورقة الإضافة السريعة).
 * حدود الملكية: القشرة (QuickActionSheet) تملك التوزيع ودورة الحياة والوصل؛
 * نماذج البيع/المصروف (طبقة أنماط المالية) تملك حقولها ومنطق تسجيلها.
 * الوصل عقد بيانات عرض — لا معنى ماليًا هنا.
 */

export type QuickActionReceipt = {
  title: string;
  amountMinor: number;
  cashMinor: number | null;
  recordHref: string | null;
  detail: string | null;
  /* سبب عدم تنفيذ وجهة المحفظة إن فشل التخصيص بعد التسجيل — يظهر في الوصل
   * بصدق؛ null حين لا وجهة أصلًا أو حين نجحت النسبة. */
  attributionNote: string | null;
};

/** مقبض النموذج للقشرة: الوسخ (حماية المدخل) والتسجيل (إتمام بالحفظ). */
export type QuickActionFormHandle = {
  isDirty: () => boolean;
  submit: () => Promise<void>;
};

/** معاينة المحفظة كما تجلبها القشرة عند فتح الورقة. */
export type QuickActionWalletOption = { id: string; name: string };
