const ammanTimeZone = "Asia/Amman";

/* مبدأ Micro: تنسيق العرض لا يغيّر قيمة المال أو التاريخ المخزنة في الطبقات الداخلية. */
const moneyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});
const integerFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0, useGrouping: true });
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ammanTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ammanTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
/* المجموعة ٦ (البند ٥): قاعدة منتج نظامية — الأرقام الإنجليزية 0–9 والتاريخ
 * الرقمي DD/MM/YYYY في كل ما يراه المستخدم. لا أسماء شهور ولا اختصاراتها ولا
 * ترتيبًا آخر؛ التنسيق الطويل يصير رقميًا من منزلتين (05/03/2026) والصافي
 * من فورمتر واحد مركزي هذا. */

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
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return (value / 1000)
    .toFixed(3)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
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

/* S4-08: معيّن واحد لتاريخ محلي صحيح — نسخة المجال المرجعية (UTC Y/M/D). */
import { isValidLocalDate as isValidLocalDateDomain } from "@micro-domain/shared/index.js";
export const isValidLocalDate = isValidLocalDateDomain;

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

export function formatLocalDateTime(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return null;
  const parts = dateTimeFormatter.formatToParts(parsed);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")} ${part("hour")}:${part("minute")}`;
}

export function formatMonthLabel(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return value;
  return `${value.slice(5)}/${value.slice(0, 4)}`;
}

export function localDateInAmman(value: Date | string = new Date()) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.valueOf())) throw new Error("Invalid instant");
  const parts = dateFormatter.formatToParts(parsed);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatTime(value: string | null | undefined) {
  return value && /^\d{2}:\d{2}$/.test(value) ? value : null;
}
