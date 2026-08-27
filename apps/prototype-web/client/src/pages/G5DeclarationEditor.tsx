/* مبدأ Micro: الإعلان يظل توقعًا معلنًا منفصلًا عن الكاش، مع تاريخ قابل للفهم. */
import { ArrowLeft, CalendarClock, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import type { G5LinkOptions } from "@/application/g5/g5Service";
import { formatMoneyMinor, localDateInAmman } from "@/presentation/formatters";

function todayInAmman() { return localDateInAmman(); }

export default function G5DeclarationEditor() {
  const [, navigate] = useLocation();
  const { g5, notifyDataChanged } = usePrototypeServices();
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
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void g5.listLinkOptions().then((result) => { if (active && result.ok) setLinks(result.value); });
    return () => { active = false; };
  }, [g5]);

  function selectDirection(next: "collection" | "commitment") {
    setDirection(next);
    if (next === "collection") setRelatedEventId(null);
    else setRelatedOrderId(null);
  }

  async function save() {
    setMessage(null);
    if (amountMinor === null || amountMinor <= 0 || !amountValid) { setMessage("أدخل مبلغًا موجبًا بصيغة واضحة قبل الحفظ."); return; }
    setSaving(true);
    const result = await g5.createDeclaration({ direction, amountMinor, dueOn, source, knowledge, note, relatedOrderId: direction === "collection" ? relatedOrderId : null, relatedEventId: direction === "commitment" ? relatedEventId : null, idempotencyKey: `g5-ui:${direction}:${dueOn}:${amountMinor}:${source.trim()}:${note.trim()}:${relatedOrderId ?? relatedEventId ?? "none"}` });
    setSaving(false);
    if (!result.ok) { setMessage(result.message); return; }
    notifyDataChanged();
    navigate("/finance");
  }

  const linkOptions = direction === "collection" ? links?.orders ?? [] : links?.payableEvents ?? [];
  const selectedLinkId = direction === "collection" ? relatedOrderId : relatedEventId;
  const setSelectedLinkId = direction === "collection" ? setRelatedOrderId : setRelatedEventId;

  return <section className="micro-page micro-g5-editor-page"><button className="micro-back-button" type="button" onClick={() => navigate("/finance")}><ArrowLeft aria-hidden="true" /> القرار المالي</button><div className="micro-page-heading"><span className="micro-overline">إعلان لا يتحول إلى حركة مالية</span><h1>تحصيل أو التزام قريب</h1><p>اكتب ما أعلنته أو تعرفه مع تاريخه ومصدره. سيظهر في توقع G5 منفصلًا عن الكاش الحالي، ويمكن عكسه لاحقًا دون تعديل السجل القديم.</p></div><section className="micro-form-card"><div className="micro-field"><span>نوع التدفق</span><div className="micro-g5-choice-row"><button className="micro-g5-choice" data-selected={direction === "collection"} type="button" onClick={() => selectDirection("collection")}>تحصيل من عميل</button><button className="micro-g5-choice" data-selected={direction === "commitment"} type="button" onClick={() => selectDirection("commitment")}>التزام قريب</button></div></div><label className="micro-field"><span>المبلغ بالدينار <small>مثال: 80.00</small></span><EnglishNumberInput value={amountMinor} kind="money" allowEmpty placeholder="0.00" aria-label="مبلغ إعلان السيولة" onNumericChange={setAmountMinor} onEmptyChange={() => setAmountMinor(null)} onTextValidityChange={setAmountValid} /></label><LocalDateField label="التاريخ المعلن" value={dueOn} onChange={(event) => setDueOn(event.target.value)} /><label className="micro-field"><span>المصدر المعلن</span><input type="text" value={source} onChange={(event) => setSource(event.target.value)} placeholder="مثال: رسالة العميلة أو فاتورة المورد" /></label><label className="micro-field"><span>درجة المعرفة</span><select value={knowledge} onChange={(event) => setKnowledge(event.target.value as "known" | "estimated" | "needs_review")}><option value="known">معروف / مؤكد</option><option value="estimated">تقديري معلن</option><option value="needs_review">يحتاج مراجعة</option></select></label><label className="micro-field"><span>ربط اختياري بمصدر قائم <small>{direction === "collection" ? "طلب له ذمة مسجلة" : "مصروف مستحق قائم"}</small></span><select value={selectedLinkId ?? ""} onChange={(event) => setSelectedLinkId(event.target.value || null)}><option value="">بدون ربط — إعلان مستقل</option>{linkOptions.map((option) => <option key={option.id} value={option.id}>{option.label} · {formatMoneyMinor(option.amountMinor)}</option>)}</select></label><label className="micro-field"><span>ملاحظة السياق</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="ما الذي يجعلك تعتبر هذا التحصيل أو الالتزام معلنًا؟" /></label><p className="micro-local-truth"><CalendarClock aria-hidden="true" /><span>هذا الإعلان لا يزيد الكاش ولا ينقصه ولا يسجل قبضًا أو دفعًا. إذا تغيرت الواقعة، صححها بعكس موثق من سطح القرار.</span></p>{message ? <p className="micro-field-error" role="alert">{message}</p> : null}<div className="micro-form-actions"><button className="micro-button micro-button-primary micro-button-block" type="button" disabled={saving} onClick={() => void save()}><Save aria-hidden="true" />{saving ? "جارٍ حفظ الإعلان…" : "حفظ الإعلان المحلي"}</button><button className="micro-button micro-button-secondary micro-button-block" type="button" onClick={() => navigate("/finance")}>إلغاء</button></div></section></section>;
}
