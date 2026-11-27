/**
 * M5.1/M5.10 (Manage v2 phase 5 — §9 R-19/R-21 + §10 «نصوص مركّبة»): تنسيق
 * العرض المشترك لأسطح مانج — التواريخ (R-21)، العمر (R-19 بمفاتيح §10.7)،
 * واستيفاء العناصر النائبة `{x}` في نصوص الكتالوج.
 *
 * الحدود:
 *  - التاريخ نص→نص صرف (إعادة ترتيب مقاطع YYYY-MM-DD إلى dd/mm/yyyy) — لا
 *    حساب تاريخ هنا؛ كل حساب أيام التاريخ (العمر) يمر بنواة التاريخ
 *    المشتركة المملوكة (`src/domain/shared/numeric.ts` — ملكية حساب التاريخ
 *    R5) عبر بوابة `@micro-domain/shared` المسموحة للعميل (R10 يمنع مجال
 *    مانج وحده).
 *  - المبالغ ليست هنا أبدًا: نص المبلغ المعروض يأتي جاهزًا من الخادم، ونص
 *    الإدخال من moneyInput.ts — كل رقم مالي واحد له مصدر واحد.
 *  - العمر نص عرض مشتق من تاريخين (origin وtoday) — ليس رقمًا ماليًا ولا
 *    يعتمد على أي قيمة من §8.
 */
import { floorRatio, localDateDayNumber } from "@micro-domain/shared/index.js";
import { t, type ManageStringKey } from "../strings/index.js";

/** استيفاء العناصر النائبة حرفيًا: fill("رصيدك {amount}", { amount: "85" })
 *  → "رصيدك 85". كل قيمة تُستبدل كنص كما وردت (أرقامًا جاهزة من الخادم). */
export function fill(key: ManageStringKey, params: Record<string, string>): string {
  let text = t(key);
  for (const [name, value] of Object.entries(params)) {
    text = text.split(`{${name}}`).join(value);
  }
  return text;
}

/** R-21: `2026-11-25` → `25/11/2026` في كل مكان — نص→نص صرف، والمدخل
 *  غير الصالح يُعرض كما ورد (صدق العرض لا توقّعه). */
export function formatDateR21(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (match === null) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** R-21 لتسمية الشهر: `2026-11` → `11/2026` (رأس التقويم وأعمدة الربح). */
export function formatMonthR21(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(isoDate);
  if (match === null) return isoDate;
  return `${match[2]}/${match[1]}`;
}

/** مفتاح عمر R-19 لعدد أيام — التصنيف الحرفي للقاعدة (الأسابيع floor/7
 *  من 14–55 يومًا والأشهر floor/30 من 56). */
function ageKeyOf(days: number): { key: ManageStringKey; n?: number } {
  if (days <= 0) return { key: "a.today" };
  if (days === 1) return { key: "l.age_day1" };
  if (days === 2) return { key: "l.age_day2" };
  if (days >= 3 && days <= 10) return { key: "l.age_days", n: days };
  if (days >= 11 && days <= 13) return { key: "l.age_days_many", n: days };
  if (days >= 14 && days <= 55) {
    const weeks = floorRatio(days, 7) ?? 0;
    if (weeks === 2) return { key: "l.age_week2" };
    return { key: "l.age_weeks", n: weeks };
  }
  const months = floorRatio(days, 30) ?? 0;
  if (months === 1) return { key: "l.age_month1" };
  if (months === 2) return { key: "l.age_month2" };
  if (months >= 3 && months <= 10) return { key: "l.age_months", n: months };
  return { key: "l.age_months_many", n: months };
}

/** نص العمر C-11 (R-19) لتاريخ نشوء مقابل «اليوم» — الفرق بالنواة
 *  المشتركة (أيام صحيحة)، والنص من الكتالوج حصرًا. التاريخ غير الصالح
 *  يُعرض بتاريخه المنسق (صدقٌ لا تعويض). */
export function ageTextR19(originOn: string, today: string): string {
  const origin = localDateDayNumber(originOn);
  const now = localDateDayNumber(today);
  if (origin === null || now === null) return formatDateR21(originOn);
  const { key, n } = ageKeyOf(now - origin);
  return n === undefined ? t(key) : fill(key, { n: String(n) });
}
