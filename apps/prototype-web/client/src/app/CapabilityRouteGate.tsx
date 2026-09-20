import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/primitives";
import { useDisabledCapabilities, type CapabilityId } from "@/app/useDisabledCapabilities";

/* G-004 (تدقيق الإدارة المالية المتدرجة 2026-09-19): حرس مسارات الإنشاء —
 * الرابط العميق البارد إلى مسار إنشاء قدرة متوقفة لا يتجاوز الحرس: يُعرض
 * وضع «قدرة متوقفة» الصادق بتركيبة micro-not-found القائمة نفسها (لا CSS
 * جديد ولا رموز جديدة) مع رجوع آمن ووصول مباشر للإعدادات لإعادة التفعيل.
 * السجلات القائمة وقراءتها وعملياتها الموثقة (تأكيد/عكس/تسديد) تبقى كما
 * هي — الحرس على الإنشاء فقط. حتى تكتمل قراءة التفضيل تُعرض حالة تحميل
 * لا المحرر. */

const CAPABILITY_ENTRY_LABELS: Record<CapabilityId, string> = {
  orders: "الطلبات",
  inventory: "المواد والمخزون",
  suppliers: "الموردين والمشتريات",
  catalog: "منتجاتي وخدماتي",
};

export function CapabilityCreateGate({
  capability,
  isCreate,
  children,
}: {
  capability: CapabilityId;
  isCreate: boolean;
  children: ReactNode;
}) {
  const { disabled, ready } = useDisabledCapabilities();
  const [, navigate] = useLocation();
  if (!isCreate) return <>{children}</>;
  if (!ready)
    return (
      <div className="micro-route-loading" role="status">
        جارٍ التحقق من قدراتك…
      </div>
    );
  if (disabled.includes(capability))
    return (
      <section className="micro-page micro-not-found" data-testid="capability-disabled-state">
        <span className="micro-overline">قدرة متوقفة عن الإدخال</span>
        <h1>{`${CAPABILITY_ENTRY_LABELS[capability]} متوقفة عن الإدخال`}</h1>
        <p>
          أوقفت هذه القدرة من الإعدادات — سجلاتها القائمة تبقى مقروءة كما هي، ويمكنك إعادة تفعيل الإدخال في أي
          وقت.
        </p>
        <div className="micro-form-actions micro-contextual-actions">
          <Button action="secondary" onClick={() => navigate("/settings")}>
            <ArrowRight aria-hidden="true" /> فعّلها من الإعدادات
          </Button>
          <Button action="secondary" onClick={() => navigate("/")}>
            مشروعي الآن
          </Button>
        </div>
      </section>
    );
  return <>{children}</>;
}
