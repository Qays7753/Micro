/* ─── نواة التاريخ المحلي الكنسية (R2 — M-01/M-02، 2026-10-08) ───
 * العقد: تاريخ محلي بصيغة ISO 8601 calendar date `YYYY-MM-DD` بنطاق سنوات
 * صريح 0000–9999 (تقويم غريغوري استباقي؛ السنة 0 كبيسة)؛ الشهر 01–12؛
 * اليوم صالح تقويميًا لشهره وسنته. لا كائن `Date` ولا منصة JS في أي حساب
 * (لا إعادة تعيين 1900+، لا دوران، لا RangeError) — حريد الحساب الصحيح
 * الخالص، ويفرضه حارس ملكية حساب التاريخ (check-date-arithmetic-ownership).
 * المالك الوحيد لصلاحية التاريخ المحلي وحسابه لكل المجال والتطبيق. */
const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonthOf(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

export function isValidLocalDate(value: string): boolean {
  if (!LOCAL_DATE_PATTERN.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonthOf(year, month);
}

function parseLocalDate(value: string): { year: number; month: number; day: number } | null {
  if (!isValidLocalDate(value)) return null;
  return {
    year: Number(value.slice(0, 4)),
    month: Number(value.slice(5, 7)),
    day: Number(value.slice(8, 10)),
  };
}

function formatLocalDateParts(year: number, month: number, day: number): string | null {
  /* الناتج يجب أن يبقى داخل النطق القابل للتمثيل 0000–9999 وإلا فهو ليس
   * تاريخًا محليًا كنونيًا — null صريح بدل سلسلة موسعة غير صالحة. */
  if (year < 0 || year > 9999 || month < 1 || month > 12) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** أيام منذ 1970-01-01 للتاريخ المحلي الصالح (خوارزمية تقويم غريغوري استباقي
 * الخالصة — Howard Hinnant days_from_civil)؛ نفس محور `Date.UTC/86400000`
 * التاريخي فيتكافآن قطعًا للسنوات ≥ 0100 حيث كانت القديمة صحيحة. `null`
 * للمدخل غير الصالح — أساس فروق الأيام (المستدعون يفشلون مغلقًا عند null). */
export function localDateDayNumber(value: string): number | null {
  const parts = parseLocalDate(value);
  if (!parts) return null;
  const shiftedYear = parts.month <= 2 ? parts.year - 1 : parts.year;
  const era = Math.floor(shiftedYear / 400);
  const yearOfEra = shiftedYear - era * 400;
  const dayOfYear = Math.floor((153 * (parts.month + (parts.month > 2 ? -3 : 9)) + 2) / 5) + parts.day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

function civilFromDayNumber(dayNumber: number): { year: number; month: number; day: number } {
  const shifted = dayNumber + 719468;
  const era = Math.floor(shifted / 146097);
  const dayOfEra = shifted - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) /
      365,
  );
  const year = yearOfEra + era * 400;
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthIndex = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthIndex + 2) / 5) + 1;
  const month = monthIndex + (monthIndex < 10 ? 3 : -9);
  return { year: month <= 2 ? year + 1 : year, month, day };
}

/** إزاحة أيام على تاريخ محلي صالح — حساب خالص (لا مرساة ولا منصة).
 * `null`: مدخل غير صالح أو ناتج خارج النطاق القابل للتمثيل 0000–9999. */
export function localDatePlusDays(value: string, days: number): string | null {
  const dayNumber = localDateDayNumber(value);
  if (dayNumber === null || !Number.isSafeInteger(dayNumber + days)) return null;
  const shifted = civilFromDayNumber(dayNumber + days);
  return formatLocalDateParts(shifted.year, shifted.month, shifted.day);
}

/** إزاحة شهور تقويمية مع تثبيت اليوم عند آخر يوم شهر الناتج (نفس دلالة
 * إزاحة الشهور في التكرارات) — `null` للمدخل غير الصالح أو الناتج خارج النطاق. */
export function localDatePlusMonthsClamped(value: string, months: number): string | null {
  const parts = parseLocalDate(value);
  if (!parts || !Number.isSafeInteger(parts.year * 12 + parts.month - 1 + months)) return null;
  const totalMonths = parts.year * 12 + (parts.month - 1) + months;
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths - year * 12 + 1;
  const day = Math.min(parts.day, daysInMonthOf(year, month));
  return formatLocalDateParts(year, month, day);
}

/** فهرس يوم الأسبوع بدءًا من الأحد (0 = الأحد) — يكافئ `getUTCDay()`
 * التاريخي؛ `null` للمدخل غير الصالح. 1970-01-01 خميس = 4. */
export function localDateWeekdayIndex(value: string): number | null {
  const dayNumber = localDateDayNumber(value);
  if (dayNumber === null) return null;
  return ((dayNumber % 7) + 7 + 4) % 7;
}

/** آخر يوم لشهر مفتاحه `YYYY-MM` بصيغة تاريخ محلي كامل — `null` للمفتاح
 * غير الصالح أو السنة خارج 0000–9999. */
export function localDateMonthEnd(monthKey: string): string | null {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return null;
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  if (month < 1 || month > 12) return null;
  return formatLocalDateParts(year, month, daysInMonthOf(year, month));
}

