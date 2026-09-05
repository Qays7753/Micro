/**
 * المجموعة ١ (فحص سلامة مالي): سطح قراءة فقط تحت «أدواتي» — «يقرأ أرقامك ولا
 * يغيّر شيئًا». مسار سطح (يبقى شريط التنقل) لأنه قارئ تفكير لا محرر؛ البديل
 * القانوني /tools. الحالة كلمة وأيقونة لا لونًا وحده؛ لا إصلاح تلقائي أبدًا —
 * الفحص يشير والتصحيح مساره الموثق في أسطحه الأصلية.
 */
import { AlertTriangle, CheckCircle2, OctagonX, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { withFrom } from "@/app/navigationContract";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { formatLocalDateLong } from "@/presentation/formatters";
import type {
  IntegrityCheckReport,
  IntegrityCheckResult,
  IntegrityCheckStatus,
} from "@/application/finance/integrityCheckService";

type State = { phase: "idle" } | { phase: "running" } | { phase: "done"; report: IntegrityCheckReport } | { phase: "error"; message: string };

const statusMeta: Record<IntegrityCheckStatus, { word: string; Icon: typeof CheckCircle2 }> = {
  PASS: { word: "سليم", Icon: CheckCircle2 },
  WARN: { word: "تحذير", Icon: AlertTriangle },
  FAIL: { word: "خلل", Icon: OctagonX },
};

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

  const overall =
    state.phase === "done"
      ? statusMeta[state.report.overall]
      : null;

  return (
    <section className="micro-page micro-integrity-page">
      <button
        className="micro-back-button"
        type="button"
        onClick={() => navigate(returnPath)}
      >
        أدواتي
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">أداة قراءة</span>
        <h1>فحص سلامة مالي</h1>
        <p>ستّة عشر فحصًا تقرأ أرقامك كما هي — النتيجة والكاش والأحداث والأمانات والمخزون والأصول والقروض والعربون.</p>
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
              return (
                <>
                  <strong data-status={state.report.overall}>
                    {`${overall.word} — ${verdictPhrase}`}
                  </strong>
                  <p>
                    أُجري الفحص{" "}
                    <bdi dir="ltr">
                      {formatLocalDateLong(state.report.runAt.slice(0, 10)) ?? state.report.runAt.slice(0, 10)}
                    </bdi>{" "}
                    لفترة هذا الشهر حتى اليوم — كل فحص قراءة جديدة.
                  </p>
                  {/* المجموعة ٥ (عقد ٣٥): الصحة تعني الاتساق لا الجدوى — فحص
                   * سليم لا يقول إن المشروع رابح؛ وعدًا مطابقًا للسلوك. */}
                  {state.report.overall === "PASS" ? (
                    <p className="micro-offline-truth" role="note">
                      «لا خلل مكتشفًا» يعني أن أرقامك متسقة مع قواعدها — لا يعني أنك رابح؛ الفحص يقيس الاتساق لا الجدوى.
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
            <p>لم يُجرَ الفحص بعد — اضغط «افحص الآن» لقراءة الأرقام كما هي.</p>
          )}
          <div className="micro-form-actions">
            <button
              className="micro-button micro-button-primary"
              type="button"
              disabled={state.phase === "running"}
              onClick={() => void runCheck()}
            >
              <ShieldCheck aria-hidden="true" />
              {state.phase === "running" ? "جارٍ الفحص…" : "افحص الآن"}
            </button>
          </div>
        </div>
      </section>
      {state.phase === "done"
        ? state.report.checks.map(check => (
            <IntegrityCheckRow key={check.id} check={check} onOpen={path => navigate(withFrom(path, "/tools/integrity"))} />
          ))
        : null}
      <div className="micro-offline-truth" role="note">
        يعمل بلا إنترنت — الفحص يقرأ سجلك المحلي ولا يغيّر شيئًا.
      </div>
    </section>
  );
}

function IntegrityCheckRow({
  check,
  onOpen,
}: {
  check: IntegrityCheckResult;
  onOpen: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
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
                {(check.offenderSampleIds ?? []).map(id => (
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
            {check.offenderCount && check.offenderCount > 0 && !check.deepLink ? (
              <button
                className="micro-text-action"
                type="button"
                aria-expanded={open}
                onClick={() => setOpen(current => !current)}
              >
                {open ? "إخفاء المعرّفات" : "أظهر المعرّفات"}
              </button>
            ) : null}
          </div>
        </div>
      </article>
    </section>
  );
}
