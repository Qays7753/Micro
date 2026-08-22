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
  return <section className="micro-page micro-setup-page"><div className="micro-page-heading"><span className="micro-overline">مشروع محلي</span><h1>ابدأ باسم مشروعك</h1><p>سنسجل أول طلب مخصص، ثم تظهر تكلفته واتفاقه ونتيجته كلٌّ في مرحلته الصحيحة.</p></div><section className="micro-form-card"><label className="micro-field"><span>اسم النشاط أو اسمك</span><input autoFocus value={activityName} onChange={event => setActivityName(event.target.value)} placeholder="مثال: مشغل ليان" aria-invalid={Boolean(error)} aria-describedby={error ? "setup-error" : undefined} /></label>{error ? <p id="setup-error" className="micro-field-error" role="alert">{error}</p> : null}<p className="micro-setup-context">الدينار الأردني (JOD) · حرفة مخصصة</p><div className="micro-local-truth"><ShieldCheck aria-hidden="true" /><p>تُحفظ البيانات على هذا الجهاز. لا يوجد تسجيل دخول أو مزامنة سحابية في هذا الإصدار.</p></div><button className="micro-button micro-button-primary micro-button-block" type="button" disabled={isSaving} onClick={submit}>{isSaving ? "جارٍ الحفظ…" : "حفظ وبدء طلب"}<ArrowLeft aria-hidden="true" /></button></section></section>;
}
