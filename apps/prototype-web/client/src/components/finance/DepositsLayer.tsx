/* §10: طبقة «العربونات» وحدة مستقلة (إضافة المالك — القرار ١٩). */
import { ArrowLeft } from "lucide-react";
import { IntegerValue, MoneyValue } from "@/components/presentation/DisplayValue";
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
                  </small>
                  <small className="micro-row-next-action">{depositStateLabel(row)}</small>
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
