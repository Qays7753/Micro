/**
 * UNIT-036 (P3 — أمر 2026-10-27، تنفيذ S15 بالأمر الموحد §5): الاقتراض
 * مؤجل خارج نطاق الإطلاق قرارًا صريحًا — لا زر إنشاء في أي سطح، وهذا المسار
 * يبقى مسجلًا ليرفض الوصلة العميقة القديمة رفضًا صادقًا (لا إنشاء ولا قرض
 * بديل باسم عميل أو طرف خارجي). السجلات القائمة محفوظة بمعناها وتُقرأ من
 * سطحها.
 */
import { ArrowRight, ShieldX } from "lucide-react";
import { useLocation } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";

export default function ReceivedLoanEditor() {
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  return (
    <section className="micro-page micro-loans-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> القروض
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">قدرة مؤجلة خارج الإطلاق</span>
        <h1>تسجيل الاقتراض مؤجل</h1>
      </div>
      <section className="micro-decision-card" aria-label="قرار تأجيل الاقتراض">
        <ShieldX aria-hidden="true" />
        <div>
          <span>قرار نطاق معتمد</span>
          <strong>لا يُسجل قرض جديد أخذته في هذا الإطلاق.</strong>
          <p>
            هذا الرابط كان مدخل تسجيل قرض مستلم؛ الاقتراض مؤجل قرارًا معتمدًا ولا تمويل بديل باسم
            عميل أو طرف خارجي يعيده. ما سُجل سابقًا محفوظ كما هو ويُقرأ من صفحة القروض.
          </p>
        </div>
      </section>
    </section>
  );
}
