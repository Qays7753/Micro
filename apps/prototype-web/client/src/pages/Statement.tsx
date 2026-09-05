/**
 * المجموعة ٢ (§9.2 — StatementView): كشف فترة بسيط — يفصل الكاش عن النتيجة عن
 * الأمانات عن الذمم عن مال المالك، ويفسر المجهول بصدق، ويصل كل سطر بمصدره.
 * الأسبوع الحالي افتراضيًا؛ نطاقات سريعة ونطاق مخصص — والرجوع للمصدر محفوظ.
 */
import { ArrowLeft, FileText, HandCoins, Landmark, ReceiptText, Share2, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { RestatementNote } from "@/components/finance/RestatementNote";
import { StatementMarkdownService } from "@/application/finance/statementMarkdownService";
import { categoryCountLabel } from "@/presentation/g5Plurals";
import { canShareText, downloadTextFile, shareTextManually } from "@/lib/textDelivery";
import {
  formatLocalDate,
  formatLocalDateLong,
  localDateInAmman,
  formatMoneyWithUnit,
} from "@/presentation/formatters";
import type {
  StatementLine,
  StatementReading,
  StatementExpenseCategoryGroup,
} from "@/application/finance/statementService";

type State =
  { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; reading: StatementReading };

type QuickRange = "this_week" | "last_week" | "this_month" | "custom";

/* المجموعة ١ (تصنيفي للمصاريف): «مصاريفي حسب تصنيفي» — صفوف الأوسمة بنفس
 * نمط صفوف الكشف (زر تبديل يفتح المصادر)؛ «غير مصنّف» مجموعة صادقة أخيرة. */
function ExpenseCategoryGroupRow({
  group,
  onOpenSource,
}: {
  group: StatementExpenseCategoryGroup;
  onOpenSource: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <article
      className="micro-finance-event"
      data-category-group={group.classified ? "classified" : "unclassified"}
    >
      <div className="micro-finance-event-main">
        <div>
          <strong>{group.label}</strong>
          <small>
            {group.classified
              ? "تصنيفك — قراءة تجميعية لا تغير الأثر"
              : "مصاريف بلا وسم — صنّفها من محرر المصروف عند الحاجة"}
          </small>
        </div>
        <b>
          <MoneyValue minor={group.totalMinor} /> د.أ
        </b>
      </div>
      <button
        className="micro-text-action micro-finance-event-toggle"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
      >
        {open ? "إخفاء المصادر" : `المصادر (${group.lines.length})`}
      </button>
      {open ? (
        <ul className="micro-party-movements">
          {group.lines.map(line => (
            <li key={line.eventId}>
              <button type="button" onClick={() => onOpenSource(line.href)}>
                <span>
                  <b>{line.note}</b>
                  <small>
                    {formatLocalDate(line.occurredOn) ?? line.occurredOn} ·{" "}
                    {line.kind === "paid" ? "مدفوع" : "مستحق"}
                  </small>
                </span>
                <MoneyValue minor={line.amountMinor} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

const DAY = 24 * 60 * 60 * 1000;
const shiftDate = (localDate: string, days: number): string => {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
};
/* الأسبوع في النموذج: الأحد → السبت (أسبوع عمل المالك الصغير في الأردن). */
function weekBounds(today: string): { from: string; to: string } {
  const [year, month, day] = today.split("-").map(Number);
  const weekday = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
  const from = shiftDate(today, -weekday);
  return { from, to: shiftDate(from, 6) };
}

function StatementLineRow({
  line,
  onOpenSource,
}: {
  line: StatementLine;
  onOpenSource: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <article className="micro-finance-event">
      <div className="micro-finance-event-main">
        <div>
          <strong>{line.label}</strong>
          <small>{line.qualifier ?? ""}</small>
        </div>
        <b>
          <MoneyValue minor={line.amountMinor} showPlus /> د.أ
        </b>
      </div>
      {line.sources.length > 0 ? (
        <button
          className="micro-text-action micro-finance-event-toggle"
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(current => !current)}
        >
          {open ? "إخفاء المصادر" : `المصادر (${line.sources.length})`}
        </button>
      ) : null}
      {open ? (
        <ul className="micro-party-movements">
          {line.sources.map(source => (
            <li key={`${source.href}:${source.label}`}>
              <button type="button" onClick={() => onOpenSource(source.href)}>
                <span>
                  <b>{source.label}</b>
                </span>
                <MoneyValue minor={source.amountMinor} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export default function Statement() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const returnPath = useReturnPath();
  const { statement, dataVersion } = usePrototypeServices();
  const markdownRenderer = new StatementMarkdownService();
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  const today = localDateInAmman();
  const thisWeek = weekBounds(today);
  const [range, setRange] = useState<QuickRange>("this_week");
  const [from, setFrom] = useState(thisWeek.from);
  const [to, setTo] = useState(thisWeek.to);
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    let active = true;
    statement.read(from, to).then(result => {
      if (!active) return;
      setState(
        result.ok ? { phase: "ready", reading: result.value } : { phase: "error", message: result.message },
      );
    });
    return () => {
      active = false;
    };
  }, [statement, from, to, dataVersion]);

  const applyQuick = (quick: QuickRange) => {
    setRange(quick);
    if (quick === "this_week") {
      setFrom(thisWeek.from);
      setTo(thisWeek.to);
    } else if (quick === "last_week") {
      const lastFrom = shiftDate(thisWeek.from, -7);
      setFrom(lastFrom);
      setTo(shiftDate(lastFrom, 6));
    } else if (quick === "this_month") {
      const month = today.slice(0, 7);
      const [year, monthNumber] = month.split("-").map(Number);
      const lastDay = new Date(Date.UTC(year!, monthNumber!, 0)).getUTCDate();
      setFrom(`${month}-01`);
      setTo(`${month}-${String(lastDay).padStart(2, "0")}`);
    }
  };

  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ قراءة كشف الفترة…
      </div>
    );
  if (state.phase === "error")
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر قراءة الكشف</h1>
        <p>{state.message}</p>
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate(returnPath)}
        >
          رجوع
        </button>
      </section>
    );

  const { reading } = state;
  const openWithReferrer = (path: string) =>
    navigate(`${path}${path.includes("?") ? "&" : "?"}from=${encodeURIComponent("/finance/statement")}`);
  /* روابط المصادر تعود للكشف عبر ?from= لا للمالي — السياق محفوظ. */
  const sourceHref = new URLSearchParams(search).get("from");

  /* المجموعة ٥ (عقد ٣٢): تقرير محلي — التنزيل متاح دائمًا، والمشاركة تحسين
   * اختياري عبر نظام المشاركة بالنص وحده؛ التوليد لا يغيّر أي رقم ولا يسجل
   * حدثًا. */
  const generateReport = async () => {
    setReportNotice(null);
    const rendered = markdownRenderer.render(reading);
    if (!rendered.ok) {
      setReportNotice(rendered.message);
      return;
    }
    downloadTextFile(rendered.value.filename, rendered.value.markdown, "text/markdown");
    if (canShareText()) {
      const outcome = await shareTextManually(rendered.value.markdown);
      setReportNotice(
        outcome === "shared"
          ? "التقرير جاهز ونُزّل، وفتح نظام المشاركة بيدك — الإرسال قرارك هناك."
          : outcome === "copied"
            ? "التقرير نُزّل ونسخ نصه للحافظة — مشاركته قرارك اليدوي."
            : "التقرير نُزّل ملفًا نصيًا — نسخة قراءة لحظة، ليست حدثًا ماليًا.",
      );
      return;
    }
    setReportNotice("التقرير نُزّل ملفًا نصيًا — نسخة قراءة لحظة من سجلك، ليست حدثًا ماليًا.");
  };

  return (
    <section className="micro-page micro-statement-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowLeft aria-hidden="true" /> رجوع
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">كشف فترة · المبالغ (د.أ)</span>
        <h1>كشف الفترة</h1>
        <p>
          من {formatLocalDateLong(reading.from)} إلى {formatLocalDateLong(reading.to)} — ما صار خلالها،
          مفصولًا: الكاش غير النتيجة، والأمانات غير الربح.
        </p>
      </div>
      <section className="micro-form-card" aria-label="نطاق الكشف">
        <div className="micro-form-actions" role="group" aria-label="نطاقات سريعة">
          {(
            [
              ["this_week", "هذا الأسبوع"],
              ["last_week", "الأسبوع الماضي"],
              ["this_month", "هذا الشهر"],
              ["custom", "نطاق مخصص"],
            ] as readonly [QuickRange, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              className="micro-text-action"
              type="button"
              aria-pressed={range === value}
              onClick={() => applyQuick(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {range === "custom" ? (
          <div className="micro-period-range-fields">
            <LocalDateField label="من" value={from} onChange={event => setFrom(event.target.value)} />
            <LocalDateField label="إلى" value={to} onChange={event => setTo(event.target.value)} />
          </div>
        ) : null}
      </section>
      <section className="micro-decision-card" aria-label="صافي الكاش في الفترة">
        <WalletCards aria-hidden="true" />
        <div>
          <span>صافي حركة الكاش في الفترة</span>
          <strong>
            <MoneyValue minor={reading.cashNetMinor} showPlus /> د.أ
          </strong>
          <p>حركة القبض والدفع — ليس ربحًا ولا نتيجة؛ الكاش قد يرتفع من دين تحصّل أو أمانة قُبضت.</p>
        </div>
      </section>
      <section className="micro-supplier-list" aria-label="حركات الكاش داخل الفترة">
        <div className="micro-finance-event-heading">
          <span className="micro-overline">دخل كاش</span>
          <h2>ما دخل من كاش</h2>
        </div>
        {reading.blocks.cashIn.length === 0 ? (
          <p className="micro-empty-copy">لا حركات كاش داخلة في هذه الفترة.</p>
        ) : (
          reading.blocks.cashIn.map(line => (
            <StatementLineRow key={line.id} line={line} onOpenSource={path => openWithReferrer(path)} />
          ))
        )}
        <div className="micro-finance-event-heading">
          <span className="micro-overline">خرج كاش</span>
          <h2>ما خرج من كاش</h2>
        </div>
        {reading.blocks.cashOut.length === 0 ? (
          <p className="micro-empty-copy">لا حركات كاش خارجة في هذه الفترة.</p>
        ) : (
          reading.blocks.cashOut.map(line => (
            <StatementLineRow key={line.id} line={line} onOpenSource={path => openWithReferrer(path)} />
          ))
        )}
        {reading.blocks.corrections.lines.length > 0 ? (
          <>
            <div className="micro-finance-event-heading">
              <span className="micro-overline">تصحيحات الفترة</span>
              <h2>تصحيحات وقعت خلالها</h2>
            </div>
            {reading.blocks.corrections.lines.map(correction => (
              <article key={correction.id} className="micro-finance-event">
                <div className="micro-finance-event-main">
                  <div>
                    <strong>تراجع عن {correction.familyLabel}</strong>
                    <small>
                      {correction.reason ? `السبب: ${correction.reason} — ` : ""}
                      الأثر الصافي على هذا الكشف{" "}
                      {correction.netEffectMinor === 0
                        ? "صفر: الأثر أُلغي كاملًا"
                        : formatMoneyWithUnit(correction.netEffectMinor)}
                    </small>
                  </div>
                  <b>
                    <MoneyValue minor={correction.netEffectMinor} showPlus /> د.أ
                  </b>
                </div>
                <button
                  className="micro-text-action micro-finance-event-toggle"
                  type="button"
                  onClick={() => openWithReferrer(correction.sourceHref)}
                >
                  {correction.sourceLabel}
                </button>
              </article>
            ))}
            <RestatementNote
              count={reading.blocks.corrections.lines.length}
              netAmountMinor={reading.blocks.corrections.netMinor}
              scopeLabel="هذه الفترة"
              onOpen={() => openWithReferrer("/finance?layer=corrections")}
            />
          </>
        ) : null}
      </section>
      <section className="micro-decision-card" aria-label="نتيجة الفترة">
        <ReceiptText aria-hidden="true" />
        <div>
          <span>نتيجة الفترة المسجلة</span>
          <strong>
            {reading.result.resultMinor === null ? (
              "غير متاح"
            ) : (
              <MoneyValue minor={reading.result.resultMinor} />
            )}
            {reading.result.resultMinor === null ? null : " د.أ"}
          </strong>
          <p>
            {/* المجموعة ١ (قراءة الفترة الواحدة): المجموع مشتقّ في الخدمة — لا حساب فترة داخل الصفحة. */}
            إيراد معترف به {formatMoneyWithUnit(reading.recognizedRevenueTotalMinor)} − تكلفة مباشرة{" "}
            {formatMoneyWithUnit(reading.result.effectiveDirectCostMinor)} − مصروف موزّع{" "}
            {formatMoneyWithUnit(reading.result.recordedOperatingExpenseMinor)} — ضمن الفترة فقط.
            {reading.result.resultMinor === null
              ? " هناك تكلفة غير معروفة تمنع رقمًا نهائيًا — لا يُعرض ربح متوهَّم."
              : ""}
          </p>
          <p>
            الملك {formatMoneyWithUnit(reading.blocks.owner.investedMinor)} · سحب{" "}
            {formatMoneyWithUnit(reading.blocks.owner.withdrawnMinor)} — مال المالك لا يدخل النتيجة.
          </p>
        </div>
      </section>
      {reading.expenseCategories.length > 0 ? (
        /* المجموعة ١ (تصنيفي للمصاريف): كتلة مطوية افتراضيًا — تُفتح حين يريدها
         * المالك؛ التجميع بُعد قراءة فوق نفس أحداث الفترة، لا مسار حساب ثانٍ. */
        <details className="micro-finance-layer micro-category-groups">
          <summary className="micro-finance-layer-summary">
            <span>
              <b>مصاريفي حسب تصنيفي</b>
              <small>{`${categoryCountLabel(reading.expenseCategories.length)} — وسمك البشري، لا تصنيفًا محاسبيًا`}</small>
            </span>
            <strong>افتح التجميع</strong>
          </summary>
          <section className="micro-finance-event-list">
            {reading.expenseCategories.map(group => (
              <ExpenseCategoryGroupRow key={group.label} group={group} onOpenSource={openWithReferrer} />
            ))}
          </section>
        </details>
      ) : null}
      {/* المجموعة ٥ (عقد ٣١): بنود عقد ٢٩ غير النقدية وطبقات المركز — طبقة
       * مطوية كإخواتها؛ أرقامها من القارئ الكنوني نفسه (قراءة، لا حساب جديد). */}
      <details className="micro-finance-layer micro-statement-deep">
        <summary className="micro-finance-layer-summary">
          <span>
            <b>الأصول والقروض والعربونات في النتيجة</b>
            <small>الإهلاك والشطب والتخلص والعربون المصنّف — وطبقات مستقلة الآن</small>
          </span>
          <strong>افتح العمق</strong>
        </summary>
        <section className="micro-finance-event-list">
          <article className="micro-finance-event">
            <div className="micro-finance-event-main">
              <div>
                <strong>إهلاك الأصول</strong>
                <small>غير نقدي — يخفض النتيجة لا الكاش</small>
              </div>
              <b>
                <MoneyValue minor={reading.blocks.deepFinance.depreciationMinor} /> د.أ
              </b>
            </div>
          </article>
          <article className="micro-finance-event">
            <div className="micro-finance-event-main">
              <div>
                <strong>خسارة شطب أصول</strong>
                <small>غير نقدي — مبلغ دفتري مفقود</small>
              </div>
              <b>
                <MoneyValue minor={reading.blocks.deepFinance.writeOffLossMinor} /> د.أ
              </b>
            </div>
          </article>
          <article className="micro-finance-event">
            <div className="micro-finance-event-main">
              <div>
                <strong>نتيجة التخلص من أصول</strong>
                <small>مقابل البيع ناقصًا الدفتري</small>
              </div>
              <b>
                <MoneyValue minor={reading.blocks.deepFinance.disposalResultMinor} showPlus /> د.أ
              </b>
            </div>
          </article>
          <article className="micro-finance-event">
            <div className="micro-finance-event-main">
              <div>
                <strong>عربون محتفظ به مصنّف إيرادًا</strong>
                <small>بقرار موثق — الكاش قُبض سابقًا</small>
              </div>
              <b>
                <MoneyValue minor={reading.blocks.deepFinance.retainedDepositRevenueMinor} /> د.أ
              </b>
            </div>
          </article>
          <article className="micro-finance-event">
            <div className="micro-finance-event-main">
              <div>
                <strong>الدفتري للأصول النشطة — الآن</strong>
                <small>ليس مصروفًا ولا كاشًا</small>
              </div>
              <b>
                <MoneyValue minor={reading.blocks.deepFinance.assetBookValueNowMinor} /> د.أ
              </b>
            </div>
          </article>
          <article className="micro-finance-event">
            <div className="micro-finance-event-main">
              <div>
                <strong>القروض القائمة — الآن</strong>
                <small>ذمم لصالح مشروعك — ليست نتيجة</small>
              </div>
              <b>
                <MoneyValue minor={reading.blocks.deepFinance.loansOutstandingNowMinor} /> د.أ
              </b>
            </div>
          </article>
          <article className="micro-finance-event">
            <div className="micro-finance-event-main">
              <div>
                <strong>عربونات محتفظة بانتظار القرار — الآن</strong>
                <small>ليست مالكًا ولا إيرادًا بعد</small>
              </div>
              <b>
                <MoneyValue minor={reading.blocks.deepFinance.pendingRetainedDepositsNowMinor} /> د.أ
              </b>
            </div>
          </article>
        </section>
      </details>
      {reading.blocks.deepFinance.unresolved.length > 0 ? (
        <section className="micro-info-card" data-tone="warning" aria-label="قيم غير محلولة">
          <span className="micro-overline">قيم غير محلولة</span>
          <h2>ما لم يُحسم بعد</h2>
          <ul className="micro-activity-unresolved">
            {reading.blocks.deepFinance.unresolved.map(item => (
              <li key={item.id}>
                <span>{item.label}</span>
                <b>
                  {item.amountMinor === null ? null : (
                    <>
                      <MoneyValue minor={item.amountMinor} /> د.أ
                    </>
                  )}
                  {item.count !== null && item.count !== undefined ? ` (${item.count})` : ""}
                </b>
              </li>
            ))}
          </ul>
          <p>هذه القيم تُعرض كما هي — لا تُختزل إلى صفر ولا تدخل رقمًا نهائيًا قبل حلّها.</p>
        </section>
      ) : null}
      <section className="micro-decision-card" aria-label="الأمانات في الفترة">
        <HandCoins aria-hidden="true" />
        <div>
          <span>الأمانات — ليست ربحك</span>
          <strong>
            <MoneyValue minor={reading.blocks.amanah.heldNowMinor} /> د.أ بحوزتك الآن
          </strong>
          <p>
            قُبض {formatMoneyWithUnit(reading.blocks.amanah.heldInPeriodMinor)} · سُلّم{" "}
            {formatMoneyWithUnit(reading.blocks.amanah.releasedInPeriodMinor)} خلال الفترة —{" "}
            {reading.blocks.amanah.trustLine}
          </p>
        </div>
      </section>
      <section className="micro-cash-facts" aria-label="الدين الآن">
        <div>
          <span>لي عند الناس الآن</span>
          <strong>
            <MoneyValue minor={reading.blocks.receivablesPayables.receivablesNowMinor} /> د.أ
          </strong>
          <small>
            تحصّل منها في الفترة{" "}
            {formatMoneyWithUnit(reading.blocks.receivablesPayables.collectionsInPeriodMinor)}
          </small>
        </div>
        <div>
          <span>عليّ للناس الآن</span>
          <strong>
            <MoneyValue minor={reading.blocks.receivablesPayables.payablesNowMinor} /> د.أ
          </strong>
          <small>
            دفع للموردين في الفترة{" "}
            {formatMoneyWithUnit(
              reading.blocks.receivablesPayables.supplierPurchasesInPeriodMinor +
                reading.blocks.receivablesPayables.supplierPaymentsInPeriodMinor,
            )}
          </small>
        </div>
      </section>
      <section className="micro-info-card" data-tone="accent" aria-label="تقرير الفترة">
        <span className="micro-overline">تقرير الفترة المحلي</span>
        <h2>خذ التقرير معك</h2>
        <p>
          ملف نصي (Markdown) عربي بأرقام هذه الفترة — يُولّد على جهازك ويعمل دون إنترنت؛ نسخة قراءة لحظة ليست
          حدثًا ماليًا. مشاركته إن شئت فعلٌ يدوي بيدك وحدك.
        </p>
        <div className="micro-form-actions">
          <button
            className="micro-button micro-button-primary"
            type="button"
            onClick={() => void generateReport()}
          >
            <Share2 aria-hidden="true" /> ولّد ونزّل التقرير
          </button>
        </div>
        {reportNotice ? (
          <p className="micro-offline-truth" role="status">
            {reportNotice}
          </p>
        ) : null}
      </section>
      <div className="micro-finance-actions">
        <button
          className="micro-button micro-button-secondary"
          type="button"
          onClick={() => navigate(sourceHref ? sourceHref : withFromFallback(returnPath))}
        >
          <Landmark aria-hidden="true" /> الوضع المالي
        </button>
      </div>
      <section className="micro-finance-truth" aria-label="حدود هذا الكشف">
        <FileText aria-hidden="true" />
        <div>
          <h2>ما يعنيه هذا الكشف</h2>
          {reading.truthLines.map(line => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </section>
    </section>
  );
}

function withFromFallback(returnPath: string): string {
  /* رجوع الكشف يمر عبر ?from المحفوظ أو البديل القانوني — لا وجهة ثابتة مفروضة. */
  return returnPath && returnPath !== "/finance/statement" ? returnPath : "/finance";
}
