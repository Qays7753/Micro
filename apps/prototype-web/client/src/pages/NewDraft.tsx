/** Slice 1 intent choice: distinguish a customer order from a planned design before any agreement or financial claim. */
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
  return <section className="micro-page"><div className="micro-page-heading"><span className="micro-overline">طلب جديد</span><h1>ماذا تريد أن تعرف الآن؟</h1><p>اختر البداية الصحيحة؛ هذا يوضح اللغة، ولا يثبت سعرًا أو اتفاقًا أو بيعًا.</p></div><div className="micro-intent-stack"><button className="micro-intent-card" type="button" disabled={isCreating} onClick={() => create("customer_order")}><span className="micro-intent-icon"><ClipboardPlus aria-hidden="true" /></span><span><strong>لدي طلب من عميل</strong><small>سجّل وصف القطعة وما تعرفه من الاتفاق.</small></span><ArrowLeft aria-hidden="true" /></button><button className="micro-intent-card" type="button" disabled={isCreating} onClick={() => create("planned_design")}><span className="micro-intent-icon"><Box aria-hidden="true" /></span><span><strong>أخطط لتصميم أو منتج</strong><small>قدّر الفكرة قبل أن تصبح بيعًا فعليًا.</small></span><ArrowLeft aria-hidden="true" /></button></div>{error ? <p className="micro-field-error" role="alert">{error}</p> : null}</section>;
}
