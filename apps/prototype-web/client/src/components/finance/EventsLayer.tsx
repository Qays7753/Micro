/* §10: طبقة «السجل والأثر» وحدة مستقلة — تسميات الأحداث وأثرها وتصحيحها الموثق. */
import { useState } from "react";
import { LocalDateValue, MoneyValue } from "@/components/presentation/DisplayValue";
import type { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import type { FinancialEvent, FinancialEventType } from "@micro-domain/financial-event/index.js";
import { formatLocalDate, formatMoneyMinor, localDateInAmman } from "@/presentation/formatters";

export const eventLabel: Record<FinancialEventType, string> = {
  owner_investment_cash: "استثمار المالك",
  owner_withdrawal_cash: "سحب شخصي",
  operating_expense_cash: "مصروف مدفوع",
  operating_expense_payable: "مصروف مستحق",
  payable_settlement_cash: "تسديد التزام",
  amanah_held_cash: "أمانة قُبضت",
  amanah_released_cash: "أمانة سُلّمت",
  loss_non_cash: "هالك بلا خروج نقد",
};
export const expenseContextLabel = (event: FinancialEvent) => {
  if (
    event.operatingExpenseDeltaMinor <= 0 &&
    event.expenseContext?.sharedProjectShare?.allocation !== "unallocated"
  )
    return null;
  if (!event.expenseContext) return "مصروف قديم غير مصنف";
  const knowledge =
    event.expenseContext.knowledge === "known"
      ? "معروف"
      : event.expenseContext.knowledge === "estimated"
        ? "تقديري"
        : "يحتاج مراجعة";
  if (event.expenseContext.relationship === "project") return `للمشروع · ${knowledge}`;
  const share = event.expenseContext.sharedProjectShare;
  if (share?.allocation === "unallocated")
    return `مصروف مشترك غير موزّع · ${formatMoneyMinor(share.totalAmountMinor ?? event.amountMinor)}`;
  const source = share?.basis;
  const sourceLabel =
    source === "agreed_fixed_share"
      ? "حصة ثابتة معلنة"
      : source === "agreed_percentage"
        ? "نسبة معلنة"
        : source === "owner_estimate"
          ? "تقدير المالك"
          : source === "needs_review"
            ? "مصدر يحتاج مراجعة"
            : "مصدر الحصة غير موثق";
  return `حصة المشروع من مصروف مشترك · ${knowledge} · ${sourceLabel}`;
};

function FinancialEventRow({
  event,
  events,
  projectFinance,
  onChanged,
}: {
  event: FinancialEvent;
  events: readonly FinancialEvent[];
  projectFinance: ProjectFinancialService;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const reversal =
    events.find(
      candidate => candidate.correctionType === "reverse" && candidate.correctionOfEventId === event.id,
    ) ?? null;
  const isReversal = event.correctionType === "reverse";
  const original =
    isReversal && event.correctionOfEventId
      ? (events.find(candidate => candidate.id === event.correctionOfEventId) ?? null)
      : null;
  const begin = () => {
    setError(null);
    setSuccess(null);
    setReason("");
    setDetailsOpen(true);
    setOpen(true);
  };
  const cancel = () => {
    if (saving) return;
    setError(null);
    setReason("");
    setOpen(false);
  };
  const submit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("سبب التصحيح مطلوب؛ اكتب لماذا سُجّل هذا الحدث خطأ قبل التراجع.");
      return;
    }
    setError(null);
    setSaving(true);
    const result = await projectFinance.reverse({
      sourceEventId: event.id,
      occurredOn: localDateInAmman(),
      reason: trimmed,
      idempotencyKey: `reverse:${event.id}`,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setOpen(false);
    setReason("");
    setSuccess(
      result.reused ? "التراجع موثق مسبقًا؛ لم يُضاعف الأثر." : "تم تسجيل تراجع موثق. الأصل محفوظ ولم يتغير.",
    );
    onChanged();
  };
  return (
    <article
      className="micro-finance-event"
      data-correction={isReversal ? "reverse" : reversal ? "reversed" : "source"}
    >
      <div className="micro-finance-event-main">
        <div>
          <strong>{eventLabel[event.type]}</strong>
          <small>
            <LocalDateValue value={event.occurredOn} /> ·{" "}
            {isReversal ? "تراجع موثق" : reversal ? "تم التراجع" : "مسجلة"}
          </small>
        </div>
        <b>
          <MoneyValue minor={event.amountMinor} /> د.أ
        </b>
      </div>
      <button
        className="micro-text-action micro-finance-event-toggle"
        type="button"
        aria-expanded={detailsOpen}
        aria-controls={`micro-finance-event-detail-${event.id}`}
        onClick={() => setDetailsOpen(current => !current)}
      >
        {detailsOpen ? "إخفاء الأثر الكامل" : "عرض الأثر الكامل"}
      </button>
      {detailsOpen ? (
        <div className="micro-finance-event-detail" id={`micro-finance-event-detail-${event.id}`}>
          <p className="micro-finance-event-note">{event.note}</p>
          {expenseContextLabel(event) ? (
            <p className="micro-finance-event-note">{expenseContextLabel(event)}</p>
          ) : null}
          {isReversal ? (
            <small className="micro-finance-event-audit">
              {original ? (
                <>
                  الأصل: {eventLabel[original.type]} · <LocalDateValue value={original.occurredOn} /> ·{" "}
                </>
              ) : null}
              السبب: {event.correctionReason}
            </small>
          ) : reversal ? (
            <small className="micro-finance-event-audit">
              التراجع الموثق: {eventLabel[reversal.type]} · <LocalDateValue value={reversal.occurredOn} /> ·
              السبب: {reversal.correctionReason}
            </small>
          ) : null}
          <div className="micro-finance-event-effects">
            <span>
              كاش <MoneyValue minor={event.cashDeltaMinor} /> د.أ
            </span>
            <span>
              التزام <MoneyValue minor={event.payableDeltaMinor} /> د.أ
            </span>
            <span>
              مال المالك <MoneyValue minor={event.ownerCapitalDeltaMinor} /> د.أ
            </span>
            <span>
              مصروف <MoneyValue minor={event.operatingExpenseDeltaMinor} /> د.أ
            </span>
          </div>
        </div>
      ) : null}
      {!isReversal && !reversal ? (
        <button className="micro-text-action" type="button" onClick={begin}>
          صحّح هذا الحدث
        </button>
      ) : null}
      {reversal ? (
        <p className="micro-finance-event-closed">
          تم التراجع عنها مرة واحدة بتراجع كامل؛ لا يُسمح بتراجع ثانٍ.
        </p>
      ) : null}
      {success ? (
        <p className="micro-save-note" role="status">
          {success}
        </p>
      ) : null}
      {open ? (
        <div className="micro-finance-reversal-editor">
          <div className="micro-finance-reversal-review">
            <strong>مراجعة قبل التراجع</strong>
            <p>
              سيبقى السجل الأصلي كما هو دون تعديل. سيُضاف حدث جديد بتاريخ اليوم المحلي ويلغي كامل الأثر، دون
              إعادة كتابة تاريخ الحدث.
            </p>
            <dl>
              <div>
                <dt>الحدث</dt>
                <dd>
                  {eventLabel[event.type]} · <LocalDateValue value={event.occurredOn} />
                </dd>
              </div>
              <div>
                <dt>الأثر الحالي</dt>
                <dd>
                  كاش <MoneyValue minor={event.cashDeltaMinor} /> · التزام{" "}
                  <MoneyValue minor={event.payableDeltaMinor} /> · مال المالك{" "}
                  <MoneyValue minor={event.ownerCapitalDeltaMinor} /> · مصروف{" "}
                  <MoneyValue minor={event.operatingExpenseDeltaMinor} />
                </dd>
              </div>
            </dl>
          </div>
          <label className="micro-field">
            <span>
              سبب التصحيح <small>مطلوب · لا يُقبل فارغًا</small>
            </span>
            <textarea
              value={reason}
              onChange={input => setReason(input.target.value)}
              placeholder="مثال: سُجّل الحدث مرتين بالخطأ"
              autoFocus
            />
          </label>
          <p className="micro-local-truth">
            التراجع لا يحذف التاريخ ولا يعدل المبلغ أو السياق القديم. إذا كان الحدث الصحيح مختلفًا، سجّل حدثًا
            جديدًا منفصلًا.
          </p>
          {error ? (
            <p className="micro-field-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="micro-form-actions">
            <button
              className="micro-button micro-button-primary"
              type="button"
              disabled={saving}
              onClick={() => void submit()}
            >
              {saving ? "جارٍ تسجيل التراجع…" : "أكّد التراجع الموثق"}
            </button>
            <button
              className="micro-button micro-button-secondary"
              type="button"
              disabled={saving}
              onClick={cancel}
            >
              إلغاء
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function EventsLayer({
  visibleEvents,
  events,
  projectFinance,
  onChanged,
}: {
  visibleEvents: readonly FinancialEvent[];
  events: readonly FinancialEvent[];
  projectFinance: ProjectFinancialService;
  onChanged: () => void;
}) {
  return (
    <details className="micro-finance-layer">
      <summary className="micro-finance-layer-summary">
        <span>
          <b>السجل والأثر</b>
          <small>آخر ثلاثة أحداث؛ افتح الصف لرؤية الأثر الكامل</small>
        </span>
        <strong>افتح السجل</strong>
      </summary>
      <section className="micro-finance-event-list">
        <div className="micro-finance-event-heading">
          <span className="micro-overline">السجل المحلي · المبالغ (د.أ)</span>
          <h2>أحدث الأحداث العامة</h2>
          <p>كل تراجع موثق يضيف حدثًا جديدًا؛ الأصل يبقى ظاهرًا ولا يوجد حذف.</p>
        </div>
        {visibleEvents.length > 0 ? (
          visibleEvents.map(event => (
            <FinancialEventRow
              key={event.id}
              event={event}
              events={events}
              projectFinance={projectFinance}
              onChanged={onChanged}
            />
          ))
        ) : (
          <p>لم تسجل حدثًا عامًا بعد. سجّل واقعًا تعرفه، لا تقديرًا لا تثق به.</p>
        )}
      </section>
    </details>
  );
}
