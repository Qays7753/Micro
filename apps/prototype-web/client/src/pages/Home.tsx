/** Slice 1 home: shows one local next action from real profile/draft data, never a made-up financial KPI. */
import { ArrowLeft, ClipboardPenLine, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { InfoCard } from "@/components/presentation/InfoCard";
import type { ActivityProfile, OrderDraft } from "@/storage/local/types";

type HomeState = { phase: "loading" } | { phase: "error" } | { phase: "ready"; profile: ActivityProfile; drafts: readonly OrderDraft[] };
export default function Home() {
  const [, navigate] = useLocation();
  const { profiles, drafts, dataVersion } = usePrototypeServices();
  const [state, setState] = useState<HomeState>({ phase: "loading" });
  useEffect(() => { let active = true; Promise.all([profiles.load(), drafts.list()]).then(([profile, orderDrafts]) => { if (!active) return; if (!profile.ok || !orderDrafts.ok || !profile.value) { setState({ phase: "error" }); return; } setState({ phase: "ready", profile: profile.value, drafts: orderDrafts.value }); }); return () => { active = false; }; }, [dataVersion, drafts, profiles]);
  if (state.phase === "loading") return <div className="micro-route-loading" role="status">جارٍ ترتيب صورة مشروعك…</div>;
  if (state.phase === "error") return <section className="micro-page micro-not-found"><h1>تعذر تحميل صورة المشروع</h1><p>لم يتم تغيير بياناتك. أعد فتح التطبيق للمحاولة.</p></section>;
  const latestDraft = state.drafts[0];
  const priorityTitle = latestDraft ? `أكمل مسودة: ${latestDraft.itemName || "وصف القطعة"}` : "ابدأ بطلب واحد تعرف تفاصيله";
  const priorityTruth = latestDraft ? "لديك مسودة محفوظة محليًا، من دون تكلفة أو اتفاق بعد." : "لا توجد طلبات أو مسودات محفوظة بعد.";
  const actionHref = latestDraft ? `/orders/draft/${latestDraft.id}` : "/orders/new";
  return <section className="micro-page"><section className="micro-priority-panel" aria-labelledby="today-title"><img className="micro-priority-texture" src="/manus-storage/micro-onboarding-hero_24586879.png" alt="" /><div className="micro-priority-content"><span className="micro-eyebrow"><Sparkles aria-hidden="true" /> الأولوية الآن</span><h1 id="today-title">{priorityTitle}</h1><div className="micro-priority-truth"><span>ما نعرفه الآن</span><strong>{priorityTruth}</strong></div><p>{latestDraft ? "الخطوة التالية: راجع الوصف والكمية، ثم احفظ لتكمل لاحقًا." : "الخطوة التالية: أنشئ مسودة محلية قبل تكلفة أو سعر أو اتفاق."}</p><button className="micro-button micro-button-primary" type="button" onClick={() => navigate(actionHref)}>{latestDraft ? "استئناف المسودة" : "ابدأ طلبًا مخصصًا"}<ArrowLeft aria-hidden="true" /></button></div></section><section className="micro-section" aria-labelledby="now-status-title"><div className="micro-section-heading"><div><span className="micro-overline">صورة اليوم</span><h2 id="now-status-title">{state.profile.activityName}</h2></div><span className="micro-status-chip">محلي على هذا الجهاز</span></div><InfoCard title={latestDraft ? "هناك مسودة تنتظرك" : "لا توجد طلبات مسجلة بعد"} eyebrow="الحالة المحلية"><p>{latestDraft ? "لم تُنشئ هذه المسودة أي مبلغ أو حركة مالية. أكملها حين تعرف التفاصيل." : "ابدأ من الوصف والكمية؛ ستأتي التكلفة والاتفاق في مراحل منفصلة."}</p><button className="micro-text-action" type="button" onClick={() => navigate("/orders")}>فتح الطلبات <ClipboardPenLine aria-hidden="true" /></button></InfoCard></section><section className="micro-guidance-grid" aria-label="ما تعرفه Micro"><InfoCard title="ما تم حفظه" eyebrow="في هذه الدورة" tone="accent"><p>اسم النشاط والمسودات فقط. لا توجد تكلفة أو سعر أو عربون أو نتيجة طلب بعد.</p></InfoCard><InfoCard title="الخطوة التي تلي المسودة" eyebrow="عند جاهزية التفاصيل" tone="warning"><p>سنفصل التكلفة عن الاتفاق، ثم نوضح ما ينقص قبل أي رقم مالي.</p></InfoCard></section></section>;
}
