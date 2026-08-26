const ammanTimeZone = "Asia/Amman";

const moneyFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });
const integerFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0, useGrouping: true });
const dateFormatter = new Intl.DateTimeFormat("en-US", { timeZone: ammanTimeZone, year: "numeric", month: "2-digit", day: "2-digit" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", { timeZone: ammanTimeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const monthFormatter = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { timeZone: ammanTimeZone, month: "long", year: "numeric" });

export function formatMoneyMinor(minor: number | null | undefined) {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) return "غير متاح";
  return moneyFormatter.format(minor / 100);
}

export function formatInteger(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "غير متاح";
  return integerFormatter.format(value);
}

export function formatQuantityMilli(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "غير متاح";
  return (value / 1000).toFixed(3).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export type BreakEvenDisplay = { number: string; scale: string };

export function formatBreakEvenDisplay(value: number | null, unitKey: string | null, unitLabel: string | null): BreakEvenDisplay | null {
  if (value === null || !Number.isSafeInteger(value) || value <= 0) return null;
  const normalizedLabel = unitLabel?.trim();
  const scale = unitKey === "legacy:recorded-mix" || !unitKey || !normalizedLabel ? "من المزيج المسجل" : normalizedLabel;
  return { number: integerFormatter.format(value), scale };
}

export function isValidLocalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function formatLocalDate(value: string | null | undefined) {
  if (!value || !isValidLocalDate(value)) return null;
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function formatLocalDateTime(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return null;
  const parts = dateTimeFormatter.formatToParts(parsed);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")} ${part("hour")}:${part("minute")}`;
}

export function formatMonthLabel(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return value;
  const parsed = new Date(`${value}-15T12:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) ? value : monthFormatter.format(parsed);
}

export function localDateInAmman(value: Date | string = new Date()) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.valueOf())) throw new Error("Invalid instant");
  const parts = dateFormatter.formatToParts(parsed);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatTime(value: string | null | undefined) {
  return value && /^\d{2}:\d{2}$/.test(value) ? value : null;
}
