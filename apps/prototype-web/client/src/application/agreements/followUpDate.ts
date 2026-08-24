export type FollowUpDateStatus = "none" | "invalid" | "overdue" | "today" | "upcoming";

const ammanTimeZone = "Asia/Amman";

export function isValidLocalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function localDateInAmman(now: Date | string) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.valueOf())) throw new Error("Invalid instant");
  const parts = new Intl.DateTimeFormat("en", { timeZone: ammanTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function classifyFollowUpDate(followUpDate: string | null, today: string): FollowUpDateStatus {
  if (!followUpDate) return "none";
  if (!isValidLocalDate(followUpDate)) return "invalid";
  if (followUpDate < today) return "overdue";
  if (followUpDate === today) return "today";
  return "upcoming";
}

export function formatLocalDate(followUpDate: string | null) {
  if (!followUpDate || !isValidLocalDate(followUpDate)) return null;
  const [year, month, day] = followUpDate.split("-");
  return `${day}/${month}/${year}`;
}
