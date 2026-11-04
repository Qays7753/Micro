/**
 * S10 (UNIT-030 T02 — أمر b56967d8): «قيمة ساعة عملك» — أداة تخطيط نقية.
 * مقابل الشهر ÷ (الأيام × الساعات المنتجة) = قيمة ساعة تقديرية. لا تثبت
 * سعر ساعة في أي إعداد ولا تغير تكلفة طلب؛ المجهول يظل مجهولًا والصفر
 * مقصود فقط (U030-AC03/AC04). لا حفظ لأدوات T02–T05 (عقد UNIT-032).
 */
import { ArrowRight, Clock } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { computeHourValue } from "@/application/planning";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { MoneyValue } from "@/components/presentation/DisplayValue";

import { Button } from "@/components/primitives";

export default function HourValue() {
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const [compensationMinor, setCompensationMinor] = useState<number | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [hoursPerDay, setHoursPerDay] = useState<number | null>(null);
  const [result, setResult] = useState<{ hourValueMinor: number; monthlyHours: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function calculate() {
    /* الفراغ يظل مجهولًا: لا تحويل للفارغ إلى صفر قبل الحساب (U030-AC04). */
    if (compensationMinor === null || days === null || hoursPerDay === null) {
      setError("أكمل الحقول الثلاثة أولًا — الحقل الفارغ غير معروف ولا يُحسب صفرًا.");
      setResult(null);
      return;
    }
    const outcome = computeHourValue({
      monthlyCompensationMinor: compensationMinor,
      workDaysPerMonth: days,
      productiveHoursPerDay: hoursPerDay,
    });
    if (!outcome.ok) {
      setError(outcome.message);
      setResult(null);
      return;
    }
    setError(null);
    setResult(outcome.value);
  }

  return (
    <section className="micro-page micro-tools-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> أدوات المشروع
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">أداة تخطيط مستقلة</span>
        <h1>قيمة ساعة عملك</h1>
        <p>كم تساوي ساعة عملك المنتجة تقديريًا — مقابل وقتك فقط، بلا أي تسجيل.</p>
      </div>

      <section className="micro-decision-card" aria-label="قاعدة الأداة">
        <span>قاعدة هذه الأداة</span>
        <strong>هذا حساب تقديري لوقتك. لا يُدفع منه أجر ولا يُسجل مصروف.</strong>
        <p>النتيجة تساعدك في التسعير؛ سجل أي مصروف فعلي من مساره عند صاحبه.</p>
      </section>

      <section className="micro-form-card" aria-label="مدخلات قيمة الساعة">
        <div className="micro-section-title">
          <Clock aria-hidden="true" />
          <div>
            <span className="micro-overline">ثلاثة مدخلات</span>
            <h2>احسب قيمة ساعة عملك</h2>
          </div>
        </div>
        <label className="micro-field">
          <span>كم تريد مقابل عملك في الشهر؟ (د.أ)</span>
          <EnglishNumberInput
            value={compensationMinor}
            kind="money"
            allowEmpty
            onEmptyChange={() => setCompensationMinor(null)}
            onNumericChange={setCompensationMinor}
            aria-label="مقابل عملك في الشهر"
          />
        </label>
        <div className="micro-field-grid">
          <label className="micro-field">
            <span>كم يومًا تعمل في الشهر؟</span>
            <EnglishNumberInput
              value={days}
              kind="integer"
              allowEmpty
              onEmptyChange={() => setDays(null)}
              onNumericChange={setDays}
              aria-label="أيام العمل في الشهر"
            />
          </label>
          <label className="micro-field">
            <span>كم ساعة عمل منتجًا في اليوم؟</span>
            <EnglishNumberInput
              value={hoursPerDay}
              kind="decimal"
              allowEmpty
              onEmptyChange={() => setHoursPerDay(null)}
              onNumericChange={setHoursPerDay}
              aria-label="ساعات العمل المنتجة يوميًا"
            />
          </label>
        </div>
        <details className="micro-decision-layer">
          <summary className="micro-decision-layer-summary">
            <span>
              <b>مساعدة: وقت العمل المنتج</b>
              <small>لماذا لا تُحسب كل ساعات يومك.</small>
            </span>
            <strong>افتح المساعدة</strong>
          </summary>
          <p className="micro-home-quiet">
            الساعات المنتجة هي ما تستطيع بيعه أو الإنتاج فيه فعلًا؛ وقت التسويق والإدارة والمواصلات لا يدخل
            هنا — لكنه ما زال يحتاج تغطية في سعر البيع النهائي، فلا تجعل قيمة الساعة آخر كلمة في التسعير. لا
            نفترض نسبة وقت منتج؛ أنت تحددها بأرقامك.
          </p>
        </details>
        {error ? (
          <p className="micro-field-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button action="save" onClick={calculate}>
          احسب قيمة الساعة
        </Button>
        {result ? (
          <section className="micro-cost-result" aria-live="polite">
            <span className="micro-overline">قيمة ساعة عملك التقديرية</span>
            <strong>
              <MoneyValue minor={result.hourValueMinor} /> <small>د.أ للساعة</small>
            </strong>
            <p>
              مقابل وقتك فقط؛ لا يشمل المواد والمصاريف الأخرى · ساعاتك المنتجة في الشهر:{" "}
              <bdi dir="ltr">{result.monthlyHours}</bdi>
            </p>
            {result.hourValueMinor === 0 ? (
              <p className="micro-cost-disclaimer">
                المقابل صفر — قيمة الساعة صفر بمعنى صفر مقصود، لا مجهول.
              </p>
            ) : null}
            <p className="micro-cost-disclaimer">
              هذا حساب تقديري. لا يُسجل منه أجر ولا مصروف ولا يغيّر أي إعداد.
            </p>
          </section>
        ) : null}
      </section>
      <p className="micro-local-truth">أدوات التخطيط لا تكتب أي سجل — حسابك يبقى على هذا الجهاز.</p>
    </section>
  );
}
