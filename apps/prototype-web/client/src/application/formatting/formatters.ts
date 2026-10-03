/* مبدأ Micro: تنسيق العرض لا يغيّر قيمة المال أو التاريخ المخزنة في الطبقات الداخلية. */
const moneyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});
const integerFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0, useGrouping: true });
/* المجموعة ٦ (البند ٥): قاعدة منتج نظامية — الأرقام الإنجليزية 0–9 والتاريخ
 * الرقمي DD/MM/YYYY في كل ما يراه المستخدم. لا أسماء شهور ولا اختصاراتها ولا
 * ترتيبًا آخر؛ التنسيق الطويل يصير رقميًا من منزلتين (05/03/2026) والصافي
 * من فورمتر واحد مركزي هذا. */

/* Wave 4.4 — P-4.4-2 (عقد التاريخ والوقت المعتمد):
 * ---------------------------------------------------------------------------
 * • التاريخ وحده: `16/09/2026` — أرقام فقط، DD/MM/YYYY، لا أسماء شهور، ولا
 *   فرق بين 16/9 و16/09 (منزلتان دائمًا).
 * • التاريخ مع الوقت: `16/09/2026، 03:30 م` — فاصلة عربية، نظام 12 ساعة،
 *   ص/م، صفر بادئ للساعة والدقيقة.
 * • الوقت المستقل: `03:30 م` بالقواعد نفسها.
 * • اللحظة الكاملة تُعرض على توقيت جهاز المستخدم — لا منطقة مثبتة داخل
 *   طبقة العرض (كانت Asia/Amman قبل هذه الموجة)؛ التخزين يبقى بصيغة UTC
 *   الكنونية الموحدة ولا تتحول أي قيمة مخزنة بسبب التنسيق.
 * • القيمة Date-only (YYYY-MM-DD) ليست لحظة: تُعرض كما هي بلا أي تحويل
 *   منطقة زمنية — لا انزياح يوم عند حدود المناطق أبدًا.
 * • المعامل الثاني (timeZone) اختياري للاختبارات الحتمية عبر المناطق
 *   الموجبة والسالبة — لا يمرره أي مكوّن عرض؛ الافتراض هو توقيت الجهاز.
 */
const dateTimeFormatOptions: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
};
const zonedDateTimeFormatters = new Map<string, Intl.DateTimeFormat>();
function dateTimeFormatterFor(timeZone: string | undefined): Intl.DateTimeFormat {
  if (timeZone === undefined) {
    /* توقيت الجهاز: كائن جديد لكل نداء كي يتبع بيئة التشغيل الحية — لا كاش
     * يثبّت منطقة أول تشغيل. */
    return new Intl.DateTimeFormat("en-US", dateTimeFormatOptions);
  }
  let formatter = zonedDateTimeFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", { timeZone, ...dateTimeFormatOptions });
    zonedDateTimeFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * مبدأ Micro: الجمع العربي يتبع القواعد اللغوية (0، 1، 2، 3-10، 11-99، 100+).
 * لا نستخدم "1 طلبات" أو "2 مادة".
 */
export function formatArabicPlural(
  count: number | null | undefined,
  forms: {
    zero: string;
    one: string;
    two: string;
    few: string; // 3-10
    many: string; // 11-99
    other: string; // 100+ or fallback
  },
) {
  if (count === null || count === undefined || !Number.isFinite(count)) return "—";
  const absCount = Math.abs(count);
  if (absCount === 0) return forms.zero;
  if (absCount === 1) return forms.one;
  if (absCount === 2) return forms.two;
  const lastTwo = absCount % 100;
  if (lastTwo >= 3 && lastTwo <= 10) return `${count} ${forms.few}`;
  if (lastTwo >= 11 && lastTwo <= 99) return `${count} ${forms.many}`;
  return `${count} ${forms.other}`;
}

export function formatMoneyMinor(minor: number | null | undefined) {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) return "—";
  return moneyFormatter.format(minor / 100);
}

/* S4-06: مصدر واحد لعرض المال بوحدته — الرقم بفواصل الآلاف والوحدة بعده بمسافة.
 * (S3-09): توحيد كل المساعدات المحلية المكررة على هذا المعيّن. */
export function formatMoneyWithUnit(minor: number | null | undefined) {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) return "—";
  return `${moneyFormatter.format(minor / 100)} د.أ`;
}

export function formatInteger(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return integerFormatter.format(value);
}

export function formatQuantityMilli(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isSafeInteger(value)) return "—";
  return trimTrailingZeros(quantityMilliToFixed3(value));
}

/* المجموعة ١١ (المرحلة 11-0 — سياسة القيم الدقيقة): التنسيق الكمي الكنسي
 * واحد يُبنى بإنشاء السلسلة العشرية من عدد الملي الصحيح مباشرة — قسمة
 * صحيحة/صحيحة وبقية صحيحة فلا شوائب ثنائية أصلًا (لا 0.30000000000000004)،
 * ولا يغيّر التنسيق القيمة أبدًا: تطبيع الأصفار اللاحقة تمثيل لا تقريب. */
