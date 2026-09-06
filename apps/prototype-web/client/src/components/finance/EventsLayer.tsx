/* §10: طبقة «السجل والأثر» وحدة مستقلة — تسميات الأحداث وأثرها وتصحيحها الموثق. */
/* D-005: التصحيح الثلاثة الموثق — التراجع، والتعديل الذرّي (تراجع + بديل)، والحذف الموثق،
 * والاسترجاع — كلها بأثرها الحقيقي أمام العين قبل التأكيد، وسبب واضح حيث يلزم. */
/* U-001 (دورة التدقيق النهائي): وصول عملي للأحداث الأقدم لا الأحدث الثلاثة فقط —
 * زر «اعرض كل الأحداث» + تركيز صف مصدر التصحيح القادم من «السجل» عبر ?event=. */
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { withFrom } from "@/app/navigationContract";
import { LocalDateValue, MoneyValue } from "@/components/presentation/DisplayValue";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { CorrectionPreview } from "@/components/finance/CorrectionPreview";
import type { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import type {
  FinancialEvent,
  FinancialEventType,
  OperatingExpenseContext,
} from "@micro-domain/financial-event/index.js";
import { formatLocalDate, formatMoneyMinor, localDateInAmman } from "@/presentation/formatters";
import { eventCountLabel } from "@/presentation/g5Plurals";

export const eventLabel: Record<FinancialEventType, string> = {
  owner_investment_cash: "استثمار المالك",
  owner_withdrawal_cash: "سحب شخصي",
  operating_expense_cash: "مصروف مدفوع",
  operating_expense_payable: "مصروف مستحق",
  payable_settlement_cash: "تسديد التزام",
  amanah_held_cash: "أمانة قُبضت",
  amanah_released_cash: "أمانة سُلّمت",
  loss_non_cash: "هالك بلا خروج نقد",
  /* المجموعة ٤ (عقد ٢٩): تسميات قراءة للأنواع الجديدة — تعرض في السجلات والتصحيحات. */
  asset_purchase_cash: "شراء أصل نقدًا",
  asset_purchase_payable: "شراء أصل بالذمم",
  asset_depreciation: "إهلاك أصل",
  asset_disposal_cash: "استبعاد أصل (تخلص)",
  asset_writeoff: "شطب أصل",
  loan_outgoing_cash: "قرض لشخص",
  loan_repayment_cash: "سداد قرض",
  deposit_retained_revenue: "عربون محتفظ به كإيراد",
  deposit_retained_owner: "عربون محتفظ به كمال مالك",
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
  /* المجموعة ١ (تصنيفي للمصاريف): وسم المالك يظهر مع السياق — قراءة فقط لا أثر. */
  const category = event.expenseContext.categoryLabel
    ? ` · تصنيفك: ${event.expenseContext.categoryLabel}`
    : "";
  if (event.expenseContext.relationship === "project") return `للمشروع · ${knowledge}${category}`;
  const share = event.expenseContext.sharedProjectShare;
  if (share?.allocation === "unallocated")
    return `مصروف مشترك غير موزّع · ${formatMoneyMinor(share.totalAmountMinor ?? event.amountMinor)}${category}`;
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
  return `حصة المشروع من مصروف مشترك · ${knowledge} · ${sourceLabel}${category}`;
};

type CorrectionMode = "reverse" | "edit" | "delete" | "restore";

/* المجموعة ٦ (تدقيق A1 — FT-03): أحداث الأصول والقروض والعربونات المحتفظة
 * تُصحّح من سجل عائلتها فقط (صفحة الأصل/القرض/الطلب تُحدّث الحدث والسجل
 * معًا في معاملة واحدة) — المصحّح العام هنا كان يعكس الحدث ويُفشل فحوص
 * MIC-10/11/12 بلا طريق إصلاح. الطبقة العامة تعرض وصلة المالك بدل الأزرار. */
function familyEventOwner(event: FinancialEvent): { href: string; label: string; owner: string } | null {
  if (event.type.startsWith("asset_") && event.assetContext?.assetId)
    return {
      href: withFrom(`/assets/${event.assetContext.assetId}`, "/finance"),
      label: "صحّحه من صفحة الأصل",
      owner: "سجل الأصل",
    };
  if (
    (event.type === "loan_outgoing_cash" || event.type === "loan_repayment_cash") &&
    event.loanContext?.loanId
  )
    return {
      href: withFrom(`/loans/${event.loanContext.loanId}`, "/finance"),
      label: "صحّحه من صفحة القرض",
      owner: "سجل القرض",
    };
  if (
    (event.type === "deposit_retained_revenue" || event.type === "deposit_retained_owner") &&
    event.depositContext?.orderId
  )
    return {
      href: withFrom(`/orders/${event.depositContext.orderId}`, "/finance"),
      label: "صحّحه من صفحة الطلب",
      owner: "سجل الطلب",
    };
  return null;
}

function FinancialEventRow({
  event,
  events,
  projectFinance,
  onChanged,
  focused = false,
}: {
  event: FinancialEvent;
  events: readonly FinancialEvent[];
  projectFinance: ProjectFinancialService;
  onChanged: () => void;
  focused?: boolean;
}) {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState<CorrectionMode | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /* U-001: الصف المركَّز (قادم من سجل التصحيحات) يُبرَز ويُمرَّر إليه مرة واحدة. */
  const rowRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (focused && rowRef.current) {
      /* scrollIntoView اختيارية — jsdom وبعض البيئات لا توفرها، والإبراز وحده كافٍ. */
      rowRef.current.scrollIntoView?.({ block: "center" });
      rowRef.current.focus?.({ preventScroll: true });
    }
  }, [focused]);
  /* D-005: نموذج التعديل يبدأ معبّأً بقيم الحدث الحالية — البديل الجديد هو ما تصحّحه. */
  const [editAmount, setEditAmount] = useState(event.amountMinor);
  const [validEditAmount, setValidEditAmount] = useState(true);
  const [editDate, setEditDate] = useState(event.occurredOn);
  const [editNote, setEditNote] = useState(event.note);
  const [editCounterparty, setEditCounterparty] = useState(event.counterparty ?? "");
  /* Conflict H (WF-04): تصحيح التصنيف بعد الحفظ — يُفتح عند الحاجة لأحداث المصروف
   * فقط؛ الحقول تبدأ من تصنيف الحدث الحالي فلا تصحيح صامت ولا إعادة تسجيل يدوية. */
  const isExpenseEvent =
    event.type === "operating_expense_cash" || event.type === "operating_expense_payable";
  const [classificationOpen, setClassificationOpen] = useState(false);
  const [editCategoryLabel, setEditCategoryLabel] = useState(event.expenseContext?.categoryLabel ?? "");
  const [editRelationship, setEditRelationship] = useState<OperatingExpenseContext["relationship"]>(
    event.expenseContext?.relationship ?? "project",
  );
  const [editBehavior, setEditBehavior] = useState<OperatingExpenseContext["behavior"]>(
    event.expenseContext?.behavior ?? "unknown",
  );
  const [editPurpose, setEditPurpose] = useState<OperatingExpenseContext["purpose"]>(
    event.expenseContext?.purpose ?? "project_general",
  );
  const [editKnowledge, setEditKnowledge] = useState<OperatingExpenseContext["knowledge"]>(
    event.expenseContext?.knowledge ?? "known",
  );
  const reversal =
    events.find(
      candidate => candidate.correctionType === "reverse" && candidate.correctionOfEventId === event.id,
    ) ?? null;
  const isReversal = event.correctionType === "reverse";
  const familyOwner = familyEventOwner(event);
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
    setClassificationOpen(false);
    setEditCategoryLabel(event.expenseContext?.categoryLabel ?? "");
    setEditRelationship(event.expenseContext?.relationship ?? "project");
    setEditBehavior(event.expenseContext?.behavior ?? "unknown");
    setEditPurpose(event.expenseContext?.purpose ?? "project_general");
    setEditKnowledge(event.expenseContext?.knowledge ?? "known");
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
      setError("سبب الإلغاء مطلوب؛ اكتب لماذا سُجّلت هذه العملية خطأ قبل إلغائها.");
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
      result.reused
        ? "الإلغاء موثق مسبقًا؛ لم يُضاعف الأثر."
        : "أُلغيت العملية — أثرها خرج من أرقامك وسجلها الأصلي محفوظ.",
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
    /* Conflict H (WF-04): التصنيف المصحّح يركب البديل — الأصل يبقى بتصنيفه
     * للمراجعة، والنطاق يتحقق منه factory النطاق نفسه عند البناء. */
    const nextExpenseContext =
      isExpenseEvent && classificationOpen
        ? {
            relationship: editRelationship,
            behavior: editBehavior,
            purpose: editPurpose,
            knowledge: editKnowledge,
            /* حصة المشروع المشتركة تُدار كما سُجّلت: تُحفظ للمشترك وتُسقط لغيره. */
            sharedProjectShare:
              editRelationship === "shared" ? (event.expenseContext?.sharedProjectShare ?? null) : null,
            categoryLabel: editCategoryLabel.trim() || null,
          }
        : undefined;
    setError(null);
    setSaving(true);
    const result = await projectFinance.editEvent({
      sourceEventId: event.id,
      amountMinor: editAmount,
      occurredOn: editDate,
      note: editNote,
      counterparty: editCounterparty.trim() || null,
      expenseContext: nextExpenseContext,
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
        : "تم تعديل العملية — أرقامك تعرض القيم الجديدة، والقديمة محفوظة في السجل.",
    );
    onChanged();
  };
  /* D-005: الحذف الموثق — تراجع كامل بسبب؛ لا حذفًا صامتًا ولا اختفاءً من التاريخ. */
  const submitDelete = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("سبب الحذف مطلوب؛ «حذف العملية» يُلغي الأثر ويبقى مع سببه في السجل — لا محو.");
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
        : "حُذفت العملية — أثرها صار خارج أرقامك، وأصلها باقٍ في السجل.",
    );
    onChanged();
  };
  /* D-005 + Conflict A: التراجع عن التصحيح — تعود أرقام العملية كما كانت؛ الماضي لا يُلمس. */
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
        ? "التراجع عن التصحيح موثق مسبقًا؛ لم يُضاعف الأثر."
        : "تم التراجع عن التصحيح — عادت أرقام العملية كما كانت قبل التصحيح.",
    );
    onChanged();
  };
  return (
    <article
      ref={rowRef}
      className="micro-finance-event"
      data-correction={isReversal ? "reverse" : reversal ? "reversed" : "source"}
      data-focused={focused ? "true" : undefined}
      tabIndex={focused ? -1 : undefined}
      aria-label={focused ? "حدث مركَّز قادم من سجل التصحيحات" : undefined}
    >
      <div className="micro-finance-event-main">
        <div>
          <strong>{eventLabel[event.type]}</strong>
          <small>
            <LocalDateValue value={event.occurredOn} /> ·{" "}
            {isReversal ? "إلغاء/تصحيح موثق" : reversal ? "أُلغيت أو صُحّحت" : "مسجلة"}
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
            {event.amanahDeltaMinor ? (
              <span>
                أمانات <MoneyValue minor={event.amanahDeltaMinor} showPlus /> د.أ
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
      {!isReversal && !reversal ? (
        familyOwner ? (
          <div className="micro-text-actions">
            <button className="micro-text-action" type="button" onClick={() => navigate(familyOwner.href)}>
              {familyOwner.label}
            </button>
            <small className="micro-finance-event-audit">
              تصحيح هذا الحدث يُديره {familyOwner.owner} — يُحدّث الحدث وسجل عائلته معًا بلا فحص سلامة فاشل.
            </small>
          </div>
        ) : (
          <div className="micro-text-actions">
            {/* Conflict A (حدود التصحيح المعتمدة): أفعال بسيطة للمالك — المحرك
             * الداخلي يبقى العكس والاستبدال الذرّي الموثق؛ لا محرّك تعديل موازٍ. */}
            <button className="micro-text-action" type="button" onClick={() => begin("reverse")}>
              إلغاء العملية
            </button>
            <button className="micro-text-action" type="button" onClick={() => begin("edit")}>
              تعديل العملية
            </button>
            <button className="micro-text-action" type="button" onClick={() => begin("delete")}>
              حذف العملية
            </button>
          </div>
        )
      ) : null}
      {reversal ? (
        familyOwner ? (
          <div className="micro-text-actions">
            <button className="micro-text-action" type="button" onClick={() => navigate(familyOwner.href)}>
              {familyOwner.label}
            </button>
            <small className="micro-finance-event-audit">
              استرجاع/تصحيح هذا الحدث يُدار من سجل عائلته ليبقى السجل وفحص السلامة متطابقين.
            </small>
          </div>
        ) : (
          <button className="micro-text-action" type="button" onClick={() => begin("restore")}>
            التراجع عن التصحيح
          </button>
        )
      ) : null}
      {reversal ? (
        <p className="micro-finance-event-closed">
          أُلغيت هذه العملية مرة واحدة ولا يمكن إلغاؤها مرة ثانية. «التراجع عن التصحيح» يعيد أثرها إن لزم.
        </p>
      ) : null}
      {success ? (
        <p className="micro-save-note" role="status">
          {success}
        </p>
      ) : null}
      {open === "reverse" ? (
        /* المجموعة ٢ (§10.2) + Conflict A: معاينة موحدة بلغة النتيجة — الأبعاد
         * المالية الخمسة بما فيها الأمانات، بلا مصطلحات دفترية. */
        <CorrectionPreview
          action="إلغاء العملية"
          originalLabel={`${eventLabel[event.type]} · ${formatMoneyMinor(event.amountMinor)} د.أ`}
          originalDetail={formatLocalDate(event.occurredOn) ?? event.occurredOn}
          intro="سيُلغى أثر هذه العملية من أرقامك اليوم، ويبقى سجلها الأصلي محفوظًا للمراجعة — لا يُمحى شيء."
          dimensions={[
            { label: "الكاش", beforeMinor: event.cashDeltaMinor, afterMinor: -event.cashDeltaMinor },
            {
              label: "الالتزامات",
              beforeMinor: event.payableDeltaMinor,
              afterMinor: -event.payableDeltaMinor,
            },
            {
              label: "مال المالك",
              beforeMinor: event.ownerCapitalDeltaMinor,
              afterMinor: -event.ownerCapitalDeltaMinor,
            },
            {
              label: "المصروف/النتيجة",
              beforeMinor: event.operatingExpenseDeltaMinor,
              afterMinor: -event.operatingExpenseDeltaMinor,
            },
            {
              label: "الأمانات",
              beforeMinor: event.amanahDeltaMinor ?? 0,
              afterMinor: -(event.amanahDeltaMinor ?? 0),
            },
          ]}
          unchanged={["سجل العملية الأصلي بقيمه وتاريخه", "سبب الإلغاء يُحفظ مع السجل"]}
          reversibleNote="الإلغاء نفسه لا يُلغى؛ إن أردت إعادة الأثر فاستخدم «التراجع عن التصحيح»."
          reason={reason}
          onReasonChange={setReason}
          reasonPlaceholder="مثال: سُجّل الحدث مرتين بالخطأ"
          error={error}
          busy={saving}
          confirmLabel="أكّد إلغاء العملية"
          busyLabel="جارٍ إلغاء العملية…"
          onConfirm={() => void submitReverse()}
          onCancel={cancel}
        />
      ) : null}
      {open === "edit" ? (
        <div className="micro-finance-reversal-editor">
          <div className="micro-finance-reversal-review">
            <strong>مراجعة قبل التعديل</strong>
            <p>
              سيظهر تعديلك في أرقامك بالقيم الجديدة، وتبقى العملية القديمة محفوظة في السجل للمراجعة. التطبيق
              كله أو لا شيء: إن تعذّر لا يتغير أي رقم.
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
            {/* عقد الإغلاق العميق (FC-03 — العقد ٢) + Conflict A: تحذير بلغة
                النتيجة حين يقع التعديل في شهر غير شهر الأصل — يظهر الأثر في
                كشفي الشهرين؛ لا تغيير صامت لأرقام شهر قديم. */}
            {editDate.slice(0, 7) !== event.occurredOn.slice(0, 7) ? (
              <p className="micro-warning-copy" data-testid="edit-period-impact">
                انتبه: التاريخ الجديد يقع في فترة شهر مختلفة عن الأصل — ستُحسب العملية في الشهر الجديد وتخرج
                من حساب الشهر القديم، فيتغيّر رقم الشهرين في كشفك. رجّع التاريخ إن كنت تقصد الشهر نفسه.
              </p>
            ) : null}
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
          <LocalDateField
            label="تاريخ الحدث الجديد"
            value={editDate}
            onChange={input => setEditDate(input.target.value)}
          />
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
          {isExpenseEvent ? (
            <div className="micro-finance-layer" data-testid="expense-classification-edit">
              <button
                className="micro-text-action"
                type="button"
                aria-expanded={classificationOpen}
                onClick={() => setClassificationOpen(current => !current)}
              >
                {classificationOpen ? "أخفِ تصحيح التصنيف" : "صحّح تصنيف المصروف"}
              </button>
              {classificationOpen ? (
                <div className="micro-form-card">
                  <p className="micro-note-copy">
                    التصنيف الحالي: {expenseContextLabel(event)} — التصحيح يركب العملية الجديدة، والقديم يبقى
                    في السجل.
                  </p>
                  <label className="micro-field">
                    <span>
                      وسم التصنيف <small>اختياري · مثال: بنزين، تغليف</small>
                    </span>
                    <input
                      value={editCategoryLabel}
                      onChange={input => setEditCategoryLabel(input.target.value)}
                      aria-label="وسم تصنيف المصروف"
                      maxLength={80}
                    />
                  </label>
                  <label className="micro-field">
                    <span>علاقة المصروف بالمشروع</span>
                    <select
                      value={editRelationship}
                      onChange={input =>
                        setEditRelationship(input.target.value as OperatingExpenseContext["relationship"])
                      }
                      aria-label="علاقة المصروف بالمشروع"
                    >
                      <option value="project">للمشروع</option>
                      <option value="shared">مشترك</option>
                    </select>
                  </label>
                  <label className="micro-field">
                    <span>سلوك المصروف</span>
                    <select
                      value={editBehavior}
                      onChange={input =>
                        setEditBehavior(input.target.value as OperatingExpenseContext["behavior"])
                      }
                      aria-label="سلوك المصروف"
                    >
                      <option value="fixed">ثابت</option>
                      <option value="variable">متغير</option>
                      <option value="mixed">مختلط</option>
                      <option value="unknown">غير معروف</option>
                    </select>
                  </label>
                  <label className="micro-field">
                    <span>غرض المصروف</span>
                    <select
                      value={editPurpose}
                      onChange={input =>
                        setEditPurpose(input.target.value as OperatingExpenseContext["purpose"])
                      }
                      aria-label="غرض المصروف"
                    >
                      <option value="project_general">عام للمشروع</option>
                      <option value="period">لفترة تشغيل</option>
                      <option value="order">لطلب</option>
                      <option value="product">لمنتج</option>
                      <option value="campaign">لحملة</option>
                      <option value="unallocated">غير مخصص</option>
                    </select>
                  </label>
                  <label className="micro-field">
                    <span>معرفة تكلفته</span>
                    <select
                      value={editKnowledge}
                      onChange={input =>
                        setEditKnowledge(input.target.value as OperatingExpenseContext["knowledge"])
                      }
                      aria-label="معرفة تكلفة المصروف"
                    >
                      <option value="known">معروفة</option>
                      <option value="estimated">تقديرية</option>
                      <option value="needs_review">تحتاج مراجعة</option>
                    </select>
                  </label>
                  {editRelationship === "shared" ? (
                    <p className="micro-note-copy">
                      تفاصيل حصة المشروع تبقى كما سُجّلت أولًا؛ لتغييرها سجّل تراجعًا كاملًا ثم عِد بالتسجيل
                      المصنف.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          <label className="micro-field">
            <span>
              سبب التعديل <small>مطلوب · لا يُقبل فارغًا</small>
            </span>
            <textarea
              value={reason}
              onChange={input => setReason(input.target.value)}
              placeholder="مثال: المبلغ الصحيح 12 دينارًا لا 21"
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
              {saving ? "جارٍ حفظ التعديل…" : "أكّد تعديل العملية"}
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
        <CorrectionPreview
          action="حذف العملية"
          originalLabel={`${eventLabel[event.type]} · ${formatMoneyMinor(event.amountMinor)} د.أ`}
          originalDetail={formatLocalDate(event.occurredOn) ?? event.occurredOn}
          intro="سيُلغى أثر هذه العملية من أرقامك، ويبقى أصلها وسبب الحذف في السجل للمراجعة — لا محو صامت."
          dimensions={[
            { label: "الكاش", beforeMinor: event.cashDeltaMinor, afterMinor: 0 },
            { label: "الالتزامات", beforeMinor: event.payableDeltaMinor, afterMinor: 0 },
            { label: "مال المالك", beforeMinor: event.ownerCapitalDeltaMinor, afterMinor: 0 },
            { label: "المصروف/النتيجة", beforeMinor: event.operatingExpenseDeltaMinor, afterMinor: 0 },
            { label: "الأمانات", beforeMinor: event.amanahDeltaMinor ?? 0, afterMinor: 0 },
          ]}
          unchanged={["سجل العملية الأصلي باقٍ في التاريخ", "سبب الحذف جزء من السجل لا يُحذف"]}
          reversibleNote="يمكن التراجع عن هذا الحذف لاحقًا فيعود الأثر إلى أرقامك إن كان الأصل صحيحًا."
          reason={reason}
          onReasonChange={setReason}
          reasonPlaceholder="مثال: حدث اختباري سُجّل بالخطأ"
          error={error}
          busy={saving}
          danger
          confirmLabel="أكّد حذف العملية"
          busyLabel="جارٍ حذف العملية…"
          onConfirm={() => void submitDelete()}
          onCancel={cancel}
        />
      ) : null}
      {open === "restore" ? (
        <div className="micro-finance-reversal-editor">
          <div className="micro-finance-reversal-review">
            <strong>مراجعة قبل التراجع عن التصحيح</strong>
            <p>
              ستعود أرقام هذه العملية كما كانت قبل التصحيح؛ سجل التصحيح السابق يبقى في التاريخ، والماضي لا
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
                <dt>الأثر بعد التراجع عن التصحيح</dt>
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
              {saving ? "جارٍ التراجع عن التصحيح…" : "أكّد التراجع عن التصحيح"}
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
  focusEventId = null,
  openOnLoad = false,
}: {
  visibleEvents: readonly FinancialEvent[];
  events: readonly FinancialEvent[];
  projectFinance: ProjectFinancialService;
  onChanged: () => void;
  focusEventId?: string | null;
  openOnLoad?: boolean;
}) {
  /* U-001 (دورة التدقيق النهائي): طريقة عملية للوصول للأحداث الأقدم — الافتراضي
   * الأحدث الثلاثة (كثافة §10)، وزر واحد يعرض السجل كاملًا بنفس صفوفه وتصحيحاته.
   * التركيز القادم من «السجل» (?event=) يفتح الكل ويُبرز صف المصدر. */
  const [showAll, setShowAll] = useState(false);
  const [layerOpen, setLayerOpen] = useState(false);
  useEffect(() => {
    if (focusEventId) {
      setShowAll(true);
      setLayerOpen(true);
    }
  }, [focusEventId]);
  /* S1-09: ?layer=events يفتح الطبقة نفسها (معجم عقد ٢٦ §3.1). */
  useEffect(() => {
    if (openOnLoad) setLayerOpen(true);
  }, [openOnLoad]);
  const renderedEvents = showAll ? events : visibleEvents;
  const focusedEventId = focusEventId ?? null;
  const onToggle = (event: React.ToggleEvent<HTMLDetailsElement>) => {
    setLayerOpen(event.currentTarget.open);
  };
  return (
    <details className="micro-finance-layer" open={layerOpen} onToggle={onToggle}>
      <summary className="micro-finance-layer-summary">
        <span>
          <b>السجل والأثر</b>
          <small>
            {showAll
              ? `السجل كاملًا (${eventCountLabel(events.length)})؛ افتح الصف لرؤية الأثر وتصحيحه`
              : "آخر ثلاثة أحداث؛ افتح الصف لرؤية الأثر الكامل وتصحيحه"}
          </small>
        </span>
        <strong>افتح السجل</strong>
      </summary>
      <section className="micro-finance-event-list">
        <div className="micro-finance-event-heading">
          <span className="micro-overline">السجل المحلي · المبالغ (د.أ)</span>
          <h2>{showAll ? "كل الأحداث العامة" : "أحدث الأحداث العامة"}</h2>
          <p>كل تراجع أو تعديل أو حذف موثق يضيف سجلًا؛ الأصل يبقى ظاهرًا ولا يوجد محو صامت.</p>
        </div>
        {renderedEvents.length > 0 ? (
          renderedEvents.map(event => (
            <FinancialEventRow
              key={event.id}
              event={event}
              events={events}
              projectFinance={projectFinance}
              onChanged={onChanged}
              focused={event.id === focusedEventId}
            />
          ))
        ) : (
          <p>لم تسجل حدثًا عامًا بعد. سجّل واقعًا تعرفه، لا تقديرًا لا تثق به.</p>
        )}
        <div className="micro-form-actions" role="group" aria-label="نطاق عرض الأحداث">
          <button
            className="micro-text-action"
            type="button"
            aria-pressed={showAll}
            onClick={() => setShowAll(current => !current)}
          >
            {showAll ? "أعرض الأحدث فقط" : `اعرض كل الأحداث (${events.length})`}
          </button>
        </div>
        {showAll && events.length > visibleEvents.length ? (
          <p className="micro-finance-event-closed">
            السجل الكامل ظاهر الآن؛ التصفح للأسفل بلا حد أقصى، وكل صف قابل للتصحيح الموثق مثل الأحدث.
          </p>
        ) : null}
      </section>
    </details>
  );
}
