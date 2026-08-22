/** Anti-vibe intent choice: two operational entry points, each with a distinct record outcome. */
import { Box, ClipboardPlus, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { DraftIntent } from "@/storage/local/types";

export default function NewDraft() {
  const [, navigate] = useLocation();
  const { drafts, notifyDataChanged } = usePrototypeServices();
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  async function create(intent: DraftIntent) {
    setIsCreating(true); setError(null);
    const result = await drafts.create(intent);
    setIsCreating(false);
    if (!result.ok) { setError(result.message); return; }
    notifyDataChanged(); navigate(`/orders/draft/${result.draft.id}`);
  }
  return <section className="micro-page"><div className="micro-page-heading"><span className="micro-overline">سجل جديد</span><h1>اختر نقطة البداية</h1><p>ينشئ الاختيار مسودة فقط؛ لا يسجل سعرًا أو قبضًا حتى تدخل هذه البيانات وتثبتها.</p></div><div className="micro-intent-stack"><button className="micro-intent-card" type="button" disabled={isCreating} onClick={() => create("customer_order")}><span className="micro-intent-icon"><ClipboardPlus aria-hidden="true" /></span><span><strong>طلب عميل</strong><small>سجل القطعة والكمية والتفاصيل المتفق عليها.</small></span><ArrowLeft aria-hidden="true" /></button><button className="micro-intent-card" type="button" disabled={isCreating} onClick={() => create("planned_design")}><span className="micro-intent-icon"><Box aria-hidden="true" /></span><span><strong>تقدير تصميم</strong><small>احسب فكرة أو منتجًا قبل أن يتحول إلى اتفاق.</small></span><ArrowLeft aria-hidden="true" /></button></div>{error ? <p className="micro-field-error" role="alert">{error}</p> : null}</section>;
}
