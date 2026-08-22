/** Anti-vibe review: local order results and operational counts, without a defensive hero or fabricated portfolio metrics. */
import { ArrowLeft, Landmark } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { StoredCraftOrder } from "@/storage/local/types";

type ReviewState = { phase: "loading" } | { phase: "error" } | { phase: "ready"; orders: readonly StoredCraftOrder[] };
const money = new Intl.NumberFormat("ar-JO", { style: "currency", currency: "JOD", minimumFractionDigits: 2 });
const count = new Intl.NumberFormat("en-US", { useGrouping: false });
const resultLabel: Record<string, string> = { final: "معروفة", estimated: "تقديرية", incomplete: "غير مكتملة", review_required: "تحتاج مراجعة" };

export default function Review() {
  const [, navigate] = useLocation(); const { agreements, dataVersion } = usePrototypeServices(); const [state, setState] = useState<ReviewState>({ phase: "loading" });
  useEffect(() => { let active = true; agreements.list().then(result => { if (!active) return; setState(result.ok ? { phase: "ready", orders: result.orders } : { phase: "error" }); }); return () => { active = false; }; }, [agreements, dataVersion]);
  if (state.phase === "loading") return <div className="micro-route-loading" role="status">جارٍ قراءة المراجعة المحلية…</div>;
  if (state.phase === "error") return <section className="micro-page micro-not-found"><h1>تعذر قراءة المراجعة</h1><p>لم يتم تعديل بياناتك. أعد فتح التطبيق للمحاولة.</p></section>;
  const completed = state.orders.filter(stored => ["delivered", "settled"].includes(stored.order.status)); const debtOrders = state.orders.filter(stored => stored.order.settlementStatus === "debt"); const resultOrder = completed.find(stored => stored.order.resultStatus === "final") ?? completed[0] ?? null;
  return <section className="micro-page"><div className="micro-page-heading"><span className="micro-overline">نتائج الطلبات</span><h1>المراجعة</h1><p>توضح هذه الشاشة ما سُجل من طلبات محلية. لا تستبدل تقرير ربح أو كاش على مستوى المشروع.</p></div>{resultOrder ? <section className="micro-review-result" data-result={resultOrder.order.resultStatus}><div><span>نتيجة {resultLabel[resultOrder.order.resultStatus] ?? "تحتاج مراجعة"}</span><h2>{resultOrder.order.itemName}</h2></div>{resultOrder.order.profitIndicatorMinor !== null ? <strong className="micro-number">{money.format(resultOrder.order.profitIndicatorMinor / 100)}</strong> : <p>لا تظهر نتيجة رقمية نهائية لأن معرفة التكلفة ليست مكتملة أو تحتاج مراجعة.</p>}<p>إيراد معترف به {money.format(resultOrder.order.recognizedRevenueMinor / 100)} · تكلفة معترف بها {money.format(resultOrder.order.recognizedCostMinor / 100)}</p><button className="micro-text-action" type="button" onClick={() => navigate(`/orders/${resultOrder.id}`)}>فتح سجل الطلب <ArrowLeft aria-hidden="true" /></button></section> : <section className="micro-review-empty"><h2>لا توجد نتيجة طلب بعد</h2><p>تظهر هنا نتيجة الطلب بعد التسليم، وفق المعرفة المسجلة في تكلفة ذلك الطلب.</p><button className="micro-button micro-button-secondary" type="button" onClick={() => navigate("/orders")}>فتح الطلبات</button></section>}<section className="micro-record-summary" aria-label="حالة الطلبات المحلية"><div><span>طلبات سُلّمت أو أُغلقت</span><strong className="micro-number">{count.format(completed.length)}</strong></div><div><span>ديون مسجلة</span><strong className="micro-number">{count.format(debtOrders.length)}</strong></div></section><section className="micro-scope-line"><Landmark aria-hidden="true" /><p>العربون قبض مرتبط بالطلب، والدين مستحق، والتسليم لا يضيف قبضًا تلقائيًا.</p></section></section>;
}
