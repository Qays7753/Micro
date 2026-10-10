/** Style: Micro «مسار القرار» — reversal preserves the original trace and explains why it is being negated. */
/* مبدأ Micro: يبقى أصل حركة الكاش محفوظًا، ويعرض تاريخ العكس بوضوح قبل التسجيل. */
import { ArrowRight, RotateCcw, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { withReturnTo } from "@/app/navigationContract";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { CashContinuityEntry } from "@micro-domain/cash-continuity/index.js";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { useFormDirty } from "@/components/forms/useFormDirty";
import { LocalDateValue, MoneyValue } from "@/components/presentation/DisplayValue";

import { Button } from "@/components/primitives";
import { todayInAmman } from "@/application/time";

/* R9-GA-F3.1 + R9-W3-F1 (استمرار R9 — آلة حالة القراءة الصريحة): كان
 * حارس العرض القديم (!entry && !message ⇒ تحميل، !entry ⇒ «لم نجد») يجعل
 * سطح «لم نجد» غير قابل للوصول عبر مسار النجاح (id مجهول ⇒ تحميل أبدي)
 * ويبتلع فشل القراءة داخل سطح «لم نجد» (رسالة الخطأ لا تُعرض أبدًا). الفصل
 * الصريح للمراحل يجعل كل حالة صادقة بذاتها: تحميل ← جاهز / غير موجود /
 * خطأ قراءة فعلي برسالته الأصلية وإعادة محاولة — نفس نمط EstimateDetail
 * وReceivedLoanDetail؛ لا تغيير في النسخ العربية القائمة ولا في أي سطح
 * بصري إلا سطح خطأ القراءة الجديد وفق نمط الصفحات العميقة القائمة. */
type ReversalReadState =
  | { phase: "loading" }
  | { phase: "not-found" }
  | { phase: "read-error"; message: string }
  | { phase: "ready"; entry: CashContinuityEntry };

export default function CashReversalEditor() {
  const { id } = useParams<{ id: string }>();
  const [location, navigate] = useLocation();
  /* المجموعة ١ (Scope A): الرجوع يعود للمصدر (?from) مع بديل قانوني موثّق. */
  const returnPath = useReturnPath();
  const { dataVersion, cashContinuity, agreements, notifyDataChanged } = usePrototypeServices();
  const [state, setState] = useState<ReversalReadState>({ phase: "loading" });
  const [retryCount, setRetryCount] = useState(0);
  const [sourceWarning, setSourceWarning] = useState<{ orderId: string; text: string } | null>(null);
  const [date, setDate] = useState(() => todayInAmman());
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const operationKey = useRef(`cash-reversal-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
  const entry = state.phase === "ready" ? state.entry : null;
  useEffect(() => {
    let active = true;
    void cashContinuity.entries().then(result => {
      if (!active) return;
      if (!result.ok) {
        setState({ phase: "read-error", message: result.message });
        return;
      }
      const found = result.value.find(candidate => candidate.id === id) ?? null;
      setState(found ? { phase: "ready", entry: found } : { phase: "not-found" });
    });
    return () => {
      active = false;
    };
  }, [cashContinuity, id, dataVersion, retryCount]);
  /* G6-F1-4 (البند ١ — الجزء ب): تحذير غير حاجر عند التراجع عن تخصيص مرتبط
   * بقبضة ما زالت مسجلة — الصدق المزدوج: التصحيح ينفَّذ من سطحه المالك (الطلب)،
   * لا عكس تلقائي من سطح الكاش. وصلة للطلب مع الحفاظ على الرجوع. */
  useEffect(() => {
    let active = true;
    void (async () => {
      if (!entry || entry.type !== "allocation" || entry.sourceRefKind !== "order" || !entry.sourceRefId) {
        if (active) setSourceWarning(null);
        return;
      }
      const orderResult = await agreements.get(entry.sourceRefId);
      if (!active) return;
      if (!orderResult.ok || !orderResult.stored) {
        setSourceWarning(null);
        return;
      }
      const events = orderResult.stored.order.events;
      const lineStillRecorded = entry.sourceRefLineId
        ? events.some(event => event.type === "collection_recorded" && event.id === entry.sourceRefLineId)
        : events.some(event => event.type === "collection_recorded");
      if (!lineStillRecorded) {
        setSourceWarning(null);
        return;
      }
      setSourceWarning({
        orderId: orderResult.stored.id,
        text: "هذا التخصيص مرتبط بقبضة ما زالت مسجلة على الطلب — لو رجّعت المبلغ للزبون، تراجع عن القبضة وتخصيصها معًا من صفحة الطلب.",
      });
    })();
    return () => {
      active = false;
    };
  }, [entry, agreements, dataVersion]);
  /* U-005 (دورة التدقيق النهائي): حماية المدخلات غير المحفوظة — الرجوع يمر
   * بالحارس: «ابقَ / احفظ ثم اخرج / اخرج بلا حفظ» كبقية المحررات العميقة. */
  const isDirty = useFormDirty([date, reason]);
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: () => save() });

  async function save(): Promise<boolean> {
    /* R9-GA-F3.1/W3-F1: لا حفظ ولا رسالة خارج مرحلة الجاهزية — حارس
     * الحوار (احفظ ثم اخرج) قد يستدعي الحفظ بعد تغيّر المرحلة. */
    if (state.phase !== "ready") return false;
    if (!reason.trim()) {
      setMessage("اذكر سبب التراجع قبل الحفظ.");
      return false;
    }
    setSaving(true);
    const result = await cashContinuity.reverse({
      entryId: state.entry.id,
      occurredOn: date,
      reason,
      operationKey: operationKey.current,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return false;
    }
    notifyDataChanged();
    /* S1-07: الخروج بعد حفظ ناجح يعود للمصدر (?from) — عقد ٢٦ قاعدة ٣. */
    navigate(returnPath);
    return true;
  }
  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ فتح الأثر…
      </div>
    );
  if (state.phase === "not-found")
    return (
      <section className="micro-page micro-not-found">
        <h1>لم نجد أثر الكاش</h1>
        <p>قد يكون السجل حُذف من هذا الجهاز أو تم التراجع عنه سابقًا.</p>
        <Button action="secondary" onClick={() => navigate("/cash")}>
          محافظ الكاش
        </Button>
      </section>
    );
  if (state.phase === "read-error")
    /* R9-GA-F3.1: فشل القراءة يُعرض برسالته الفعلية لا مموّهًا ك«عدم
     * وجود» — نمط ReceivedLoanDetail: زر رجوع + رسالة الخطأ الحقيقية
     * بصفة alert + إعادة محاولة. لا حفظ ولا تنقل ولا إشعار هنا. */
    return (
      <section className="micro-page">
        <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
          محافظ الكاش
        </button>
        <p className="micro-field-error" role="alert">
          {state.message}
        </p>
        <div className="micro-form-actions">
          <Button action="save" onClick={() => setRetryCount(count => count + 1)}>
            إعادة المحاولة
          </Button>
        </div>
      </section>
    );
  return (
    <section className="micro-page micro-finance-page">
      <button className="micro-back-button" type="button" onClick={() => requestNavigation(returnPath)}>
        <ArrowRight aria-hidden="true" /> محافظ الكاش
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">تراجع محفوظ</span>
        <h1>تراجع عن هذا الأثر</h1>
        <p>سيبقى الأصل ظاهرًا، ويضاف أثر مقابل له بدل الحذف أو التعديل الصامت.</p>
      </div>
      <section className="micro-decision-card">
        <RotateCcw aria-hidden="true" />
        <div>
          <span>الأثر الذي سيتم التراجع عنه</span>
          <strong>
            <MoneyValue minor={state.entry.cashDeltaMinor} showPlus />
          </strong>
          <p>
            <LocalDateValue value={state.entry.occurredOn} /> · {state.entry.note}
          </p>
        </div>
      </section>
      {sourceWarning ? (
        <section className="micro-note-card" aria-label="تحذير ارتباط المصدر">
          <p>{sourceWarning.text}</p>
          <Button
            action="quiet"

            onClick={() =>
              navigate(withReturnTo(`/orders/${sourceWarning.orderId}`, location.split("?")[0] ?? location))
            }
          >
            افتح الطلب
          </Button>
        </section>
      ) : null}
      <section className="micro-form-card">
        <LocalDateField label="تاريخ التراجع" value={date} onChange={event => setDate(event.target.value)} />
        <label className="micro-field">
          <span>لماذا تتراجع عنه؟</span>
          <textarea
            value={reason}
            onChange={event => setReason(event.target.value)}
            placeholder="مثال: سجلت فرق الجرد بالعكس"
          />
        </label>
        {message ? (
          <p className="micro-field-error" role="alert">
            {message}
          </p>
        ) : null}
        <div className="micro-form-actions micro-sticky-save">
          <Button
            action="commit"
            block

            disabled={saving}
            onClick={save}
          >
            <Save aria-hidden="true" />
            {saving ? "جارٍ الحفظ…" : "حفظ التراجع"}
          </Button>
        </div>
      </section>
    </section>
  );
}
