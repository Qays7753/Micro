/** Micro design reminder: Home leads with one useful question and an honest empty state, never fictional KPIs. */
import { ArrowLeft, ChevronLeft, CircleHelp, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { InfoCard } from "@/components/presentation/InfoCard";

export default function Home() {
  const [, navigate] = useLocation();
  function showSliceNotice() { toast.message("بداية الطلب ستصل في Slice التالية", { description: "سنحفظ المسودة محليًا قبل إضافة تكلفة أو اتفاق أو أي أثر مالي." }); }

  return (
    <section className="micro-page"><section className="micro-priority-panel" aria-labelledby="today-title"><img className="micro-priority-texture" src="/manus-storage/micro-onboarding-hero_24586879.png" alt="" /><div className="micro-priority-content"><span className="micro-eyebrow"><Sparkles aria-hidden="true" /> الأولوية الآن</span><h1 id="today-title">ابدأ طلبًا واحدًا تعرف تفاصيله</h1><div className="micro-priority-truth"><span>ما نعرفه الآن</span><strong>لا توجد بيانات محلية بعد.</strong></div><p>الخطوة التالية: احفظ بداية طلبك، ثم نكمل التكلفة والاتفاق في وقتها.</p><button className="micro-button micro-button-primary" type="button" onClick={showSliceNotice}>ابدأ طلبًا مخصصًا <ArrowLeft aria-hidden="true" /></button></div></section>
      <section className="micro-section" aria-labelledby="now-status-title"><div className="micro-section-heading"><div><span className="micro-overline">صورة اليوم</span><h2 id="now-status-title">مشروعي الآن</h2></div><span className="micro-status-chip">جاهز للبدء</span></div><InfoCard title="لم تسجّل طلبًا بعد" eyebrow="الحالة المحلية"><p>لا نعرض مبيعات أو أرباحًا قبل أن يحدث شيء فعلي.</p><button className="micro-text-action" type="button" onClick={() => navigate("/orders")}>افتح الطلبات <ChevronLeft aria-hidden="true" /></button></InfoCard></section>
      <section className="micro-guidance-grid" aria-label="مبادئ البداية"><InfoCard title="بعد كل خطوة" eyebrow="ما سيظهر لك" tone="accent"><p>ما تم حفظه، أثره المعروف، ثم الإجراء المناسب.</p></InfoCard><InfoCard title="قبل أي نتيجة مالية" eyebrow="ما ينقص القرار" tone="warning"><p>نحتاج تكلفة واتفاقًا وأحداثًا فعلية؛ غير ذلك يبقى واضحًا كنقص لا كتخمين.</p><button className="micro-text-action" type="button" onClick={showSliceNotice}><CircleHelp aria-hidden="true" /> تعرّف على المسار</button></InfoCard></section>
    </section>
  );
}
