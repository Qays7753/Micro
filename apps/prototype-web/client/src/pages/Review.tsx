/** Review reads local Domain results only; it does not calculate a project-wide profit or invent an aggregate. */
import { ArrowLeft, Landmark, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { DecisionPanel } from "@/components/presentation/DecisionPanel";
import { InfoCard } from "@/components/presentation/InfoCard";
import type { StoredCraftOrder } from "@/storage/local/types";

type ReviewState = { phase: "loading" } | { phase: "error" } | { phase: "ready"; orders: readonly StoredCraftOrder[] };
const money = new Intl.NumberFormat("ar-JO", { style: "currency", currency: "JOD", minimumFractionDigits: 2 });
const resultLabel: Record<string, string> = { final: "معروفة", estimated: "تقديرية", incomplete: "غير مكتملة", review_required: "تحتاج مراجعة" };

export default function Review() {
  const [, navigate] = useLocation(); const { agreements, dataVersion } = usePrototypeServices(); const [state, setState] = useState<ReviewState>({ phase: "loading" });
  useEffect(() => { let active = true; agreements.list().then(result => { if (!active) return; setState(result.ok ? { phase: "ready", orders: result.orders } : { phase: "error" }); }); return () => { active = false; }; }, [agreements, dataVersion]);
  if (state.phase === "loading") return <div className="micro-route-loading" role="status">جارٍ قراءة المراجعة المحلية…</div>;
  if (state.phase === "error") return <section className="micro-page micro-not-found"><h1>تعذر قراءة المراجعة</h1><p>لم يتم تعديل بياناتك. أعد فتح التطبيق للمحاولة.</p></section>;
  const completed = state.orders.filter(stored => ["delivered", "settled"].includes(stored.order.status)); const debtOrders = state.orders.filter(stored => stored.order.settlementStatus === "debt"); const resultOrder = completed.find(stored => stored.order.resultStatus === "final") ?? completed[0] ?? null;
  const truth = resultOrder ? `${resultOrder.order.itemName}: النتيجة ${resultLabel[resultOrder.order.resultStatus] ?? "تحتاج مراجعة"}.` : "لا توجد نتيجة طلب بعد؛ لا نعرض رقمًا بلا قصة.";
  return <section className="micro-page"><section className="micro-review-intro"><img src="/manus-storage/micro-pattern-panel_65e2b8c4.png" alt="" className="micro-review-pattern" /><div className="micro-review-intro-copy"><span className="micro-overline">الفهم قبل الرقم</span><h1>المراجعة</h1><p>هنا نفهم نتيجة طلب واحد بوضوح، لا نعرض لوحة محاسبة مزدحمة.</p></div></section><DecisionPanel label="القرار الآن" truth={truth} nextAction={resultOrder ? "افتح الطلب لتراجع النتيجة وسجلّه." : "أكمل طلبًا قبل مراجعة نتيجته."} tone={resultOrder ? "accent" : "support"} />{resultOrder ? <InfoCard title={resultOrder.order.itemName} eyebrow={`نتيجة ${resultLabel[resultOrder.order.resultStatus] ?? "تحتاج مراجعة"}`} tone={resultOrder.order.resultStatus === "final" ? "accent" : "warning"}>{resultOrder.order.profitIndicatorMinor !== null ? <p><strong>{money.format(resultOrder.order.profitIndicatorMinor / 100)}</strong> مؤشر نتيجة الطلب حسب التكلفة المعترف بها.</p> : <p>لا تظهر نتيجة رقمية نهائية لأن معرفة التكلفة ليست مكتملة أو تحتاج مراجعة.</p>}<p>الإيراد المعترف به: {money.format(resultOrder.order.recognizedRevenueMinor / 100)} · التكلفة المعترف بها: {money.format(resultOrder.order.recognizedCostMinor / 100)}</p><button className="micro-text-action" type="button" onClick={() => navigate(`/orders/${resultOrder.id}`)}>فتح سجل الطلب <ArrowLeft aria-hidden="true" /></button></InfoCard> : null}<section className="micro-guidance-grid" aria-label="حالة المراجعة المحلية"><InfoCard title="طلبات وصلت إلى التسليم" eyebrow="حالة تشغيلية" tone="accent"><p>{completed.length} طلب/طلبات وصلت إلى التسليم أو الإغلاق. لا يعني التسليم وحده قبضًا كاملًا.</p></InfoCard><InfoCard title="ديون مسجلة" eyebrow="متابعة لا كاش" tone="warning">{debtOrders.length > 0 ? <p><Landmark aria-hidden="true" /> {debtOrders.length} طلب/طلبات لها متبقٍ مسجل كدين. لا يدخل في الكاش المحصل.</p> : <p>لا يوجد دين مسجل في الطلبات المحلية الحالية.</p>}</InfoCard></section><div className="micro-truth-banner"><ShieldCheck aria-hidden="true" /><p><strong>قاعدة Micro:</strong> العربون كاش محصل، والدين مستحق، والتسليم لا يسجل قبضًا تلقائيًا.</p></div></section>;
}
