/**
 * وحدة «وقت الأعمال» — المجموعة ٩ (STR-029/STR-031): العقد الكنسي لاشتقاق
 * تاريخ الأعمال من لحظة زمنية، خارج طبقة العرض نهائيًا.
 *
 * العقد المجمد (اختُبر بتوثيف المجموعة ٩ قبل النقل وثبت أن النقل لا يغير
 * أي متجه):
 *
 * 1) الخوارزمية: أجزاء Intl بتوقيت `Asia/Amman` (سنة رقمية، شهر ويوم
 *    بمنزلتين) بصيغة `YYYY-MM-DD` — نفس الخوارزمية الحرفية التي كانت
 *    تسع نسخ موزعة قبل التوحيد.
 * 2) التوقيت: عمّان UTC+3 طول العام في ICU وقت التشغيل (التوقيت الصيفي
 *    الدائم منذ 2022) — حدّ اليوم المحلي 21:00:00Z ثابتًا؛ الدقة تتبع
 *    بيانات المنطقة الزمنية للمنصة، والخوارزمية لا تفترض إزاحة ثابتة.
 * 3) المدخل: `Date` أو نص تاريخ/وقت؛ المتغيّر الرمي يقبل الوضع الافتراضي
 *    «الآن».
 * 4) مفتاح الشهر/الفترة: مشتق دائمًا من أول سبعة أحرف من تاريخ الأعمال
 *    (`YYYY-MM`) — لا توجد خوارزمية شهر مستقلة ولا يجوز اختراعها.
 * 5) المدخل غير الصالح لهذا التاريخ — هوية الخطأ التي يفرّع عليها
 *    المستهلكون — متغيران معتمدان فقط:
 *    • `localDateInAmman` (متغيّر الرمي): خطأ صريح `Invalid instant` —
 *      لمدخلات موثوقة الإنشاء (دالة `now` أو سجلات مُتحقق منها)؛ الفشل
 *      الصادق أرفع من كتم بيانات فاسدة.
 *    • `ammanDateOrNull` (متغيّر الفارغ): `null` — لقراءات احتياطية
 *      تعلن غياب المعرفة لا تفترضها (تحديث سجل التصحيحات، فحص الصلاحية).
 *
 * هذه الوحدة نقية: لا React ولا UI ولا استيراد خارج نطاق المجال — يفرضه
 * حارس نقاء المجال (ESLint) ويُثبته اختبار حدود الطبقات بعينات موجبة
 * وسالبة. عرض التنسيق (DD/MM/YYYY وغيره) يبقى في طبقة العرض وحدها.
 */
const ammanDateFormatter = new Intl.DateTimeFormat("en", {
  timeZone: "Asia/Amman",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** تاريخ الأعمال بتوقيت عمّان بصيغة `YYYY-MM-DD` — يرمي `Invalid instant` للمدخل غير الصالح. */
export function localDateInAmman(instant: Date | string = new Date()): string {
  const parsed = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(parsed.valueOf())) throw new Error("Invalid instant");
  const parts = ammanDateFormatter.formatToParts(parsed);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** تاريخ الأعمال بتوقيت عمّان أو `null` للمدخل غير الصالح — إعلان غياب المعرفة لا افتراضها. */
export function ammanDateOrNull(instant: Date | string): string | null {
  const parsed = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(parsed.valueOf())) return null;
  const parts = ammanDateFormatter.formatToParts(parsed);
  const year = parts.find(item => item.type === "year")?.value ?? null;
  const month = parts.find(item => item.type === "month")?.value ?? null;
  const day = parts.find(item => item.type === "day")?.value ?? null;
  return year && month && day ? `${year}-${month}-${day}` : null;
}
