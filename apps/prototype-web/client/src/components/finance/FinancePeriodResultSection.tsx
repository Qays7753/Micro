/**
 * المجموعة ١١ (المرحلة 11-D — تفكيك المالية): قراءة نتيجة الفترة المسجلة ومصادرها — مقطع
 * عرض مستخرج من صفحة Finance.tsx حرفيًا؛ ProjectFinancialService يبقى نواة
 * قراءة المال المصدر الوحيد — لا حساب ماليًا هنا إطلاقًا، عرض فقط بنفس السلوك.
 */
import { type Dispatch, type SetStateAction } from "react";
import { formatLocalDate, formatMoneyMinor, formatMonthLabel } from "@/presentation/formatters";
import { MoneyValue, IntegerValue } from "@/components/presentation/DisplayValue";
import { RestatementNote } from "@/components/finance/RestatementNote";
import { withFrom } from "@/app/navigationContract";
import type { RecordedPeriodResult } from "@/application/finance/projectFinancialService";
import type { FinanceState } from "@/pages/Finance";

type ReadyFinanceState = Extract<FinanceState, { phase: "ready" }>;

const recordedPeriodStatusLabel = (status: ReadyFinanceState["period"]["status"]) =>
  status === "recorded_only" ? "مسجل" : status === "incomplete" ? "ناقص" : "غير متاح";
const cogsStatusLabel = (status: ReadyFinanceState["period"]["cogsStatus"]) =>
  status === "recorded" ? "من الاستهلاك" : status === "partial" ? "جزئي" : "من نسخة التكلفة";

export type FinancePeriodResultSectionProps = {
  state: ReadyFinanceState;
  period: ReadyFinanceState["period"];
  insights: ReadyFinanceState["insights"];
  appliedRange: { from: string; to: string };
  fromMonth: string;
  setFromMonth: Dispatch<SetStateAction<string>>;
  toMonth: string;
  setToMonth: Dispatch<SetStateAction<string>>;
  rangeInvalid: boolean;
  navigate: (target: string) => void;
};

