/** Micro design reminder: an unavailable route explains the boundary and offers one clear escape route. */
import { ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, navigate] = useLocation();
  return (
    <section className="micro-page micro-not-found">
      <span className="micro-overline">مسار غير متاح</span>
      <h1>هذه الصفحة ليست جزءًا من Prototype الحالي</h1>
      <p>ارجع إلى مشروعي الآن لمتابعة المسار المحلي الأساسي.</p>
      <button className="micro-button micro-button-primary" type="button" onClick={() => navigate("/")}>
        <ArrowRight aria-hidden="true" /> العودة إلى مشروعي الآن
      </button>
    </section>
  );
}
