import { formatLocalDate, isValidLocalDate } from "@/presentation/formatters";
import { localDateInAmman } from "@micro-domain/shared/index.js";

export type FollowUpDateStatus = "none" | "invalid" | "overdue" | "today" | "upcoming";

export { formatLocalDate, isValidLocalDate, localDateInAmman };

export function classifyFollowUpDate(followUpDate: string | null, today: string): FollowUpDateStatus {
  if (!followUpDate) return "none";
  if (!isValidLocalDate(followUpDate)) return "invalid";
  if (followUpDate < today) return "overdue";
  if (followUpDate === today) return "today";
  return "upcoming";
}