export function FinancePeriodResultSection({
  state,
  period,
  insights,
  appliedRange,
  fromMonth,
  setFromMonth,
  toMonth,
  setToMonth,
  rangeInvalid,
  navigate,
}: FinancePeriodResultSectionProps) {
  return (
    <>
      <details className="micro-finance-layer">
        <summary className="micro-finance-layer-summary">
          <span>
            <b>قراءة الفترة</b>
            <small>نتيجة مسجلة ومصادرها واستبعاداتها</small>
          </span>
          <strong>افتح التفاصيل</strong>
        </summary>
        <section className="micro-period-result micro-derived-surface" data-status={period.status}>
          <div className="micro-period-heading">
            <div>
              <span className="micro-overline">قراءة تشغيلية مسجلة · ضمن فترة معلنة</span>
              <h2>نتيجة الفترة المسجلة</h2>
            </div>
            <div className="micro-period-range-fields">
              <label>
                <span>من</span>
                <input
                  type="month"
                  value={fromMonth}
                  onChange={event => setFromMonth(event.target.value)}
                  aria-label="بداية نطاق نتيجة الفترة"
                />
              </label>
              <label>
                <span>إلى</span>
                <input
                  type="month"
                  value={toMonth}
                  onChange={event => setToMonth(event.target.value)}
                  aria-label="نهاية نطاق نتيجة الفترة"
                />
              </label>
            </div>
          </div>
          {rangeInvalid ? (
            <p className="micro-field-error" role="alert">
              اختر نطاقًا يبدأ قبل نهايته؛ القراءة أدناه تبقى على آخر نطاق صحيح.
            </p>
          ) : null}
          <p className="micro-period-range-label">
            النطاق المحدد: {formatMonthLabel(appliedRange.from)} — {formatMonthLabel(appliedRange.to)}. هذا
            رقم تشغيلي مسجل من البنود المعروفة، وليس صافي ربح نهائيًا.
          </p>
          <p className="micro-period-result-value">
            <span>
              إيراد الطلبات والبيع المباشر − التكلفة المباشرة المستخدمة − المصروف التشغيلي الموزّع − الإهلاك
              والشطب المسجّلين + نتيجة التخلص وعربون محتفظ مصنَّف، ضمن الفترة المحددة فقط
            </span>
            <strong>
              {period.resultMinor === null ? "غير متاح" : <MoneyValue minor={period.resultMinor} />}
            </strong>
          </p>
          <p className="micro-period-status" data-status={period.status}>
            {recordedPeriodStatusLabel(period.status)}
          </p>
          {state.correctionsInPeriod && state.correctionsInPeriod.count > 0 ? (
            <RestatementNote
              count={state.correctionsInPeriod.count}
              netAmountMinor={state.correctionsInPeriod.netAmountMinor}
              scopeLabel="هذه الفترة"
              onOpen={() => navigate(withFrom("/finance?layer=corrections", "/finance"))}
            />
          ) : null}
          {/* F-005 + بند ٢٤ من قرارات المالك: نطاق القراءة معلن صراحة — ما يدخل
              وما لا يدخل، وكيف يُعترف بكل مصدر، والكاش غير النتيجة. */}
          <div className="micro-period-review-note" aria-label="نطاق قراءة الفترة">
            <strong>ما تشمله هذه القراءة</strong>
            <p>
              طلبات مسلَّمة بنتيجة نهائية (تُعرف إيرادها بتاريخ التسليم) + بيع مباشر نشط (يُعرف إيراده بتاريخ
              البيع وبالثمن المسجّل وقت البيع). البيع الملغى مستبعد بالكامل.
            </p>
            <p>
              القبض — من طلبات أو بيع آجل — ليس إيرادًا هنا؛ الكاش يظهر في بطاقة الكاش، وديون العملاء في «لي
              عند العملاء». رأس المال والسحوبات والأمانات ليست إيرادًا ولا مصروفًا ولا تربحًا.
            </p>
            {period.directSaleCostUnknownCount > 0 ? (
              <p role="status">
                يوجد بيع مباشر بتكلفة غير معروفة: النتيجة «غير متاح» حتى تُوثّق تكلفته — لا تُقلب المجهول
                صفرًا فيربو رقمٌ غير مؤكد.
              </p>
            ) : null}
          </div>
          {/* القرار ١٠: التقارير القديمة تقول صراحةً إن المخزون لم يكن مُدارًا — لا إخفاء ولا صفر. */}
          {period.inventoryManagedFrom === null || period.inventoryManagedFrom > period.from ? (
            <p className="micro-period-review-note" role="status">
              {period.inventoryManagedFrom === null
                ? "لم يكن المخزون مُدارًا في هذه المدة؛ لا تُقرأ من هذه الفترة أرقام مخزون."
                : `المخزون لم يكن مُدارًا قبل ${
                    formatLocalDate(period.inventoryManagedFrom) ?? period.inventoryManagedFrom
                  }؛ ما قبله في هذه الفترة لا يُحسب من حركات المخزون.`}
            </p>
          ) : null}
          <dl>
            <div>
              <dt>إيراد طلبات نهائية</dt>
              <dd>
                <PeriodMoney value={period.recognizedRevenueMinor} status={period.status} />
              </dd>
            </div>
            {/* F-005: البيع المباشر داخل نتيجة الفترة — بتاريخ البيع وبثمنه المسجّل. */}
            <div>
              <dt>إيراد بيع مباشر (بتاريخ البيع)</dt>
              <dd>
                <PeriodMoney value={period.directSaleRevenueMinor} status={period.status} />
              </dd>
            </div>
            <div>
              <dt>تكلفة بيع مباشر معروفة</dt>
              <dd>
                <PeriodMoney value={period.directSaleCostKnownMinor} status={period.status} />
              </dd>
            </div>
            <div>
              <dt>بيع مباشر بتكلفة غير معروفة</dt>
              <dd>
                {period.status === "invalid" ? (
                  <span className="micro-unknown-value">غير متاح</span>
                ) : (
                  <IntegerValue value={period.directSaleCostUnknownCount} className="micro-inline-number" />
                )}
              </dd>
            </div>
            <div>
              <dt>بيع مباشر نشط / ملغى مستبعد</dt>
              <dd>
                {period.status === "invalid" ? (
                  <span className="micro-unknown-value">غير متاح</span>
                ) : (
                  <>
                    <IntegerValue value={period.directSaleCount} className="micro-inline-number" /> /{" "}
                    <IntegerValue value={period.directSaleCancelledCount} className="micro-inline-number" />
                  </>
                )}
              </dd>
            </div>
            {/* المجموعة ٤ (عقد ٢٩): بنود مستقلة معلنة — إهلاك وشطب وتخلص وعربون مصنَّف. */}
            {period.assetDepreciationMinor !== 0 ||
            period.assetWriteOffLossMinor !== 0 ||
            period.assetDisposalResultMinor !== 0 ||
            period.retainedDepositRevenueMinor !== 0 ? (
              <>
                <div>
                  <dt>إهلاك أصول مسجّل (غير نقدي)</dt>
                  <dd>
                    <PeriodMoney value={period.assetDepreciationMinor} status={period.status} />
                  </dd>
                </div>
                <div>
                  <dt>خسارة شطب أصل (غير نقدي)</dt>
                  <dd>
                    <PeriodMoney value={period.assetWriteOffLossMinor} status={period.status} />
                  </dd>
                </div>
                <div>
                  <dt>نتيجة التخلص من أصول</dt>
                  <dd>
                    <PeriodMoney value={period.assetDisposalResultMinor} status={period.status} />
                  </dd>
                </div>
                <div>
                  <dt>عربون محتفظ به كإيراد</dt>
                  <dd>
                    <PeriodMoney value={period.retainedDepositRevenueMinor} status={period.status} />
                  </dd>
                </div>
              </>
            ) : null}
            <div>
              <dt>تكلفة مباشرة من نسخة التكلفة</dt>
              <dd>
                <PeriodMoney value={period.snapshotDirectCostMinor} status={period.status} />
              </dd>
            </div>
            <div>
              <dt>تكلفة بيع مسجلة من الاستهلاك</dt>
              <dd>
                <PeriodMoney value={period.recordedCogsMinor} status={period.status} />
              </dd>
            </div>
            <div>
              <dt>التكلفة المباشرة المستخدمة</dt>
              <dd>
                <PeriodMoney value={period.effectiveDirectCostMinor} status={period.status} />
              </dd>
            </div>
            <div>
              <dt>مصروف للمشروع</dt>
              <dd>
                <PeriodMoney value={period.projectOperatingExpenseMinor} status={period.status} />
              </dd>
            </div>
            <div>
              <dt>حصة المشروع من مصروف مشترك موزّعة</dt>
              <dd>
                <PeriodMoney value={period.sharedProjectExpenseMinor} status={period.status} />
              </dd>
            </div>
            <div>
              <dt>مصروف مشترك غير موزّع</dt>
              <dd>
                <PeriodMoney value={period.sharedUnallocatedExpenseMinor} status={period.status} />
              </dd>
            </div>
            <div>
              <dt>استهلاك عام غير موزّع</dt>
              <dd>
                <PeriodMoney value={period.unallocatedInventoryCostMinor} status={period.status} />
              </dd>
            </div>
            <div>
              <dt>هدر مخزون (منذ البداية)</dt>
              <dd>
                <PeriodMoney value={period.generalInventoryWasteMinor} status={period.status} />
              </dd>
            </div>
            {/* المجموعة ٢ (عقد ٢٨) + عقد الإغلاق العميق (العقد ١): هدر الفترة —
             * غير نقدي دومًا؛ ودخوله في نتيجة الفترة بخيار المالك عند التسجيل
             * (نعم → حدث خسارة غير نقدية مرتبط). قيمة غير معروفة تُصرَّح بها
             * ولا تُعرض 0.00 واثقة. */}
            {state.periodWaste && state.periodWaste.count > 0 ? (
              <div>
                <dt>هدر مخزون هذه الفترة</dt>
                <dd>
                  {state.periodWaste.valueMinor === 0 && state.periodWaste.hasUnknownCost ? (
                    <span className="micro-unknown-value">قيمة الهدر غير معروفة بعد</span>
                  ) : (
                    <>
                      <PeriodMoney value={state.periodWaste.valueMinor} status={period.status} />
                      {state.periodWaste.hasUnknownCost ? <small> · منها جزء بتكلفة غير معروفة</small> : null}
                    </>
                  )}{" "}
                  — غير نقدي: لا يخرج كاش، ودخوله في النتيجة بخيارك لحظة تسجيل الهدر.
                </dd>
              </div>
            ) : null}
            <div>
              <dt>مصروف قديم بلا سياق</dt>
              <dd>
                <PeriodMoney value={period.legacyUnclassifiedExpenseMinor} status={period.status} />
              </dd>
            </div>
            <div>
              <dt>طلبات داخلة / مستبعدة</dt>
              <dd>
                {period.status === "invalid" ? (
                  <span className="micro-unknown-value">غير متاح</span>
                ) : (
                  <>
                    <IntegerValue value={period.finalOrderCount} className="micro-inline-number" /> /{" "}
                    <IntegerValue value={period.excludedOrderCount} className="micro-inline-number" />
                  </>
                )}
              </dd>
            </div>
          </dl>
          <div className="micro-period-review-note">
            <strong>مصدر التكلفة وحالة تكلفة البيع</strong>
            <p>
              {cogsStatusLabel(period.cogsStatus)} · من نسخة التكلفة:{" "}
              <IntegerValue value={period.cogsMissingOrderCount} className="micro-inline-number" />
            </p>
            {period.cogsReasons.length > 0 ? (
              <ul>
                {period.cogsReasons.map(reason => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
          </div>
          {period.reasons.length > 0 ? (
            <div className="micro-period-review-note">
              <strong>ما يحتاج مراجعة قبل الاعتماد على نتيجة أدق</strong>
              <ul>
                {period.reasons.map(reason => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {/* و٧ (F-077): طبقة «المؤشرات» داخل قراءة الفترة — هامش أسماء الأعمال
              وتكوين التكلفة والتغطية والتعادل والسيولة، قيم مسجلة بلا سرد. */}
          <details className="micro-finance-layer micro-insights-layer">
            <summary className="micro-finance-layer-summary">
              <span>
                <b>المؤشرات</b>
                <small>هامش الأعمال · تكوين التكلفة · التغطية والتعادل · السيولة المسجلة</small>
              </span>
              <strong>افتح المؤشرات</strong>
            </summary>
            <section className="micro-period-result micro-derived-surface" aria-label="مؤشرات الفترة">
              <div className="micro-period-review-note">
                <strong>هامش أسماء الأعمال</strong>
                {insights.workNames.length === 0 ? (
                  <p className="micro-insights-empty">— لا أعمال نهائية في الفترة</p>
                ) : (
                  <ul className="micro-insights-work-list">
                    {insights.workNames.map(work => (
                      <li key={work.itemName}>
                        <span className="micro-insights-work-name">{work.itemName}</span>
                        <small>
                          طلبات <IntegerValue value={work.finalOrderCount} className="micro-inline-number" />{" "}
                          · إيراد{" "}
                          <MoneyValue minor={work.recognizedRevenueMinor} className="micro-inline-number" /> ·
                          تكلفة مباشرة{" "}
                          <MoneyValue
                            minor={work.recognizedDirectCostMinor}
                            className="micro-inline-number"
                          />
                        </small>
                        <b>
                          هامش <MoneyValue minor={work.directMarginMinor} className="micro-inline-number" />
                        </b>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="micro-period-review-note">
                <strong>تكوين التكلفة المباشرة</strong>
                <dl className="micro-insights-grid">
                  <div>
                    <dt>مواد</dt>
                    <dd>
                      <MoneyValue minor={insights.costComposition.materialMinor} />
                    </dd>
                  </div>
                  <div>
                    <dt>وقت</dt>
                    <dd>
                      <MoneyValue minor={insights.costComposition.timeMinor} />
                    </dd>
                  </div>
                  <div>
                    <dt>تغليف</dt>
                    <dd>
                      <MoneyValue minor={insights.costComposition.packagingMinor} />
                    </dd>
                  </div>
                  <div>
                    <dt>توصيل</dt>
                    <dd>
                      <MoneyValue minor={insights.costComposition.deliveryMinor} />
                    </dd>
                  </div>
                  <div>
                    <dt>هدر</dt>
                    <dd>
                      <MoneyValue minor={insights.costComposition.wasteMinor} />
                    </dd>
                  </div>
                  <div>
                    <dt>مصروف تشغيلي</dt>
                    <dd>
                      <MoneyValue minor={insights.costComposition.operatingExpenseMinor} />
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="micro-period-review-note">
                <strong>التغطية والتعادل المسجلان</strong>
                <dl className="micro-insights-grid">
                  <div>
                    <dt>المصروف الثابت المسجل</dt>
                    <dd>
                      <MoneyValue minor={insights.coverage.fixedExpenseMinor} />
                    </dd>
                  </div>
                  <div>
                    <dt>الكمية المسلّمة النهائية</dt>
                    <dd>
                      <IntegerValue value={insights.coverage.finalDeliveredQuantity} />
                    </dd>
                  </div>
                  <div>
                    <dt>الهامش المباشر</dt>
                    <dd>
                      <MoneyValue minor={insights.coverage.directMarginMinor} />
                    </dd>
                  </div>
                  <div>
                    <dt>وحدات التعادل</dt>
                    <dd>
                      {insights.coverage.breakEvenUnits === null ? (
                        <span className="micro-insights-unknown">—</span>
                      ) : (
                        <IntegerValue value={insights.coverage.breakEvenUnits} />
                      )}
                    </dd>
                  </div>
                </dl>
                {insights.coverage.status !== "recorded_only" && insights.coverage.reasons.length > 0 ? (
                  <ul className="micro-insights-reasons">
                    {insights.coverage.reasons.map(reason => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="micro-period-review-note">
                <strong>السيولة المسجلة</strong>
                <dl className="micro-insights-grid">
                  <div>
                    <dt>الكاش المسجل</dt>
                    <dd>
                      <MoneyValue minor={insights.liquidity.recordedCashMinor} />
                    </dd>
                  </div>
                  <div>
                    <dt>ديون العملاء</dt>
                    <dd>
                      <MoneyValue minor={insights.liquidity.customerReceivablesMinor} />
                    </dd>
                  </div>
                  <div>
                    <dt>التزامات الموردين</dt>
                    <dd>
                      <MoneyValue minor={insights.liquidity.supplierPayablesMinor} />
                    </dd>
                  </div>
                  <div>
                    <dt>التغطية بعد الالتزامات</dt>
                    <dd>
                      <MoneyValue minor={insights.liquidity.cashCoverageAfterLiabilitiesMinor} />
                    </dd>
                  </div>
                  <div>
                    <dt>أمانات محتجزة (ليست مالكًا)</dt>
                    <dd>
                      <MoneyValue minor={insights.liquidity.amanahHeldMinor} />
                    </dd>
                  </div>
                </dl>
                {insights.liquidity.amanahNotice ? (
                  <p className="micro-period-review-note" role="status">
                    {insights.liquidity.amanahNotice}
                  </p>
                ) : null}
              </div>
            </section>
          </details>
        </section>
      </details>
    </>
  );
}

function PeriodMoney({ value, status }: { value: number; status: RecordedPeriodResult["status"] }) {
  return status === "invalid" ? (
    <span className="micro-unknown-value">غير متاح</span>
  ) : (
    <MoneyValue minor={value} />
  );
}
