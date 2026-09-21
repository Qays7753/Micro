/**
 * Wave 4.2 — P-4.2-4 (قرارات المالك F01/F05): سطح «المالية ← المزيد».
 * سطح قراءة يبقي App Shell والشريط السفلي (routeClassifier: surface — لا
 * نمط deepFlow) — دليل مداخل منظمة لا قائمة عشوائية:
 * ١) سلامة الحسابات أولًا دائمًا (حيث يُشك بالرقم — N-22)؛
 * ٢) الملخصات والتقارير (الكشف، القارئ الكامل، سجل الأحداث، سجل التصحيحات
 *    عبر الروابط العميقة القائمة ?layer= — REV-003 خيار التوافق)؛
 * ٣) الأدوات المالية المتقدمة (عدّ الصندوق)؛
 * ٤) المالك والسياسات في مواضعها المعتمدة.
 * لا يُسجَّل شيء من هذه الصفحة — كل مدخل يفتح البيت المالك بـreturnTo
 * (عقد ٢٦ قاعدة ٤). السياسات: موضعها المعتمد «ملخص الفترة» بجوار «التغطية
 * والتعادل» (F02) — تنقلها P-4.2-5؛ حتى دمجها مدخلها يفتح سطحها القائم.
 */
import {
  ArrowRight,
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  HandCoins,
  Landmark,
  ReceiptText,
  Repeat,
  RotateCcw,
  Scale,
  ShieldCheck,
  WalletMinimal,
} from "lucide-react";
import { useLocation } from "wouter";
import { withReturnTo } from "@/app/navigationContract";
import { useReturnPath } from "@/app/useReturnNavigation";

import { Button } from "@/components/primitives";

