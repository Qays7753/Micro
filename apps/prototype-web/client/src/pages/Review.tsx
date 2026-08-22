/** Micro design reminder: review explains one order result only when data exists; it never invents project-wide profit. */
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { DecisionPanel } from "@/components/presentation/DecisionPanel";
import { InfoCard } from "@/components/presentation/InfoCard";

export default function Review() {
  function showSliceNotice() { toast.message("ستظهر المراجعة بعد مسار الطلب", { description: "نتيجة الطلب لا تُنشأ قبل التكلفة والاتفاق والتسليم أو التسوية الفعلية." }); }
  return <section className="micro-page"><section className="micro-review-intro"><img src="/manus-storage/micro-pattern-panel_65e2b8c4.png" alt="" className="micro-review-pattern" /><div className="micro-review-intro-copy"><span className="micro-overline">الفهم قبل الرقم</span><h1>المراجعة</h1><p>هنا نفهم نتيجة الطلب، لا نعرض رقمًا بلا قصة.</p></div></section><DecisionPanel label="القرار الآن" truth="لا توجد نتيجة طلب بعد." nextAction="أكمل طلبًا قبل مراجعة نتيجته." tone="support" /><InfoCard title="عند اكتمال الطلب" eyebrow="ما ستراه هنا" tone="accent"><p>تكلفة معروفة أو مقدرة، ما قُبض، ما بقي، وما تحتاجه لتكون النتيجة أوضح.</p><button className="micro-text-action" type="button" onClick={showSliceNotice}>ما الذي ستعرضه النتيجة؟ <ArrowLeft aria-hidden="true" /></button></InfoCard><div className="micro-truth-banner"><ShieldCheck aria-hidden="true" /><p><strong>قاعدة Micro:</strong> العربون كاش محصل، والدين مستحق، والتسليم لا يسجل قبضًا تلقائيًا.</p></div></section>;
}
