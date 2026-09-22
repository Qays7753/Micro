/**
 * المجموعة ١١ (المرحلة 11-A — تفكيك الكتالوج): قراءة المراجع: الهوامش المسجلة والسياسات وأدلة القرار — مقطع عرض مستخرج
 * من صفحة Catalog.tsx حرفيًا؛ الصفحة تبقى الموزّع الوحيد (تملك الحالة
 * والمعالجات وحارس التغييرات غير المحفوظة) وتمرّر كل شيء خصائصِ أدناه.
 * لا منطق ماليًا هنا ولا تخزين ولا مسارات — عرض فقط بنفس السلوك.
 *
 * Wave 4.2 — P-4.2-5 (F02/T3): الكتالوج بلا كتابة سياسات نهائيًا — السياسات
 * تُعرض قراءةً (النتيجة والمعاينة) مع رابط سياقي واحد إلى سطحها المالي
 * («ملخص الفترة» بجوار «التغطية والتعادل»)؛ أزرار النسخ والإيقاف انتقلت
 * مع السطح إلى FinancePoliciesSection.
 */
import { ArrowLeft, ArchiveX } from "lucide-react";
import { withReturnTo } from "@/app/navigationContract";
import { formatLocalDateLong, formatMoneyMinor, formatMoneyWithUnit } from "@/presentation/formatters";
import {
  catalogAllocationKindLabel,
  catalogAllocationStatusLabel,
  catalogPerUnitRateLabel,
  quantityLabel,
} from "@/presentation/catalogPresentation";
import type { CatalogItem, MeasurementUnit } from "@micro-domain/catalog/index.js";
import type { RecurringWorkReading, RecurringWorkReadings } from "@/application/finance/recurringWorkService";

import { Button } from "@/components/primitives";
export type CatalogReadingsSectionProps = {
  readings: RecurringWorkReadings | null;
  items: readonly CatalogItem[];
  units: readonly MeasurementUnit[];
  deactivate: (id: string) => Promise<void>;
  /* P-4.2-5: رابط سياقي واحد إلى سطح السياسات المالي — لا كتابة من الكتالوج. */
  navigate: (target: string) => void;
};

