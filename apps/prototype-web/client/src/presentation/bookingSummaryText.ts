/**
 * R1-17 (أمر المالك 2026-11-14 — Workstream A/DOC-039): سطرا ملخص القرار
 * على بطاقات الحجز (المسار والموعد) من الملخص الخادمي الآمن — وحدة عرض
 * مستقلة صغيرة عمدًا: صفحات لا تستورد بقية تسميات التوصيل (مثل نظرة المالك)
 * لا تسحبها عدويا إلى كثافة نصها؛ القيم الغائبة تعرض «غير محدد» بصدق لا
 * فراغًا، ولا عناوين تفصيلية هنا أبدًا (خلف بوابة الإفصاح — عقد 21).
 * دفاعية صادقة: بطاقة من خادم قديم/ناقص تعرض «غير محدد» لا انهيار قائمة.
 */

export function bookingRouteText(route?: {
  pickupGovernorate: string | null;
  dropoffGovernorate: string | null;
}): string {
  const from = route?.pickupGovernorate ?? "غير محدد";
  const to = route?.dropoffGovernorate ?? "غير محدد";
  return `${from} ← ${to}`;
}

export function bookingScheduleText(schedule?: { date: string | null; pickupWindow: string | null }): string {
  if ((schedule?.date ?? null) === null && (schedule?.pickupWindow ?? null) === null) return "غير محدد";
  const parts: string[] = [];
  if (schedule?.date != null) parts.push(schedule.date);
  if (schedule?.pickupWindow != null) parts.push(`استلام ${schedule.pickupWindow}`);
  return parts.join(" · ");
}
