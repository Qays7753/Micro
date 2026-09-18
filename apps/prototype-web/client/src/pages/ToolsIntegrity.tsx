/**
 * سلامة الحسابات (Wave 4.2 — P-4.2-4/F05): سطح قراءة فقط — «يقرأ أرقامك ولا
 * يغيّر شيئًا». المدخل المرئي صار «المالية ← المزيد ← سلامة الحسابات»؛ المسار
 * التقني /tools/integrity يبقى للتوافق مع الروابط السابقة (قرار F05). زر
 * الرجوع ديناميكي حسب مصدر الدخول (?returnTo) — لا يعرض «أدواتي» لمن دخل من
 * المالية. الحالة كلمة وأيقونة لا لونًا وحده؛ لا إصلاح تلقائي أبدًا — الفحص
 * يشير والتصحيح مساره الموثق في أسطحه الأصلية.
 */
import { AlertTriangle, ArrowRight, CheckCircle2, CircleSlash, OctagonX, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { withReturnTo } from "@/app/navigationContract";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { financialEventLabel } from "@/presentation/financialEventLabels";
import {
  formatArabicPlural,
  formatLocalDate,
  formatLocalDateLong,
  formatLocalDateTime,
} from "@/presentation/formatters";
import type {
  IntegrityCheckReport,
  IntegrityCheckResult,
  IntegrityOffenderSummary,
  IntegrityCheckStatus,
} from "@/application/finance/integrityCheckService";

import { Button } from "@/components/primitives";
type State =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "done"; report: IntegrityCheckReport }
  | { phase: "error"; message: string };

const statusMeta: Record<IntegrityCheckStatus, { word: string; Icon: typeof CheckCircle2 }> = {
  PASS: { word: "سليم", Icon: CheckCircle2 },
  WARN: { word: "تحذير", Icon: AlertTriangle },
  UNAVAILABLE: { word: "غير متاح", Icon: CircleSlash },
  FAIL: { word: "خلل", Icon: OctagonX },
};

/* TOOL-001: مجاميع الحالات من نتائج التشغيل نفسها — العدّ والقائمة متفقان
 * دائمًا لأنهما من المصدر نفسه. */
function countStatusTotals(checks: readonly IntegrityCheckResult[]) {
  const totals = { pass: 0, warn: 0, unavailable: 0, fail: 0 };
  for (const check of checks) {
    if (check.status === "PASS") totals.pass += 1;
    else if (check.status === "WARN") totals.warn += 1;
    else if (check.status === "UNAVAILABLE") totals.unavailable += 1;
    else totals.fail += 1;
  }
  return totals;
}