export function CatalogReadingsSection({
  readings,
  items,
  units,
  deactivate,
  navigate,
}: CatalogReadingsSectionProps) {
  return (
    <details className="micro-decision-layer">
      <summary className="micro-decision-layer-summary">
        <span>
          <b>قراءة المراجع</b>
          <small>الهامش المسجل والأدلة والسياسات عند الحاجة.</small>
        </span>
        <strong>افتح التفاصيل</strong>
      </summary>
      <section className="micro-form-card">
        <div className="micro-page-heading">
          <span className="micro-overline">المراجع المسجلة</span>
          <h2>أعمال متكررة وقراءة القرار</h2>
          <p>
            {readings
              ? `الفترة المعلنة: ${formatLocalDateLong(readings.from) ?? readings.from} → ${formatLocalDateLong(readings.to) ?? readings.to}`
              : "جارٍ تحميل القراءة المحلية…"}
          </p>
        </div>
        {readings && readings.unlinkedDeliveredOrders.length > 0 ? (
          /* FIN-006 (WS-177 — Wave 5): الاستبعاد الظاهر — الطلبات المسلّمة
              بلا مرجع قابل للربط تُعرض بأسمائها التاريخية كما سُجلت؛ لا
              تُدمج في أي صف ولا تختفي، وليست صفرًا مؤكدًا. */
          <p className="micro-warning-copy" role="status">
            طلبات مسلّمة في الفترة بلا مرجع قابل للربط ({readings.unlinkedDeliveredOrders.length}):
            {readings.unlinkedDeliveredOrders
              .slice(0, 4)
              .map(
                order =>
                  `${order.itemName} — ${order.resultStatus === "final" ? "نهائي" : order.resultStatus === "estimated" ? "تقديري" : "غير مكتمل"}`,
              )
              .join(" · ")}
            {readings.unlinkedDeliveredOrders.length > 4 ? " وغيرها" : ""} — مستبعدة من كل الصفوف؛ لا يدمجها
            النظام باسم عرض ولا يخفيها.
          </p>
        ) : null}
        {items.length ? (
          <div className="micro-list">
            {items.map(item => {
              const reading = readings?.items.find(entry => entry.catalogItemId === item.id);
              const organizedUnit = item.unitId ? units.find(unit => unit.id === item.unitId) : null;
              const allocation = reading?.allocation ?? null;
              return (
                <article key={item.id} className="micro-list-item">
                  <div>
                    <strong>{item.name}</strong>
                    <p>
                      {item.kind === "product" ? "منتج" : "خدمة"}
                      {item.unitLabel ? ` · ${item.unitLabel}` : ""}
                      {organizedUnit ? ` · ${organizedUnit.nameAr}` : ""}
                      {item.active ? "" : " · موقوف للطلبات الجديدة"}
                    </p>
                    {reading?.directStatus === "recorded" ? (
                      <p>
                        <strong>
                          الهامش المباشر المسجل: {formatMoneyWithUnit(reading.directMarginMinor ?? 0)}
                        </strong>{" "}
                        · {reading.finalOrderCount} طلب نهائي · كمية {reading.deliveredQuantity}
                      </p>
                    ) : (
                      <p>
                        لا توجد طلبات نهائية مرتبطة بهذا المرجع في الفترة؛ لا تعرض القراءة صفرًا بدل دليل
                        ناقص.
                      </p>
                    )}
                    {reading && reading.estimatedOrderCount > 0 ? (
                      /* FIN-006 (WS-177 — Wave 5): الفصل الكنوني — التقديرية
                          مرئية بقيمها المسجلة منفصلة عن الرقم الأساسي. */
                      <p>
                        تقديرية منفصلة: {reading.estimatedOrderCount} طلبًا · إيراد مسجل{" "}
                        {formatMoneyWithUnit(reading.estimatedRevenueMinor ?? 0)} · هامش تقديري{" "}
                        {formatMoneyWithUnit(reading.estimatedMarginMinor ?? 0)} — لا تدخل الرقم النهائي.
                      </p>
                    ) : null}
                    {reading && reading.incompleteOrderCount > 0 ? (
                      /* FIN-006: غير المكتملة (ومنها المقفلة للمراجة) عَدّ مرئي
                          بلا قيم — لا تُدمج ولا تُصفر. */
                      <p className="micro-warning-copy">
                        {reading.incompleteOrderCount} طلبًا غير مكتمل أو مقفلًا للمراجعة — مستبعد من الرقم
                        حتى تكتمل نتيجته الموثقة.
                      </p>
                    ) : null}
                    {reading ? (
                      <>
                        <p>
                          المادة:{" "}
                          {reading.material.actualMaterialMinor === null
                            ? "غير مسجلة بعد"
                            : formatMoneyWithUnit(reading.material.actualMaterialMinor)}
                          {reading.material.varianceMinor === null
                            ? ""
                            : ` · الفرق ${formatMoneyWithUnit(reading.material.varianceMinor)}`}{" "}
                          · {reading.material.recordedOrderCount} مسجل /{" "}
                          {reading.material.notRecordedOrderCount} بلا سجل
                        </p>
                        <p>
                          الوقت:{" "}
                          {reading.time.actualMinutes === null
                            ? "غير مسجل بعد"
                            : `${reading.time.actualMinutes} دقيقة`}
                          {reading.time.varianceMinutes === null
                            ? ""
                            : ` · الفرق ${reading.time.varianceMinutes} دقيقة`}{" "}
                          · {reading.time.recordedOrderCount} مسجل / {reading.time.notRecordedOrderCount} بلا
                          سجل
                        </p>
                        <p>
                          الهدر المرتبط بهذا المرجع:{" "}
                          {formatMoneyWithUnit(
                            reading.waste.orderWasteMinor +
                              reading.waste.catalogItemWasteMinor +
                              reading.waste.catalogTemplateWasteMinor,
                          )}{" "}
                          · الهدر العام/غير الموزع منفصل:{" "}
                          {formatMoneyWithUnit(
                            reading.waste.generalProjectWasteMinor + reading.waste.unallocatedWasteMinor,
                          )}
                        </p>
                        {allocation ? (
                          <>
                            <p>
                              <strong>
                                الربح بعد التوزيع:{" "}
                                {allocation.resultMinor === null
                                  ? "غير مكتمل"
                                  : formatMoneyWithUnit(allocation.resultMinor)}
                              </strong>{" "}
                              · {catalogAllocationKindLabel(allocation.kind)} ·{" "}
                              {catalogAllocationStatusLabel(allocation.status)}
                            </p>
                            <p>{allocation.calculationNote}</p>
                          </>
                        ) : (
                          <p>لا توجد سياسة توزيع فعالة تغطي الفترة؛ الهامش المباشر هو القراءة الأساسية.</p>
                        )}
                        {reading.reasons.map(reason => (
                          <p className="micro-warning-copy" key={reason}>
                            {reason}
                          </p>
                        ))}
                        {reading.policies.length ? (
                          <details className="micro-inline-disclosure">
                            <summary>سياسات هذا المرجع</summary>
                            {reading.policies.map(policy => (
                              <p key={policy.id}>
                                {catalogAllocationKindLabel(policy.kind)} ·{" "}
                                {policy.status === "active" ? "فعالة" : "غير فعالة"} ·{" "}
                                {formatLocalDateLong(policy.periodFrom) ?? policy.periodFrom} →{" "}
                                {formatLocalDateLong(policy.periodTo) ?? policy.periodTo}
                                {policy.kind === "per_output_unit" && policy.rateMinorPerWholeUnit !== null
                                  ? ` · ${formatMoneyWithUnit(policy.rateMinorPerWholeUnit)} لكل 1.000 وحدة`
                                  : ""}{" "}
                                · {policy.source} · السبب: {policy.reason} · {policy.note}
                                {/* P-4.2-5 (F02/T3): قراءة فقط — الإدارة (نسخ/إيقاف موثق)
                                 * من سطح المالية «ملخص الفترة»؛ هذا رابط سياقي واحد. */}
                              </p>
                            ))}
                            <button
                              className="micro-text-action"
                              type="button"
                              onClick={() => navigate(withReturnTo("/finance?view=period", "/catalog"))}
                            >
                              إدارة هذه السياسات من المالية — ملخص الفترة <ArrowLeft aria-hidden="true" />
                            </button>
                          </details>
                        ) : null}
                        <details className="micro-inline-disclosure">
                          <summary>الحقيقة والحدود</summary>
                          <p>
                            الهدر لا يدخل تكلفة البيع ولا المصروف تلقائيًا. القراءة لا تعني صافي ربح نهائيًا،
                            ولا توصية سعر، ولا تتضمن تكاليف لم تُسجل.
                          </p>
                        </details>
                      </>
                    ) : (
                      <p className="micro-empty-copy">لا تتوفر قراءة لهذا المرجع بعد.</p>
                    )}
                  </div>
                  {item.active ? (
                    <Button
                      action="secondary"

                      onClick={() => deactivate(item.id)}
                    >
                      <ArchiveX aria-hidden="true" /> إيقاف
                    </Button>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="micro-empty-copy">
            لا يوجد مرجع بعد. أضف فقط العمل الذي يتكرر كي يصبح تحليله منظمًا لاحقًا.
          </p>
        )}
      </section>
    </details>
  );
}