/** عدد أيام الشهر (28/29/30/31). الشرط المسبق: شهر 1–12 (المستدعون
 * يتحققون من المفتاح قبل النداء — لا تعيد النواة التحقق). */
export { daysInMonthOf };

export function isValidTimestamp(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

/** مجموع أعداد صحيحة آمنة بطيّ القاعدة الزوجية الكنسية `addSafe` — حارس
 * فيض الاتجاهين؛ `null` لأي مدخل غير آمن أو فيض. (المالك الكنوني للجمع
 * المحروس — R2-X2؛ كان مجموعًا محليًا يعيد اختراع القاعدة.) */
export function sumSafeIntegers(values: readonly number[]): number | null {
  let total = 0;
  for (const value of values) {
    const next = addSafe(total, value);
    if (next === null) return null;
    total = next;
  }
  return total;
}

const FIELD_LABELS_AR: Readonly<Record<string, string>> = {
  id: "المعرّف",
  name: "الاسم",
  note: "الوصف",
  reason: "السبب",
  source: "المصدر",
  supplierName: "اسم المورد",
  customerName: "اسم العميل",
  itemName: "اسم العمل",
  idempotencyKey: "مفتاح العملية",
  operationKey: "مفتاح العملية",
  createdOperationKey: "مفتاح الإنشاء",
  amountMinor: "المبلغ",
  totalMinor: "إجمالي الشراء",
  initialPaidMinor: "المبلغ المدفوع مبدئيًا",
  agreedPriceMinor: "السعر المتفق عليه",
  hourlyRateMinor: "أجر الساعة",
  unitPriceMinor: "سعر الوحدة",
  packagingMinor: "قيمة التغليف",
  deliveryMinor: "قيمة التوصيل",
  wasteMinor: "قيمة الهدر",
  safetyBufferMinor: "هامش الحماية",
  totalAmountMinor: "إجمالي المصروف المشترك",
  calculatedShareMinor: "حصة المشروع المحسوبة",
  percentageBps: "النسبة",
  baseMinor: "المبلغ الأساس",
  quantity: "الكمية",
  unitLabel: "تسمية الوحدة",
  freshnessDays: "أيام صلاحية السعر",
  purchasedOn: "تاريخ الشراء",
  dueOn: "تاريخ الاستحقاق",
  occurredOn: "تاريخ الحركة",
  startsOn: "تاريخ البداية",
  endsOn: "تاريخ النهاية",
  periodFrom: "بداية الفترة",
  periodTo: "نهاية الفترة",
  createdAt: "وقت الإنشاء",
  recordedAt: "وقت التسجيل",
  walletId: "المحفظة",
  policyId: "السياسة",
  relatedOrderId: "الطلب المرتبط",
  relatedEventId: "الحدث المرتبط",
  reversalReason: "سبب التراجع",
  sourceKeys: "مفاتيح المصدر",
  version: "رقم النسخة",
  policyVersion: "رقم نسخة السياسة",
};

/** Arabic label for a validation field key so guard messages reach the user in their own language. */
export function fieldLabelAr(field: string): string {
  return FIELD_LABELS_AR[field] ?? field;
}

export function assertId(value: string, field: string): void {
  if (!value.trim()) throw new Error(`أكمل ${fieldLabelAr(field)} قبل الحفظ.`);
}

export function assertPositiveMinor(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`أدخل ${fieldLabelAr(field)} رقمًا صحيحًا موجبًا ضمن الدقة الآمنة.`);
}

export function assertNonNegativeInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`أدخل ${fieldLabelAr(field)} رقمًا صحيحًا غير سالب بالدينار الأردني ضمن الدقة الآمنة.`);
  }
}

export function addSafe(left: number, right: number): number | null {
  if (
    !Number.isSafeInteger(left) ||
    !Number.isSafeInteger(right) ||
    (right > 0 && left > Number.MAX_SAFE_INTEGER - right) ||
    (right < 0 && left < Number.MIN_SAFE_INTEGER - right)
  )
    return null;
  return left + right;
}

/** Whole milli units of a user quantity, or null when the quantity is not exactly milli-representable. */
export function quantityMilliExact(quantity: number): number | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const scaled = Math.round(quantity * 1000);
  if (!Number.isSafeInteger(scaled) || scaled <= 0 || Math.abs(quantity - scaled / 1000) > Number.EPSILON)
    return null;
  return scaled;
}

export function roundHalfUp(numerator: number, denominator: number): number | null {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) return null;
  const quotient = Math.floor(numerator / denominator);
  const remainder = numerator % denominator;
  return quotient + (remainder * 2 >= denominator ? 1 : 0);
}

export function floorRatio(numerator: number, denominator: number): number | null {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) return null;
  return Math.floor(numerator / denominator);
}

export function ceilRatio(numerator: number, denominator: number): number | null {
  if (
    !Number.isSafeInteger(numerator) ||
    !Number.isSafeInteger(denominator) ||
    numerator < 0 ||
    denominator <= 0
  )
    return null;
  return Math.floor(numerator / denominator) + (numerator % denominator === 0 ? 0 : 1);
}
