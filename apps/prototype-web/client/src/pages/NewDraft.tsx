/** Anti-vibe intent choice: two operational entry points, each with a distinct record outcome. */
import { Box, ClipboardPlus, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { DraftIntent } from "@/storage/local/types";

/** The quick-action sheet already answered the intent question; its answer rides the route. */
const intentFromLocation = (location: string): DraftIntent | null => {
  const value = new URLSearchParams(location.split("?")[1] ?? "").get("intent");
  return value === "customer_order" || value === "planned_design" ? value : null;
};

export default function NewDraft() {
  const [location, navigate] = useLocation();
  const { drafts, notifyDataChanged } = usePrototypeServices();
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [intendedIntent, setIntendedIntent] = useState<DraftIntent | null>(() =>
    intentFromLocation(location),
  );
  async function create(intent: DraftIntent) {
    setIsCreating(true);
    setError(null);
    const result = await drafts.create(intent);
    setIsCreating(false);
    if (!result.ok) {
      setIntendedIntent(null);
      setError(result.message);
      return;
    }
    notifyDataChanged();
    navigate(`/orders/draft/${result.draft.id}`);
  }
  useEffect(() => {
    if (intendedIntent) void create(intendedIntent);
    // The route's answer is consumed once on mount; the sheet must not be asked again.
  }, []);
  return (
    <section className="micro-page">
      <div className="micro-page-heading">
        <span className="micro-overline">سجل جديد</span>
        <h1>اختر نقطة البداية</h1>
        <p>
          {intendedIntent
            ? "جارٍ إنشاء المسودة من اختيارك في القائمة السريعة…"
            : "ينشئ الاختيار مسودة فقط؛ لا يسجل سعرًا أو قبضًا حتى تدخل هذه البيانات وتسجّلها."}
        </p>
      </div>
      <div className="micro-intent-stack">
        <button
          className="micro-intent-card"
          type="button"
          disabled={isCreating}
          data-selected={intendedIntent === "customer_order" || undefined}
          onClick={() => create("customer_order")}
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
          disabled={isCreating}
          data-selected={intendedIntent === "planned_design" || undefined}
          onClick={() => create("planned_design")}
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
      {error ? (
        <p className="micro-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
