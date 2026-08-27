/** Style: Micro «مسار القرار» — phone-first RTL list where each row states status, date, settlement truth, and one next action. */
/* مبدأ Micro: تعرض القائمة حالة الاتفاق والفعل التالي من خريطة واحدة، ولا توهم باعتماد ثانٍ. */
import { ClipboardCheck, ClipboardPlus, ChevronLeft } from "lucide-react";
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
        <span className="micro-overline">المتابعة</span>
        <h1>الطلبات</h1>
        <p>كل طلب يقودك إلى قرار واحد فقط، لا إلى لوحة مكتظة.</p>
      </div>
      <DecisionPanel
        label="الأولوية الآن"
        truth={state.followUp.truth}
        nextAction={state.followUp.nextAction}
        tone={tone}
      />
      {state.orders.length > 0 ? (
        <section className="micro-draft-list" aria-label="الاتفاقات المحلية">
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
                  <small className="micro-row-next-action">الفعل التالي: {agreement.nextAction}</small>
                </span>
                <ChevronLeft aria-hidden="true" />
              </button>
            );
          })}
        </section>
      ) : null}
      {state.drafts.length === 0 && state.orders.length === 0 ? (
        <section className="micro-empty-state" aria-labelledby="orders-empty-title">
          <span className="micro-empty-symbol">
            <ClipboardPlus aria-hidden="true" />
          </span>
          <span className="micro-status-chip">لا توجد بيانات بعد</span>
          <h2 id="orders-empty-title">ابدأ بطلب واحد تعرف قصته</h2>
          <p>الوصف والكمية وما اتفقت عليه تكفي كبداية.</p>
          <button
            className="micro-button micro-button-primary"
            type="button"
            onClick={() => navigate("/orders/new")}
          >
            <ClipboardPlus aria-hidden="true" /> إنشاء طلب مخصص
          </button>
        </section>
      ) : null}
      {state.drafts.length > 0 ? (
        <section className="micro-draft-list" aria-label="المسودات المحلية">
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
                <small className="micro-row-next-action">الفعل التالي: أكمل ما تعرفه الآن.</small>
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
    </section>
  );
}
