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
import { withReturnTo } from "@/app/navigationContract";
import { getAgreementPresentation } from "@/presentation/orderAgreementPresentation";
import { IntegerValue, LocalDateValue, MoneyValue, TimeValue } from "@/components/presentation/DisplayValue";
import { Button, EmptyState, StatusChip } from "@/components/primitives";
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

/* Wave 4.3 — P-4.3-4 (§11): الطلبات حسب حالة العمل — ما يحتاج تنفيذًا الآن،
 * ما ينتظر العميل، ما ينتظر تحصيلًا، وما تم تسليمه؛ الملغاة مطوية بلا حذف
 * (السجل يبقى مرئيًا للتدقيق). الطلب البسيط لا يُجبر على رحلة طويلة —
 * التجميع عرض فقط ولا مسّ للمنطق ولا للكتاب. */
type OrderWorkGroup = {
  id: "executing" | "waiting_customer" | "awaiting_collection" | "delivered" | "cancelled";
  title: string;
  orders: readonly StoredCraftOrder[];
};
function groupOrdersByWorkState(orders: readonly StoredCraftOrder[]): OrderWorkGroup[] {
  const executing: StoredCraftOrder[] = [];
  const waitingCustomer: StoredCraftOrder[] = [];
  const awaitingCollection: StoredCraftOrder[] = [];
  const delivered: StoredCraftOrder[] = [];
  const cancelled: StoredCraftOrder[] = [];
  for (const stored of orders) {
    const status = stored.order.status;
    if (status === "cancelled") cancelled.push(stored);
    else if (status === "delivered" || status === "settled") {
      if (stored.order.receivableMinor > 0) awaitingCollection.push(stored);
      else delivered.push(stored);
    } else if (status === "in_progress" || status === "ready" || status === "needs_review")
      executing.push(stored);
    else waitingCustomer.push(stored);
  }
  return [
    { id: "executing", title: "يحتاج تنفيذًا الآن", orders: executing },
    { id: "waiting_customer", title: "ينتظر العميل", orders: waitingCustomer },
    { id: "awaiting_collection", title: "ينتظر تحصيلًا", orders: awaitingCollection },
    { id: "delivered", title: "تم تسليمه", orders: delivered },
    { id: "cancelled", title: "ملغاة", orders: cancelled },
  ];
}

