/** Micro design reminder: an unavailable route explains the boundary and offers one clear escape route. */
import { ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

import { Button } from "@/components/primitives";
export default function NotFound() {
  const [, navigate] = useLocation();
  return (
    <section className="micro-page micro-not-found">
      {/* F-008 (UXR-02 — أمر UXR-W01): عنوان وجهة واحد واضح بلا تمهيد معماري
          فوقه (SOP-02) — الرسالة القصيرة والرجوع الآمن كما هما (RET/SHELL). */}
      <h1>هذه الصفحة ليست جزءًا من هذا الإصدار</h1>
      <p>ارجع إلى الرئيسية لمتابعة المسار المحلي الأساسي.</p>
      <Button action="secondary" onClick={() => navigate("/")}>
        <ArrowRight aria-hidden="true" /> العودة إلى الرئيسية
      </Button>
    </section>
  );
}
