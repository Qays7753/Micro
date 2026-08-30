/** Anti-vibe intent choice: two operational entry points, each with a distinct record outcome.
 * §٥-١ (و٥): الاختيار يفتح المحرر بلا إنشاء — المسودة تُنشأ عند أول إدخال حقيقي داخله،
 * فلا يخلّف الاستكشاف مسودات فارغة في السجل. */
import { Box, ClipboardPlus, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import type { DraftIntent } from "@/storage/local/types";

export default function NewDraft() {
  const [, navigate] = useLocation();
  function openEditor(intent: DraftIntent) {
    navigate(`/orders/draft/new?intent=${intent}`);
  }
  return (
    <section className="micro-page">
      <div className="micro-page-heading">
        <span className="micro-overline">سجل جديد</span>
        <h1>اختر نقطة البداية</h1>
        <p>يفتح الاختيار المحرر فارغًا؛ لا تُحفظ مسودة حتى تكتب شيئًا.</p>
      </div>
      <div className="micro-intent-stack">
        <button
          className="micro-intent-card"
          type="button"
          onClick={() => openEditor("customer_order")}
        >
          <span className="micro-intent-icon">
            <ClipboardPlus aria-hidden="true" />
          </span>
          <span>
            <strong>طلب عميل</strong>
            <small>سجل القطعة والكمية والتفاصيل المتفق عليها.</small>
          </span>
          <ArrowLeft aria-hidden="true" />
        </button>
        <button
          className="micro-intent-card"
          type="button"
          onClick={() => openEditor("planned_design")}
        >
          <span className="micro-intent-icon">
            <Box aria-hidden="true" />
          </span>
          <span>
            <strong>مسودة تصميم</strong>
            <small>ابدأ فكرة أو منتجًا قبل أن يتحول إلى اتفاق.</small>
          </span>
          <ArrowLeft aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
