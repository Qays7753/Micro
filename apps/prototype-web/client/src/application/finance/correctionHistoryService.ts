/** U-001: «السجل» — سطح قراءة واحد لكل تصحيح موثق عبر أنواع السجلات المدعومة.
 * لا يكتب شيئًا ولا يعيد تفسير الماضي؛ يجمع ما سُجّل فعلًا من مصادر كل مخزن. */
import type { FinancialEvent, FinancialEventType } from "@micro-domain/financial-event/index.js";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";
import type { CashContinuityEntry } from "@micro-domain/cash-continuity/index.js";
import type { PrototypeLocalStore } from "@/storage/local/types";

export type CorrectionHistoryKind =
  | "event_reversal"
  | "event_edit"
  | "event_restore"
  | "sale_edit"
  | "sale_cancel"
  | "sale_price_cut"
  | "cash_reversal";

export type CorrectionHistoryGroup = "all" | "events" | "sales" | "cash";

export type CorrectionHistoryEntry = {
  id: string;
  kind: CorrectionHistoryKind;
  /** متى سُجّل التصحيح نفسه (وقت التسجيل، لا تاريخ الأثر). */
  recordedAt: string;
  /** التاريخ الفعال للتصحيح حيث له معنى؛ null حين لا ينطبق. */
  occurredOn: string | null;
  /** أثر مالي موقّع حيث يمكن التعبير عنه برقم واحد صادق؛ null حين لا يمكن. */
  amountEffectMinor: number | null;
  reason: string | null;
  /** وصف السجل الأصلي (نوع · تاريخ · مبلغ) كما سُجّل. */
  originalLabel: string | null;
  /** وصف البديل في التعديلات الذرّية (تراجع + بديل). */
  replacementLabel: string | null;
  /** رابط عميق حيث يوجد للسجل مسار حقيقي. */
  deepLink: string | null;
};

export type CorrectionHistoryResult =
  | { ok: true; value: readonly CorrectionHistoryEntry[] }
  | { ok: false; code: "storage_error"; message: string };

export const eventKindLabel: Record<FinancialEventType, string> = {
  owner_investment_cash: "استثمار المالك",
  owner_withdrawal_cash: "سحب شخصي",
  operating_expense_cash: "مصروف مدفوع",
  operating_expense_payable: "مصروف مستحق",
  payable_settlement_cash: "تسديد التزام",
  amanah_held_cash: "أمانة قُبضت",
  amanah_released_cash: "أمانة سُلّمت",
  loss_non_cash: "هالك بلا خروج نقد",
};

const money = (minor: number) => `${(minor / 100).toFixed(2)} د.أ`;

/** استرجاع الحدث المالي يُوسَم بمفتاح «restore:<id>» من واجهة التصحيح — علامة صريحة لا تخمين. */
const RESTORE_KEY_PREFIX = "restore:";
/** تعديل الحدث الذرّي يُنشئ تراجعًا بمفتاح «<key>:reversal» والبديل بمفتاح «<key>». */
const EDIT_REVERSAL_SUFFIX = ":reversal";

export class CorrectionHistoryService {
  constructor(private readonly store: PrototypeLocalStore) {}

