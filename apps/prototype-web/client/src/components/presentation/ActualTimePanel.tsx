import { Clock3, RotateCcw, Save, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import type { ActualTimeService, OperatingModeValue } from "@/application/time/actualTimeService";
import type { ActualTimeComparison } from "@micro-domain/actual-time/index.js";
import type { ActualTimeRecord } from "@micro-domain/actual-time/index.js";

type Props = { orderId: string; actualTime: ActualTimeService; dataVersion: number; notifyDataChanged: () => void };
type LoadState = { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; mode: OperatingModeValue; records: readonly ActualTimeRecord[]; comparison: ActualTimeComparison };

type Message = { tone: "error" | "success"; text: string };

const ammanDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(new Date());
const newOperationKey = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const minutesLabel = (minutes: number) => `${minutes > 0 ? "+" : ""}${minutes} دقيقة`;
const comparisonCopy: Record<ActualTimeComparison["status"], { title: string; truth: string; tone?: "warning" }> = {
  not_recorded: { title: "لا يوجد وقت فعلي مسجل", truth: "غياب السجل ليس صفر دقيقة؛ لا توجد مقارنة وقت بعد." },
  recorded: { title: "فرق وقت مسجل", truth: "الفرق يشرح الوقت المسجل مقابل خطة Snapshot، ولا يغيّر نتيجة الطلب المالية." },
  needs_review: { title: "فرق الوقت يحتاج مراجعة", truth: "يوجد وقت فعلي، لكن الوقت المخطط تقديري أو غير متاح؛ هذه ليست نتيجة مالية نهائية.", tone: "warning" },
};
const formatVariance = (minutes: number | null) => minutes === null ? "غير متاح" : minutesLabel(minutes);

export function ActualTimePanel({ orderId, actualTime, dataVersion, notifyDataChanged }: Props) {
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [minutes, setMinutes] = useState(0);
  const [minutesValid, setMinutesValid] = useState(true);
  const [recordedOn, setRecordedOn] = useState(ammanDate);
  const [note, setNote] = useState("");
  const [reverseTarget, setReverseTarget] = useState<ActualTimeRecord | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reverseRecordedOn, setReverseRecordedOn] = useState(ammanDate);
  const [message, setMessage] = useState<Message | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const recordOperationKey = useRef(newOperationKey("actual-time-record"));
  const reverseOperationKeys = useRef(new Map<string, string>());

  useEffect(() => {
    let active = true;
    setState({ phase: "loading" });
    Promise.all([actualTime.readOperatingMode(), actualTime.readOrderActualTimeRecords(orderId), actualTime.readOrderActualTimeComparison(orderId)]).then(([modeResult, recordsResult, comparisonResult]) => {
      if (!active) return;
      if (!modeResult.ok) {
        setState({ phase: "error", message: modeResult.message });
        return;
      }
      if (!recordsResult.ok) {
        setState({ phase: "error", message: recordsResult.message });
        return;
      }
      if (!comparisonResult.ok) {
        setState({ phase: "error", message: comparisonResult.message });
        return;
      }
      setState({ phase: "ready", mode: modeResult.value, records: recordsResult.value, comparison: comparisonResult.value });
    });
    return () => {
      active = false;
    };
  }, [actualTime, dataVersion, orderId]);

  if (state.phase === "loading") return <section className="micro-note-card" aria-live="polite"><Clock3 aria-hidden="true" /><p>جارٍ قراءة سجل الوقت المحلي…</p></section>;
  if (state.phase === "error") return <section className="micro-storage-error" role="alert"><strong>تعذر قراءة سجل الوقت</strong><p>{state.message}</p></section>;

  const guidedByPreference = state.mode.actualTimeTrackingEnabled || state.mode.workMode === "time_focused" || state.mode.workMode === "mixed";
  const reversals = new Map(state.records.filter(record => record.reversalOfId !== null).map(record => [record.reversalOfId, record]));
  const originalRecords = state.records.filter(record => record.reversalOfId === null);

  function beginReverse(record: ActualTimeRecord) {
    setMessage(null);
    setReverseTarget(record);
    setReverseReason("");
    setReverseRecordedOn(ammanDate());
  }

  async function saveRecord() {
    setMessage(null);
    if (!minutesValid || !Number.isInteger(minutes) || minutes <= 0 || !recordedOn) {
      setMessage({ tone: "error", text: "أدخل عدد دقائق صحيحًا وموجبًا، مع تاريخ التسجيل، بالأرقام 0–9." });
      return;
    }
    setIsSaving(true);
    const result = await actualTime.record({ orderId, minutes, recordedOn, note: note.trim() || null, operationKey: recordOperationKey.current });
    setIsSaving(false);
    if (!result.ok) {
      setMessage({ tone: "error", text: result.message });
      return;
    }
    recordOperationKey.current = newOperationKey("actual-time-record");
    setMinutes(0);
    setNote("");
    setShowRecordForm(false);
    setState(current => current.phase === "ready" ? { ...current, records: [result.value, ...current.records] } : current);
    setMessage({ tone: "success", text: result.reused ? "هذا الضغط أعاد السجل نفسه؛ لم تتضاعف الدقائق." : "تم حفظ وقت التنفيذ محليًا دون أثر مالي." });
    notifyDataChanged();
  }

  async function saveReverse() {
    setMessage(null);
    if (!reverseTarget || !reverseReason.trim() || !reverseRecordedOn) {
      setMessage({ tone: "error", text: "أدخل سبب عكس سجل الوقت وتاريخه." });
      return;
    }
    const operationKey = reverseOperationKeys.current.get(reverseTarget.id) ?? newOperationKey("actual-time-reverse");
    reverseOperationKeys.current.set(reverseTarget.id, operationKey);
    setIsSaving(true);
    const result = await actualTime.reverse({ targetId: reverseTarget.id, recordedOn: reverseRecordedOn, reason: reverseReason, operationKey });
    setIsSaving(false);
    if (!result.ok) {
      setMessage({ tone: "error", text: result.message });
      return;
    }
    reverseOperationKeys.current.delete(reverseTarget.id);
    setReverseTarget(null);
    setReverseReason("");
    setState(current => current.phase === "ready" ? { ...current, records: [result.value, ...current.records] } : current);
    setMessage({ tone: "success", text: result.reused ? "هذا الضغط أعاد عكس السجل نفسه." : "تم حفظ عكس سجل الوقت بسبب واضح؛ بقي الأصل ظاهرًا." });
    notifyDataChanged();
  }

  return <section className="micro-form-card micro-actual-time-panel" aria-labelledby={`actual-time-title-${orderId}`}>
    <div className="micro-section-heading">
      <div>
        <span className="micro-overline">وقت التنفيذ المحلي</span>
        <h2 id={`actual-time-title-${orderId}`}>سجل وقتًا فعليًا للطلب</h2>
      </div>
      <Clock3 aria-hidden="true" />
    </div>
    <p>يسجل هذا دقائق التنفيذ فقط. لا يحولها إلى أجر أو تكلفة أو ربح، ولا يغيّر Snapshot أو الكاش أو الذمم.</p>
    <ActualTimeComparisonPanel comparison={state.comparison} />
    {state.records.length === 0 ? <p className="micro-empty-inline">لا يوجد سجل وقت فعلي لهذا الطلب بعد. الغياب ليس صفر دقيقة.</p> : <div className="micro-actual-time-list" aria-label="سجلات الوقت الفعلي">
      {originalRecords.map(record => {
        const reversal = reversals.get(record.id);
        return <article className="micro-actual-time-row" key={record.id}>
          <div>
            <span className="micro-card-eyebrow">سجل وقت فعلي</span>
            <strong className="micro-number" dir="ltr">{minutesLabel(record.minutesDelta)}</strong>
            <small>{record.recordedOn}{record.note ? ` · ${record.note}` : ""}</small>
            {reversal ? <p className="micro-actual-time-reversed">عُكس في {reversal.recordedOn} بسبب: {reversal.reversalReason}</p> : null}
          </div>
          {!reversal ? <button className="micro-text-action" type="button" disabled={isSaving} onClick={() => beginReverse(record)}><RotateCcw aria-hidden="true" /> عكس السجل</button> : <span className="micro-actual-time-status">تم العكس</span>}
        </article>;
      })}
      {state.records.filter(record => record.reversalOfId !== null).map(record => <article className="micro-actual-time-row micro-actual-time-reversal" key={record.id}>
        <div>
          <span className="micro-card-eyebrow">عكس محفوظ</span>
          <strong className="micro-number" dir="ltr">{minutesLabel(record.minutesDelta)}</strong>
          <small>{record.recordedOn} · السبب: {record.reversalReason}</small>
        </div>
        <span className="micro-actual-time-status">الأصل محفوظ</span>
      </article>)}
    </div>}
    <button className={guidedByPreference ? "micro-button micro-button-secondary" : "micro-text-action"} type="button" disabled={isSaving} onClick={() => { setMessage(null); setShowRecordForm(value => !value); }}>{showRecordForm ? "إخفاء نموذج الوقت" : "سجل وقتًا فعليًا"}</button>
    {!guidedByPreference ? <p className="micro-cost-disclaimer">لم تحدد طريقة عمل أو لم تفعّل التتبع؛ يبقى التسجيل متاحًا هنا عند الحاجة دون سؤال يومي أو إلزام.</p> : null}
    {showRecordForm ? <section className="micro-actual-time-form" aria-label="نموذج تسجيل الوقت">
      <label className="micro-field"><span>الدقائق الفعلية <small>أرقام 0–9 صحيحة</small></span><EnglishNumberInput value={minutes} kind="integer" min={1} aria-label="الدقائق الفعلية بالأرقام 0–9" onNumericChange={setMinutes} onTextValidityChange={setMinutesValid} /></label>
      <label className="micro-field"><span>تاريخ التسجيل</span><input type="date" value={recordedOn} onChange={event => setRecordedOn(event.target.value)} /></label>
      <label className="micro-field"><span>ملاحظة اختيارية</span><textarea value={note} onChange={event => setNote(event.target.value)} placeholder="مثال: تنفيذ الجزء الأول" /></label>
      <button className="micro-button micro-button-primary micro-save-cost" type="button" disabled={isSaving} onClick={saveRecord}><Save aria-hidden="true" />{isSaving ? "جارٍ حفظ الوقت…" : "حفظ وقت التنفيذ"}</button>
    </section> : null}
    {reverseTarget ? <section className="micro-actual-time-form micro-actual-time-reverse-form" aria-label="نموذج عكس سجل الوقت">
      <div className="micro-section-heading"><div><span className="micro-overline">عكس محفوظ</span><h2>اعكس {minutesLabel(reverseTarget.minutesDelta)}</h2></div><button className="micro-icon-button" type="button" disabled={isSaving} onClick={() => setReverseTarget(null)} aria-label="إلغاء عكس سجل الوقت"><X aria-hidden="true" /></button></div>
      <p>سيبقى السجل الأصلي ظاهرًا، ويضاف أثر مقابل مرة واحدة فقط.</p>
      <label className="micro-field"><span>تاريخ العكس</span><input type="date" value={reverseRecordedOn} onChange={event => setReverseRecordedOn(event.target.value)} /></label>
      <label className="micro-field"><span>سبب العكس <small>إلزامي</small></span><textarea value={reverseReason} onChange={event => setReverseReason(event.target.value)} placeholder="مثال: سجلت الدقائق بالخطأ" /></label>
      <button className="micro-button micro-button-primary micro-save-cost" type="button" disabled={isSaving} onClick={saveReverse}><RotateCcw aria-hidden="true" />{isSaving ? "جارٍ حفظ العكس…" : "حفظ عكس سجل الوقت"}</button>
    </section> : null}
    {message ? <p className={message.tone === "error" ? "micro-field-error" : "micro-save-note"} role={message.tone === "error" ? "alert" : "status"}>{message.text}</p> : null}
  </section>;
}

