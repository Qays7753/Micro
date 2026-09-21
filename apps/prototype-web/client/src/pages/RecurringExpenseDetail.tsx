/**
 * OPS-003 (عقد ٤١ §٣/§٦/§٨/§١٢): تفصيل تذكير مصروف متكرر — فتراته بقراراتها
 * المحفوظة وحالتها الواحدة الصادقة: قادم/مستحق اليوم/متأخر انتباهًا/مؤجَّل/
 * مخطَّى/ملغاة/«تم تسجيل المصروف»/«المصروف مسجل مسبقًا لهذه الفترة»/«لم
 * يُسجل المصروف»/«نتيجة التسجيل غير معروفة». التسجيل يمر بمراجعة ومعاينة
 * وتأكيد صريح (RecurringConfirmPanel)؛ التراجع يبقى تصحيحًا ماليًا مستقلًا
 * من سجل الأحداث ولا يفتح الفترة. سؤال الشهر القصير صريح بلا تخمين.
 */
import { ArrowLeft, PencilLine, Plus } from "lucide-react";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useLocation, useParams } from "wouter";
import { withReturnTo } from "@/app/navigationContract";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { RecurringExpenseDetailReading } from "@/application/finance/recurringExpenseService";
import type {
  RecurringExpenseOccurrenceReading,
  RecurringExpenseRuleRevision,
} from "@micro-domain/recurring-expense/index.js";
import { RecurringConfirmPanel } from "@/components/finance/RecurringConfirmPanel";
import { LocalDateValue, MoneyValue } from "@/components/presentation/DisplayValue";
import { Button, StatusChip } from "@/components/primitives";

type PageState =
  | { phase: "loading" }
  | { phase: "ready"; detail: RecurringExpenseDetailReading }
  | { phase: "failed"; message: string };

export type InlineDecision =
  | { kind: "snooze"; occurrenceId: string }
  | { kind: "skip"; occurrenceId: string }
  | { kind: "cancel-series" }
  | null;

const SERIES_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة — فعّلها لتبدأ الفترات",
  active: "نشط",
  paused: "موقوف مؤقتًا — لا فترات جديدة حتى الاستئناف",
  cancelled: "ملغى — التذكير المستقبلي أُلغي بقرار موثق",
  archived: "مؤرشف — مخفي تشغيليًا وقابل للاستعادة",
};

function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function datePlusDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function occurrenceStatusLabel(reading: RecurringExpenseOccurrenceReading): string {
  const { displayState, occurrence } = reading;
  if (displayState === "recorded") return "تم تسجيل المصروف";
  if (displayState === "reversed") return "تم تسجيل المصروف — ثم عُكس بتراجع موثق";
  if (displayState === "record_failed") return "لم يُسجل المصروف";
  if (displayState === "result_unknown") return "نتيجة التسجيل غير معروفة";
  if (displayState === "recording") return "قيد التأكيد الآن";
  if (displayState === "snoozed") return `مؤجَّل انتباهه إلى ${occurrence.snoozedUntil}`;
  if (displayState === "skipped") return "مخطَّى بقرار موثق";
  if (displayState === "cancelled") return "ملغاة";
  if (reading.attention === "overdue") return "متأخر — انتباه لا دين";
  if (reading.attention === "due_today") return "مستحق اليوم";
  return "قادم";
}

