/** Style: Micro «مسار القرار» — phone-first RTL list where each row states status, date, settlement truth, and one next action. */
/* مبدأ Micro: تعرض القائمة حالة الاتفاق والفعل التالي من خريطة واحدة، ولا توهم باعتماد ثانٍ. */
/* المجموعة ١ (§8): العمل مبني حول أولوية العمل والمهمة التالية لا حول قائمة طويلة —
 * «الأولوية الآن» دائمًا (ولو بعبارة لا شيء مستعجل)، صفوف البيع مختصرة، والتفاصيل
 * الثانوية (الربح والمراجعات) خلف شاشة التفصيل. */
import { BadgeDollarSign, CalendarDays, ClipboardCheck, ClipboardPlus, ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { DecisionPanel } from "@/components/presentation/DecisionPanel";
import { withFrom } from "@/app/navigationContract";
import { getAgreementPresentation } from "@/presentation/orderAgreementPresentation";
import { IntegerValue, LocalDateValue, MoneyValue, TimeValue } from "@/components/presentation/DisplayValue";
import type { DailyFollowUp } from "@/application/follow-up/dailyFollowUpService";
import type { OrderDraft, StoredCraftOrder } from "@/storage/local/types";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";
import type { ScheduleOverview } from "@/application/scheduling/scheduleService";
import { formatMoneyWithUnit } from "@/presentation/formatters";

type OrdersState =
  | { phase: "loading" }
  | { phase: "error" }
  | {
      phase: "ready";
      drafts: readonly OrderDraft[];
      orders: readonly StoredCraftOrder[];
      directSales: readonly DirectSale[];
      followUp: DailyFollowUp;
      scheduleOverview: ScheduleOverview;
    };
const settlementDetail = (stored: StoredCraftOrder) => (
  <>
    {stored.order.settlementStatus === "debt" ? "دين مسجل (د.أ): " : "المتبقي (د.أ): "}
    <MoneyValue minor={stored.order.receivableMinor} className="micro-inline-number" />
  </>
);

export default function Orders() {
  const [location, navigate] = useLocation();
  const { dailyFollowUp, directSales, schedules, dataVersion } = usePrototypeServices();
  const [state, setState] = useState<OrdersState>({ phase: "loading" });
  useEffect(() => {
    let active = true;
    Promise.all([dailyFollowUp.read(), directSales.list(), schedules.overview()]).then(
      ([result, sales, scheduleResult]) => {
        if (!active) return;
        if (!result.ok || !sales.ok || !scheduleResult.ok) {
          setState({ phase: "error" });
          return;
        }
        setState({
          phase: "ready",
          drafts: result.drafts,
          orders: result.orders,
          directSales: sales.value,
          followUp: result.followUp,
          scheduleOverview: scheduleResult.value,
        });
      },
    );
    return () => {
      active = false;
    };
  }, [dailyFollowUp, directSales, schedules, dataVersion]);
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
  /* المجموعة ١ (§8.1): كل فتح من «العمل» يحفظ مصدره — الرجوع يعود إلى العمل. */
  const openFromWork = (href: string) => navigate(withFrom(href, location));
  const tone = state.followUp.kind === "recorded_debt" ? "warning" : "accent";
  /* «الأولوية الآن» دائمًا: حالة «لا طلبات» تُقال بصدق لا تُخفى، ولا تُفبرك أولوية. */
  const isEmptyWorkState =
    state.followUp.kind === "empty" && state.directSales.length === 0 && state.drafts.length === 0;
  const priorityTruth = isEmptyWorkState ? "لا شيء مستعجل الآن — يومك مفتوح للعمل." : state.followUp.truth;
  const priorityNextAction = isEmptyWorkState
    ? "سجّل بيعًا أو ابدأ طلبًا عندما يحدث."
    : state.followUp.nextAction;
  return (
    <section className="micro-page">
      <div className="micro-page-heading">
        <span className="micro-overline">وجهة العمل</span>
        <h1>العمل</h1>
        <p>الطلبات والمبيعات والمسودات والمواعيد — وكل قسم يظهر عند وجود سجل فعلي.</p>
      </div>
      {/* §8.1: الأولوية الآن قبل القوائم — دائمًا حاضرة حتى بلا طلبات. */}
      <DecisionPanel
        label="الأولوية الآن"
        truth={priorityTruth}
        nextAction={priorityNextAction}
        tone={tone}
      />
      {state.orders.length > 0 ? (
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
                onClick={() => openFromWork(`/orders/${stored.id}`)}
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
      ) : null}
      <section className="micro-decision-surface" data-tone="accent" aria-labelledby="direct-sales-title">
        <span className="micro-overline">مبيعات مباشرة</span>
        <h2 id="direct-sales-title">مبيعاتي</h2>
        {state.directSales.length === 0 ? (
          <>
            <p>لا توجد مبيعات مباشرة محفوظة بعد.</p>
            <p className="micro-home-truth-line">
              هذا لا ينشئ بيعًا تلقائيًا ولا يحوّل أي تحصيل مرتبط بطلب إلى مبيعات مباشرة.
            </p>
          </>
        ) : (
          <div className="micro-draft-list" aria-label="سجل المبيعات المباشرة">
            {/* §8.2: صف البيع مختصر — الربح والمراجعات وثانوية التفاصيل خلف شاشة التفصيل. */}
            {state.directSales.map(sale => (
              <button
                className="micro-draft-row"
                type="button"
                key={sale.id}
                onClick={() => openFromWork(`/direct-sales/${sale.id}`)}
                aria-label={`فتح بيع ${sale.itemName}`}
              >
                <span className="micro-draft-symbol">
                  <BadgeDollarSign aria-hidden="true" />
                </span>
                <span>
                  <strong>{sale.itemName}</strong>
                  <small>
                    <LocalDateValue value={sale.occurredOn} /> · الكمية:{" "}
                    <IntegerValue value={sale.quantity} className="micro-inline-number" />
                  </small>
                  <small>
                    المحصل (د.أ): <MoneyValue minor={sale.collectedMinor} className="micro-inline-number" />
                    {sale.revenueMinor > sale.collectedMinor ? (
                      <> من {formatMoneyWithUnit(sale.revenueMinor)} المتفق</>
                    ) : null}
                  </small>
                  <small className="micro-row-next-action">
                    {sale.status === "cancelled"
                      ? `ملغى — ${sale.cancellationReason ?? "بدون سبب مسجل"}`
                      : sale.collectionStatus === "partial_debt" && sale.revenueMinor > sale.collectedMinor
                        ? "الفرق دَين على العميل — التفاصيل عند فتح البيع."
                        : "الخطوة التالية: راجع أو صحح البيع عند الحاجة."}
                  </small>
                </span>
                <ChevronLeft aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </section>
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
              onClick={() => openFromWork(`/orders/draft/${draft.id}`)}
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
      {/* F-070 (§6.1): مقطع مواعيد دائم في «العمل» — ماذا يأتي ومتى؟ بلا شرط بيانات (08-5). */}
      <section className="micro-draft-list" aria-labelledby="work-schedules-title">
        <div className="micro-section-title">
          <CalendarDays aria-hidden="true" />
          <div>
            <span className="micro-overline">قراءة تشغيلية · بلا أثر مالي</span>
            <h2 id="work-schedules-title">المواعيد</h2>
          </div>
        </div>
        {state.scheduleOverview.overdue.length > 0 ||
        state.scheduleOverview.today.length > 0 ||
        state.scheduleOverview.upcoming.length > 0 ? (
          <div className="micro-schedule-preview-list">
            {[...state.scheduleOverview.overdue, ...state.scheduleOverview.today, ...state.scheduleOverview.upcoming]
              .slice(0, 5)
              .map(item => (
                <button
                  key={item.schedule.id}
                  className="micro-draft-row"
                  type="button"
                  onClick={() => openFromWork(`/schedule/${item.schedule.id}`)}
                >
                  <span className="micro-draft-symbol">
                    <CalendarDays aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{item.order.order.itemName || "موعد تسليم"}</strong>
                    <small>
                      {item.bucket === "overdue"
                        ? "متأخر · "
                        : item.bucket === "today"
                          ? "اليوم · "
                          : "قادم · "}
                      <LocalDateValue value={item.schedule.scheduledFor} />
                      {item.schedule.scheduledTime ? (
                        <>
                          {" "}
                          · <TimeValue value={item.schedule.scheduledTime} />
                        </>
                      ) : null}
                    </small>
                    <small className="micro-row-next-action">
                      الخطوة التالية: افتح الموعد أو أجّله من محرره.
                    </small>
                  </span>
                  <ChevronLeft aria-hidden="true" />
                </button>
              ))}
          </div>
        ) : (
          <p className="micro-empty-inline">
            لا مواعيد بعد؛ يُسجَّل موعد التسليم تلقائيًا مع كل اتفاق، وبقية المواعيد من الجدول.
          </p>
        )}
        <button className="micro-text-action" type="button" onClick={() => openFromWork("/schedule")}>
          افتح جدول المواعيد <ChevronLeft aria-hidden="true" />
        </button>
      </section>
      {/* §8.1: CTA ثانوي واضح حيث يملك هذا السطح المبيعات. */}
      <button
        className="micro-button micro-button-secondary"
        type="button"
        onClick={() => openFromWork("/direct-sales/new")}
      >
        <BadgeDollarSign aria-hidden="true" /> تسجيل بيع مباشر
      </button>
      {state.orders.length > 0 || state.drafts.length > 0 ? (
        <button
          className="micro-button micro-button-secondary"
          type="button"
          onClick={() => openFromWork("/orders/draft/new?intent=customer_order")}
        >
          إنشاء مسودة أخرى
        </button>
      ) : null}
      {isEmptyWorkState ? (
        <section className="micro-empty-state" aria-labelledby="work-empty-title">
          <span className="micro-empty-symbol">
            <BadgeDollarSign aria-hidden="true" />
          </span>
          <span className="micro-status-chip">لا توجد سجلات عمل بعد</span>
          <h2 id="work-empty-title">يومك مفتوح — سجّل أول بيع</h2>
          <p>
            بيع واحد مسجل يكفي لتبدأ؛ الربح يظهر بعد معرفة التكلفة، وما لا تعرفه يبقى «غير محدد بعد» لا صفرًا.
          </p>
          <button
            className="micro-button micro-button-primary"
            type="button"
            onClick={() => openFromWork("/direct-sales/new")}
          >
            سجّل أول بيع
          </button>
        </section>
      ) : null}
    </section>
  );
}
