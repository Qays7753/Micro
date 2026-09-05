/* §10: طبقة «العربونات» وحدة مستقلة (إضافة المالك — القرار ١٩). */
import { ArrowLeft } from "lucide-react";
import { IntegerValue, MoneyValue } from "@/components/presentation/DisplayValue";
import { formatMoneyMinor } from "@/presentation/formatters";
import type { DepositOverview } from "@/application/fulfillment/fulfillmentService";

/* §10: حالة العربون علامة قصيرة — الحد في النطاق لا في الجملة. */
const depositStateLabel = (row: DepositOverview["deposits"][number]) =>
  row.depositSettlement === "needs_review"
    ? "ينتظر قرارك"
    : row.depositSettlement === "refund_deposit"
      ? "مردود"
      : row.depositSettlement === "retain_deposit"
        ? "محتفظ به"
        : "مرتبط بطلب";

export function DepositsLayer({
  deposits,
  onOpenOrder,
}: {
  deposits: DepositOverview;
  onOpenOrder: (orderId: string) => void;
}) {
  return (
    <details className="micro-finance-layer">
      <summary className="micro-finance-layer-summary">
        <span>
          <b>العربونات</b>
          <small>
            {deposits.deposits.length > 0
              ? `${deposits.deposits.length} عربونًا مقبوضًا · ينتظر التسوية: ${deposits.awaitingSettlementCount}`
              : "لا عربونات مقبوضة بعد"}
          </small>
        </span>
        <strong>افتح العربونات</strong>
      </summary>
      {/* إضافة المالك (القرار ١٩): قسم يجمع العربونات — كم عربونًا مقبوضًا، على أي طلبات، وأيها ينتظر تسوية. */}
      <section className="micro-finance-event-list" aria-label="قراءة العربونات">
        <div className="micro-finance-event-heading">
          <span className="micro-overline">العربونات المقبوضة · المبالغ (د.أ)</span>
          <h2>عربونات الطلبات في مكان واحد</h2>
        </div>
        {deposits.deposits.length > 0 ? (
          <>
            <p className="micro-period-range-label">
              إجمالي العربونات المقبوضة: <MoneyValue minor={deposits.collectedTotalMinor} /> · ينتظر قرار
              التسوية:{" "}
              <IntegerValue value={deposits.awaitingSettlementCount} className="micro-inline-number" />
            </p>
            {deposits.deposits.map(row => (
              <button
                key={row.orderId}
                className="micro-home-recent-item"
                type="button"
                onClick={() => onOpenOrder(row.orderId)}
              >
                <span>
                  <strong>{row.itemName || "طلب بلا وصف"}</strong>
                  <small>
                    {row.customerName || "عميل بلا اسم"} · عربون مقبوض:{" "}
                    <MoneyValue minor={row.depositCollectedMinor} className="micro-inline-number" />
                    {row.walletName ? ` · في محفظة «${row.walletName}»` : " · غير موزع"}
                  </small>
                  {/* عقد الإغلاق العميق (FC-05 — العقد ٣): تفصيل التطبيق والتسوية
                      على البطاقة نفسها — رقم واحد لكل معنى، لا قراءة مزدوجة. */}
                  <small>
                    {row.appliedToSaleMinor > 0
                      ? `مطبَّق على قيمة الطلب: ${formatMoneyMinor(row.appliedToSaleMinor)} د.أ`
                      : row.refundedMinor > 0
                        ? `مردود للعميل: ${formatMoneyMinor(row.refundedMinor)} د.أ`
                        : row.retainedMinor > 0
                          ? `محتفظ به: ${formatMoneyMinor(row.retainedMinor)} د.أ`
                          : "لم يُطبَّق بعد — بانتظار التسليم"}
                  </small>
                  <small className="micro-row-next-action">{depositStateLabel(row)}</small>
                  <small className="micro-muted-copy">{row.profitEffectLabel}</small>
                </span>
                <ArrowLeft aria-hidden="true" />
              </button>
            ))}
          </>
        ) : (
          <p>لم تقبض عربونًا بعد. العربون يسجل من تسجيل الاتفاق، ويظهر هنا لحظة قبضه.</p>
        )}
      </section>
    </details>
  );
}
