/** Micro design reminder: task list with one obvious action; no fictional customers, balances, dates, or financial statuses. */
import { ArrowLeft, ClipboardPlus } from "lucide-react";
import { toast } from "sonner";
import { DecisionPanel } from "@/components/presentation/DecisionPanel";

export default function Orders() {
  function showSliceNotice() { toast.message("الطلبات المحلية ستُبنى في Slice البداية", { description: "لن ننشئ طلبًا ظاهريًا قبل وجود مسودة وحفظ محلي حقيقي." }); }
  return <section className="micro-page"><div className="micro-page-heading"><span className="micro-overline">المتابعة</span><h1>الطلبات</h1><p>طلباتك والمسودات التي تحتاج قرارًا واحدًا واضحًا.</p></div><DecisionPanel label="الأولوية الآن" truth="لا توجد طلبات محفوظة بعد." nextAction="ابدأ مسودة طلب مخصص واحد." tone="accent" /><section className="micro-empty-state" aria-labelledby="orders-empty-title"><span className="micro-empty-symbol"><ClipboardPlus aria-hidden="true" /></span><span className="micro-status-chip">لا توجد بيانات بعد</span><h2 id="orders-empty-title">ابدأ بطلب واحد تعرف قصته</h2><p>الوصف والكمية وما اتفقت عليه تكفي كبداية.</p><button className="micro-button micro-button-primary" type="button" onClick={showSliceNotice}><ClipboardPlus aria-hidden="true" /> إنشاء طلب مخصص</button><button className="micro-text-action" type="button" onClick={showSliceNotice}>ابدأ كتقدير فقط <ArrowLeft aria-hidden="true" /></button></section></section>;
}
