/** Anti-vibe home: a single stored next action plus a bounded record count, never a fabricated financial dashboard. */
import { ArrowLeft, ClipboardPenLine } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { ActivityProfile, OrderDraft, StoredCraftOrder } from "@/storage/local/types";

type HomeState = { phase: "loading" } | { phase: "error" } | { phase: "ready"; profile: ActivityProfile; drafts: readonly OrderDraft[]; orders: readonly StoredCraftOrder[] };
const count = new Intl.NumberFormat("en-US", { useGrouping: false });

export default function Home() {
  const [, navigate] = useLocation(); const { profiles, drafts, agreements, dataVersion } = usePrototypeServices(); const [state, setState] = useState<HomeState>({ phase: "loading" });
  useEffect(() => { let active = true; Promise.all([profiles.load(), drafts.list(), agreements.list()]).then(([profile, orderDrafts, orderList]) => { if (!active) return; if (!profile.ok || !orderDrafts.ok || !orderList.ok || !profile.value) { setState({ phase: "error" }); return; } setState({ phase: "ready", profile: profile.value, drafts: orderDrafts.value.filter(draft => !draft.linkedOrderId), orders: orderList.orders }); }); return () => { active = false; }; }, [agreements, dataVersion, drafts, profiles]);
  if (state.phase === "loading") return <div className="micro-route-loading" role="status">جارٍ قراءة سجلات المشروع…</div>;
  if (state.phase === "error") return <section className="micro-page micro-not-found"><h1>تعذر تحميل سجلات المشروع</h1><p>لم يتم تغيير بياناتك. أعد فتح التطبيق للمحاولة.</p></section>;
  const priorityOrder = state.orders.find(stored => stored.order.status !== "settled"); const latestDraft = state.drafts[0];
  const priorityTitle = priorityOrder ? priorityOrder.order.itemName : latestDraft ? (latestDraft.itemName || "مسودة تحتاج وصفًا") : "لا توجد طلبات بعد";
  const priorityDetail = priorityOrder ? priorityOrder.order.nextAction : latestDraft ? "أكمل الوصف والكمية ثم احفظ التكلفة عندما تعرفها." : "أنشئ طلبًا مخصصًا لتبدأ بسجل قابل للتسعير والمتابعة.";
  const actionHref = priorityOrder ? `/orders/${priorityOrder.id}` : latestDraft ? `/orders/draft/${latestDraft.id}` : "/orders/new";
  const actionLabel = priorityOrder ? "فتح الطلب" : latestDraft ? "استئناف المسودة" : "بدء طلب";
  const activeOrderCount = state.orders.filter(stored => stored.order.status !== "settled").length;
  return <section className="micro-page"><div className="micro-page-heading micro-home-heading"><span className="micro-overline">مشروعي الآن</span><h1>{state.profile.activityName}</h1><p>بيانات محلية للطلبات والمسودات. تظهر الأرقام المالية فقط بعد تسجيل أحداثها.</p></div><section className="micro-decision-surface" aria-labelledby="home-priority"><span className="micro-overline">الفعل التالي</span><h2 id="home-priority">{priorityTitle}</h2><p>{priorityDetail}</p><button className="micro-button micro-button-primary micro-button-block" type="button" onClick={() => navigate(actionHref)}>{actionLabel}<ArrowLeft aria-hidden="true" /></button></section><section className="micro-record-summary" aria-label="ملخص السجلات المحلية"><div><span>طلبات قيد المتابعة</span><strong className="micro-number">{count.format(activeOrderCount)}</strong></div><div><span>مسودات محفوظة</span><strong className="micro-number">{count.format(state.drafts.length)}</strong></div></section><section className="micro-scope-line"><ClipboardPenLine aria-hidden="true" /><p>لا تعني هذه الأعداد كاشًا أو ربحًا. تُعرض النتيجة والقبض والدين من أحداث الطلبات في المراجعة.</p><button className="micro-text-action" type="button" onClick={() => navigate("/orders")}>فتح الطلبات <ArrowLeft aria-hidden="true" /></button></section></section>;
}
