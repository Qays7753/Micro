/** Anti-vibe setup: one required identity input, one scoped local boundary, and one full-width start action. */
/* مبدأ Micro: توحيد اسم العملة في البداية عرضي، ولا يغيّر القيمة الداخلية أو حدود الحفظ المحلي. */
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
    setIsSaving(true);
    setError(null);
    const result = await profiles.save(activityName);
    setIsSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    notifyDataChanged();
    /* §2.5: بعد الاسم، الوجهة صفحة الأساس «شو عندك هلق؟» لا أول طلب. */
    navigate("/foundation", { replace: true });
  }
  return (
    <section className="micro-page micro-setup-page">
      <div className="micro-page-heading micro-setup-heading">
        <span className="micro-overline">قرار البداية</span>
        <h1>بأي اسم سيظهر مشروعك في أول طلب؟</h1>
        <p>يظهر الاسم في سجل الطلبات والتسعير المحلي. يمكنك تعديله لاحقًا من الإعدادات.</p>
        <div className="micro-setup-impact">
          <span>ما يعرفه Micro الآن</span>
          <strong>
            مشغل حرفي <b>·</b> الدينار الأردني <em>د.أ</em>
          </strong>
          <small>اسم المشروع هو أول مرجع منظم قبل تسجيل التكلفة أو الاتفاق أو المتابعة.</small>
        </div>
      </div>
      <form
        className="micro-form-card micro-setup-decision"
        onSubmit={event => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="micro-setup-step">
          <span>1</span>
          <div>
            <b>سمّ سجل مشروعك</b>
            <p>سترى هذا الاسم في سجل الطلبات، وصفحة الأساس بعده اختيارية بالكامل.</p>
          </div>
        </div>
        <label className="micro-field">
          <span>اسم يظهر في سجل الطلبات</span>
          <input
            autoFocus
            value={activityName}
            onChange={event => setActivityName(event.target.value)}
            placeholder="مثال: مشغل ليان"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "setup-error" : undefined}
          />
        </label>
        {error ? (
          <p id="setup-error" className="micro-field-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="micro-local-truth">
          <ShieldCheck aria-hidden="true" />
          <p>
            <b>سطر حقيقة:</b> الاسم وسجل الطلبات يُحفظان على هذا الجهاز فقط في هذا الإصدار.
          </p>
        </div>
        <button
          className="micro-button micro-button-primary micro-button-block"
          type="submit"
          disabled={isSaving}
        >
          {isSaving ? "جارٍ حفظ الاسم…" : "احفظ الاسم وافتح صفحة الأساس"}
          <ArrowLeft aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
