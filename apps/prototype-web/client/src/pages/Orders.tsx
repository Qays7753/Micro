/** Slice 1 orders: a local draft list with truthful empty, loading, and read-failure states. */
import { ClipboardPlus, ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { DecisionPanel } from "@/components/presentation/DecisionPanel";
import type { OrderDraft } from "@/storage/local/types";

type OrdersState = { phase: "loading" } | { phase: "error" } | { phase: "ready"; drafts: readonly OrderDraft[] };
export default function Orders() {
  const [, navigate] = useLocation();
  const { drafts, dataVersion } = usePrototypeServices();
  const [state, setState] = useState<OrdersState>({ phase: "loading" });
  useEffect(() => { let active = true; drafts.list().then(result => { if (!active) return; setState(result.ok ? { phase: "ready", drafts: result.value } : { phase: "error" }); }); return () => { active = false; }; }, [dataVersion, drafts]);
  if (state.phase === "loading") return <div className="micro-route-loading" role="status">جارٍ تحميل المسودات المحلية…</div>;
  if (state.phase === "error") return <section className="micro-page micro-not-found"><h1>تعذر تحميل الطلبات</h1><p>لم يتم تغيير شيء. أعد فتح التطبيق للمحاولة.</p></section>;
  const firstDraft = state.drafts[0];
  return <section className="micro-page"><div className="micro-page-heading"><span className="micro-overline">المتابعة</span><h1>الطلبات</h1><p>مسوداتك المحلية التي تحتاج قرارًا واحدًا واضحًا.</p></div><DecisionPanel label="الأولوية الآن" truth={firstDraft ? `أكمل مسودة: ${firstDraft.itemName || "وصف القطعة"}.` : "لا توجد طلبات محفوظة بعد."} nextAction={firstDraft ? "افتح المسودة واحفظ ما تعرفه الآن." : "ابدأ مسودة طلب مخصص واحد."} tone="accent" />{state.drafts.length === 0 ? <section className="micro-empty-state" aria-labelledby="orders-empty-title"><span className="micro-empty-symbol"><ClipboardPlus aria-hidden="true" /></span><span className="micro-status-chip">لا توجد بيانات بعد</span><h2 id="orders-empty-title">ابدأ بطلب واحد تعرف قصته</h2><p>الوصف والكمية وما اتفقت عليه تكفي كبداية.</p><button className="micro-button micro-button-primary" type="button" onClick={() => navigate("/orders/new")}><ClipboardPlus aria-hidden="true" /> إنشاء طلب مخصص</button></section> : <section className="micro-draft-list" aria-label="المسودات المحلية">{state.drafts.map(draft => <button className="micro-draft-row" type="button" key={draft.id} onClick={() => navigate(`/orders/draft/${draft.id}`)}><span className="micro-draft-symbol"><ClipboardPlus aria-hidden="true" /></span><span><strong>{draft.itemName || "مسودة تحتاج وصفًا"}</strong><small>{draft.intent === "customer_order" ? "طلب من عميل" : "تصميم مخطط"} · الكمية: {draft.quantity}</small></span><ChevronLeft aria-hidden="true" /></button>)}<button className="micro-button micro-button-secondary" type="button" onClick={() => navigate("/orders/new")}>إنشاء مسودة أخرى</button></section>}</section>;
}
