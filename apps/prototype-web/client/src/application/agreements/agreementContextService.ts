/**
 * G7-A agreement context: local memory for an existing order, not CRM or messaging.
 * It never creates a ScheduleEntry, reminder, financial event, or external side effect.
 */
import type { AgreementSource, FollowUpEvent, PrototypeLocalStore, StoredCraftOrder } from "@/storage/local/types";

export type LegacyAgreementSource = "conversation" | "call" | "in_person";
export type AgreementSourceValue = AgreementSource | LegacyAgreementSource;
export type AgreementContextInput = { agreementSource: AgreementSourceValue | null; followUpSummary: string | null; followUpDate: string | null; followUpReason: string | null };
export type AgreementContextView = Pick<StoredCraftOrder, "id" | "agreementSource" | "followUpSummary" | "followUpDate" | "followUpReason" | "followUpEvents">;
export type FollowUpRead = { due: readonly StoredCraftOrder[]; upcoming: readonly StoredCraftOrder[] };
export type AgreementContextResult<T> = { ok: true; value: T } | { ok: false; code: "validation_error" | "storage_error" | "not_found"; message: string };

const sources = new Set<AgreementSourceValue>(["instagram", "whatsapp", "referral", "walk_in", "other", "conversation", "call", "in_person"]);
const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};
const todayInAmman = (now: string) => {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Amman", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(now));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};
const normalized = (value: string | null) => value?.trim() || null;
const asView = (stored: StoredCraftOrder): AgreementContextView => ({ id: stored.id, agreementSource: stored.agreementSource ?? null, followUpSummary: stored.followUpSummary ?? null, followUpDate: stored.followUpDate ?? null, followUpReason: stored.followUpReason ?? null, followUpEvents: stored.followUpEvents ?? [] });
const failure = (message: string): Extract<AgreementContextResult<never>, { ok: false }> => ({ ok: false, code: "validation_error", message });

function validateInput(input: AgreementContextInput, previousDate: string | null) {
  if (input.agreementSource !== null && !sources.has(input.agreementSource)) return failure("اختر مصدر اتفاق من القائمة أو اتركه غير محدد.");
  if (input.followUpSummary !== null && (input.followUpSummary.trim().length < 2 || input.followUpSummary.trim().length > 240)) return failure("اكتب ملخص متابعة قصيرًا من حرفين إلى 240 حرفًا، أو اتركه فارغًا.");
  if (input.followUpDate !== null && !validDate(input.followUpDate)) return failure("أدخل تاريخ متابعة محليًا صحيحًا بصيغة YYYY-MM-DD.");
  const dateChanged = input.followUpDate !== previousDate;
  if (input.followUpDate === null && previousDate === null && input.followUpReason !== null) return failure("سبب المتابعة لا يحفظ دون تاريخ متابعة.");
  if (input.followUpDate !== null && previousDate === null && !input.followUpReason) return failure("اكتب هدفًا أو سببًا قصيرًا لموعد المتابعة.");
  if (dateChanged && previousDate !== null && !input.followUpReason) return failure("تغيير تاريخ متابعة موجود يحتاج سببًا مكتوبًا.");
  if (input.followUpReason !== null && (input.followUpReason.trim().length < 2 || input.followUpReason.trim().length > 160)) return failure("اكتب سبب متابعة قصيرًا من حرفين إلى 160 حرفًا.");
  return null;
}

export class AgreementContextService {
  constructor(private readonly store: PrototypeLocalStore, private readonly now: () => string = () => new Date().toISOString()) {}

  async get(id: string): Promise<AgreementContextResult<AgreementContextView | null>> {
    const result = await this.store.getOrder(id);
    return result.ok ? { ok: true, value: result.value ? asView(result.value) : null } : { ok: false, code: "storage_error", message: "تعذر قراءة سياق الاتفاق المحلي." };
  }

  async save(id: string, input: AgreementContextInput): Promise<AgreementContextResult<StoredCraftOrder>> {
    const current = await this.store.getOrder(id);
    if (!current.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة الطلب المحلي قبل حفظ سياق الاتفاق." };
    if (!current.value) return { ok: false, code: "not_found", message: "الطلب غير متاح محليًا؛ لم يتغير أي سياق." };
    const stored = current.value;
    const previousDate = stored.followUpDate ?? null;
    const next: AgreementContextInput = { agreementSource: input.agreementSource, followUpSummary: normalized(input.followUpSummary), followUpDate: normalized(input.followUpDate), followUpReason: normalized(input.followUpReason) };
    const invalid = validateInput(next, previousDate);
    if (invalid) return invalid;
    const previousSummary = stored.followUpSummary ?? null; const previousSource = stored.agreementSource ?? null; const previousReason = stored.followUpReason ?? null;
    const effectiveReason = next.followUpDate === null ? null : next.followUpReason ?? previousReason;
    if (previousSource === next.agreementSource && previousSummary === next.followUpSummary && previousDate === next.followUpDate && previousReason === effectiveReason) return { ok: true, value: stored };
    const timestamp = this.now();
    const events = [...(stored.followUpEvents ?? [])];
    if (previousDate !== next.followUpDate) {
      const event: FollowUpEvent = { id: `${id}:follow-up:${events.length + 1}`, type: previousDate === null ? "created" : "changed", idempotencyKey: `${id}:follow-up:${previousDate ?? "none"}:${next.followUpDate ?? "none"}`, createdAt: timestamp, previousDate, followUpDate: next.followUpDate, reason: next.followUpReason ?? "تحديث سياق المتابعة" };
      events.push(event);
    }
    const updated: StoredCraftOrder = { ...stored, agreementSource: next.agreementSource, followUpSummary: next.followUpSummary, followUpDate: next.followUpDate, followUpReason: effectiveReason, followUpEvents: events, updatedAt: timestamp };
    const saved = await this.store.saveOrder(updated);
    return saved.ok ? { ok: true, value: saved.value } : { ok: false, code: "storage_error", message: "تعذر حفظ سياق الاتفاق محليًا. لم يتم تأكيد نجاح العملية." };
  }

  async dueFollowUps(): Promise<AgreementContextResult<FollowUpRead>> {
    const result = await this.store.listOrders();
    if (!result.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة المتابعات المحلية." };
    const today = todayInAmman(this.now());
    const withDate = result.value.filter((stored) => Boolean(stored.followUpDate) && stored.order.status !== "cancelled");
    return { ok: true, value: { due: withDate.filter((stored) => (stored.followUpDate ?? "") <= today).sort((left, right) => (left.followUpDate ?? "").localeCompare(right.followUpDate ?? "")), upcoming: withDate.filter((stored) => (stored.followUpDate ?? "") > today).sort((left, right) => (left.followUpDate ?? "").localeCompare(right.followUpDate ?? "")) } };
  }
}
