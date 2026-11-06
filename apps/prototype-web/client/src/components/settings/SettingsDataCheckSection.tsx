/**
 * S17 (DOC-026 / UNIT-033 — الأمر المتصل 2026-11-04): قسم «فحص البيانات» —
 * صيانة قراءة فقط داخل الإعدادات (قرار المالك المعتمد: وصول يدوي عند الحاجة
 * باسم «فحص البيانات»؛ لا واجب يومي ولا أداة تخطيط ولا قسم مستقل). سطح
 * ToolsIntegrity المستقل تقاعد مع هذا القسم (B-DUP: البديل جاهز في الشريحة
 * نفسها — نفس الخدمة الواحدة IntegrityCheckService فوق قارئاتها الكنونية،
 * بلا خدمة ثانية ولا كتابة ولا إصلاح مالي آلي أبدًا).
 *
 * الحالات الصادقة (UNIT-033 A3): لم يُجرِ الفحص بعد (لا أخضر ولا إنذارًا
 * لمجرد عدم التشغيل) · جارٍ (لا تقدم مختلق) · «لم نكتشف مشكلة ضمن الفحوص
 * المنفذة» (لا «كل الحسابات صحيحة») · مشكلة محددة بوصفها ومصدرها · غير
 * منطبق يسمى بنطاقه لا نجاحًا · فشل قراءة/جزئي يظهر كما هو (لا صفرًا ولا
 * فراغًا) · نتيجة سابقة تظهر بوقتها ونطاقها مع «أعد الفحص» (لا شارة حالية
 * من لقطة قديمة). تكرار الضغط تشغيل واحد مقصود؛ والرجوع من المصدر يعيد
 * النتيجة وموضعها (returnTo محفوظ).
 */
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleSlash,
  FileSearch,
  OctagonX,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { forwardRef } from "react";
