/** Financial pulse review: local order evidence, named money meanings, and no ledger-like claims beyond the available events. */
/* مبدأ Micro: وحدة العملة في العرض موحدة، بينما تبقى دلالات القبض والدين والنتيجة منفصلة. */
import { ArrowLeft, CircleAlert, Landmark } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { LocalFinancialPulse } from "@/application/financial-pulse/financialPulseService";
import type { StoredCraftOrder } from "@/storage/local/types";
import { IntegerValue, MoneyValue } from "@/components/presentation/DisplayValue";

type ReviewState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; orders: readonly StoredCraftOrder[]; pulse: LocalFinancialPulse };
const resultLabel: Record<string, string> = {
  final: "معروفة",
  estimated: "تقديرية",
  incomplete: "غير مكتملة",
  review_required: "تحتاج مراجعة",
};

export default function Review() {
  const [, navigate] = useLocation();
  const { financialPulse, dataVersion } = usePrototypeServices();
  const [state, setState] = useState<ReviewState>({ phase: "loading" });
  useEffect(() => {
    let active = true;
    financialPulse.read().then(result => {
      if (!active) return;
      setState(
        result.ok ? { phase: "ready", orders: result.orders, pulse: result.pulse } : { phase: "error" },
      );
    });
    return () => {
      active = false;
    };
  }, [dataVersion, financialPulse]);
  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ قراءة المراجعة المحلية…
      </div>
    );
  if (state.phase === "error")
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر قراءة المراجعة</h1>
        <p>لم يتم تعديل بياناتك. أعد فتح التطبيق للمحاولة.</p>
      </section>
    );
  const completed = state.orders.filter(stored => ["delivered", "settled"].includes(stored.order.status));
  const excludedOrders = completed.filter(stored => stored.order.resultStatus !== "final");
  const resultOrder = completed.find(stored => stored.order.resultStatus === "final") ?? completed[0] ?? null;
  return (
    <section className="micro-page">
      <div className="micro-page-heading">
        <span className="micro-overline">نتائج الطلبات</span>
        <h1>المراجعة</h1>
        <p>أرقام مسماة من طلبات محلية. لكل رقم مصدر وحدود، ولا تُختصر في رقم «ما أملك».</p>
      </div>
      <section className="micro-financial-pulse" aria-labelledby="review-pulse-title">
        <div className="micro-financial-pulse-heading">
          <div>
            <span className="micro-overline">صورة الطلبات المسجلة</span>
            <h2 id="review-pulse-title">قبض ودين ونتائج</h2>
          </div>
          <span>القيم (د.أ)</span>
        </div>
        <dl>
          <div>
            <dt>قبض مسجل من الطلبات</dt>
            <dd>
              <MoneyValue minor={state.pulse.registeredCollectionsMinor} />
            </dd>
            <small>لا يساوي كاش المشروع</small>
          </div>
          <div>
            <dt>دين مسجل بعد التسليم</dt>
            <dd>
              <MoneyValue minor={state.pulse.registeredDebtMinor} />
            </dd>
            <small>لا يدخل في القبض</small>
          </div>
          <div>
            <dt>إيراد معترف به</dt>
            <dd>
              <MoneyValue minor={state.pulse.recognizedRevenueFromFinalOrdersMinor} />
            </dd>
            <small>من نتائج معرفة فقط</small>
          </div>
          <div>
            <dt>تكلفة معترف بها</dt>
            <dd>
              <MoneyValue minor={state.pulse.recognizedCostFromFinalOrdersMinor} />
            </dd>
            <small>من نتائج معرفة فقط</small>
          </div>
        </dl>
        <p className="micro-financial-pulse-note">
          الإيراد والتكلفة أعلاه محسوبان من الطلبات ذات النتيجة النهائية فقط؛ ليست هذه قراءة كل طلب مسلّم.
        </p>
        {excludedOrders.length ? (
          <section className="micro-review-exclusions" aria-labelledby="review-exclusions-title">
            <div>
              <CircleAlert aria-hidden="true" />
              <p id="review-exclusions-title">
                استُبعدت{" "}
                <strong>
                  <IntegerValue value={excludedOrders.length} />
                </strong>{" "}
                طلب/طلبات مسلّمة لأن معرفة التكلفة غير مكتملة أو تحتاج مراجعة.
              </p>
            </div>
            <div>
              {excludedOrders.map(stored => (
                <button
                  className="micro-text-action"
                  type="button"
                  key={stored.id}
                  onClick={() => navigate(`/orders/${stored.id}`)}
                >
                  فتح مصدر الاستبعاد: {stored.order.itemName} <ArrowLeft aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        ) : (
          <p className="micro-financial-pulse-note">لا توجد طلبات مسلّمة مستبعدة من نطاق النتيجة النهائية.</p>
        )}
      </section>
      {resultOrder ? (
        <section className="micro-review-result" data-result={resultOrder.order.resultStatus}>
          <div>
            <span>نتيجة {resultLabel[resultOrder.order.resultStatus] ?? "تحتاج مراجعة"}</span>
            <h2>{resultOrder.order.itemName}</h2>
          </div>
          {resultOrder.order.profitIndicatorMinor !== null ? (
            <p>
              مؤشر نتيجة هذا الطلب (د.أ):{" "}
              <strong>
                <MoneyValue minor={resultOrder.order.profitIndicatorMinor} />
              </strong>
              ، بناءً على التكلفة المعترف بها.
            </p>
          ) : (
            <p>لا تظهر نتيجة رقمية نهائية لأن معرفة التكلفة ليست مكتملة أو تحتاج مراجعة.</p>
          )}
          <button
            className="micro-text-action"
            type="button"
            onClick={() => navigate(`/orders/${resultOrder.id}`)}
          >
            فتح سجل الطلب <ArrowLeft aria-hidden="true" />
          </button>
        </section>
      ) : (
        <section className="micro-review-empty">
          <h2>لا توجد نتيجة طلب بعد</h2>
          <p>تظهر هنا نتيجة الطلب بعد التسليم، وفق المعرفة المسجلة في تكلفة ذلك الطلب.</p>
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => navigate("/orders")}
          >
            فتح الطلبات
          </button>
        </section>
      )}
      <section className="micro-scope-line">
        <Landmark aria-hidden="true" />
        <p>العربون قبض مرتبط بالطلب، والدين مستحق، والتسليم لا يضيف قبضًا تلقائيًا.</p>
      </section>
    </section>
  );
}
