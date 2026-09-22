/**
 * FIN-005 (WS-175 — Wave 3): عائلة أفق الكاش القصير — نموذج نقٍّ بلا مخزن
 * ولا React ولا مكتبة تواريخ (نفس نمط `periodPresets.ts` من الموجة 1).
 *
 * الأفق عائلة معتمدة من المالك: ٧ / ٣٠ / ٩٠ يومًا، والافتراضي ٣٠. الأفق
 * مثبَّت على «اليوم» المحلي (Asia/Amman — المشتق من لحظة زمنية عبر
 * `localDateInAmman` تبقى مسؤولية المستدعي؛ هنا يُعامل كسلسلة):
 *
 * ```text
 * الأفق(N) = [اليوم، اليوم + N − 1]   // شامل الطرفين بالتاريخ المحلي
 * ```
 *
 * سبعة أيام تعني اليوم وستة أيام بعده — لا «آخر ٧ أيام». كل الحساب بصيغة
 * UTC-millis على منتصف ليل التاريخ المحلي (نفس أسلوب `periodPresets.ts`
 * والسطح الحي): قسمة صحيحة على مضاعفات 86400000 بالضبط، بلا تقريب مالي.
 * القراءة فوق هذا الأفق لا تكتب شيئًا (عقد 17 §7: توقع معلن لا قبض/دفع)،
 * والصيغة نفسها لا تتغير هنا — هذه الوحدة تحلّ النطاق فقط.
 */
import { isValidLocalDate } from "@micro-domain/shared/index.js";

/** أيام الأفق المعتمدة — عائلة مغلقة لا تقبل قيمًا مؤقتة. */
export type ShortCashHorizonDays = 7 | 30 | 90;

export const SHORT_CASH_HORIZON_DAYS: readonly ShortCashHorizonDays[] = [7, 30, 90];

/** الافتراضي المعتمد من المالك: ٣٠ يومًا. */
export const DEFAULT_SHORT_CASH_HORIZON_DAYS: ShortCashHorizonDays = 30;

/** تسميات العرض العربية للعائلة. */
export const SHORT_CASH_HORIZON_LABELS_AR: Readonly<Record<ShortCashHorizonDays, string>> = {
  7: "٧ أيام",
  30: "٣٠ يومًا",
  90: "٩٠ يومًا",
};

/** أفق شامل بحدود محلية `YYYY-MM-DD` (من ≤ إلى). */
export type ShortCashHorizon = {
  horizonDays: ShortCashHorizonDays;
  from: string;
  to: string;
};

/** رفض مُنمّط (typed) لا استثناء خام: رمز واحد ورسالة عربية صريحة —
 * نص الرسالة حرفي داخل `message:` (نمط g5Service نفسه): رسالة تحقق
 * لحظة الفعل لا نص سكون، فلا تدخل كثافة نص السكون بحكم عقد العرض §10.1. */
export type ShortCashHorizonResolution =
  { ok: true; value: ShortCashHorizon } | { ok: false; code: "invalid_horizon"; message: string };

const DAY_MS = 24 * 60 * 60 * 1000;

function parseParts(localDate: string): { year: number; month: number; day: number } | null {
  if (!isValidLocalDate(localDate)) return null;
  const [year, month, day] = localDate.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
}

/** إزاحة أيام على التاريخ المحلي — نفس أسلوب `shiftLocalDays` في periodPresets. */
function shiftLocalDays(localDate: string, days: number): string {
  const parts = parseParts(localDate);
  if (!parts) return localDate;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days)).toISOString().slice(0, 10);
}

/**
 * حلّ الأفق إلى نطاق شامل بتواريخ محلية. `todayLocalISO` تاريخ اليوم
 * المحلي (Asia/Amman) `YYYY-MM-DD` — لا تُشتق هنا لحظة زمنية (الساعة
 * القابلة للحقن مسؤولية الخدمة المستدعية). القيمة المقبولة فقط من
 * العائلة {7, 30, 90}؛ غير ذلك رفض مُنمّط بلا قيم مُختلقة.
 */
export function resolveShortCashHorizon(
  horizonDays: ShortCashHorizonDays,
  todayLocalISO: string,
): ShortCashHorizonResolution {
  if (!SHORT_CASH_HORIZON_DAYS.includes(horizonDays))
    return { ok: false, code: "invalid_horizon", message: "الأفق المعتمد ٧ أو ٣٠ أو ٩٠ يومًا فقط." };
  const today = parseParts(todayLocalISO);
  if (!today)
    return {
      ok: false,
      code: "invalid_horizon",
      message: "أدخل تاريخ اليوم المحلي بصيغة YYYY-MM-DD صحيحة.",
    };
  return {
    ok: true,
    value: { horizonDays, from: todayLocalISO, to: shiftLocalDays(todayLocalISO, horizonDays - 1) },
  };
}
