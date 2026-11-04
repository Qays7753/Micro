/**
 * S10 (UNIT-030 T04 — أمر b56967d8): «نصيب المشروع من فاتورة مشتركة» — أداة
 * تخطيط نقية بأساس صريح يختاره المستخدم (نسبة معروفة أو جزء من استخدام
 * مقاس/مقدر بنفس الوحدة). الناتج تقديري بأساسه الظاهر؛ لا تسجيل مصروف من
 * هنا — التسجيل الفعلي عند صاحب المصروف بقرار منفصل (U030-AC10..13).
 */
import { ArrowRight, Receipt } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { computeInvoiceShare } from "@/application/planning";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { MoneyValue } from "@/components/presentation/DisplayValue";

import { Button } from "@/components/primitives";
import type { InvoiceShareResult } from "@micro-domain/planning/index.js";

export default function InvoiceShare() {
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const [billTotalMinor, setBillTotalMinor] = useState<number | null>(null);
  const [billDescription, setBillDescription] = useState("");
  const [method, setMethod] = useState<"percent" | "usage">("percent");
  const [percentValue, setPercentValue] = useState<number | null>(null);
  const [projectUsage, setProjectUsage] = useState<number | null>(null);
  const [totalUsage, setTotalUsage] = useState<number | null>(null);
  const [result, setResult] = useState<InvoiceShareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function calculate() {
    if (billTotalMinor === null) {
      setError("أدخل قيمة الفاتورة — الحقل الفارغ غير معروف ولا يُحسب صفرًا.");
      setResult(null);
      return;
    }
    if (method === "percent") {
      if (percentValue === null) {
        setError("أدخل نسبة المشروع من الفاتورة بين 0 و100.");
        setResult(null);
        return;
      }
      /* R2-F4: الحقل يحمل percentCenti مباشرة (kind="percentage") — لا
       * تحويل تقريبي؛ الدقة أصلية بالبناء. */
      const outcome = computeInvoiceShare({
        method: "percent",
        billTotalMinor,
        percentCenti: percentValue,
      });
      if (!outcome.ok) {
        setError(outcome.message);
        setResult(null);
        return;
      }
      setError(null);
      setResult(outcome.value);
      return;
    }
    if (projectUsage === null || totalUsage === null) {
      setError("أدخل استخدام المشروع وإجمالي الاستخدام بالمقياس نفسه.");
      setResult(null);
      return;
    }
    const outcome = computeInvoiceShare({
      method: "usage",
      billTotalMinor,
      projectUsage,
      totalUsage,
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
        <h1>نصيب المشروع من فاتورة مشتركة</h1>
        <p>مثل فاتورة كهرباء البيت التي يستخدم جزءًا منها المشروع — نصيب تقديري بأساس واضح.</p>
      </div>

      <section className="micro-decision-card" aria-label="قاعدة الأداة">
        <span>قاعدة هذه الأداة</span>
        <strong>هذا نصيب تقديري للتخطيط. لا يُسجل منه أي مصروف.</strong>
        <p>تسجيل المصروف الفعلي قرار منفصل عند صاحبه — وهنا لا يُخصم شيء ولا يُكرر أي مبلغ.</p>
      </section>

      <section className="micro-form-card" aria-label="مدخلات نصيب الفاتورة">
        <div className="micro-section-title">
          <Receipt aria-hidden="true" />
          <div>
            <span className="micro-overline">فاتورة وأساس معلوم</span>
            <h2>احسب نصيب المشروع التقديري</h2>
          </div>
        </div>
        <label className="micro-field">
          <span>قيمة الفاتورة (د.أ)</span>
          <EnglishNumberInput
            value={billTotalMinor}
            kind="money"
            allowEmpty
            onEmptyChange={() => setBillTotalMinor(null)}
            onNumericChange={setBillTotalMinor}
            aria-label="قيمة الفاتورة"
          />
        </label>
        <label className="micro-field">
          <span>الفاتورة تخص (وصف اختياري)</span>
          <input
            value={billDescription}
            onChange={event => setBillDescription(event.target.value)}
            placeholder="مثال: كهرباء شهر نوفمبر"
          />
        </label>
        <label className="micro-field">
          <span>كيف تريد تقدير نصيب المشروع؟</span>
          <select
            value={method}
            onChange={event => setMethod(event.target.value === "usage" ? "usage" : "percent")}
          >
            <option value="percent">أعرف النسبة</option>
            <option value="usage">أعرف الجزء من الاستخدام</option>
          </select>
        </label>
        {method === "percent" ? (
          <label className="micro-field">
            <span>نسبة المشروع من الفاتورة (٪)</span>
            <EnglishNumberInput
              value={percentValue}
              kind="percentage"
              allowEmpty
              onEmptyChange={() => setPercentValue(null)}
              onNumericChange={setPercentValue}
              aria-label="نسبة المشروع من الفاتورة"
            />
            <small>بين 0 و100 — النسبة تختارها أنت؛ لا نسبة مفترضة.</small>
          </label>
        ) : (
          <div className="micro-field-grid">
            <label className="micro-field">
              <span>استخدام المشروع</span>
              <EnglishNumberInput
                value={projectUsage}
                kind="decimal"
                allowEmpty
                onEmptyChange={() => setProjectUsage(null)}
                onNumericChange={setProjectUsage}
                aria-label="استخدام المشروع"
              />
            </label>
            <label className="micro-field">
              <span>إجمالي الاستخدام</span>
              <EnglishNumberInput
                value={totalUsage}
                kind="decimal"
                allowEmpty
                onEmptyChange={() => setTotalUsage(null)}
                onNumericChange={setTotalUsage}
                aria-label="إجمالي الاستخدام"
              />
            </label>
            <p className="micro-home-quiet">
              استخدم قياسًا أو تقديرًا يناسب الفاتورة (عدّاد، ساعات، صفحات) — بالمقياس نفسه في الحقلين.
            </p>
          </div>
        )}
        <details className="micro-decision-layer">
          <summary className="micro-decision-layer-summary">
            <span>
              <b>مساعدة: اختيار الأساس</b>
              <small>متى تناسب النسبة ومتى يناسب الاستخدام.</small>
            </span>
            <strong>افتح المساعدة</strong>
          </summary>
          <p className="micro-home-quiet">
            النسبة تناسبك إن كنت تعرف حصة المشروع تقريبًا من قبل. أساس الاستخدام أدق حين يوجد عدّاد أو وقت
            مشترك — كهرباء بعدّاد أو إنترنت بساعات. لا نستنتج الحصة من ساعات العمل وحدها؛ فالاستهلاك المختلف
            والرسوم الثابتة قد يجعلان التناسب غير مناسب. إن لم تعرف أساسًا مناسبًا يمكنك الخروج بلا نتيجة — لا
            نخمن لك رقمًا.
          </p>
        </details>
        {error ? (
          <p className="micro-field-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button action="save" onClick={calculate}>
          احسب نصيب المشروع
        </Button>
        {result ? (
          <section className="micro-cost-result" aria-live="polite">
            <span className="micro-overline">نصيب المشروع التقديري</span>
            <strong>
              <MoneyValue minor={result.shareMinor} /> <small>د.أ</small>
            </strong>
            <p>
              {result.basis.kind === "percent" ? (
                <>
                  الأساس: <bdi dir="ltr">{result.basis.percentCenti / 100}</bdi>٪ من فاتورة{" "}
                  <MoneyValue minor={result.basis.billTotalMinor} />
                </>
              ) : (
                <>
                  الأساس: استخدام المشروع <bdi dir="ltr">{result.basis.projectUsage}</bdi> من إجمالي{" "}
                  <bdi dir="ltr">{result.basis.totalUsage}</bdi> لفاتورة{" "}
                  <MoneyValue minor={result.basis.billTotalMinor} />
                </>
              )}
            </p>
            <p>
              المتبقي خارج حصة المشروع: <MoneyValue minor={result.remainingMinor} />
            </p>
            <p className="micro-cost-disclaimer">
              النتيجة تقديرية حتى لو بدت الأرقام دقيقة — تسجيل المصروف الفعلي فعل منفصل عند صاحبه، ولا يُكرر
              أي مبلغ هنا.
            </p>
          </section>
        ) : null}
      </section>
      <p className="micro-local-truth">أدوات التخطيط لا تكتب أي سجل — حسابك يبقى على هذا الجهاز.</p>
    </section>
  );
}
