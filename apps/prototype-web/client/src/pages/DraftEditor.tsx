/** Slice 1 draft editor: saves pre-domain details only and never creates price, deposit, cash, or a CraftOrder. */
import { useEffect, useState } from "react";
import { ArrowRight, Save } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { OrderDraft } from "@/storage/local/types";

type EditorState = "loading" | "ready" | "not_found" | "error";
export default function DraftEditor() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { drafts, dataVersion, notifyDataChanged } = usePrototypeServices();
  const [state, setState] = useState<EditorState>("loading");
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => { let active = true; drafts.get(params.id).then(result => { if (!active) return; if (!result.ok) { setState("error"); return; } setDraft(result.value); setState(result.value ? "ready" : "not_found"); }); return () => { active = false; }; }, [dataVersion, drafts, params.id]);
  async function save(andContinue: boolean) {
    if (!draft) return;
    setIsSaving(true); setMessage(null);
    const result = await drafts.save(draft);
    setIsSaving(false);
    if (!result.ok) { setMessage(result.message); return; }
    setDraft(result.draft); notifyDataChanged(); setMessage("تم حفظ المسودة على هذا الجهاز.");
    if (andContinue) navigate(`/orders/draft/${draft.id}/cost`);
  }
  if (state === "loading") return <div className="micro-route-loading" role="status">جارٍ فتح المسودة…</div>;
  if (state === "not_found") return <section className="micro-page micro-not-found"><h1>لم نجد هذه المسودة</h1><p>قد تكون حذفت محليًا أو لم تُحفظ بعد.</p><button className="micro-button micro-button-primary" type="button" onClick={() => navigate("/orders")}>العودة للطلبات</button></section>;
  if (state === "error" || !draft) return <section className="micro-page micro-not-found"><h1>تعذر فتح المسودة</h1><p>لم يتم تغيير بياناتك. أعد المحاولة من قائمة الطلبات.</p><button className="micro-button micro-button-primary" type="button" onClick={() => navigate("/orders")}>العودة للطلبات</button></section>;
  const isCustomerOrder = draft.intent === "customer_order";
  return <section className="micro-page"><button className="micro-back-button" type="button" onClick={() => save(false)}><ArrowRight aria-hidden="true" /> حفظ والبقاء هنا</button><div className="micro-page-heading"><span className="micro-overline">مسودة محلية</span><h1>{isCustomerOrder ? "طلب من عميل" : "تصميم مخطط"}</h1><p>نسجل القصة والكمية الآن. التكلفة والاتفاق يأتيان بعد ذلك.</p></div><section className="micro-form-card"><label className="micro-field"><span>وصف القطعة <small>مطلوب قبل الانتقال للتكلفة</small></span><input value={draft.itemName} onChange={event => setDraft({ ...draft, itemName: event.target.value })} placeholder="مثال: صندوق خشبي مخصص" /></label>{isCustomerOrder ? <label className="micro-field"><span>اسم العميل <small>اختياري في المسودة</small></span><input value={draft.customerName} onChange={event => setDraft({ ...draft, customerName: event.target.value })} placeholder="مثال: سارة" /></label> : null}<label className="micro-field"><span>الكمية</span><input type="number" min="1" inputMode="numeric" value={draft.quantity} onChange={event => setDraft({ ...draft, quantity: Number(event.target.value) || 0 })} /></label><label className="micro-field"><span>ملاحظات التخصيص <small>اختياري</small></span><textarea value={draft.specifications} onChange={event => setDraft({ ...draft, specifications: event.target.value })} placeholder="لون، قياس، اسم أو تفاصيل مهمة…" rows={4} /></label>{message ? <p className="micro-save-note" role="status">{message}</p> : null}<div className="micro-form-actions"><button className="micro-button micro-button-secondary" type="button" disabled={isSaving} onClick={() => save(false)}><Save aria-hidden="true" /> حفظ مسودة</button><button className="micro-button micro-button-primary" type="button" disabled={isSaving || !draft.itemName.trim()} onClick={() => save(true)}>{isSaving ? "جارٍ الحفظ…" : "احسب التكلفة"}</button></div></section></section>;
}
