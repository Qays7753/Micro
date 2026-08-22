/** Financial pulse home: one stored action plus named order-level collections and debts, never a project cash or profit claim. */
import { ArrowLeft, ClipboardPenLine } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { LocalFinancialPulse } from "@/application/financial-pulse/financialPulseService";
import type { ActivityProfile, OrderDraft, StoredCraftOrder } from "@/storage/local/types";

type HomeState = { phase: "loading" } | { phase: "error" } | { phase: "ready"; profile: ActivityProfile; drafts: readonly OrderDraft[]; orders: readonly StoredCraftOrder[]; pulse: LocalFinancialPulse };
const amount = new Intl.NumberFormat("en-JO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const count = new Intl.NumberFormat("en-US", { useGrouping: false });

export default function Home() {
  const [, navigate] = useLocation(); const { profiles, drafts, financialPulse, dataVersion } = usePrototypeServices(); const [state, setState] = useState<HomeState>({ phase: "loading" });
  useEffect(() => { let active = true; Promise.all([profiles.load(), drafts.list(), financialPulse.read()]).then(([profile, orderDrafts, pulseResult]) => { if (!active) return; if (!profile.ok || !orderDrafts.ok || !pulseResult.ok || !profile.value) { setState({ phase: "error" }); return; } setState({ phase: "ready", profile: profile.value, drafts: orderDrafts.value.filter(draft => !draft.linkedOrderId), orders: pulseResult.orders, pulse: pulseResult.pulse }); }); return () => { active = false; }; }, [dataVersion, drafts, financialPulse, profiles]);
  if (state.phase === "loading") return <div className="micro-route-loading" role="status">جارٍ قراءة سجلات المشروع…</div>;
  if (state.phase === "error") return <section className="micro-page micro-not-found"><h1>تعذر تحميل سجلات المشروع</h1><p>لم يتم تغيير بياناتك. أعد فتح التطبيق للمحاولة.</p></section>;
  const priorityOrder = state.orders.find(stored => stored.order.status !== "settled"); const latestDraft = state.drafts[0];
  const priorityTitle = priorityOrder ? priorityOrder.order.itemName : latestDraft ? (latestDraft.itemName || "مسودة تحتاج وصفًا") : "لا توجد طلبات بعد";
  const priorityDetail = priorityOrder ? priorityOrder.order.nextAction : latestDraft ? "أكمل الوصف والكمية ثم احفظ التكلفة عندما تعرفها." : "أنشئ طلبًا مخصصًا لتبدأ بسجل قابل للتسعير والمتابعة.";
  const actionHref = priorityOrder ? `/orders/${priorityOrder.id}` : latestDraft ? `/orders/draft/${latestDraft.id}` : "/orders/new";
  const actionLabel = priorityOrder ? "فتح الطلب" : latestDraft ? "استئناف المسودة" : "بدء طلب";
  return <section className="micro-page"><div className="micro-page-heading micro-home-heading"><span className="micro-overline">مشروعي الآن</span><h1>{state.profile.activityName}</h1><p>بيانات محلية للطلبات والمسودات. تظهر الأرقام المالية فقط بعد تسجيل أحداثها.</p></div><section className="micro-decision-surface" aria-labelledby="home-priority"><span className="micro-overline">الفعل التالي</span><h2 id="home-priority">{priorityTitle}</h2><p>{priorityDetail}</p><button className="micro-button micro-button-primary micro-button-block" type="button" onClick={() => navigate(actionHref)}>{actionLabel}<ArrowLeft aria-hidden="true" /></button></section><section className="micro-financial-pulse" aria-labelledby="pulse-title"><div className="micro-financial-pulse-heading"><div><span className="micro-overline">صورة الطلبات المسجلة</span><h2 id="pulse-title">متابعة مالية محدودة</h2></div><span>د.أ</span></div><dl><div><dt>قبض مسجل من الطلبات</dt><dd className="micro-number">{amount.format(state.pulse.registeredCollectionsMinor / 100)}</dd><small>ليس كاش المشروع</small></div><div><dt>دين مسجل بعد التسليم</dt><dd className="micro-number">{amount.format(state.pulse.registeredDebtMinor / 100)}</dd><small>مستحق عند العملاء</small></div><div><dt>طلبات قيد المتابعة</dt><dd className="micro-number">{count.format(state.pulse.activeOrderCount)}</dd><small>حالة تشغيلية</small></div><div><dt>نتائج مكتملة المعرفة</dt><dd className="micro-number">{count.format(state.pulse.finalResultOrderCount)}</dd><small>طلبات، لا ربح مشروع</small></div></dl></section><section className="micro-scope-line"><ClipboardPenLine aria-hidden="true" /><p>يقتصر الملخص على أحداث الطلبات المحلية. لا يحسب مصاريف عامة أو مخزونًا أو كاشًا أو ربحًا للمشروع كاملًا.</p><button className="micro-text-action" type="button" onClick={() => navigate("/review")}>فتح المراجعة <ArrowLeft aria-hidden="true" /></button></section></section>;
}
