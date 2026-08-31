/* §10: طبقة «السجل والأثر» وحدة مستقلة — تسميات الأحداث وأثرها وتصحيحها الموثق. */
/* D-005: التصحيح الثلاثة الموثق — التراجع، والتعديل الذرّي (تراجع + بديل)، والحذف الموثق،
 * والاسترجاع — كلها بأثرها الحقيقي أمام العين قبل التأكيد، وسبب واضح حيث يلزم. */
import { useState } from "react";
import { LocalDateValue, MoneyValue } from "@/components/presentation/DisplayValue";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
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

type CorrectionMode = "reverse" | "edit" | "delete" | "restore";

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
  const [open, setOpen] = useState<CorrectionMode | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /* D-005: نموذج التعديل يبدأ معبّأً بقيم الحدث الحالية — البديل الجديد هو ما تصحّحه. */
  const [editAmount, setEditAmount] = useState(event.amountMinor);
  const [validEditAmount, setValidEditAmount] = useState(true);
  const [editDate, setEditDate] = useState(event.occurredOn);
  const [editNote, setEditNote] = useState(event.note);
  const [editCounterparty, setEditCounterparty] = useState(event.counterparty ?? "");
  const reversal =
    events.find(
      candidate => candidate.correctionType === "reverse" && candidate.correctionOfEventId === event.id,
    ) ?? null;
  const isReversal = event.correctionType === "reverse";
  const original =
    isReversal && event.correctionOfEventId
      ? (events.find(candidate => candidate.id === event.correctionOfEventId) ?? null)
      : null;
  const begin = (mode: CorrectionMode) => {
    setError(null);
    setSuccess(null);
    setReason("");
    setEditAmount(event.amountMinor);
    setEditDate(event.occurredOn);
    setEditNote(event.note);
    setEditCounterparty(event.counterparty ?? "");
    setDetailsOpen(true);
    setOpen(mode);
  };
  const cancel = () => {
    if (saving) return;
    setError(null);
    setReason("");
    setOpen(null);
  };
  const submitReverse = async () => {
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
    setOpen(null);
    setReason("");
    setSuccess(
      result.reused ? "التراجع موثق مسبقًا؛ لم يُضاعف الأثر." : "تم تسجيل تراجع موثق. الأصل محفوظ ولم يتغير.",
    );
    onChanged();
  };
  /* D-005: التعديل الذرّي — تراجع + بديل في معاملة واحدة؛ الأصل يبقى والبديل يحمل القيم الجديدة. */
  const submitEdit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("سبب التعديل مطلوب؛ التصحيح المالي يوثَّق بسبب واضح لا يُترك فارغًا.");
      return;
    }
    if (!validEditAmount || !Number.isInteger(editAmount) || editAmount <= 0) {
      setError("أدخل مبلغ البديل رقمًا صحيحًا موجبًا بالأرقام 0–9.");
      return;
    }
    if (!editNote.trim()) {
      setError("اكتب بيان البديل؛ الوصف جزء من السجل المالي.");
      return;
    }
    setError(null);
    setSaving(true);
    const result = await projectFinance.editEvent({
      sourceEventId: event.id,
      amountMinor: editAmount,
      occurredOn: editDate,
      note: editNote,
      counterparty: editCounterparty.trim() || null,
      reason: trimmed,
      idempotencyKey: `edit:${event.id}`,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setOpen(null);
    setReason("");
    setSuccess(
      result.reused
        ? "التعديل موثق مسبقًا؛ لم يُضاعف الأثر."
        : "تم التعديل بتراجع موثق وبديل جديد في معاملة واحدة؛ القيم القديمة باقية في السجل.",
    );
    onChanged();
  };
  /* D-005: الحذف الموثق — تراجع كامل بسبب؛ لا حذفًا صامتًا ولا اختفاءً من التاريخ. */
  const submitDelete = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("سبب الحذف مطلوب؛ «حذف» في هذا النظام تراجع موثق باقٍ في السجل لا محوه.");
      return;
    }
    setError(null);
    setSaving(true);
    const result = await projectFinance.deleteEvent({
      sourceEventId: event.id,
      reason: trimmed,
      idempotencyKey: `delete:${event.id}`,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setOpen(null);
    setReason("");
    setSuccess(
      result.reused
        ? "الحذف موثق مسبقًا؛ لم يُضاعف الأثر."
        : "تم حذف الأثر بتراجع موثق؛ السجل الأصلي باقٍ والقيمة صارت خارج الحساب.",
    );
    onChanged();
  };
  /* D-005: الاسترجاع — إعادة تسجيل القيم الأصلية كحدث جديد؛ الماضي لا يُلمس. */
  const submitRestore = async () => {
    setError(null);
    setSaving(true);
    const result = await projectFinance.restoreEvent({
      sourceEventId: event.id,
      idempotencyKey: `restore:${event.id}`,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setOpen(null);
    setSuccess(
      result.reused
        ? "الاسترجاع موثق مسبقًا؛ لم يُضاعف الأثر."
        : "أُعيد تسجيل القيم الأصلية كحدث جديد؛ التراجع السابق باقٍ في السجل.",
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
        <div className="micro-text-actions">
          <button className="micro-text-action" type="button" onClick={() => begin("reverse")}>
            تراجع موثق
          </button>
          <button className="micro-text-action" type="button" onClick={() => begin("edit")}>
            عدّل بقيم جديدة
          </button>
          <button className="micro-text-action" type="button" onClick={() => begin("delete")}>
            حذف موثق
          </button>
        </div>
      ) : null}
      {reversal ? (
        <button className="micro-text-action" type="button" onClick={() => begin("restore")}>
          استرجع القيم الأصلية
        </button>
      ) : null}
      {reversal ? (
        <p className="micro-finance-event-closed">
          تم التراجع عنها مرة واحدة بتراجع كامل؛ لا يُسمح بتراجع ثانٍ. الاسترجاع يعيد القيم حدثًا جديدًا.
        </p>
      ) : null}
      {success ? (
        <p className="micro-save-note" role="status">
          {success}
        </p>
      ) : null}
      {open === "reverse" ? (
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
              <div>
                <dt>الأثر بعد التراجع</dt>
                <dd>
                  كاش <MoneyValue minor={-event.cashDeltaMinor} /> · التزام{" "}
                  <MoneyValue minor={-event.payableDeltaMinor} /> · مال المالك{" "}
                  <MoneyValue minor={-event.ownerCapitalDeltaMinor} /> · مصروف{" "}
                  <MoneyValue minor={-event.operatingExpenseDeltaMinor} />
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
            التراجع لا يحذف التاريخ ولا يعدل المبلغ أو السياق القديم. إذا كان الحدث الصحيح مختلفًا، عدّله
            بقيم جديدة أو سجّل حدثًا منفصلًا.
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
              onClick={() => void submitReverse()}
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
      {open === "edit" ? (
        <div className="micro-finance-reversal-editor">
          <div className="micro-finance-reversal-review">
            <strong>مراجعة قبل التعديل</strong>
            <p>
              التعديل الذرّي يسجّل تراجعًا عن الأصل وبديلًا بقيمك الجديدة في معاملة واحدة: إن فشل أي جزء لم
              يتغير شيء. القيم القديمة تبقى في السجل ولا تُطمس.
            </p>
            <dl>
              <div>
                <dt>الأصل الحالي</dt>
                <dd>
                  {eventLabel[event.type]} · <LocalDateValue value={event.occurredOn} /> ·{" "}
                  {formatMoneyMinor(event.amountMinor)} د.أ
                </dd>
              </div>
              <div>
                <dt>البديل الذي سُيسجّل</dt>
                <dd>
                  {eventLabel[event.type]} · <LocalDateValue value={editDate} /> ·{" "}
                  {validEditAmount ? formatMoneyMinor(editAmount) : "—"} د.أ
                </dd>
              </div>
            </dl>
          </div>
          <label className="micro-field">
            <span>المبلغ الجديد بالدينار الأردني</span>
            <EnglishNumberInput
              value={editAmount}
              kind="money"
              onNumericChange={setEditAmount}
              onTextValidityChange={setValidEditAmount}
              aria-label="المبلغ الجديد"
            />
          </label>
          <LocalDateField label="تاريخ الحدث الجديد" value={editDate} onChange={input => setEditDate(input.target.value)} />
          <label className="micro-field">
            <span>بيان البديل</span>
            <textarea value={editNote} onChange={input => setEditNote(input.target.value)} />
          </label>
          <label className="micro-field">
            <span>
              الجهة المقابلة <small>اختياري</small>
            </span>
            <input
              value={editCounterparty}
              onChange={input => setEditCounterparty(input.target.value)}
              aria-label="الجهة المقابلة للبديل"
            />
          </label>
          <label className="micro-field">
            <span>
              سبب التعديل <small>مطلوب · لا يُقبل فارغًا</small>
            </span>
            <textarea
              value={reason}
              onChange={input => setReason(input.target.value)}
              placeholder="مثال: المبلغ الصحيح ١٢ دينارًا لا ٢١"
              autoFocus
            />
          </label>
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
              onClick={() => void submitEdit()}
            >
              {saving ? "جارٍ حفظ التعديل…" : "أكّد التعديل الذرّي"}
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
      {open === "delete" ? (
        <div className="micro-finance-reversal-editor">
          <div className="micro-finance-reversal-review">
            <strong>مراجعة قبل الحذف الموثق</strong>
            <p>
              «الحذف» هنا تراجع كامل موثق: الأثر المالي يزول من الحساب، والسجل الأصلي والسبب يبقيان في
              التاريخ — لا محو صامت.
            </p>
            <dl>
              <div>
                <dt>الأثر الذي سيُلغى</dt>
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
              سبب الحذف <small>مطلوب · لا يُقبل فارغًا</small>
            </span>
            <textarea
              value={reason}
              onChange={input => setReason(input.target.value)}
              placeholder="مثال: حدث اختباري سُجّل بالخطأ"
              autoFocus
            />
          </label>
          {error ? (
            <p className="micro-field-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="micro-form-actions">
            <button
              className="micro-button micro-button-danger"
              type="button"
              disabled={saving}
              onClick={() => void submitDelete()}
            >
              {saving ? "جارٍ توثيق الحذف…" : "أكّد الحذف الموثق"}
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
      {open === "restore" ? (
        <div className="micro-finance-reversal-editor">
          <div className="micro-finance-reversal-review">
            <strong>مراجعة قبل الاسترجاع</strong>
            <p>
              يُعاد تسجيل القيم الأصلية كحدث جديد بحالته الأولى؛ التراجع السابق يبقى في السجل، والماضي لا
              يُلمس ولا يُعاد كتابته.
            </p>
            <dl>
              <div>
                <dt>القيم التي ستعود</dt>
                <dd>
                  {eventLabel[event.type]} · <LocalDateValue value={event.occurredOn} /> ·{" "}
                  {formatMoneyMinor(event.amountMinor)} د.أ
                </dd>
              </div>
              <div>
                <dt>الأثر بعد الاسترجاع</dt>
                <dd>
                  كاش <MoneyValue minor={event.cashDeltaMinor} /> · التزام{" "}
                  <MoneyValue minor={event.payableDeltaMinor} /> · مال المالك{" "}
                  <MoneyValue minor={event.ownerCapitalDeltaMinor} /> · مصروف{" "}
                  <MoneyValue minor={event.operatingExpenseDeltaMinor} />
                </dd>
              </div>
            </dl>
          </div>
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
              onClick={() => void submitRestore()}
            >
              {saving ? "جارٍ الاسترجاع…" : "أكّد استرجاع القيم الأصلية"}
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
          <small>آخر ثلاثة أحداث؛ افتح الصف لرؤية الأثر الكامل وتصحيحه</small>
        </span>
        <strong>افتح السجل</strong>
      </summary>
      <section className="micro-finance-event-list">
        <div className="micro-finance-event-heading">
          <span className="micro-overline">السجل المحلي · المبالغ (د.أ)</span>
          <h2>أحدث الأحداث العامة</h2>
          <p>كل تراجع أو تعديل أو حذف موثق يضيف سجلًا؛ الأصل يبقى ظاهرًا ولا يوجد محو صامت.</p>
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
