/** Anti-vibe setup: one required identity input, one scoped local boundary, and one full-width start action. */
import { useState } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
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
  return <section className="micro-page micro-setup-page"><div className="micro-page-heading micro-setup-heading"><span className="micro-overline">قرار البداية</span><h1>بأي اسم سيظهر مشروعك في أول طلب؟</h1><p>يظهر الاسم في سجل الطلبات والتسعير المحلي. يمكنك تعديله لاحقًا من الإعدادات.</p></div><section className="micro-form-card micro-setup-decision"><label className="micro-field"><span>اسم يظهر في سجل الطلبات</span><input autoFocus value={activityName} onChange={event => setActivityName(event.target.value)} placeholder="مثال: مشغل ليان" aria-invalid={Boolean(error)} aria-describedby={error ? "setup-error" : undefined} /></label>{error ? <p id="setup-error" className="micro-field-error" role="alert">{error}</p> : null}<p className="micro-setup-context">حرفة مخصصة <b>·</b> الدينار الأردني <span>JOD</span></p><div className="micro-local-truth"><ShieldCheck aria-hidden="true" /><p><b>سطر حقيقة:</b> الاسم وسجل الطلبات يُحفظان على هذا الجهاز فقط في هذا الإصدار.</p></div><button className="micro-button micro-button-primary micro-button-block" type="button" disabled={isSaving} onClick={submit}>{isSaving ? "جارٍ تثبيت الاسم…" : "ثبّت الاسم وابدأ أول طلب"}<ArrowLeft aria-hidden="true" /></button></section></section>;
}
