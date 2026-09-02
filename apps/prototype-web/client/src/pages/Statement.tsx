/**
 * المجموعة ٢ (§9.2 — StatementView): كشف فترة بسيط — يفصل الكاش عن النتيجة عن
 * الأمانات عن الذمم عن مال المالك، ويفسر المجهول بصدق، ويصل كل سطر بمصدره.
 * الأسبوع الحالي افتراضيًا؛ نطاقات سريعة ونطاق مخصص — والرجوع للمصدر محفوظ.
 */
import { ArrowLeft, FileText, HandCoins, Landmark, ReceiptText, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { formatLocalDate, formatLocalDateLong, localDateInAmman , formatMoneyWithUnit } from "@/presentation/formatters";
import type { StatementLine, StatementReading } from "@/application/finance/statementService";

type State =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; reading: StatementReading };

type QuickRange = "this_week" | "last_week" | "this_month" | "custom";

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
        result.ok
          ? { phase: "ready", reading: result.value }
          : { phase: "error", message: result.message },
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
        <button className="micro-button micro-button-primary" type="button" onClick={() => navigate(returnPath)}>
          رجوع
        </button>
      </section>
    );

  const { reading } = state;
  const openWithReferrer = (path: string) => navigate(`${path}${path.includes("?") ? "&" : "?"}from=${encodeURIComponent("/finance/statement")}`);
  /* روابط المصادر تعود للكشف عبر ?from= لا للمالي — السياق محفوظ. */
  const sourceHref = new URLSearchParams(search).get("from");

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
          <p>
            حركة القبض والدفع — ليس ربحًا ولا نتيجة؛ الكاش قد يرتفع من دين تحصّل أو أمانة قُبضت.
          </p>
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
            <StatementLineRow
              key={line.id}
              line={line}
              onOpenSource={path => openWithReferrer(path)}
            />
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
            <StatementLineRow
              key={line.id}
              line={line}
              onOpenSource={path => openWithReferrer(path)}
            />
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
            <p className="micro-empty-copy">
              التصحيح يظهر هنا مرة واحدة — لا مع عائلته الأصلية، ولا يُخفى أثره.
            </p>
          </>
        ) : null}
      </section>
      <section className="micro-decision-card" aria-label="نتيجة الفترة">
        <ReceiptText aria-hidden="true" />
        <div>
          <span>نتيجة الفترة المسجلة</span>
          <strong>
            {reading.result.resultMinor === null ? "غير متاح" : <MoneyValue minor={reading.result.resultMinor} />}
            {reading.result.resultMinor === null ? null : " د.أ"}
          </strong>
          <p>
            إيراد معترف به {formatMoneyWithUnit(reading.result.recognizedRevenueMinor + reading.result.directSaleRevenueMinor)}{" "}
            − تكلفة مباشرة {formatMoneyWithUnit(reading.result.effectiveDirectCostMinor)} − مصروف موزّع{" "}
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
            تحصّل منها في الفترة {formatMoneyWithUnit(reading.blocks.receivablesPayables.collectionsInPeriodMinor)}
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
