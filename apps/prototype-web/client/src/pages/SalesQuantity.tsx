/**
 * S10 (UNIT-030 T03 — أمر b56967d8): «كم أحتاج أن أبيع؟» — أداة تخطيط نقية.
 * مساهمة الوحدة تقسم مصاريف الفترة (مع الهدف إن فُعل) وتقرب الكمية لأعلى
 * للوحدة غير القابلة للتجزئة؛ المساهمة غير الموجبة نتيجة صادقة غير قابلة
 * للحساب لا عدد مضلل (U030-AC05..09). لا حفظ (عقد UNIT-032).
 */
import { ArrowRight, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { computeSalesQuantity } from "@/application/planning";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { MoneyValue } from "@/components/presentation/DisplayValue";

import { Button } from "@/components/primitives";
import type { SalesQuantityResult } from "@micro-domain/planning/index.js";

export default function SalesQuantity() {
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const [periodLabel, setPeriodLabel] = useState("");
  const [priceMinor, setPriceMinor] = useState<number | null>(null);
  const [unitCostMinor, setUnitCostMinor] = useState<number | null>(null);
  const [fixedMinor, setFixedMinor] = useState<number | null>(null);
  const [targetEnabled, setTargetEnabled] = useState(false);
  const [targetMinor, setTargetMinor] = useState<number | null>(null);
  const [result, setResult] = useState<SalesQuantityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function calculate() {
    if (!periodLabel.trim()) {
      setError("حدد الفترة التي تخصها الأرقام — شهر أو فترة تكتبها.");
      setResult(null);
      return;
    }
    if (priceMinor === null || unitCostMinor === null || fixedMinor === null) {
      setError("أكمل السعر وتكلفة الوحدة ومصاريف الفترة — الحقل الفارغ غير معروف ولا يُحسب صفرًا.");
      setResult(null);
      return;
    }
    if (targetEnabled && targetMinor === null) {
      setError("أدخل الربح الإضافي المستهدف أو أطفئ الخيار.");
      setResult(null);
      return;
    }
    const outcome = computeSalesQuantity({
      periodLabel: periodLabel.trim(),
      unitSellingPriceMinor: priceMinor,
      unitVariableCostMinor: unitCostMinor,
      fixedExpensesMinor: fixedMinor,
      targetProfitMinor: targetEnabled && targetMinor !== null ? targetMinor : null,
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
        <h1>كم أحتاج أن أبيع؟</h1>
        <p>كم وحدة تغطي مصاريف فترتك — وكم تحقق هدفًا إضافيًا إن أردت.</p>
      </div>

      <section className="micro-decision-card" aria-label="قاعدة الأداة">
        <span>قاعدة هذه الأداة</span>
        <strong>هذا عدد تقديري لتغطية مدخلاتك — ليس وعدًا بطلب السوق.</strong>
        <p>العدد يغطي ما أدخلته فقط؛ لا يضمن بيعًا ولا توفر كاش ولا يُسجل أي شيء.</p>
      </section>

      <section className="micro-form-card" aria-label="مدخلات كمية البيع">
        <div className="micro-section-title">
          <TrendingUp aria-hidden="true" />
          <div>
            <span className="micro-overline">الفترة والوحدة</span>
            <h2>احسب كمية البيع المطلوبة</h2>
          </div>
        </div>
        <label className="micro-field">
          <span>الفترة</span>
          <input
            value={periodLabel}
            onChange={event => setPeriodLabel(event.target.value)}
            placeholder="مثال: شهر نوفمبر"
          />
        </label>
        <div className="micro-field-grid">
          <label className="micro-field">
            <span>سعر بيع الوحدة (د.أ)</span>
            <EnglishNumberInput
              value={priceMinor}
              kind="money"
              allowEmpty
              onEmptyChange={() => setPriceMinor(null)}
              onNumericChange={setPriceMinor}
              aria-label="سعر بيع الوحدة"
            />
          </label>
          <label className="micro-field">
            <span>تكلفة كل وحدة تُباع (د.أ)</span>
            <EnglishNumberInput
              value={unitCostMinor}
              kind="money"
              allowEmpty
              onEmptyChange={() => setUnitCostMinor(null)}
              onNumericChange={setUnitCostMinor}
              aria-label="تكلفة كل وحدة"
            />
          </label>
        </div>
        <label className="micro-field">
          <span>مصاريف الفترة الثابتة (د.أ)</span>
          <EnglishNumberInput
            value={fixedMinor}
            kind="money"
            allowEmpty
            onEmptyChange={() => setFixedMinor(null)}
            onNumericChange={setFixedMinor}
            aria-label="مصاريف الفترة الثابتة"
          />
          <small>ما تدفعه في الفترة مرة واحدة بغض النظر عن عدد المبيعات — أدخل 0 إن لم يكن.</small>
        </label>
        <label className="micro-field">
          <span>هل تريد ربحًا إضافيًا فوق التغطية؟</span>
          <select
            value={targetEnabled ? "yes" : "no"}
            onChange={event => setTargetEnabled(event.target.value === "yes")}
          >
            <option value="no">لا — التغطية تكفي</option>
            <option value="yes">نعم — أضف هدفًا</option>
          </select>
        </label>
        {targetEnabled ? (
          <label className="micro-field">
            <span>الربح الإضافي المستهدف في الفترة (د.أ)</span>
            <EnglishNumberInput
              value={targetMinor}
              kind="money"
              allowEmpty
              onEmptyChange={() => setTargetMinor(null)}
              onNumericChange={setTargetMinor}
              aria-label="الربح الإضافي المستهدف"
            />
            <small>بعد التكاليف المدرجة؛ لا يعاد فيه حساب مقابل عمل محسوب سابقًا.</small>
          </label>
        ) : null}
        <details className="micro-decision-layer">
          <summary className="micro-decision-layer-summary">
            <span>
              <b>مساعدة: ماذا يدخل في تكلفة الوحدة؟</b>
              <small>حتى لا تُحتسب حصة المصاريف الثابتة مرتين.</small>
            </span>
            <strong>افتح المساعدة</strong>
          </summary>
          <p className="micro-home-quiet">
            تكلفة الوحدة هنا هي ما يزيد مع كل بيع: المواد والتغليف والعمولة وما يشبهها. المصاريف التي تدفعها
            مرة واحدة في الفترة (إيجار، اشتراك إنترنت) تدخل في خانة «مصاريف الفترة الثابتة» وحدها — فإن أدخلت
            حصة منها في تكلفة الوحدة أيضًا فستُحتسب مرتين.
          </p>
        </details>
        {error ? (
          <p className="micro-field-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button action="save" onClick={calculate}>
          احسب الكمية المطلوبة
        </Button>
        {result ? (
          result.computable ? (
            <section className="micro-cost-result" aria-live="polite">
              <span className="micro-overline">الكمية المطلوبة في {periodLabel.trim()}</span>
              <strong>
                <bdi dir="ltr">{result.coverageQuantity}</bdi> <small>وحدة للتغطية</small>
                {result.targetQuantity !== null ? (
                  <>
                    {" · "}
                    <bdi dir="ltr">{result.targetQuantity}</bdi> <small>لتحقيق الهدف</small>
                  </>
                ) : null}
              </strong>
              <p>
                مساهمة كل وحدة: <MoneyValue minor={result.unitContributionMinor} /> · النتيجة تقديرية وتغطي
                مدخلاتك فقط.
              </p>
              {result.coverageRoundedUp || result.targetRoundedUp ? (
                <p className="micro-cost-disclaimer">قُرّبت الكمية لأعلى للوحدة غير القابلة للتجزئة.</p>
              ) : null}
              <p className="micro-cost-disclaimer">العدد لا يضمن طلب السوق ولا توفر الكاش ولا يسجل أي بيع.</p>
            </section>
          ) : (
            <p className="micro-field-error" role="alert">
              بهذا السعر، كل بيع لا يساهم في تغطية مصاريف الفترة. عدّل السعر أو التكلفة — لا عدد مضللًا هنا.
            </p>
          )
        ) : null}
      </section>
      <p className="micro-local-truth">أدوات التخطيط لا تكتب أي سجل — حسابك يبقى على هذا الجهاز.</p>
    </section>
  );
}