export default function ToolsIntegrity() {
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const { integrityCheck } = usePrototypeServices();
  const [state, setState] = useState<State>({ phase: "idle" });

  async function runCheck() {
    setState({ phase: "running" });
    try {
      /* الخدمة تُرجع تقريرًا دائمًا (أعطال القراءة تظهر كفحوص خلل لا كاستثناء) —
       * الالتزام بالحماية هنا للأخطاء غير المتوقعة فقط. */
      const report = await integrityCheck.run();
      setState({ phase: "done", report });
    } catch (error) {
      setState({
        phase: "error",
        message: error instanceof Error ? error.message : "تعذر إجراء الفحص — أعد المحاولة.",
      });
    }
  }

  const overall = state.phase === "done" ? statusMeta[state.report.overall] : null;

  /* F05: الرجوع ديناميكي حسب مصدر الدخول — اسم وجهة الأصل عند معرفته (عقد ٢٦ §2.1). */
  const backLabel =
    returnPath === "/finance/more"
      ? "المزيد من المالية"
      : returnPath === "/finance"
        ? "المالية"
        : returnPath === "/tools"
          ? "أدواتي"
          : returnPath === "/settings"
            ? "الإعدادات"
            : "رجوع";
  return (
    <section className="micro-page micro-integrity-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> {backLabel}
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">أداة قراءة</span>
        <h1>سلامة الحسابات</h1>
        <p>
          {`${formatArabicPlural(integrityCheck.registeredCheckCount(), {
            zero: "لا فحوص مسجلة بعد",
            one: "فحص واحد يقرأ",
            two: "فحصان يقرآن",
            few: "فحوص تقرأ",
            many: "فحصًا يقرأ",
            other: "فحصًا يقرأ",
          })} أرقامك كما هي — النتيجة والكاش والأحداث والأمانات والمخزون والأصول والقروض والعربون.`}
        </p>
      </div>
      <section className="micro-decision-card" aria-label="وعد الفحص">
        <ShieldCheck aria-hidden="true" />
        <div>
          <span>وعد هذه الأداة</span>
          <strong>يقرأ أرقامك ولا يغيّر شيئًا.</strong>
          <p>لا يصلح الفحص ولا يعدّل سجلًا تلقائيًا؛ إن ظهر خلل فالمسار الذي يفتحه من هنا يصحّحه بتوثيق.</p>
        </div>
      </section>
      <section className="micro-decision-card" aria-label="خلاصة الفحص">
        <div>
          <span>الخلاصة</span>
          {state.phase === "done" && overall ? (
            (() => {
              const verdictPhrase =
                state.report.overall === "PASS"
                  ? "الأرقام متسقة"
                  : state.report.overall === "WARN"
                    ? "توجد ملاحظات للمراجعة"
                    : "يوجد خلل يحتاج تصحيحًا موثقًا";
              const totals = countStatusTotals(state.report.checks);
              return (
                <>
                  <strong data-status={state.report.overall}>{`${overall.word} — ${verdictPhrase}`}</strong>
                  <p>
                    {`آخر تشغيل مكتمل: ${formatLocalDateTime(state.report.runAt)} — لفترة هذا الشهر حتى اليوم، وكل تشغيل قراءة جديدة.`}
                  </p>
                  {/* TOOL-001: مجاميع الحالات توافق طول القائمة والعدّ المسجل. */}
                  <p
                    className="micro-integrity-totals"
                    data-testid="integrity-status-totals"
                  >{`${totals.pass} سليم · ${totals.warn} تحذير · ${totals.unavailable} غير متاح · ${totals.fail} خلل — من أصل ${state.report.checks.length} فحصًا مسجلًا.`}</p>
                  {/* المجموعة ٥ (عقد ٣٥): الصحة تعني الاتساق لا الجدوى — فحص
                   * سليم لا يقول إن المشروع رابح؛ وعدًا مطابقًا للسلوك. */}
                  {state.report.overall === "PASS" ? (
                    <p className="micro-offline-truth" role="note">
                      «لا خلل مكتشفًا» يعني أن أرقامك متسقة مع قواعدها — لا يعني أنك رابح؛ الفحص يقيس الاتساق
                      لا الجدوى.
                    </p>
                  ) : null}
                  <p className="micro-integrity-version">
                    إصدار الفحص: قواعد المخطط <bdi dir="ltr">{state.report.schemaVersion}</bdi> · التصدير{" "}
                    <bdi dir="ltr">{state.report.exportVersion}</bdi>
                  </p>
                </>
              );
            })()
          ) : state.phase === "error" ? (
            <p className="micro-field-error" role="status">
              {state.message}
            </p>
          ) : (
            <p>لم تُشغَّل بعد — اضغط «افحص الآن» لقراءة الأرقام كما هي.</p>
          )}
          <div className="micro-form-actions">
            <Button
              action="save"

              disabled={state.phase === "running"}
              onClick={() => void runCheck()}
            >
              <ShieldCheck aria-hidden="true" />
              {state.phase === "running" ? "جارٍ الفحص…" : "افحص الآن"}
            </Button>
          </div>
        </div>
      </section>
      {state.phase === "done"
        ? state.report.checks.map(check => (
            <IntegrityCheckRow
              key={check.id}
              check={check}
              onOpen={path => navigate(withReturnTo(path, "/tools/integrity"))}
            />
          ))
        : null}
      <div className="micro-offline-truth" role="note">
        يعمل بلا إنترنت — الفحص يقرأ سجلك المحلي ولا يغيّر شيئًا.
      </div>
    </section>
  );
}

/* Wave 4.3 — P-4.3-3 (D9): اسم العملية المقروء للسجل المتأثر — من خرائط
 * العرض القائمة وحدها؛ نوع المشكلة هو نص الفحص نفسه. */