function quantityMilliToFixed3(milli: number): string {
  const sign = milli < 0 ? "-" : "";
  const abs = Math.abs(milli);
  const whole = Math.floor(abs / 1000);
  const fraction = abs - whole * 1000;
  return `${sign}${whole}.${String(fraction).padStart(3, "0")}`;
}

function trimTrailingZeros(text: string): string {
  return text.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

/** عرض الكمية بمنزلة الألف الثابتة حيث يُبلَّغ عقد الدقة نفسه (الكتالوج وفروق
 * التسليم) — نفس المصدر الكنسي وسياسة عرض موثقة لا تغيّر القيمة. */
export function formatQuantityMilliFixed3(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isSafeInteger(value)) return "—";
  return quantityMilliToFixed3(value);
}

export type BreakEvenDisplay = { number: string; scale: string };

export function formatBreakEvenDisplay(
  value: number | null,
  unitKey: string | null,
  unitLabel: string | null,
): BreakEvenDisplay | null {
  if (value === null || !Number.isSafeInteger(value) || value <= 0) return null;
  const normalizedLabel = unitLabel?.trim();
  const scale =
    unitKey === "legacy:recorded-mix" || !unitKey || !normalizedLabel ? "من المزيج المسجل" : normalizedLabel;
  return { number: integerFormatter.format(value), scale };
}

/* S4-08 + المجموعة ۹ (STR-031): معيّن المجال المرجعي — تحقق صلاحية Date-only
 * وتاريخ الأعمال الكنوني بتوقيت عمّان يأتيان من النطاق لا من طبقة العرض؛
 * إعادة التصدير لتوافق مستورديها الحاليين فقط. */
import {
  ammanDateOrNull,
  isValidLocalDate as isValidLocalDateDomain,
  localDateInAmman,
} from "@micro-domain/shared/index.js";
export const isValidLocalDate = isValidLocalDateDomain;
export { localDateInAmman };

export function formatLocalDate(value: string | null | undefined) {
  if (!value || !isValidLocalDate(value)) return null;
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

/* المجموعة ٦ (البند ٥): الطويل = الرقمي نفسه بمنزلتين — لا أسماء شهور أبدًا.
 * حاضر للتوافق مع الاستدعاءات القائمة؛ الشهر الرقمي MM/YYYY لتسمية الشهر. */
export function formatLocalDateLong(value: string | null | undefined) {
  return formatLocalDate(value);
}

export function formatLocalDateTime(value: string | null | undefined, timeZone?: string) {
  if (!value) return null;
  /* Date-only الكنوني ليس لحظة زمنية — يُعرض تاريخًا صرفًا بلا تحويل منطقة،
   * فلا ينزيح يومًا عند حدود المناطق (سياسة P-4.4-2). */
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatLocalDate(value);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return null;
  const parts = dateTimeFormatterFor(timeZone).formatToParts(parsed);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  /* نظام 12 ساعة بفترة عربية ص/م وصفر بادئ للساعة — عقد العرض المعتمد. */
  const hour = part("hour").padStart(2, "0");
  const dayPeriod = part("dayPeriod").toUpperCase() === "PM" ? "م" : "ص";
  return `${part("day")}/${part("month")}/${part("year")}، ${hour}:${part("minute")} ${dayPeriod}`;
}

export function formatMonthLabel(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return value;
  return `${value.slice(5)}/${value.slice(0, 4)}`;
}

export function formatTime(value: string | null | undefined) {
  /* Wave 4.4 — P-4.4-2: الوقت المستقل بنظام 12 ساعة وفترة عربية —
   * `03:30 م`؛ التخزين يبقى HH:MM بنظام 24 والتحويل عرض فقط لا قيمة. */
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hourText, minute] = value.split(":");
  const hour = Number(hourText);
  if (hour > 23 || Number(minute) > 59) return null;
  const dayPeriod = hour < 12 ? "ص" : "م";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(displayHour).padStart(2, "0")}:${minute} ${dayPeriod}`;
}

/* Wave 4.4 — P-4.4-2: اشتقاق تاريخ العرض من لحظة مسجلة — بتاريخ الأعمال
 * الكنوني من عقد وقت الأعمال في النطاق (المجموعة ٩)، لا بقصّ UTC الذي كان
 * يزيح اليوم عند حدود المناطق؛ الناتج canonical YYYY-MM-DD يمر عبر
 * formatLocalDate للعرض. القيمة غير الصالحة تعلن غياب المعرفة (null). */
export function businessDateFromTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  if (isValidLocalDate(value)) return value;
  return ammanDateOrNull(value);
}