import { withReturnTo } from "@/app/navigationContract";
import { getPrototypeLocalStore, usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { financialEventLabel } from "@/presentation/financialEventLabels";
import { formatArabicPlural, formatLocalDate, formatLocalDateTime } from "@/presentation/formatters";
import type {
  IntegrityCheckReport,
  IntegrityCheckResult,
  IntegrityOffenderSummary,
  IntegrityCheckStatus,
  IntegrityCheckService,
} from "@/application/finance";

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

export type SettingsDataCheckSectionProps = {
  open: boolean;
  onToggle: (open: boolean) => void;
};

/** قسم «فحص البيانات» — نطاق بسيط داخل الإعدادات يفتح ويطوى (details). */
export const SettingsDataCheckSection = forwardRef<HTMLDetailsElement, SettingsDataCheckSectionProps>(
  function SettingsDataCheckSection({ open, onToggle }, ref) {
    const [, navigate] = useLocation();
    const { projectFinance, cashContinuity } = usePrototypeServices();
    const [state, setState] = useState<State>({ phase: "idle" });
    /* أمر استئناف S14 (A3 — منع الوصول غير اللازم لكومة الإقلاع): عائلة
     * فحوص السلامة تُحمّل عند أول فتح (نمط الخدمات الكسولة) فوق المخزن
     * الأحادي والمالكين القائمين؛ التحميل حالة معلنة صادقة لا زرًّا معطّلًا
     * بصمت ولا عدًّا مختلقًا قبل الجاهزية. */
    const [service, setService] = useState<IntegrityCheckService | null>(null);
    const [serviceError, setServiceError] = useState<string | null>(null);
    /* B4: تشغيل واحد مقصود — حارس مرجع لا يقرأ حالة قد تكون قديمة بعد في
     * نفس اللحظة، فالضغط المتكرر المتزامن لا ينتج تشغيلين متداخلين أبدًا. */
    const runningRef = useRef(false);

    useEffect(() => {
      if (!open || service !== null) return;
      let active = true;
      import("@/application/finance")
        .then(finance => {
          if (!active) return;
          const store = getPrototypeLocalStore();
          setService(
            new finance.IntegrityCheckService(
              store,
              projectFinance,
              new finance.StatementService(store, projectFinance),
              cashContinuity,
            ),
          );
          setServiceError(null);
        })
        .catch(() => {
          if (!active) return;
          setServiceError("تعذّر تجهيز الفحص — أعد المحاولة.");
        });
      return () => {
        active = false;
      };
    }, [open, service, projectFinance, cashContinuity]);

    async function runCheck() {
      if (service === null || runningRef.current) return;
      /* B4: تشغيل واحد مقصود — الضغط المتكرر أثناء الجاري لا ينتج نتائج
       * متداخلة؛ الزر معطل والقراءة الجديدة تبدأ بعد انتهاء السابقة. */
      runningRef.current = true;
      setState({ phase: "running" });
      try {
        const report = await service.run();
        setState({ phase: "done", report });
      } catch (error) {
        setState({
          phase: "error",
          message: error instanceof Error ? error.message : "تعذر إكمال الفحص — أعد المحاولة.",
        });
      } finally {
        runningRef.current = false;
      }
    }

    const overall = state.phase === "done" ? statusMeta[state.report.overall] : null;

    return (
      <details
        ref={ref}
        className="micro-decision-layer"
        open={open || undefined}
        onToggle={event => onToggle((event.target as HTMLDetailsElement).open)}
      >
        <summary className="micro-decision-layer-summary">
          <span>
            <b>فحص البيانات</b>
            <small>صيانة اطمئنان اختيارية — يقرأ أرقامك ولا يغيّر شيئًا.</small>
          </span>
          <strong>افتح الفحص</strong>
        </summary>
        <section className="micro-settings-list" aria-labelledby="data-check-title">
          <div className="micro-section-heading">
            <div>
              <span className="micro-overline">صيانة</span>
              <h2 id="data-check-title">فحص البيانات</h2>
            </div>
            <FileSearch aria-hidden="true" />
          </div>
          <section className="micro-decision-card" aria-label="وعد الفحص">
            <ShieldCheck aria-hidden="true" />
            <div>
              <span>وعد هذا الفحص</span>
              <strong>يقرأ أرقامك ولا يغيّر شيئًا.</strong>
              <p>
                لا يصلح الفحص ولا يعدّل سجلًا تلقائيًا؛ إن ظهر خلل فالمسار الذي يفتحه من هنا يصحّحه بتوثيق عند
                صاحبه.
              </p>
            </div>
          </section>
          <section className="micro-decision-card" aria-label="خلاصة الفحص">
            <div>
              <span>الخلاصة</span>
              {state.phase === "done" && overall ? (
                (() => {
                  const verdictPhrase =
                    state.report.overall === "PASS"
                      ? "لم نكتشف مشكلة ضمن الفحوص المنفذة"
                      : state.report.overall === "WARN"
                        ? "توجد ملاحظات للمراجعة"
                        : state.report.overall === "UNAVAILABLE"
                          ? "تعذّر إكمال الفحص؛ تعذّرت قراءة مصادر بعض الفحوص"
                          : "يوجد خلل يحتاج تصحيحًا موثقًا";
                  const totals = countStatusTotals(state.report.checks);
                  return (
                    <>
                      <strong
                        data-status={state.report.overall}
                        role="status"
                      >{`${overall.word} — ${verdictPhrase}`}</strong>
                      <p>
                        {`آخر تشغيل مكتمل: ${formatLocalDateTime(state.report.runAt)} — لفترة هذا الشهر حتى اليوم، وكل تشغيل قراءة جديدة؛ أعد الفحص للتحقق من البيانات الحالية.`}
                      </p>
                      <p
                        className="micro-integrity-totals"
                        data-testid="integrity-status-totals"
                      >{`${totals.pass} سليم · ${totals.warn} تحذير · ${totals.unavailable} غير متاح · ${totals.fail} خلل — من أصل ${state.report.checks.length} فحصًا مسجلًا.`}</p>
                      {state.report.overall === "PASS" ? (
                        <p className="micro-offline-truth" role="note">
                          «لا خلل مكتشفًا» يعني أن أرقامك متسقة مع قواعدها — لا يعني أنك رابح؛ الفحص يقيس
                          الاتساق لا الجدوى.
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
                <p className="micro-field-error" role="alert">
                  {state.message}
                </p>
              ) : (
                <p>لم تُفحص البيانات بعد — اضغط «بدء الفحص» لقراءة الأرقام كما هي.</p>
              )}
              {/* TOOL-001: العدّ من سجل الخدمة نفسه — يظهر عند جاهزيتها؛ قبله
               * حالة تجهيز معلنة لا عدّ مختلقًا ولا زرًّا يوهم الجاهزية. */}
              <p role="status">
                {service === null
                  ? "تُجهّز قائمة الفحوص…"
                  : `${formatArabicPlural(service.registeredCheckCount(), {
                      zero: "لا فحوص مسجلة بعد",
                      one: "فحص واحد يقرأ",
                      two: "فحصان يقرآن",
                      few: "فحوص تقرأ",
                      many: "فحصًا يقرأ",
                      other: "فحصًا يقرأ",
                    })} أرقامك كما هي — النتيجة والنقد والأحداث والأمانات والمخزون والأصول والقروض والعربون.`}
              </p>
              {service === null && serviceError !== null ? (
                <p className="micro-field-error" role="alert">
                  {serviceError}
                </p>
              ) : null}
              <div className="micro-form-actions">
                <Button
                  action="save"
                  disabled={state.phase === "running" || service === null}
                  onClick={() => void runCheck()}
                >
                  <ShieldCheck aria-hidden="true" />
                  {state.phase === "running" ? "جارٍ فحص البيانات…" : "بدء الفحص"}
                </Button>
              </div>
            </div>
          </section>
          {state.phase === "done"
            ? state.report.checks.map(check => (
                <IntegrityCheckRow
                  key={check.id}
                  check={check}
                  onOpen={path => navigate(withReturnTo(path, "/settings"))}
                />
              ))
            : null}
          <div className="micro-offline-truth" role="note">
            يعمل بلا إنترنت — الفحص يقرأ سجلك المحلي ولا يغيّر شيئًا، ولا يُرسل شيئًا أبدًا.
          </div>
        </section>
      </details>
    );
  },
);

/* Wave 4.3 — P-4.3-3 (D9): اسم العملية المقروء للسجل المتأثر — من خرائط
 * العرض القائمة وحدها؛ نوع المشكلة هو نص الفحص نفسه. */
const offenderKindLabel: Record<IntegrityOffenderSummary["kind"], string> = {
  financial_event: "حدث مالي",
  craft_order: "طلب",
  cash_wallet: "محفظة نقد",
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
          </div>
        </div>
      </article>
    </section>
  );
}
