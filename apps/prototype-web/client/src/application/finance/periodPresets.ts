/**
 * FIN-007 (WS-173 — Wave 1): نموذج اختيار الفترة النقي — قوالب الفترات
 * (أسبوع/شهر/ربع، الحالي والسابق الكامل) والفترة السابقة المكافئة وحالة
 * الفترة الجارية. وحدة نقية بلا مخزن ولا React ولا مكتبة تواريخ: كل المداخل
 * والمخارج تواريخ محلية `YYYY-MM-DD` بدلالة Asia/Amman (المشتقة من لحظة
 * زمنية عبر `localDateInAmman` تبقى مسؤولية المستدعي — هنا تُعامل كسلسلة).
 *
 * اصطلاح الأسبوع: الأحد → السبت — نفس اصطلاح السطح الحي
 * (`pages/Statement.tsx` و`pages/FinanceActivity.tsx`: `getUTCDay()` ثم
 * إزاحة إلى الأحد). لو لم يكن في المستودع اصطلاح لكان الافتراضي الاثنين،
 * لكن الاصطلاح القائم هو الأحد فنطابقه ولا نخترع ثانيًا.
 *
 * الربع: ربع تقويمي (Q1 = كانون الثاني–آذار … Q4 = تشرين الأول–كانون الأول).
 * «السابق» يعني دائمًا الفترة الكاملة المنقضية (أسبوع/شهر/ربع سابق)، لا
 * «منذ ٧ أيام» — مقارنة فترات متكافئة لا متداخلة.
 *
 * كل الحساب بصيغة UTC-millis على منتصف ليل التاريخ المحلي (نفس أسلوب
 * السطح الحي) — لا تقريب مالي هنا، وإزاحة الأيام قسمة صحيحة على مضاعفات
 * 86400000 بالضبط.
 */
import { isValidLocalDate } from "@micro-domain/shared/index.js";

export type PeriodPresetId =
  "this_week" | "last_week" | "this_month" | "last_month" | "this_quarter" | "last_quarter" | "custom";

/** فترة شاملة بحدود محلية `YYYY-MM-DD` (من ≤ إلى). */
export type PeriodRange = {
  from: string;
  to: string;
};

/** رفض مُنمّط (typed) لا استثناء خام: رمز واحد ورسالة عربية صريحة. */
export type PeriodPresetResolution =
  { ok: true; value: PeriodRange } | { ok: false; code: "invalid_period"; message: string };

export const PERIOD_PRESET_IDS: readonly PeriodPresetId[] = [
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "this_quarter",
  "last_quarter",
  "custom",
] as const;

/** تسميات العرض العربية — مطابقة لحروف «كشف الفترة» الحية (Statement.tsx) مع إضافة القوالب الجديدة. */
export const PERIOD_PRESET_LABELS_AR: Readonly<Record<PeriodPresetId, string>> = {
  this_week: "هذا الأسبوع",
  last_week: "الأسبوع الماضي",
  this_month: "هذا الشهر",
  last_month: "الشهر الماضي",
  this_quarter: "هذا الربع",
  last_quarter: "الربع الماضي",
  custom: "نطاق مخصص",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseParts(localDate: string): { year: number; month: number; day: number } | null {
  if (!isValidLocalDate(localDate)) return null;
  const [year, month, day] = localDate.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
}

/** إزاحة أيام على التاريخ المحلي — نفس أسلوب `shiftDate` في السطح الحي (منتصف ليل UTC). */
function shiftLocalDays(localDate: string, days: number): string {
  const parts = parseParts(localDate);
  if (!parts) return localDate;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days)).toISOString().slice(0, 10);
}