const offenderKindLabel: Record<IntegrityOffenderSummary["kind"], string> = {
  financial_event: "حدث مالي",
  craft_order: "طلب",
  cash_wallet: "محفظة كاش",
  supplier_purchase: "شراء مورد",
  asset: "أصل",
  loan: "قرض",
  material: "مادة",
};
function offenderOperationLabel(summary: IntegrityOffenderSummary): string {
  if (summary.kind === "financial_event" && summary.eventType && summary.eventType in financialEventLabel)
    return financialEventLabel[summary.eventType as keyof typeof financialEventLabel];
  const kindWord = offenderKindLabel[summary.kind];
  return summary.name ? `${kindWord}: ${summary.name}` : kindWord;
}
function OffenderSummaryRow({
  summary,
  onOpen,
}: {
  summary: IntegrityOffenderSummary;
  onOpen: (path: string) => void;
}) {
  return (
    <li className="micro-integrity-offender" data-testid="integrity-offender-summary">
      <div>
        <strong>{offenderOperationLabel(summary)}</strong>
        <small>
          {summary.dateLocal ? (
            <time dateTime={summary.dateLocal}>
              {formatLocalDate(summary.dateLocal) ?? summary.dateLocal}
            </time>
          ) : null}
          {summary.amountMinor !== null ? (
            <>
              {summary.dateLocal ? " · " : ""}
              <MoneyValue minor={summary.amountMinor} /> د.أ
            </>
          ) : null}
        </small>
      </div>
      {summary.href ? (
        <button className="micro-text-action" type="button" onClick={() => onOpen(summary.href!)}>
          افتح السجل
          <ArrowRight aria-hidden="true" />
        </button>
      ) : (
        <small className="micro-integrity-offender-guide">افتحه من سطحه في التطبيق</small>
      )}
    </li>
  );
}

function IntegrityCheckRow({
  check,
  onOpen,
}: {
  check: IntegrityCheckResult;
  onOpen: (path: string) => void;
}) {
  const meta = statusMeta[check.status];
  const Icon = meta.Icon;
  return (
    <section className="micro-settings-list" aria-label={check.titleAr}>
      <article className="micro-setting-row micro-integrity-check" data-status={check.status}>
        <span className="micro-setting-icon">
          <Icon aria-hidden="true" />
        </span>
        <div>
          <strong>{check.titleAr}</strong>
          <small className="micro-integrity-status" data-status={check.status}>
            {meta.word}
          </small>
          <p className="micro-integrity-detail">{check.detailAr}</p>
          {typeof check.driftMinor === "number" && check.driftMinor > 0 ? (
            <p className="micro-integrity-drift">
              الفارق: <MoneyValue minor={check.driftMinor} /> د.أ
            </p>
          ) : null}
          {check.offenderCount && check.offenderCount > 0 ? (
            <details className="micro-integrity-offenders">
              <summary>{`أعرض السجلات المتأثرة (${check.offenderCount})`}</summary>
              {/* Wave 4.3 — P-4.3-3 (D9): الملخص المقروء أولًا — اسم العملية
                  والتاريخ والمبلغ ورابط السجل؛ المعرّف الخام يبقى احتياطًا
                  صادقًا لما لم يُحل بعد. */}
              <ul>
                {(check.offenderSample ?? []).map(summary => (
                  <OffenderSummaryRow key={summary.id} summary={summary} onOpen={onOpen} />
                ))}
                {(check.offenderSampleIds ?? [])
                  .filter(id => !(check.offenderSample ?? []).some(summary => summary.id === id))
                  .map(id => (
                    <li key={id}>
                      <bdi dir="ltr">{id}</bdi>
                    </li>
                  ))}
              </ul>
            </details>
          ) : null}
          <div className="micro-form-actions">
            {check.deepLink ? (
              <button
                className="micro-text-action"
                type="button"
                onClick={() => onOpen(check.deepLink ?? "")}
              >
                افتح السجل المعني
              </button>
            ) : null}
            {/* Wave 4.4 — P-4.4-1: زر «أظهر المعرّفات» أُزيل — كان ميتًا بعد D9
             * (بدّل حالة لا يقرأها عرض)، والمعرّفات الخام الاحتياطية تظهر داخل
             * تفصيل السجلات المتأثرة أصلًا بلا زر. */}
          </div>
        </div>
      </article>
    </section>
  );
}