export default function FinanceMore() {
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const openFromMore = (target: string) => navigate(withReturnTo(target, "/finance/more"));

  return (
    <section className="micro-page micro-finance-more-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> {returnPath === "/" ? "مشروعي الآن" : "رجوع"}
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">ما وراء الصورة اليومية</span>
        <h1>المزيد من المالية</h1>
        <p>قراءات وتنظيم أعمق — كل رقم يفتح مصدره، ولا يُسجَّل شيء من هذه الصفحة مباشرة.</p>
      </div>

      {/* ١ — سلامة الحسابات أولًا دائمًا: حيث يُشك بالرقم (SCR-041 بمسماه الجديد N-22). */}
      <section className="micro-decision-card" aria-label="سلامة الحسابات">
        <ShieldCheck aria-hidden="true" />
        <div>
          <span>حيث يُشك بالرقم</span>
          <strong>سلامة الحسابات</strong>
          <p>يقرأ أرقامك ولا يغيّر شيئًا — النتيجة والكاش والأحداث والأمانات والمخزون والأصول والقروض.</p>
        </div>
        <Button
          action="secondary"

          onClick={() => openFromMore("/tools/integrity")}
        >
          افتح سلامة الحسابات <ArrowLeft aria-hidden="true" />
        </Button>
      </section>

      {/* ٢ — الملخصات والتقارير: روابط سياقية تفتح بيوتها بreturnTo. */}
      <section className="micro-settings-list" aria-label="ملخصات وتقارير">
        <div className="micro-section-title">
          <ReceiptText aria-hidden="true" />
          <div>
            <span className="micro-overline">قراءة أعمق</span>
            <h2>ملخصات وتقارير</h2>
          </div>
        </div>
        <article className="micro-setting-row">
          <span className="micro-setting-icon">
            <ReceiptText aria-hidden="true" />
          </span>
          <div>
            <strong>كشف الفترة</strong>
            <small>قصة فترتك ببساطة — كاش، نتيجة، أمانات، ذمم، مال المالك، وكل سطر بمصدره</small>
          </div>
          <button
            className="micro-text-action"
            type="button"
            onClick={() => openFromMore("/finance/statement")}
          >
            افتح <ArrowLeft aria-hidden="true" />
          </button>
        </article>
        <article className="micro-setting-row">
          <span className="micro-setting-icon">
            <ClipboardList aria-hidden="true" />
          </span>
          <div>
            <strong>آخر ما حدث</strong>
            <small>القارئ الكامل لكل النشاط — كل العائلات بفلاترها</small>
          </div>
          <button
            className="micro-text-action"
            type="button"
            onClick={() => openFromMore("/finance/activity")}
          >
            افتح <ArrowLeft aria-hidden="true" />
          </button>
        </article>
        <article className="micro-setting-row">
          <span className="micro-setting-icon">
            <CalendarClock aria-hidden="true" />
          </span>
          <div>
            <strong>القادم والاستحقاقات</strong>
            <small>ما يقترب موعده وما تأخر — طلبات ومدفوعات وتحصيلات والتزامات بمعنى ومصدر لكل موعد</small>
          </div>
          <button
            className="micro-text-action"
            type="button"
            onClick={() => openFromMore("/finance/upcoming")}
          >
            افتح <ArrowLeft aria-hidden="true" />
          </button>
        </article>
        {/* OPS-003 (عقد ٤١): المصاريف المتكررة — تذكير تحت سيطرة المالك بلا كتابة مالية تلقائية. */}
        <article className="micro-setting-row">
          <span className="micro-setting-icon">
            <Repeat aria-hidden="true" />
          </span>
          <div>
            <strong>المصاريف المتكررة</strong>
            <small>تذكيرات فتراتها وقراراتها — لا يُسجَّل مصروف بغير تأكيدك، والمتأخر انتباه لا دين</small>
          </div>
          <button
            className="micro-text-action"
            type="button"
            onClick={() => openFromMore("/finance/recurring")}
          >
            افتح <ArrowLeft aria-hidden="true" />
          </button>
        </article>
        <article className="micro-setting-row">
          <span className="micro-setting-icon">
            <Scale aria-hidden="true" />
          </span>
          <div>
            <strong>سجل الأحداث المالية</strong>
            <small>كل الأحداث المالية والتشغيلية المسجلة — والتصحيح من موضعه الموثق</small>
          </div>
          <button
            className="micro-text-action"
            type="button"
            onClick={() => openFromMore("/finance?layer=events")}
          >
            افتح <ArrowLeft aria-hidden="true" />
          </button>
        </article>
        <article className="micro-setting-row">
          <span className="micro-setting-icon">
            <RotateCcw aria-hidden="true" />
          </span>
          <div>
            <strong>سجل التصحيحات الموثقة</strong>
            <small>كل تراجع وتصحيح موثق بسبب — الأصل باقٍ في التاريخ</small>
          </div>
          <button
            className="micro-text-action"
            type="button"
            onClick={() => openFromMore("/finance?layer=corrections")}
          >
            افتح <ArrowLeft aria-hidden="true" />
          </button>
        </article>
      </section>

      {/* ٣ — الأدوات المالية المتقدمة. */}
      <section className="micro-settings-list" aria-label="أدوات مالية متقدمة">
        <div className="micro-section-title">
          <WalletMinimal aria-hidden="true" />
          <div>
            <span className="micro-overline">ضبط وتسوية</span>
            <h2>أدوات مالية متقدمة</h2>
          </div>
        </div>
        <article className="micro-setting-row">
          <span className="micro-setting-icon">
            <WalletMinimal aria-hidden="true" />
          </span>
          <div>
            <strong>عدّ الصندوق</strong>
            <small>طابق الدرج مع السجل — الفارق يُسجَّل تسوية موثقة لا تعديلًا صامتًا</small>
          </div>
          <button className="micro-text-action" type="button" onClick={() => openFromMore("/cash/count")}>
            افتح <ArrowLeft aria-hidden="true" />
          </button>
        </article>
      </section>

      {/* ٤ — المالك والسياسات في مواضعها المعتمدة. */}
      <section className="micro-settings-list" aria-label="المالك والسياسات">
        <div className="micro-section-title">
          <Landmark aria-hidden="true" />
          <div>
            <span className="micro-overline">قرارات المشروع طويلة المدى</span>
            <h2>المالك والسياسات</h2>
          </div>
        </div>
        <article className="micro-setting-row">
          <span className="micro-setting-icon">
            <Landmark aria-hidden="true" />
          </span>
          <div>
            <strong>مال المالك — الدفتر الموحد</strong>
            <small>رأس مالك وحقك المتبقي بحالتي دليلهما — منفصل عن ربح المشروع</small>
          </div>
          <button
            className="micro-text-action"
            type="button"
            onClick={() => openFromMore("/finance/owner-entitlement")}
          >
            افتح <ArrowLeft aria-hidden="true" />
          </button>
        </article>
        <article className="micro-setting-row">
          <span className="micro-setting-icon">
            <HandCoins aria-hidden="true" />
          </span>
          <div>
            <strong>اسحب لنفسك</strong>
            <small>سحب موجه بسياسة معلنة — ليس مصروفًا ولا خسارة</small>
          </div>
          <button
            className="micro-text-action"
            type="button"
            onClick={() => openFromMore("/finance/withdraw")}
          >
            افتح <ArrowLeft aria-hidden="true" />
          </button>
        </article>
        <article className="micro-setting-row">
          <span className="micro-setting-icon">
            <Landmark aria-hidden="true" />
          </span>
          <div>
            <strong>أدخل مالًا للمشروع</strong>
            <small>استثمار المالك النقدي — يوزَّع إلى محفظة ويظهر في الدفتر الموحد</small>
          </div>
          <button
            className="micro-text-action"
            type="button"
            onClick={() => openFromMore("/finance/new/owner_investment_cash")}
          >
            افتح <ArrowLeft aria-hidden="true" />
          </button>
        </article>
        <article className="micro-setting-row">
          <span className="micro-setting-icon">
            <Scale aria-hidden="true" />
          </span>
          <div>
            <strong>سياسات الربح والتوزيع</strong>
            <small>
              موضعها المعتمد «ملخص الفترة» بجوار «التغطية والتعادل» — سياسة لكل مرجع أو نسبة عامة بفترة نافذة
              معلنة
            </small>
          </div>
          <button
            className="micro-text-action"
            type="button"
            onClick={() => openFromMore("/finance?view=period")}
          >
            افتح <ArrowLeft aria-hidden="true" />
          </button>
        </article>
      </section>

      <div className="micro-offline-truth" role="note">
        هذه الصفحة قراءة وتنظيم — التسجيل يحدث في محرره المالك، وكل تراجع موثق بسبب.
      </div>
    </section>
  );
}