/** فهرس يوم الأسبوع بدايةً من الأحد (0 = الأحد) — نفس `getUTCDay()` في السطح الحي. */
function sundayWeekdayIndex(localDate: string): number {
  const parts = parseParts(localDate);
  if (!parts) return 0;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

/** عدد أيام الشهر (28/29/30/31) — نفس أسلوب حسبة «هذا الشهر» في كشف الفترة. */
function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthRange(year: number, month: number): PeriodRange {
  const paddedMonth = String(month).padStart(2, "0");
  return {
    from: `${year}-${paddedMonth}-01`,
    to: `${year}-${paddedMonth}-${String(lastDayOfMonth(year, month)).padStart(2, "0")}`,
  };
}

/** الشهر السابق الكامل مع لف السنة (كانون الأول → كانون الثاني للسنة الأدنى). */
function previousMonth(year: number, month: number): PeriodRange {
  return month === 1 ? monthRange(year - 1, 12) : monthRange(year, month - 1);
}

/** أول شهر في الربع (1/4/7/10) — قسمة صحيحة بلا Math.floor (ممنوع في طبقة التطبيق). */
function quarterStartMonth(month: number): number {
  return month - ((month - 1) % 3);
}

function quarterRange(year: number, month: number): PeriodRange {
  const startMonth = quarterStartMonth(month);
  return {
    from: monthRange(year, startMonth).from,
    to: monthRange(year, startMonth + 2).to,
  };
}

/** الربع السابق الكامل مع لف السنة (Q1 → Q4 للسنة الأدنى). */
function previousQuarter(year: number, month: number): PeriodRange {
  return month <= 3 ? quarterRange(year - 1, 12) : quarterRange(year, month - 3);
}

function invalid(message: string): PeriodPresetResolution {
  return { ok: false, code: "invalid_period", message };
}

/**
 * حلّ القالب إلى فترة شاملة بتواريخ محلية. `todayLocalISO` تاريخ اليوم
 * المحلي (Asia/Amman) — لا يُشتق هنا لحظة زمنية. القالب `custom` يأخذ
 * مدخلات صريحة ويرفض نطاقًا يبدأ بعد نهايته أو تواريخ غير صالحة برفض
 * مُنمّط (لا استثناء ولا قيم مُختلقة).
 */
export function resolvePeriodPreset(
  preset: PeriodPresetId,
  todayLocalISO: string,
  custom?: { from: string; to: string },
): PeriodPresetResolution {
  const today = parseParts(todayLocalISO);
  if (!today) return invalid("أدخل تاريخ اليوم المحلي بصيغة YYYY-MM-DD صحيحة.");
  if (preset === "custom") {
    const from = parseParts(custom?.from ?? "");
    const to = parseParts(custom?.to ?? "");
    if (!from || !to) return invalid("أدخل بداية الفترة ونهايتها بتاريخين محليين صحيحين.");
    if (custom!.from > custom!.to) return invalid("بداية النطاق المخصص يجب أن تسبق نهايته أو تطابقها.");
    return { ok: true, value: { from: custom!.from, to: custom!.to } };
  }
  switch (preset) {
    case "this_week": {
      const from = shiftLocalDays(todayLocalISO, -sundayWeekdayIndex(todayLocalISO));
      return { ok: true, value: { from, to: shiftLocalDays(from, 6) } };
    }
    case "last_week": {
      const from = shiftLocalDays(todayLocalISO, -sundayWeekdayIndex(todayLocalISO) - 7);
      return { ok: true, value: { from, to: shiftLocalDays(from, 6) } };
    }
    case "this_month":
      return { ok: true, value: monthRange(today.year, today.month) };
    case "last_month":
      return { ok: true, value: previousMonth(today.year, today.month) };
    case "this_quarter":
      return { ok: true, value: quarterRange(today.year, today.month) };
    case "last_quarter":
      return { ok: true, value: previousQuarter(today.year, today.month) };
  }
}

/** عدد الأيام بين تاريخين محليين (to − from) — قسمة مضاعفات UTC-millis الدقيقة بلا تقريب. */
function daysBetween(from: string, to: string): number {
  const fromParts = parseParts(from);
  const toParts = parseParts(to);
  if (!fromParts || !toParts) return 0;
  return (
    (Date.UTC(toParts.year, toParts.month - 1, toParts.day) -
      Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day)) /
    DAY_MS
  );
}

/**
 * الفترة السابقة المكافئة فورًا بطول مطابق: نهايتها = اليوم الذي يسبق
 * بداية الفترة، وبدايتها = نهايتها الجديدة − (الطول − 1). فترة يوم واحد
 * سابقتها اليوم السابق وحده. المدخل يُفترض نطاقًا محليًا صالحًا (من ≤ إلى)
 * ولا يُعدَّل أبدًا — دالة نقية.
 */
export function previousEqualPeriod(range: PeriodRange): PeriodRange {
  const length = daysBetween(range.from, range.to) + 1;
  const to = shiftLocalDays(range.from, -1);
  return { from: shiftLocalDays(to, -(length - 1)), to };
}

/** هل اليوم المحلي داخل الفترة (من ≤ اليوم ≤ إلى)؟ — أساس وسم «فترة جارية». */
export function isPeriodActive(range: PeriodRange, todayLocalISO: string): boolean {
  return todayLocalISO >= range.from && todayLocalISO <= range.to;
}
