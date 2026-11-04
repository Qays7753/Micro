/**
 * UNIT-035 (P3 — أمر 2026-10-27، تنفيذ S15 بالأمر الموحد §5): إنشاء الإقراض
 * ملغى من نطاق المنتج قرارًا صريحًا — لا زر إنشاء في أي سطح، وهذا المسار
 * يبقى مسجلًا ليرفض الوصلة العميقة القديمة رفضًا صادقًا (لا إنشاء ولا إعلان
 * «قريبًا» لقدرة ملغاة). السجلات القائمة محفوظة بمعناها وتُقرأ من سطحها،
 * وتسجيل دفعة على قرض قائم صيانة للتاريخ لا إنشاء جديد.
 */
import { ArrowRight, ShieldX } from "lucide-react";
import { useLocation } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";

export default function LoanEditor() {
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  return (
    <section className="micro-page micro-loans-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> القروض
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">قدرة ملغاة من نطاق المنتج</span>
        <h1>إنشاء الإقراض ملغى</h1>
      </div>
      <section className="micro-decision-card" aria-label="قرار إلغاء الإقراض">
        <ShieldX aria-hidden="true" />
        <div>
          <span>قرار نطاق معتمد</span>
          <strong>لا يُنشأ إقراض جديد في هذا الإطلاق.</strong>
          <p>
            هذا الرابط كان مدخل تسجيل قرض؛ الإنشاء ملغى قرارًا معتمدًا ولا بديل تمويل أو أمانة أو سحب يعيده.
            قروضك المسجلة سابقًا محفوظة كما هي وتُقرأ من صفحة القروض، وتسجيل دفعة على قرض قائم يبقى من سجله
            نفسه.
          </p>
        </div>
      </section>
    </section>
  );
}
