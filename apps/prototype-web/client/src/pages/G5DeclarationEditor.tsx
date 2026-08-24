import { ArrowLeft, CalendarClock, Save } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";

function todayInAmman() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Amman", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export default function G5DeclarationEditor() {
  const [, navigate] = useLocation();
  const { g5, notifyDataChanged } = usePrototypeServices();
  const [direction, setDirection] = useState<"collection" | "commitment">("collection");
  const [amount, setAmount] = useState("");
  const [dueOn, setDueOn] = useState(todayInAmman);
  const [source, setSource] = useState("");
  const [knowledge, setKnowledge] = useState<"known" | "estimated" | "needs_review">("known");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setMessage(null);
    const amountMinor = Math.round(Number(amount.replace(",", ".")) * 100);
    setSaving(true);
    const result = await g5.createDeclaration({ direction, amountMinor, dueOn, source, knowledge, note, relatedOrderId: null, relatedEventId: null, idempotencyKey: `g5-ui:${direction}:${dueOn}:${amountMinor}:${source.trim()}:${note.trim()}` });
    setSaving(false);
    if (!result.ok) { setMessage(result.message); return; }
    notifyDataChanged();
    navigate("/finance");
  }

  return <section className="micro-page micro-g5-editor-page"><button className="micro-back-button" type="button" onClick={() => navigate("/finance")}><ArrowLeft aria-hidden="true" /> القرار المالي</button><div className="micro-page-heading"><span className="micro-overline">إعلان لا يتحول إلى حركة مالية</span><h1>تحصيل أو التزام قريب</h1><p>اكتب ما أعلنته أو تعرفه مع تاريخه ومصدره. سيظهر في توقع G5 منفصلًا عن الكاش الحالي، ويمكن عكسه لاحقًا دون تعديل السجل القديم.</p></div><section className="micro-form-card"><div className="micro-field"><span>نوع التدفق</span><div className="micro-g5-choice-row"><button className="micro-g5-choice" data-selected={direction === "collection"} type="button" onClick={() => setDirection("collection")}>تحصيل من عميل</button><button className="micro-g5-choice" data-selected={direction === "commitment"} type="button" onClick={() => setDirection("commitment")}>التزام قريب</button></div></div><label className="micro-field"><span>المبلغ بالدينار <small>مثال: 80.00</small></span><input className="micro-english-number-input" inputMode="decimal" type="text" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></label><label className="micro-field"><span>التاريخ المعلن</span><input type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} /></label><label className="micro-field"><span>المصدر المعلن</span><input type="text" value={source} onChange={(event) => setSource(event.target.value)} placeholder="مثال: رسالة العميلة أو فاتورة المورد" /></label><label className="micro-field"><span>درجة المعرفة</span><select value={knowledge} onChange={(event) => setKnowledge(event.target.value as "known" | "estimated" | "needs_review")}><option value="known">معروف / مؤكد</option><option value="estimated">تقديري معلن</option><option value="needs_review">يحتاج مراجعة</option></select></label><label className="micro-field"><span>ملاحظة السياق</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="ما الذي يجعلك تعتبر هذا التحصيل أو الالتزام معلنًا؟" /></label><p className="micro-local-truth"><CalendarClock aria-hidden="true" /><span>هذا الإعلان لا يزيد الكاش ولا ينقصه ولا يسجل قبضًا أو دفعًا. إذا تغيرت الواقعة، صححها بعكس موثق من سطح القرار.</span></p>{message ? <p className="micro-field-error" role="alert">{message}</p> : null}<div className="micro-form-actions"><button className="micro-button micro-button-primary micro-button-block" type="button" disabled={saving} onClick={save}><Save aria-hidden="true" />{saving ? "جارٍ حفظ الإعلان…" : "حفظ الإعلان المحلي"}</button><button className="micro-button micro-button-secondary micro-button-block" type="button" onClick={() => navigate("/finance")}>إلغاء</button></div></section></section>;
}
