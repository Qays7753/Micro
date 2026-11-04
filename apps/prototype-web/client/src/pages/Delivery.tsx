/**
 * UNIT-043 (تنفيذ S16 بالأمر الموحد §4): التوصيل — المقعد الرابع في الشريط
 * السفلي (NAV-01 §1: المالية، الطلبات، الرئيسية، التوصيل، السوق). إعلان
 * «قريبًا» صادق للخدمة المستقبلية: لا حجز ولا شركة ولا دفع ولا ارتباط
 * تلقائي بالطلبات؛ ولا أي سجل أو أثر مالي يُنشأ من هذه الصفحة إطلاقًا
 * (SDF-060: حالة صادقة ووصول معلن دون طلب سيارة أو أثر مالي).
 */
import { ArrowRight, Truck } from "lucide-react";
import { useLocation } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { futureServiceAnnouncements } from "@/app/futureServices";
import { Button } from "@/components/primitives";

export default function Delivery() {
  const returnPath = useReturnPath();
  /* EXE-005 (AUD-NEW-13): الزر يعد بوجهة معلنة فيتنقل إليها بالآلية المعتمدة
   * نفسها التي تستعملها بقية الأسطح — لا window.history.back() الذي يهبط
   * على صفحة عشوائية سابقة عند البدء البارد بوصلة عميقة. */
  const [, navigate] = useLocation();
  const announcement = futureServiceAnnouncements.delivery;
  return (
    <section className="micro-page micro-delivery-page" data-testid="delivery-soon-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> {returnPath === "/" ? "الرئيسية" : "رجوع"}
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">خدمة قادمة</span>
        <h1>التوصيل</h1>
        <p>خدمة Micro Delivery مستقبلية — إعلان صادق الآن، ولا نعرض ما لا يعمل.</p>
      </div>
      <section className="micro-soon-card" data-testid="delivery-soon-card">
        <span className="micro-soon-badge">قريبًا</span>
        <Truck aria-hidden="true" />
        <div>
          <strong>Micro Delivery</strong>
          <p>{announcement.body}</p>
          <p>{announcement.footer}</p>
        </div>
      </section>
      <p className="micro-local-truth">
        لا يُنشئ فتح هذه الصفحة أي سجل أو أثر مالي — إعلان خدمة معلن لا وظيفة وهمية.
      </p>
      <div className="micro-form-actions">
        <Button
          action="secondary"
          onClick={() => {
            navigate(returnPath);
          }}
        >
          رجوع للرئيسية
        </Button>
      </div>
    </section>
  );
}