  async list(): Promise<CorrectionHistoryResult> {
    const [eventsResult, salesResult, cashResult] = await Promise.all([
      this.store.listFinancialEvents(),
      this.store.listDirectSales(),
      this.store.listCashContinuityEntries(),
    ]);
    if (!eventsResult.ok || !salesResult.ok || !cashResult.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة سجل التصحيحات المحلي." };

    const events = eventsResult.value;
    const byId = new Map(events.map(event => [event.id, event] as const));
    const entries: CorrectionHistoryEntry[] = [];

    for (const event of events) {
      /* تراجع/تعديل: كل حدث تراجع موثق يشير للأصل بـ correctionOfEventId. */
      if (event.correctionType === "reverse" && event.correctionOfEventId) {
        const source = byId.get(event.correctionOfEventId) ?? null;
        const isEdit = event.idempotencyKey.endsWith(EDIT_REVERSAL_SUFFIX);
        const replacement = isEdit
          ? events.find(
              candidate =>
                candidate.idempotencyKey === event.idempotencyKey.slice(0, -EDIT_REVERSAL_SUFFIX.length),
            ) ?? null
          : null;
        entries.push({
          id: event.id,
          kind: isEdit && replacement ? "event_edit" : "event_reversal",
          recordedAt: event.recordedAt,
          occurredOn: event.occurredOn,
          amountEffectMinor:
            isEdit && replacement && source
              ? replacement.amountMinor - source.amountMinor
              : -event.amountMinor,
          reason: event.correctionReason ?? null,
          originalLabel: source
            ? `${eventKindLabel[source.type]} · ${source.occurredOn} · ${money(source.amountMinor)}`
            : null,
          replacementLabel:
            isEdit && replacement
              ? `${eventKindLabel[replacement.type]} · ${replacement.occurredOn} · ${money(replacement.amountMinor)}`
              : null,
          /* U-001 (دورة التدقيق النهائي): وصول عميق للحدث في «السجل والأثر» — التعديل
           * يفتح البديل النشط (حيث التصحيح/الحذف)، والتراجع يفتح الأصل (حيث الاسترجاع). */
          deepLink:
            isEdit && replacement
              ? `/finance?event=${encodeURIComponent(replacement.id)}`
              : `/finance?event=${encodeURIComponent(event.correctionOfEventId)}`,
        });
      }
      /* استرجاع: إعادة تسجيل قيم أصل متراجع عنه — موسّمة بمفتاح صريح. */
      if (event.idempotencyKey.startsWith(RESTORE_KEY_PREFIX)) {
        const source = byId.get(event.idempotencyKey.slice(RESTORE_KEY_PREFIX.length)) ?? null;
        entries.push({
          id: `${event.id}-restore`,
          kind: "event_restore",
          recordedAt: event.recordedAt,
          occurredOn: event.occurredOn,
          amountEffectMinor: event.amountMinor,
          reason: source
            ? `استرجاع بعد تراجع: ${eventKindLabel[source.type]} · ${source.occurredOn} · ${money(source.amountMinor)}`
            : "استرجاع حدث سابق",
          originalLabel: null,
          replacementLabel: null,
          /* حدث الاسترجاع هو السجل النشط الحالي — تصحيحه من صفّه. */
          deepLink: `/finance?event=${encodeURIComponent(event.id)}`,
        });
      }
    }

    for (const sale of salesResult.value) {
      for (const revision of sale.revisions ?? []) {
        /* U-001 (دورة التدقيق النهائي): الأثر الموقّع هو فرق التعديل نفسه لا قيمة
         * السجل القديمة — إلغاء بيع يُظهر الإيراد المستبعد بالسالب. */
        const signedEffectMinor =
          revision.kind === "cancel"
            ? -sale.revenueMinor
            : revision.kind === "price_cut" && revision.beforeRevenueMinor != null
              ? sale.collectedMinor - revision.beforeRevenueMinor
              : revision.beforeRevenueMinor != null
                ? sale.revenueMinor - revision.beforeRevenueMinor
                : null;
        entries.push({
          id: `${sale.id}:${revision.idempotencyKey}`,
          kind:
            revision.kind === "edit"
              ? "sale_edit"
              : revision.kind === "cancel"
                ? "sale_cancel"
                : "sale_price_cut",
          recordedAt: revision.createdAt,
          occurredOn: sale.occurredOn,
          amountEffectMinor: signedEffectMinor,
          reason: revision.reason ?? null,
          originalLabel:
            revision.beforeRevenueMinor != null
              ? `بيع مباشر «${sale.itemName}» · السعر قبل التصحيح ${money(revision.beforeRevenueMinor)}`
              : `بيع مباشر «${sale.itemName}» · ${money(sale.revenueMinor)}`,
          replacementLabel:
            revision.kind === "cancel"
              ? "ملغى — مستبعد من الإيراد والكاش، والسجل باقٍ"
              : `السعر بعد التصحيح ${money(sale.revenueMinor)}`,
          deepLink: `/direct-sales/${encodeURIComponent(sale.id)}`,
        });
      }
    }

    for (const entry of cashResult.value) {
      if (entry.type !== "reversal") continue;
      entries.push({
        id: entry.id,
        kind: "cash_reversal",
        recordedAt: entry.recordedAt,
        occurredOn: entry.occurredOn,
        amountEffectMinor: entry.cashDeltaMinor,
        reason: entry.reason ?? entry.note,
        originalLabel: `قيد كاش · ${entry.note}`,
        replacementLabel: null,
        /* U-001 (دورة التدقيق النهائي): القيد المصدر ظاهر في سطح المحافظ والقيدود —
         * لا مسار كتابة ثانٍ من هنا؛ تصحيح القيدود يُنفّذ من سطحه الأصلي. */
        deepLink: "/cash",
      });
    }

    entries.sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));
    return { ok: true, value: entries };
  }
}