function ActualTimeComparisonPanel({ comparison }: { comparison: ActualTimeComparison }) {
  const copy = comparisonCopy[comparison.status];
  return <section className="micro-actual-time-comparison" data-tone={copy.tone} aria-label="فرق الوقت المسجل">
    <div className="micro-card-copy">
      <span className="micro-card-eyebrow">قراءة تفسيرية فقط</span>
      <h3>{copy.title}</h3>
      <p>{copy.truth}</p>
    </div>
    <dl className="micro-actual-time-comparison-grid">
      <div><dt>الوقت المخطط</dt><dd className="micro-number" dir="ltr">{comparison.plannedMinutes === null ? "غير متاح" : minutesLabel(comparison.plannedMinutes)}</dd></div>
      <div><dt>الوقت الفعلي</dt><dd className="micro-number" dir="ltr">{comparison.actualMinutes === null ? "غير مسجل" : minutesLabel(comparison.actualMinutes)}</dd></div>
      <div><dt>فرق وقت مسجل</dt><dd className="micro-number" dir="ltr">{formatVariance(comparison.varianceMinutes)}</dd></div>
      <div><dt>السجلات النشطة</dt><dd className="micro-number" dir="ltr">{comparison.recordCount}</dd></div>
    </dl>
  </section>;
}