export default function RecurringExpenseDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const { recurringExpenses, dataVersion, notifyDataChanged } = usePrototypeServices();
  const [state, setState] = useState<PageState>({ phase: "loading" });
  const [retryCount, setRetryCount] = useState(0);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [decision, setDecision] = useState<InlineDecision>(null);
  const [skipReason, setSkipReason] = useState("");
  const [snoozeCustom, setSnoozeCustom] = useState(datePlusDays(7));
  const [cancelReason, setCancelReason] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!recurringExpenses) return;
    let active = true;
    recurringExpenses.readDetail(params.id).then(result => {
      if (!active) return;
      if (!result.ok) {
        setState({ phase: "failed", message: result.message });
        return;
      }
      setState({ phase: "ready", detail: result.value });
    });
    return () => {
      active = false;
    };
  }, [recurringExpenses, params.id, dataVersion, retryCount]);

  if (!recurringExpenses || state.phase === "loading") {
    return (
      <div className="micro-route-loading" role="status">
        جارٍ قراءة فترات التذكير…
      </div>
    );
  }

  async function runSeriesAction(action: () => Promise<{ ok: boolean; message?: string }>): Promise<void> {
    if (busy) return;
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setActionMessage(result.message ?? "تعذر تنفيذ القرار — لم يُغيَّر شيء.");
      return;
    }
    setActionMessage(null);
    setDecision(null);
    setCancelReason("");
    notifyDataChanged();
  }

  if (state.phase === "failed") {
    return (
      <section className="micro-page micro-finance-more-page">
        <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
          رجوع
        </button>
        <div className="micro-cancel-panel" role="alert">
          <p>{state.message}</p>
          <Button action="save" onClick={() => setRetryCount(count => count + 1)}>
            إعادة المحاولة
          </Button>
        </div>
      </section>
    );
  }

  const { detail } = state;
  const { series, revisions } = detail;
  const latest = revisions.at(-1) ?? null;
  const today = todayLocal();

  return (
    <section className="micro-page micro-finance-more-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        رجوع
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">تذكير وفتراته وقراراتها</span>
        <h1 dir="auto">{series.title}</h1>
        <p>
          {SERIES_STATUS_LABELS[series.status] ?? series.status}
          {series.cancelReason ? ` — «${series.cancelReason}»` : ""}
        </p>
      </div>

      {latest ? (
        <section className="micro-decision-card" aria-label="القاعدة النافذة">
          <div>
            <span>القاعدة النافذة (مراجعة {latest.revision})</span>
            <strong>
              يوم {latest.dueDay} · كل {latest.interval === 1 ? "شهر" : `${latest.interval} أشهر`}
              {latest.amountMode !== "manual" && latest.suggestedAmountMinor ? (
                <>
                  {" · مقترح "}
                  <MoneyValue minor={latest.suggestedAmountMinor} className="micro-inline-number" />
                </>
              ) : null}
            </strong>
            <p>
              التقويم من <LocalDateValue value={latest.anchorDate} /> بتوقيت عمّان؛ الأشهر القصيرة{" "}
              {latest.monthEndPolicy === "last_valid_day"
                ? "بآخر يوم صالح"
                : latest.monthEndPolicy === "skip"
                  ? "تُخطَّى بلا فترة"
                  : "تُسأل حين تأتي"}
              {latest.categoryLabel ? ` · تصنيف: ${latest.categoryLabel}` : ""}.
            </p>
          </div>
        </section>
      ) : null}

      {series.status === "active" || series.status === "paused" || series.status === "draft" ? (
        <section className="micro-settings-list" aria-label="قرارات التذكير">
          {series.status === "draft" ? (
            <Button
              action="create"
              block
              disabled={busy}
              onClick={() => runSeriesAction(() => recurringExpenses.activate(series.id))}
            >
              <Plus aria-hidden="true" /> فعّل التذكير — تبدأ الفترات من قاعدته
            </Button>
          ) : null}
          {series.status === "active" ? (
            <Button
              action="secondary"
              block
              disabled={busy}
              onClick={() => runSeriesAction(() => recurringExpenses.pause(series.id))}
            >
              أوقف مؤقتًا — لا فترات جديدة أثناء التوقيف
            </Button>
          ) : null}
          {series.status === "paused" ? (
            <Button
              action="create"
              block
              disabled={busy}
              onClick={() => runSeriesAction(() => recurringExpenses.resume(series.id))}
            >
              استئنف — نشاط مستقبلي فقط بلا استكمال بأثر رجعي
            </Button>
          ) : null}
          {series.status !== "draft" ? (
            <Button
              action="secondary"
              block
              disabled={busy}
              onClick={() =>
                navigate(
                  withReturnTo(`/finance/recurring/${series.id}/edit`, `/finance/recurring/${series.id}`),
                )
              }
            >
              <PencilLine aria-hidden="true" /> عدّل قاعدة المستقبل — مراجعة خلف جديدة
            </Button>
          ) : null}
          {series.status === "active" || series.status === "paused" ? (
            <Button
              action="secondary"
              block
              disabled={busy}
              onClick={() =>
                setDecision(decision?.kind === "cancel-series" ? null : { kind: "cancel-series" })
              }
            >
              ألغِ تذكير المستقبل
            </Button>
          ) : null}
          {decision?.kind === "cancel-series" ? (
            <div className="micro-cancel-panel" role="dialog" aria-label="إلغاء تذكير المستقبل">
              <p>الإلغاء يوقف التذكير المستقبلي فقط — لا حذف ولا عكس ولا مس للتاريخ المالي، وسببك يُوثَّق.</p>
              <label className="micro-field">
                <span>سبب الإلغاء</span>
                <input
                  value={cancelReason}
                  maxLength={80}
                  onChange={event => setCancelReason(event.target.value)}
                  placeholder="أغلقت المحل مثلًا"
                />
              </label>
              <Button
                action="destructive"
                block
                disabled={busy || !cancelReason.trim()}
                onClick={() =>
                  runSeriesAction(() => recurringExpenses.cancel(series.id, cancelReason.trim()))
                }
              >
                أكّد إلغاء تذكير المستقبل
              </Button>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="micro-settings-list" aria-label="قرارات التذكير">
          {series.status === "archived" ? (
            <Button
              action="create"
              block
              disabled={busy}
              onClick={() => runSeriesAction(() => recurringExpenses.restore(series.id))}
            >
              استعد التذكير — كما كان، نشاطًا مستقبليًا
            </Button>
          ) : null}
          {series.status === "cancelled" ? (
            <p>التفاعل بمراجعة خلف جديدة من محرر التعديل المستقبلي — القرارات المحفوظة باقية كما هي.</p>
          ) : null}
        </section>
      )}

      {detail.pendingDueDecisions.length > 0 ? (
        <section className="micro-supplier-list" aria-label="أسئلة الشهر القصير">
          <div className="micro-finance-event-heading">
            <span className="micro-overline">سؤال صريح بلا تخمين</span>
          </div>
          {detail.pendingDueDecisions.map(pending => (
            <article key={pending.periodKey}>
              <div className="micro-supplier-balance">
                <div>
                  <strong>
                    يوم {pending.dueDay} لا يوجد في فترة {pending.periodKey}
                  </strong>
                  <small>كيف تريد تذكير هذا الشهر القصير؟ القرار يُحفظ موثقًا.</small>
                </div>
                <div>
                  <Button
                    action="secondary"
                    disabled={busy}
                    onClick={() =>
                      runSeriesAction(() =>
                        recurringExpenses.resolveDueDecision(series.id, pending.periodKey, "last_valid_day"),
                      )
                    }
                  >
                    ذكّرني آخر يوم صالح ({pending.lastValidDay})
                  </Button>
                  <Button
                    action="quiet"
                    disabled={busy}
                    onClick={() =>
                      runSeriesAction(() =>
                        recurringExpenses.resolveDueDecision(series.id, pending.periodKey, "skip"),
                      )
                    }
                  >
                    تخطَّ هذا الشهر
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      <section className="micro-supplier-list" aria-label="فترات التذكير">
        <div className="micro-finance-event-heading">
          <span className="micro-overline">الفترات وقراراتها</span>
        </div>
        {detail.occurrences.length === 0 ? (
          <p>لا فترات بعد — توليد الفترات أمامي محدود للسلسلة النشطة.</p>
        ) : null}
        {detail.occurrences.map(reading => (
          <OccurrenceRow
            key={reading.occurrence.id}
            reading={reading}
            service={recurringExpenses}
            seriesTitle={series.title}
            latest={latest}
            today={today}
            busy={busy}
            decision={decision}
            setDecision={setDecision}
            skipReason={skipReason}
            setSkipReason={setSkipReason}
            snoozeCustom={snoozeCustom}
            setSnoozeCustom={setSnoozeCustom}
            confirmingId={confirmingId}
            setConfirmingId={setConfirmingId}
            onSeriesAction={runSeriesAction}
            onOpenEvents={() =>
              navigate(withReturnTo("/finance?layer=events", `/finance/recurring/${series.id}`))
            }
            onCheckResult={() => runSeriesAction(() => recurringExpenses.checkResult(reading.occurrence.id))}
          />
        ))}
      </section>

      {actionMessage ? (
        <p className="micro-field-error" role="alert">
          {actionMessage}
        </p>
      ) : null}

      <div className="micro-offline-truth" role="note">
        التسجيل يحدث بمراجعة وتأكيد صريحين فقط — والتصحيح المالي تراجع موثق من سجل الأحداث لا من هنا.
      </div>
    </section>
  );
}

function OccurrenceRow({
  reading,
  service,
  seriesTitle,
  latest,
  today,
  busy,
  decision,
  setDecision,
  skipReason,
  setSkipReason,
  snoozeCustom,
  setSnoozeCustom,
  confirmingId,
  setConfirmingId,
  onSeriesAction,
  onOpenEvents,
  onCheckResult,
}: {
  reading: RecurringExpenseOccurrenceReading;
  service: NonNullable<ReturnType<typeof usePrototypeServices>["recurringExpenses"]>;
  seriesTitle: string;
  latest: RecurringExpenseRuleRevision | null;
  today: string;
  busy: boolean;
  decision: InlineDecision;
  setDecision: Dispatch<SetStateAction<InlineDecision>>;
  skipReason: string;
  setSkipReason: Dispatch<SetStateAction<string>>;
  snoozeCustom: string;
  setSnoozeCustom: Dispatch<SetStateAction<string>>;
  confirmingId: string | null;
  setConfirmingId: Dispatch<SetStateAction<string | null>>;
  onSeriesAction: (action: () => Promise<{ ok: boolean; message?: string }>) => Promise<void>;
  onOpenEvents: () => void;
  onCheckResult: () => void;
}) {
  /* الخدمة تمر كخاصية من الأب (محملة غير معدومة) — لا استدعاء سياق ثانٍ. */
  const recurring = service;
  const occurrence = reading.occurrence;
  const isOpen =
    reading.displayState === "planned" ||
    reading.displayState === "snoozed" ||
    reading.displayState === "record_failed" ||
    reading.displayState === "result_unknown";
  return (
    <article>
      <div className="micro-supplier-balance">
        <div>
          <strong>
            فترة {occurrence.periodKey} — موعد التذكير <LocalDateValue value={occurrence.dueOn} />
          </strong>
          <small>{occurrenceStatusLabel(reading)}</small>
          {reading.displayState === "recorded" && occurrence.reviewedOccurredOn ? (
            <small>
              بتاريخ حدوثه المعلن <LocalDateValue value={occurrence.reviewedOccurredOn} />
              {occurrence.reviewedAmountMinor ? (
                <>
                  {" · بمبلغ "}
                  <MoneyValue minor={occurrence.reviewedAmountMinor} className="micro-inline-number" />
                </>
              ) : null}
            </small>
          ) : null}
          {occurrence.skipReason ? <small dir="auto">سبب التخطي: {occurrence.skipReason}</small> : null}
        </div>
        <div>
          {reading.displayState === "result_unknown" ? (
            <StatusChip state="unknown">{occurrenceStatusLabel(reading)}</StatusChip>
          ) : null}
          {reading.displayState === "reversed" ? (
            <Button action="secondary" onClick={onOpenEvents}>
              افتح سجل الأحداث <ArrowLeft aria-hidden="true" />
            </Button>
          ) : null}
          {isOpen ? (
            <>
              <Button
                action="save"
                disabled={busy}
                onClick={() => setConfirmingId(confirmingId === occurrence.id ? null : occurrence.id)}
              >
                سجّل مصروف هذه الفترة
              </Button>
              <Button
                action="secondary"
                disabled={busy}
                onClick={() =>
                  setDecision(
                    decision?.kind === "snooze" && decision.occurrenceId === occurrence.id
                      ? null
                      : { kind: "snooze", occurrenceId: occurrence.id },
                  )
                }
              >
                أجّل انتباهه
              </Button>
              <Button
                action="quiet"
                disabled={busy}
                onClick={() =>
                  setDecision(
                    decision?.kind === "skip" && decision.occurrenceId === occurrence.id
                      ? null
                      : { kind: "skip", occurrenceId: occurrence.id },
                  )
                }
              >
                خطِّ هذه الفترة
              </Button>
              {reading.displayState === "result_unknown" ? (
                <Button action="outline" disabled={busy} onClick={onCheckResult}>
                  تحقق من النتيجة
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      {decision?.kind === "snooze" && decision.occurrenceId === occurrence.id ? (
        <div className="micro-cancel-panel" role="dialog" aria-label="تأجيل انتباه الفترة">
          <p>التأجيل انتباه فقط — موعد التذكير المجدول لا يتغير، والقرار يُحفظ موثقًا.</p>
          <div className="micro-form-actions">
            <Button
              action="secondary"
              disabled={busy || datePlusDays(1) <= today}
              onClick={() => onSeriesAction(() => recurring.snooze(occurrence.id, datePlusDays(1)))}
            >
              غدًا
            </Button>
            <Button
              action="secondary"
              disabled={busy}
              onClick={() => onSeriesAction(() => recurring.snooze(occurrence.id, datePlusDays(3)))}
            >
              بعد ٣ أيام
            </Button>
            <Button
              action="secondary"
              disabled={busy}
              onClick={() => onSeriesAction(() => recurring.snooze(occurrence.id, datePlusDays(7)))}
            >
              بعد أسبوع
            </Button>
          </div>
          <label className="micro-field">
            <span>أو تاريخًا لاحقًا تختاره</span>
            <input
              type="date"
              lang="en"
              dir="ltr"
              value={snoozeCustom}
              onChange={event => setSnoozeCustom(event.target.value)}
            />
          </label>
          <Button
            action="save"
            block
            disabled={busy || snoozeCustom <= today}
            onClick={() => onSeriesAction(() => recurring.snooze(occurrence.id, snoozeCustom))}
          >
            أجل إلى {snoozeCustom}
          </Button>
        </div>
      ) : null}
      {decision?.kind === "skip" && decision.occurrenceId === occurrence.id ? (
        <div className="micro-cancel-panel" role="dialog" aria-label="تخطي الفترة">
          <p>التخطي قرار محفوظ لهذه الفترة وحدها — لا يكتب صفرًا ولا حدثًا ولا أي أثر مالي.</p>
          <label className="micro-field">
            <span>سبب التخطي (اختياري، يُوثَّق)</span>
            <input
              value={skipReason}
              maxLength={80}
              onChange={event => setSkipReason(event.target.value)}
              placeholder="دفعته نقدًا خارج التطبيق مثلًا"
            />
          </label>
          <Button
            action="save"
            block
            disabled={busy}
            onClick={() =>
              onSeriesAction(() => recurring.skipOccurrence(occurrence.id, skipReason.trim() || null))
            }
          >
            أكّد تخطي هذه الفترة
          </Button>
        </div>
      ) : null}
      {confirmingId === occurrence.id && latest ? (
        <RecurringConfirmPanel
          seriesTitle={seriesTitle}
          periodKey={occurrence.periodKey}
          dueOn={occurrence.dueOn}
          amountMode={latest.amountMode}
          suggestedAmountMinor={latest.suggestedAmountMinor}
          suggestedCategoryLabel={latest.categoryLabel}
          suggestedWalletId={latest.suggestedWalletId}
          occurrenceId={occurrence.id}
          today={today}
          onSettled={() => setConfirmingId(null)}
        />
      ) : null}
    </article>
  );
}
