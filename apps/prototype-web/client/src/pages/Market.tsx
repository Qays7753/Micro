/**
 * NAV-001 (قرار المالك ٢٠٢٦-٠٩-١٦): السوق — المقعد الخامس في الشريط السفلي.
 * إعلان «قريبًا» صادق لسوق الموردين المستقبلي: لا موردين وهميين، لا بيانات
 * شراء تجريبية كخدمة حية، لا زر شراء لا يُتمّ معاملة، ولا أي سجل أو أثر
 * مالي يُنشأ من هذه الصفحة إطلاقًا.
 */
import { Store } from "lucide-react";
import { useReturnPath } from "@/app/useReturnNavigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/primitives";

export default function Market() {
  const returnPath = useReturnPath();
  return (
    <section className="micro-page micro-market-page" data-testid="market-soon-page">
      <button className="micro-back-button" type="button" onClick={() => window.history.back()}>
        <ArrowRight aria-hidden="true" /> {returnPath === "/" ? "مشروعي الآن" : "رجوع"}
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">توسعة قادمة</span>
        <h1>السوق</h1>
        <p>سوق موردين يخدم مشروعك حين يصبح جاهزًا — حتى ذلك الحين لا نعرض ما لا يعمل.</p>
      </div>
      <section className="micro-soon-card" data-testid="market-soon-card">
        <span className="micro-soon-badge">قريبًا</span>
        <Store aria-hidden="true" />
        <div>
          <strong>سوق الموردين</strong>
          <p>
            سيجمع السوق مستقبليًا موردين ومواد بأسعار معلنة، فتطلب جاهزيّتك من التطبيق مباشرة بدل التنقل
            والسؤال اليدوي.
          </p>
          <p>
            هذه النسخة نسخة محلية تعمل على جهازك: تسجيلك للموردين والمشتريات متاح الآن من «المالية» و«العمل»،
            والسوق نفسه غير مشغّل بعد — لا موردين معروضين ولا طلبات شراء من هنا.
          </p>
        </div>
      </section>
      <p className="micro-local-truth">
        لا يُنشئ فتح هذه الصفحة أي سجل أو أثر مالي — إعلان توسعة معلن لا وظيفة وهمية.
      </p>
      <div className="micro-form-actions">
        <Button
          action="secondary"
          onClick={() => {
            window.history.back();
          }}
        >
          رجوع لمشروعي
        </Button>
      </div>
    </section>
  );
}