export default function Orders() {
  const [location, navigate] = useLocation();
  const { dailyFollowUp, directSales, schedules, preferences, dataVersion } = usePrototypeServices();
  /* SET-003: القدرات المتوقفة تخفي مداخل الإدخال اليومية فقط — القوائم
   * القائمة (طلبات/مسودات/مواعيد) تبقى ظاهرة دائمًا للتدقيق. */
  const [disabledCapabilities, setDisabledCapabilities] = useState<readonly string[]>([]);
  const [state, setState] = useState<OrdersState>({ phase: "loading" });
  /* AR-14: إعادة محاولة صريحة بعد فشل القراءة — رمز محلي يعيد تشغيل الحمل. */
  const [reloadToken, setReloadToken] = useState(0);
  useEffect(() => {
    let active = true;
    /* SET-003: قراءة القدرات — غياب الخدمة في بيئة اختبار لا يُسقط السطح. */
    if (typeof preferences?.readDisabledCapabilities === "function") {
      preferences
        .readDisabledCapabilities()
        .then(result => {
          if (active && result.ok) setDisabledCapabilities(result.disabled);
        })
        .catch(() => undefined);
    }
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
  }, [dailyFollowUp, directSales, schedules, dataVersion, reloadToken]);
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
        <p>لم يتم تغيير شيء — بياناتك كما هي؛ أعد المحاولة.</p>
        <Button
          action="save"

          onClick={() => setReloadToken(token => token + 1)}
        >
          إعادة المحاولة
        </Button>
      </section>
    );
  /* المجموعة ١ (§8.1): كل فتح من «العمل» يحفظ مصدره — الرجوع يعود إلى العمل. */
  const openFromWork = (href: string) => navigate(withReturnTo(href, location));
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
          {/* P-4.3-4 (§11): المجموعات بترتيب العمل — التنفيذ أولًا ثم انتظار
              العميل ثم التحصيل ثم المسلّم؛ الملغاة مطوية (مرئية للتدقيق). */}
          {groupOrdersByWorkState(state.orders).map(group =>
            group.orders.length === 0 ? null : group.id === "cancelled" ? (
              <details className="micro-orders-cancelled" key={group.id}>
                <summary>
                  {group.title} ({group.orders.length}) — تبقى في السجل للتدقيق
                </summary>
                {group.orders.map(stored => (
                  <OrderWorkRow key={stored.id} stored={stored} onOpen={openFromWork} />
                ))}
              </details>
            ) : (
              <div className="micro-orders-group" data-group={group.id} key={group.id}>
                <h3>{group.title}</h3>
                {group.orders.map(stored => (
                  <OrderWorkRow key={stored.id} stored={stored} onOpen={openFromWork} />
                ))}
              </div>
            ),
          )}
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
            {[
              ...state.scheduleOverview.overdue,
              ...state.scheduleOverview.today,
              ...state.scheduleOverview.upcoming,
            ]
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
      <Button
        action="secondary"

        onClick={() => openFromWork("/direct-sales/new")}
      >
        <BadgeDollarSign aria-hidden="true" /> تسجيل بيع مباشر
      </Button>
      {/* عقد الإغلاق العميق (WF-03 — عقد التنقل): العمل يملك المرجع والمواد —
          وصلة هادئة لكل منهما بجوار أفعال العمل، لا مقاعد جديدة ولا شريط ثانٍ. */}
      <div className="micro-form-actions micro-contextual-actions">
        {disabledCapabilities.includes("catalog") ? null : (
          <Button
            action="quiet"

            onClick={() => openFromWork("/catalog")}
          >
            منتجاتي وخدماتي
          </Button>
        )}
        {disabledCapabilities.includes("inventory") ? null : (
          <Button
            action="quiet"

            onClick={() => openFromWork("/inventory")}
          >
            المواد والمخزون
          </Button>
        )}
      </div>
      {!disabledCapabilities.includes("orders") && (state.orders.length > 0 || state.drafts.length > 0) ? (
        <Button
          action="secondary"

          onClick={() => openFromWork("/orders/draft/new?intent=customer_order")}
        >
          إنشاء مسودة أخرى
        </Button>
      ) : null}
      {isEmptyWorkState ? (
        <EmptyState
          aria-labelledby="work-empty-title"
          symbol={<BadgeDollarSign />}
          state={<StatusChip state="no-data">لا توجد سجلات عمل بعد</StatusChip>}
          title={<h2 id="work-empty-title">يومك مفتوح — سجّل أول بيع</h2>}
          description={
            <>
              بيع واحد مسجل يكفي لتبدأ؛ الربح يظهر بعد معرفة التكلفة، وما لا تعرفه يبقى «غير محدد بعد» لا
              صفرًا.
            </>
          }
          action={
            <Button action="create" onClick={() => openFromWork("/direct-sales/new")}>
              سجّل أول بيع
            </Button>
          }
        />
      ) : null}
    </section>
  );
}

/* P-4.3-4 (§11): صف طلب واحد داخل مجموعات العمل — الحالة والتسليم والمتبقي
 * والخطوة التالية من خريطة العرض الموحدة نفسها؛ لا تغيير للمنطق. */
function OrderWorkRow({ stored, onOpen }: { stored: StoredCraftOrder; onOpen: (href: string) => void }) {
  const agreement = getAgreementPresentation({
    status: stored.order.status,
    agreedPriceMinor: stored.order.agreedPriceMinor,
    deliveryDate: stored.deliveryDate,
    nextAction: stored.order.nextAction,
  });
  return (
    <button className="micro-draft-row" type="button" onClick={() => onOpen(`/orders/${stored.id}`)}>
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
}
