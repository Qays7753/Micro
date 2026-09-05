/* مبدأ Micro: المتوقع يظل سجلًا منفصلًا عن الكاش، مع تاريخ قابل للفهم. */
import { ArrowLeft, CalendarClock, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { useFormDirty } from "@/components/forms/useFormDirty";
import type { G5LinkOptions } from "@/application/g5/g5Service";
import { formatMoneyMinor, localDateInAmman } from "@/presentation/formatters";

/* مبدأ Micro: يبدأ المتوقع بالواقعة الأساسية، وتبقى المعرفة والربط والملاحظة خلف تفاصيل مقصودة. */

function todayInAmman() {
  return localDateInAmman();
}

export default function G5DeclarationEditor() {
  const [, navigate] = useLocation();
  /* المجموعة ١ (Scope A): الرجوع يعود للمصدر (?from) مع بديل قانوني موثّق. */
  const returnPath = useReturnPath();
  const { dataVersion, g5, notifyDataChanged } = usePrototypeServices();
  const [direction, setDirection] = useState<"collection" | "commitment">("collection");
  const [amountMinor, setAmountMinor] = useState<number | null>(null);
  const [amountValid, setAmountValid] = useState(true);
  const [dueOn, setDueOn] = useState(todayInAmman);
  const [source, setSource] = useState("");
  const [knowledge, setKnowledge] = useState<"known" | "estimated" | "needs_review">("known");
  const [note, setNote] = useState("");
  const [relatedOrderId, setRelatedOrderId] = useState<string | null>(null);
  const [relatedEventId, setRelatedEventId] = useState<string | null>(null);
  const [links, setLinks] = useState<G5LinkOptions | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void g5.listLinkOptions().then(result => {
      if (active && result.ok) setLinks(result.value);
    });
    return () => {
      active = false;
    };
  }, [g5, dataVersion]);

  function selectDirection(next: "collection" | "commitment") {
    setDirection(next);
    if (next === "collection") setRelatedEventId(null);
    else setRelatedOrderId(null);
  }

  /* U-005 (دورة التدقيق النهائي): حماية المدخلات غير المحفوظة — الرجوع يمر
   * بالحارس: «ابقَ / احفظ ثم اخرج / اخرج بلا حفظ» كبقية المحررات العميقة. */
  const isDirty = useFormDirty([
    direction,
    amountMinor,
    dueOn,
    source,
    knowledge,
    note,
    relatedOrderId,
    relatedEventId,
  ]);
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: () => save() });

  async function save(): Promise<boolean> {
    setMessage(null);
    if (amountMinor === null || amountMinor <= 0 || !amountValid) {
      setMessage("أدخل مبلغًا موجبًا بصيغة واضحة قبل الحفظ.");
      return false;
    }
    if (!note.trim()) {
      setDetailsOpen(true);
      setMessage("أضف ملاحظة قصيرة داخل تفاصيل المتوقع قبل الحفظ.");
      return false;
    }
    setSaving(true);
    const result = await g5.createDeclaration({
      direction,
      amountMinor,
      dueOn,
      source,
      knowledge,
      note,
      relatedOrderId: direction === "collection" ? relatedOrderId : null,
      relatedEventId: direction === "commitment" ? relatedEventId : null,
      idempotencyKey: `g5-ui:${direction}:${dueOn}:${amountMinor}:${source.trim()}:${note.trim()}:${relatedOrderId ?? relatedEventId ?? "none"}`,
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

  const linkOptions = direction === "collection" ? (links?.orders ?? []) : (links?.payableEvents ?? []);
  const selectedLinkId = direction === "collection" ? relatedOrderId : relatedEventId;
  const setSelectedLinkId = direction === "collection" ? setRelatedOrderId : setRelatedEventId;

  return (
    <section className="micro-page micro-g5-editor-page">
      <button className="micro-back-button" type="button" onClick={() => requestNavigation(returnPath)}>
        <ArrowLeft aria-hidden="true" /> القرار المالي
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">سجل متوقع لا يتحول إلى حركة مالية</span>
        <h1>تحصيل أو التزام قريب</h1>
        <p>
          اكتب ما أعلنته أو تعرفه مع تاريخه ومصدره. سيظهر في قراءة الكاش المتوقع منفصلًا عن الكاش الحالي،
          ويمكن التراجع عنه لاحقًا دون تعديل السجل القديم.
        </p>
      </div>
      <section className="micro-form-card">
        <div className="micro-field">
          <span>نوع التدفق</span>
          <div className="micro-g5-choice-row">
            <button
              className="micro-g5-choice"
              data-selected={direction === "collection"}
              type="button"
              onClick={() => selectDirection("collection")}
            >
              تحصيل من عميل
            </button>
            <button
              className="micro-g5-choice"
              data-selected={direction === "commitment"}
              type="button"
              onClick={() => selectDirection("commitment")}
            >
              التزام قريب
            </button>
          </div>
        </div>
        <label className="micro-field">
          <span>
            المبلغ بالدينار <small>مثال: 80.00</small>
          </span>
          <EnglishNumberInput
            value={amountMinor}
            kind="money"
            allowEmpty
            placeholder="0.00"
            aria-label="مبلغ السجل المتوقع"
            onNumericChange={setAmountMinor}
            onEmptyChange={() => setAmountMinor(null)}
            onTextValidityChange={setAmountValid}
          />
        </label>
        <LocalDateField
          label="التاريخ المتوقع"
          value={dueOn}
          onChange={event => setDueOn(event.target.value)}
        />
        <label className="micro-field">
          <span>مصدر التوقع</span>
          <input
            type="text"
            value={source}
            onChange={event => setSource(event.target.value)}
            placeholder="مثال: رسالة العميلة أو فاتورة المورد"
          />
        </label>
        <details
          className="micro-decision-layer micro-g5-details"
          open={detailsOpen}
          onToggle={event => setDetailsOpen(event.currentTarget.open)}
        >
          <summary className="micro-decision-layer-summary">
            <span>
              <b>تفاصيل المتوقع</b>
              <small>المعرفة والربط والملاحظة عند الحاجة.</small>
            </span>
            <strong>افتح التفاصيل</strong>
          </summary>
          <label className="micro-field">
            <span>حالة الرقم</span>
            <select
              value={knowledge}
              onChange={event => setKnowledge(event.target.value as "known" | "estimated" | "needs_review")}
            >
              <option value="known">مؤكد</option>
              <option value="estimated">تقديري معلن</option>
              <option value="needs_review">يحتاج مراجعة</option>
            </select>
          </label>
          <label className="micro-field">
            <span>
              ربط اختياري بمصدر قائم{" "}
              <small>{direction === "collection" ? "طلب له دين مسجل" : "مصروف مستحق قائم"}</small>
            </span>
            <select
              value={selectedLinkId ?? ""}
              onChange={event => setSelectedLinkId(event.target.value || null)}
            >
              <option value="">بدون ربط — سجل مستقل</option>
              {linkOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label} · {formatMoneyMinor(option.amountMinor)}
                </option>
              ))}
            </select>
          </label>
          <label className="micro-field">
            <span>ملاحظة السياق</span>
            <textarea
              value={note}
              onChange={event => setNote(event.target.value)}
              placeholder="ما الذي يجعلك تتوقع هذا القبض أو الدفع؟"
            />
          </label>
        </details>
        <p className="micro-local-truth">
          <CalendarClock aria-hidden="true" />
          <span>
            هذا السجل المتوقع لا يزيد الكاش ولا ينقصه ولا يسجل قبضًا أو دفعًا. إذا تغيّر الحدث، صحّحه بتراجع
            موثق من سطح القرار.
          </span>
        </p>
        {message ? (
          <p className="micro-field-error" role="alert">
            {message}
          </p>
        ) : null}
        <div className="micro-form-actions micro-sticky-save">
          <button
            className="micro-button micro-button-primary micro-button-block"
            type="button"
            disabled={saving}
            onClick={() => void save()}
          >
            <Save aria-hidden="true" />
            {saving ? "جارٍ حفظ المتوقع…" : "حفظ المتوقع"}
          </button>
          <button
            className="micro-button micro-button-secondary micro-button-block"
            type="button"
            onClick={() => navigate("/finance")}
          >
            إلغاء
          </button>
        </div>
      </section>
    </section>
  );
}
