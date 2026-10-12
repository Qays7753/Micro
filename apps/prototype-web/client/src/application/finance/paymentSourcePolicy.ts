/** R10-B3/R10B-NF-001 (2026-10-11): ملكية واحدة لسياسة مصدر الصرف —
 * القيمة الحارسة «لم يُختر بعد» وقاعدة الاحالة 0/1/متعدد (FIN-003 للشراء
 * من المورد وFIN-005 للمصروف) كانت منسختين بطبقتين واسمين
 * (UNSET_PAYMENT_SOURCE في application/suppliers وEXPENSE_SOURCE_UNSET
 * في components/finance). هذه الوحدة هي المصدر الكنوني الوحيد للقيمة
 * الحارسة والقاعدة المشتركة؛ نصوص الأثر ورسائل الرفض تبقى عند أسطح
 * الواجهة (نسخ عرض لا سياسة).
 *
 * عقد الوحدة: لا تخزين ولا React ولا حساب مال — ثابت نصي ودالة قرار
 * صرفة على شكل قائمة محافظ. */

/** FIN-003/FIN-005: «لم يُختر بعد» — تُميّز عدم الاختيار عن الخيار الصريح
 *  «الكاش غير الموزع» (القيمة الفارغة) عند تعدد المحافظ حيث الاختيار
 *  إلزامي صريح لا صامت. */
export const PAYMENT_SOURCE_UNSET = "__unset__";

/** قاعدة مصدر الصرف الموحدة: بلا محافظ = غير الموزع (قيمة فارغة)؛ محفظة
 *  واحدة = تُعيَّن مسبقًا بشكل مرئي؛ محافظ متعددة = «لم يُختر بعد» (إلزامي
 *  التخطي الصريح). لا تُذكر آخر محفظة أبدًا. */
export function resolveDefaultPaymentSource(walletOptions: readonly { id: string }[]): string {
  if (walletOptions.length === 1) return walletOptions[0]!.id;
  if (walletOptions.length === 0) return "";
  return PAYMENT_SOURCE_UNSET;
}

/** مصدر الدفعة كما يُرسل مع الحدث — القيمة الحارسة والفارغة تعنيان الكاش
 *  غير الموزع/بلا دفعة (null)؛ ما عداهما معرّف المحفظة كما هو. */
export function paymentSourcePayload(paymentSourceId: string): string | null {
  return paymentSourceId && paymentSourceId !== PAYMENT_SOURCE_UNSET ? paymentSourceId : null;
}
