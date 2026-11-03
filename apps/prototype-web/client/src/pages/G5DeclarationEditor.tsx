/**
 * UNIT-021 (P3 — أمر 2026-10-27، تنفيذ S15 بالأمر الموحد §5): التوقعات
 * النقدية اليدوية والتحليل النقدي المتقدم مؤجلة خارج الإصدار الأول قرارًا
 * معتمدًا — لا زر تصريح جديد في أي سطح، وهذا المسار يبقى مسجلًا ليرفض
 * الوصلة العميقة القديمة رفضًا صادقًا (لا إنشاء ولا بديل توصية يوحي بوجود
 * القدرة). سجلات التصريحات القديمة محفوظة بمعناها: تُقرأ من لوحة التغطية
 * والتعادل في صفحة المالية، وتصحيحها بتراجع موثق يبقى من هناك.
 */
import { ArrowRight, ShieldX } from "lucide-react";
import { useLocation } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";

export default function G5DeclarationEditor() {
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  return (
    <section className="micro-page micro-finance-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> المالية
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">قدرة مؤجلة خارج الإصدار الأول</span>
        <h1>تسجيل توقع نقدي مؤجل</h1>
      </div>
      <section className="micro-decision-card" aria-label="قرار تأجيل التوقعات النقدية">
        <ShieldX aria-hidden="true" />
        <div>
          <span>قرار نطاق معتمد</span>
          <strong>لا يُسجل توقع قبض أو دفع جديد في هذا الإطلاق.</strong>
          <p>
            هذا الرابط كان مدخل التصريح المتوقع؛ التوقعات النقدية اليدوية والسحب الاستشاري مؤجلان
            قرارًا معتمدًا ولا بديل يعيدهما. ما سُجل سابقًا محفوظ كما هو ويُقرأ مع تصحيحه الموثق من صفحة
            المالية، ومتابعة مواعيدك وحقوقك المسجلة الفعلية تبقى في «القادم».
          </p>
        </div>
      </section>
    </section>
  );
}
