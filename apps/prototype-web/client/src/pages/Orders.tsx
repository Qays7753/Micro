/** Style: Micro «مسار القرار» — phone-first RTL list where each row states status, date, settlement truth, and one next action. */
/* مبدأ Micro: تعرض القائمة حالة الاتفاق والفعل التالي من خريطة واحدة، ولا توهم باعتماد ثانٍ. */
import { BadgeDollarSign, ClipboardCheck, ClipboardPlus, ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { DecisionPanel } from "@/components/presentation/DecisionPanel";
import { getAgreementPresentation } from "@/presentation/orderAgreementPresentation";
import { IntegerValue, LocalDateValue, MoneyValue } from "@/components/presentation/DisplayValue";
import type { DailyFollowUp } from "@/application/follow-up/dailyFollowUpService";
import type { OrderDraft, StoredCraftOrder } from "@/storage/local/types";

type OrdersState =
  | { phase: "loading" }
  | { phase: "error" }
  | {
      phase: "ready";
      drafts: readonly OrderDraft[];
      orders: readonly StoredCraftOrder[];
      followUp: DailyFollowUp;
    };
const settlementDetail = (stored: StoredCraftOrder) => (
  <>
    {stored.order.settlementStatus === "debt" ? "دين مسجل (د.أ): " : "المتبقي (د.أ): "}
    <MoneyValue minor={stored.order.receivableMinor} className="micro-inline-number" />
  </>
);

export default function Orders() {
  const [, navigate] = useLocation();
  const { dailyFollowUp, dataVersion } = usePrototypeServices();
  const [state, setState] = useState<OrdersState>({ phase: "loading" });
  useEffect(() => {
    let active = true;
    dailyFollowUp.read().then(result => {
      if (!active) return;
      if (!result.ok) {
        setState({ phase: "error" });
        return;
      }
      setState({ phase: "ready", drafts: result.drafts, orders: result.orders, followUp: result.followUp });
    });
    return () => {
      active = false;
    };
  }, [dailyFollowUp, dataVersion]);
  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ تحميل الطلبات المحلية…
      </div>
    );
  if (state.phase === "error")
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر تحميل الطلبات</h1>
        <p>لم يتم تغيير شيء. أعد فتح التطبيق للمحاولة.</p>
      </section>
    );
  const tone = state.followUp.kind === "recorded_debt" ? "warning" : "accent";
  return (
    <section className="micro-page">
      <div className="micro-page-heading">
        <span className="micro-overline">وجهة العمل</span>
        <h1>العمل</h1>
        <p>سجلات البيع والطلبات في مكان واحد، وكل قسم يظهر عندما يكون له سجل فعلي.</p>
      </div>
      <section className="micro-decision-surface" data-tone="accent" aria-labelledby="direct-sales-title">
        <span className="micro-overline">مبيعات مباشرة</span>
        <h2 id="direct-sales-title">مبيعاتي</h2>
        <p>لا توجد مبيعات مباشرة محفوظة بعد.</p>
        <p className="micro-home-truth-line">
          هذا لا ينشئ بيعًا تلقائيًا ولا يحوّل أي تحصيل مرتبط بطلب إلى مبيعات مباشرة.
        </p>
      </section>
      {state.orders.length > 0 ? (
        <>
          <DecisionPanel
            label="الأولوية الآن"
            truth={state.followUp.truth}
            nextAction={state.followUp.nextAction}
            tone={tone}
          />
          <section className="micro-draft-list" aria-labelledby="work-orders-title">
            <div className="micro-section-title">
              <ClipboardCheck aria-hidden="true" />
              <div>
                <span className="micro-overline">سجل محفوظ</span>
                <h2 id="work-orders-title">طلباتي</h2>
              </div>
            </div>
            {state.orders.map(stored => {
              const agreement = getAgreementPresentation({
                status: stored.order.status,
                agreedPriceMinor: stored.order.agreedPriceMinor,
                deliveryDate: stored.deliveryDate,
                nextAction: stored.order.nextAction,
              });
              return (
                <button
                  className="micro-draft-row"
                  type="button"
                  key={stored.id}
                  onClick={() => navigate(`/orders/${stored.id}`)}
                >
                  <span className="micro-draft-symbol">
                    <ClipboardCheck aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{stored.order.itemName}</strong>
                    <small>
                      {agreement.label} · موعد التسليم: <LocalDateValue value={stored.deliveryDate} />
                    </small>
                    <small>{settlementDetail(stored)}</small>
                    <small className="micro-row-next-action">الخطوة التالية: {agreement.nextAction}</small>
                  </span>
                  <ChevronLeft aria-hidden="true" />
                </button>
              );
            })}
          </section>
        </>
      ) : null}
      {state.drafts.length > 0 ? (
        <section className="micro-draft-list" aria-labelledby="work-drafts-title">
          <div className="micro-section-title">
            <ClipboardPlus aria-hidden="true" />
            <div>
              <span className="micro-overline">لم تتحول إلى طلب محفوظ</span>
              <h2 id="work-drafts-title">مسودات قيد الإكمال</h2>
            </div>
          </div>
          {state.drafts.map(draft => (
            <button
              className="micro-draft-row"
              type="button"
              key={draft.id}
              onClick={() => navigate(`/orders/draft/${draft.id}`)}
            >
              <span className="micro-draft-symbol">
                <ClipboardPlus aria-hidden="true" />
              </span>
              <span>
                <strong>{draft.itemName || "مسودة تحتاج وصفًا"}</strong>
                <small>
                  {draft.intent === "customer_order" ? "طلب من عميل" : "تصميم مخطط"} · الكمية:{" "}
                  <IntegerValue value={draft.quantity} className="micro-inline-number" />
                </small>
                <small className="micro-row-next-action">الخطوة التالية: أكمل ما تعرفه الآن.</small>
              </span>
              <ChevronLeft aria-hidden="true" />
            </button>
          ))}
        </section>
      ) : null}
      {state.orders.length > 0 || state.drafts.length > 0 ? (
        <button
          className="micro-button micro-button-secondary"
          type="button"
          onClick={() => navigate("/orders/new")}
        >
          إنشاء مسودة أخرى
        </button>
      ) : null}
      {state.orders.length === 0 && state.drafts.length === 0 ? (
        <section className="micro-empty-state" aria-labelledby="work-empty-title">
          <span className="micro-empty-symbol">
            <BadgeDollarSign aria-hidden="true" />
          </span>
          <span className="micro-status-chip">لا توجد سجلات عمل بعد</span>
          <h2 id="work-empty-title">ابدأ من الفعل الذي تحتاجه اليوم</h2>
          <p>يمكنك إنشاء أول طلب من زر الإضافة؛ ويظهر قسم الطلبات بعد حفظه.</p>
        </section>
      ) : null}
    </section>
  );
}
