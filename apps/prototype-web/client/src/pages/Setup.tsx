/** Slice 1 setup: three deliberate facts only, saved locally through ProfileService. */
import { useState } from "react";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";

export default function Setup() {
  const [, navigate] = useLocation();
  const { profiles, notifyDataChanged } = usePrototypeServices();
  const [activityName, setActivityName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  async function submit() {
    setIsSaving(true); setError(null);
    const result = await profiles.save(activityName);
    setIsSaving(false);
    if (!result.ok) { setError(result.message); return; }
    notifyDataChanged();
    navigate("/orders/new", { replace: true });
  }
  return <section className="micro-page micro-setup-page"><span className="micro-overline">تأسيس محلي قصير</span><h1>لنرتب أول قرار يهمك</h1><p>طلب مخصص تريد تسعيره أو متابعته. نحتاج ثلاث معلومات فقط لنبدأ.</p><div className="micro-setup-steps" aria-label="معلومات التأسيس"><span><Check aria-hidden="true" /> اسم النشاط</span><span><Check aria-hidden="true" /> الدينار الأردني</span><span><Check aria-hidden="true" /> حرفة مخصصة</span></div><label className="micro-field"><span>اسم النشاط أو اسمك</span><input autoFocus value={activityName} onChange={event => setActivityName(event.target.value)} placeholder="مثال: مشغل ليان" aria-invalid={Boolean(error)} aria-describedby={error ? "setup-error" : undefined} /></label>{error ? <p id="setup-error" className="micro-field-error" role="alert">{error}</p> : null}<div className="micro-setup-static"><span>العملة</span><strong>الدينار الأردني (JOD)</strong><small>ثابتة في Prototype الأول.</small></div><div className="micro-setup-static"><span>مسار البداية</span><strong>حرفة يدوية مخصصة</strong><small>يمكن توسيع النشاطات لاحقًا، وليس الآن.</small></div><div className="micro-local-truth"><ShieldCheck aria-hidden="true" /><p>سيُحفظ التأسيس على هذا الجهاز فقط. لا يوجد تسجيل دخول أو مزامنة سحابية هنا.</p></div><button className="micro-button micro-button-primary" type="button" disabled={isSaving} onClick={submit}>{isSaving ? "جارٍ الحفظ…" : "ابدأ أول طلب"}<ArrowLeft aria-hidden="true" /></button></section>;
}
