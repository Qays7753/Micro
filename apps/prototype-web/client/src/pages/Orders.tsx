/**
 * S13 (DOC-022 / UNIT-006 + SH-17 — أمر 2158b0fc §6): وجهة «الطلبات» —
 * قائمة افتراضية وتقويم بديل من المصادر نفسها (الطلبات من مالكها والمواعيد
 * من قراءة 012 النقية)؛ بحث وتصفية على المجتمع المقروء كله قبل حد العرض،
 * وسابق ومسودات بحدود واضحة، ومدخلان ثانويان للمرجعين (العملاء/المنتجات).
 *
 * عقد الملكية (ORD-A/ORD-D + SH-17): القراءة والتصفية وتبديل العرض لا
 * يكتبان طلبًا ولا موعدًا ولا قبضًا أبدًا (SDF-013)؛ فتح الصف يفتح مصدره
 * (010 للطلب، 007 للمسودة)؛ البيع المباشر عند المالية لا هنا (ORD-D01)؛
 * لا وقت 00:00 لموعد بلا وقت، ولا تاريخ اليوم للمجهول، و«بلا موعد»
 * والتاريخ التالف وفشل القراءة ثلاث حقائق مختلفة (ORD-A4/ORD-D2).
 */
import {
  CalendarDays,
  ChevronLeft,
  CircleAlert,
  ClipboardPlus,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useLocation, useSearch } from "wouter";
import { usePrototypeServices, getPrototypeLocalStore } from "@/app/PrototypeServicesContext";
import { useDisabledCapabilities } from "@/app/useDisabledCapabilities";
import { withReturnTo } from "@/app/navigationContract";
import { Button, EmptyState, StatusChip } from "@/components/primitives";
import { LocalDateValue, MoneyValue, TimeValue } from "@/components/presentation/DisplayValue";
import { getAgreementPresentation } from "@/presentation/orderAgreementPresentation";
import { formatLocalDate, formatMonthLabel, localDateWeekdayIndex } from "@/presentation/formatters";
import { todayInAmman } from "@/application/time";
import { isValidLocalDate, localDatePlusDays, localDatePlusMonthsClamped } from "@/presentation/formatters";
import type { OrderDraft, StoredCraftOrder } from "@/storage/local/types";
import {
  readScheduleCommunity,
  windowOf,
  type ScheduleCommunity,
  type ScheduleCommunityEntry,
} from "@/application/scheduling";

/* ─── نطاقات القائمة (ORD-A3): تصفية عرض لا حالة مخزن ─── */

type OrdersScope = "current" | "past" | "all";

const orderOperationallyDone = (stored: StoredCraftOrder) =>
  stored.order.status === "delivered" ||
  stored.order.status === "settled" ||
  stored.order.status === "cancelled";

function ordersInScope(orders: readonly StoredCraftOrder[], scope: OrdersScope): readonly StoredCraftOrder[] {
  if (scope === "all") return orders;
  if (scope === "past") return orders.filter(orderOperationallyDone);
  return orders.filter(order => !orderOperationallyDone(order));
}

/* ─── التصفية (ORD-A5): لوحة واحدة — تطبيق/إعادة ضبط/إلغاء ─── */

type OrdersFilterDraft = {
  scope: OrdersScope;
  datePresence: "all" | "dated" | "undated";
  ordering: "recent" | "byDate";
};
type OrdersFilter = OrdersFilterDraft & { query: string };

const DEFAULT_FILTER: OrdersFilter = {
  scope: "current",
  datePresence: "all",
  ordering: "recent",
  query: "",
};

/* S13 (UNIT-006 ORD-D2 / U018-ACD032 — أمر 2158b0fc §6.7، تصحيح المراجعة
 * الخامسة S13-R5-F02): URL والرجوع يحفظان السياق — القائمة/اليوم/الفلتر
 * المطبقة تُحمل في وصل الصفحة، فيفتح الرجوع الوجهة كما تركها، وإعادة
 * التحميل تصل السياق نفسه؛ القراءة ذاتها لا تتأثر (معاملات عرض فقط). */
type ViewContext = {
  view: "list" | "calendar";
  filter: OrdersFilter;
  calendarMode: "month" | "week" | "day";
  anchorDate: string;
  selectedDate: string | null;
};

function viewContextFromSearch(search: string, today: string): ViewContext {
  const params = new URLSearchParams(search);
  const scope = params.get("scope");
  const dates = params.get("dates");
  const sort = params.get("sort");
  const q = params.get("q");
  const listing = params.get("listing");
  const cmode = params.get("cmode");
  const cday = params.get("cday");
  const canchor = params.get("canchor");
  return {
    view: listing === "calendar" ? "calendar" : "list",
    filter: {
      scope: scope === "past" || scope === "all" ? scope : "current",
      datePresence: dates === "dated" || dates === "undated" ? dates : "all",
      ordering: sort === "byDate" ? "byDate" : "recent",
      query: q ?? "",
    },
    calendarMode: cmode === "week" || cmode === "day" ? cmode : "month",
    anchorDate: isValidLocalDate(canchor ?? "") ? canchor! : today,
    selectedDate: isValidLocalDate(cday ?? "") ? cday : null,
  };
}

function searchOfViewContext(context: ViewContext, today: string): string {
  const params = new URLSearchParams();
  if (context.view === "calendar") params.set("listing", "calendar");
  if (context.filter.scope !== "current") params.set("scope", context.filter.scope);
  if (context.filter.datePresence !== "all") params.set("dates", context.filter.datePresence);
  if (context.filter.ordering !== "recent") params.set("sort", context.filter.ordering);
  if (context.filter.query.trim() !== "") params.set("q", context.filter.query.trim());
  if (context.view === "calendar") {
    if (context.calendarMode !== "month") params.set("cmode", context.calendarMode);
    if (context.selectedDate !== null) params.set("cday", context.selectedDate);
    /* مرساة اليوم الافتراضية لا تُكتب — الوصل النظيف للسياق الافتراضي. */
    if (context.anchorDate !== "" && context.anchorDate !== today) params.set("canchor", context.anchorDate);
  }
  const query = params.toString();
  return query === "" ? "" : `?${query}`;
}

function filterOrders(
  orders: readonly StoredCraftOrder[],
  filter: OrdersFilter,
): readonly StoredCraftOrder[] {
  const query = filter.query.trim();
  const scoped = ordersInScope(orders, filter.scope);
  const filtered = scoped.filter(order => {
    /* S13-R4-F02: «له موعد معلن» = تاريخ صالح فقط — الفاسد حقيقة ثالثة
     * لا تدخل «معلن» ولا «بلا موعد»؛ تظهر في «الكل» وتصحح عند مالكها. */
    if (filter.datePresence === "dated" && !isValidLocalDate(order.deliveryDate ?? "")) return false;
    if (filter.datePresence === "undated" && order.deliveryDate !== null) return false;
    if (query === "") return true;
    const haystack = `${order.order.itemName} ${order.order.customerName ?? ""}`.trim();
    return haystack.includes(query);
  });
  /* الترتيب على المجتمع المصفى كله قبل حد العرض — الأحدث تعديلًا أولًا، أو
   * بالموعد المعلن (المجهول آخرًا لا بتاريخ اليوم) ثم الهوية الثابتة. */
  const byUpdated = (left: StoredCraftOrder, right: StoredCraftOrder) =>
    right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id);
  const byDate = (left: StoredCraftOrder, right: StoredCraftOrder) => {
    const leftDate = left.deliveryDate ?? "9999-12-31";
    const rightDate = right.deliveryDate ?? "9999-12-31";
    return leftDate.localeCompare(rightDate) || left.id.localeCompare(right.id);
  };
  return [...filtered].sort(filter.ordering === "recent" ? byUpdated : byDate);
}

const DISPLAY_CAP = 30;

/* ─── حالة الصفحة ───
 * S13-MR-001 (أمر ba2ce7b4 §4): قراءتان مستقلتان بحالتين مستقلتين —
 * فشل قراءة المواعيد/مجتمع التقويم لا يخفي الطلبات والمسودات المقروءة،
 * وفشل قراءة الطلبات لا يخفي التقويم؛ كل سطح يعلن حقيقته وإعادة المحاولة
 * تعيد قراءة مصدره المتعذر وحده دون المساس بالسليم. */

type OrdersReadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; orders: readonly StoredCraftOrder[]; drafts: readonly OrderDraft[] };

type CommunityReadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; community: ScheduleCommunity };

const weekdayLabels = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default function Orders() {
  const [location, navigate] = useLocation();
  const { dailyFollowUp, dataVersion } = usePrototypeServices();
  const { disabled: disabledCapabilities } = useDisabledCapabilities();
  const [state, setState] = useState<OrdersReadState>({ phase: "loading" });
  const [communityState, setCommunityState] = useState<CommunityReadState>({ phase: "loading" });
  const [reloadToken, setReloadToken] = useState(0);
  const [communityRetryToken, setCommunityRetryToken] = useState(0);
  /* SDF-061: جيل القراءة — استجابة جيل قديم لا تُخلط مع أحدث أبدًا. */
  const readGeneration = useRef(0);
  const communityGeneration = useRef(0);

  /* عرض القائمة/التقويم وسياقهما — ACD032: السياق يُستعاد من الوصل أولًا
   * (الرجوع/التحميل بالقائمة واليوم والفلتر نفسها) ثم يُعاد كتابته في
   * الوصل عند كل تغيير مطبق (replace — بلا تكديس تاريخ). */
  const search = useSearch();
  const initialContext = useMemo(() => viewContextFromSearch(search, todayInAmman()), [search]);
  const [view, setView] = useState<"list" | "calendar">(initialContext.view);
  const [applied, setApplied] = useState<OrdersFilter>(initialContext.filter);
  const [draft, setDraft] = useState<OrdersFilter>(initialContext.filter);
  const [filterOpen, setFilterOpen] = useState(false);
  const [shownCount, setShownCount] = useState(DISPLAY_CAP);
  const [calendarMode, setCalendarMode] = useState<"month" | "week" | "day">(initialContext.calendarMode);
  const [anchorDate, setAnchorDate] = useState(initialContext.anchorDate);
  const [selectedDate, setSelectedDate] = useState<string | null>(initialContext.selectedDate);

  /* S13-MR-001: قراءة الطلبات/المسودات وحدها — فشلها لا يمس التقويم. */
  useEffect(() => {
    const generation = readGeneration.current + 1;
    readGeneration.current = generation;
    setState(current => (current.phase === "ready" ? current : { phase: "loading" }));
    dailyFollowUp
      .read()
      .then(result => {
        /* الجيل القديم يُهمل بلا خلط — تُعاد قراءته بالختم المتسق نفسه. */
        if (generation !== readGeneration.current) return;
        if (!result.ok) {
          setState({ phase: "error", message: result.message });
          return;
        }
        setState({ phase: "ready", orders: result.orders, drafts: result.drafts });
      })
      .catch((error: unknown) => {
        if (generation !== readGeneration.current) return;
        setState({
          phase: "error",
          message: error instanceof Error ? error.message : "تعذر تحميل الطلبات.",
        });
      });
  }, [dailyFollowUp, dataVersion, reloadToken]);

  /* S13-MR-001: قراءة مجتمع المواعيد وحدها — فشلها لا يخفي الطلبات،
   * وإعادة محاولتها تعيد مصدرها وحده دون قراءة الطلبات مرة أخرى. */
  useEffect(() => {
    const generation = communityGeneration.current + 1;
    communityGeneration.current = generation;
    setCommunityState(current => (current.phase === "ready" ? current : { phase: "loading" }));
    readScheduleCommunity(getPrototypeLocalStore())
      .then(result => {
        if (generation !== communityGeneration.current) return;
        if (!result.ok) {
          setCommunityState({ phase: "error", message: result.message });
          return;
        }
        setCommunityState({ phase: "ready", community: result.value });
      })
      .catch((error: unknown) => {
        if (generation !== communityGeneration.current) return;
        setCommunityState({
          phase: "error",
          message: error instanceof Error ? error.message : "تعذر تحميل مواعيد التقويم.",
        });
      });
  }, [dataVersion, communityRetryToken]);

  /* ACD032: كل تغيير مطبق يُكتب في الوصل (replace — بلا تكديس تاريخ)؛
   * الرجوع من أي صف يفتح الوجهة بالقائمة/اليوم/الفلتر نفسها. */
  useEffect(() => {
    const next = `/orders${searchOfViewContext(
      { view, filter: applied, calendarMode, anchorDate, selectedDate },
      todayInAmman(),
    )}`;
    /* بلا تغيير فعلي لا نكتب الوصل — الوصول الأول النظيف يبقى كما هو. */
    if (next !== `/orders${search}`) navigate(next, { replace: true });
  }, [view, applied, calendarMode, anchorDate, selectedDate]);

  const open = (href: string) => navigate(withReturnTo(href, location));
  const applyFilter = () => {
    setApplied({ ...draft, query: draft.query });
    setShownCount(DISPLAY_CAP);
    setFilterOpen(false);
  };
  const resetFilter = () => {
    setApplied(DEFAULT_FILTER);
    setDraft(DEFAULT_FILTER);
    setShownCount(DISPLAY_CAP);
    setFilterOpen(false);
  };
  const switchView = (next: "list" | "calendar") => {
    /* التبديل يحفظ النطاق والبحث المطبقين — لا يفرض شهر التقويم على القائمة. */
    setView(next);
    setShownCount(DISPLAY_CAP);
  };

  if (state.phase === "loading" && communityState.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ تحميل الطلبات المحلية…
      </div>
    );

  const ordersReady = state.phase === "ready" ? state.orders : [];
  const draftsReady = state.phase === "ready" ? state.drafts : [];
  const filteredOrders = filterOrders(ordersReady, applied);
  const pastCount = ordersInScope(ordersReady, "past").length;
  const scopeTitle =
    applied.scope === "current"
      ? "الطلبات الحالية"
      : applied.scope === "past"
        ? "الطلبات السابقة"
        : "كل الطلبات";

  return (
    <section className="micro-page">
      {/* DEC-ORD-01 (UXR-03 — أمر W02): طبقة «وجهة العمل» محذوفة — اسم
       * الوجهة في الترويسة وH1 واحد في المحتوى (قبول F-008: طبقة تعريف
       * واحدة فوق H1). */}
      <div className="micro-page-heading">
        <h1>الطلبات</h1>
        <div className="micro-form-actions">
          <Button
            action="create"
            onClick={() => open("/orders/draft/new?intent=customer_order")}
            disabled={disabledCapabilities.includes("orders")}
          >
            <Plus aria-hidden="true" /> طلب جديد
          </Button>
        </div>
      </div>
      <details className="micro-inline-disclosure">
        <summary>عن الطلبات</summary>
        <p>
          القائمة والتقويم عرضان لنفس الطلبات ومواعيدها من مصادرها؛ فتح صف أو تبديل عرض لا يغيّر حالة ولا يقبض
          مالًا. طلب بلا موعد صحيح ويظهر بلا موعد معلن — لا يُخترع له تاريخ.
        </p>
      </details>

      {/* A2-2/DEC-ORD-02 (UXR-03 — F-009): مفتاح العرض المضغوط — صف واحد
       * فوق radio أصلية (أسهم/Tab/Mسافة من radio القائمة نفسها، والحالة
   * معلنة بالتسمية المرتبطة لا لونًا وحده)؛ التبويب الداخلي «وجهة» بلا
   * مقعد هنا — القائمة والتقويم عرضان داخل وجهة واحدة (SOP-08)، والنطاق
   * والبحث المطبقان محفوظان عبر التبديل. */}
      <fieldset className="micro-payment-mode micro-view-toggle">
        <legend>العرض</legend>
        <label className="micro-view-segment">
          <input
            type="radio"
            name="orders-view"
            checked={view === "list"}
            onChange={() => switchView("list")}
          />
          <span>القائمة</span>
        </label>
        <label className="micro-view-segment">
          <input
            type="radio"
            name="orders-view"
            checked={view === "calendar"}
            onChange={() => switchView("calendar")}
          />
          <span>التقويم</span>
        </label>
      </fieldset>

      {view === "list" ? (
        /* S13-MR-001: فشل قراءة الطلبات لا يُعرض فراغًا مضللًا — القائمة
         * تعلن حقيقتها هي (الإشعار أسفل التبديل) والتقويم السليم متاح. */
        state.phase === "error" ? null : (
          <>
            {/* A2-3: البحث وزر التصفية — نطاق النتائج ظاهر دائمًا */}
            <div className="micro-orders-search">
              <label className="micro-field">
                <span>ابحث في الطلبات</span>
                <input
                  type="search"
                  value={applied.query}
                  onChange={event => {
                    setApplied(current => ({ ...current, query: event.target.value }));
                    setDraft(current => ({ ...current, query: event.target.value }));
                    setShownCount(DISPLAY_CAP);
                  }}
                  placeholder="اسم الطلب أو العميل"
                />
              </label>
              <Button action="secondary" onClick={() => setFilterOpen(openState => !openState)}>
                <SlidersHorizontal aria-hidden="true" /> تصفية
              </Button>
            </div>
            {filterOpen ? (
              <section className="micro-form-card" aria-label="لوحة تصفية الطلبات">
                <fieldset>
                  <legend>النطاق</legend>
                  {(
                    [
                      ["current", "الحالية"],
                      ["past", "السابقة"],
                      ["all", "كل الطلبات"],
                    ] as const
                  ).map(([value, label]) => (
                    <label className="micro-radio-choice" key={value}>
                      <input
                        type="radio"
                        name="orders-scope"
                        checked={draft.scope === value}
                        onChange={() => setDraft(current => ({ ...current, scope: value }))}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </fieldset>
                <fieldset>
                  <legend>الموعد</legend>
                  {(
                    [
                      ["all", "الكل"],
                      ["dated", "له موعد معلن"],
                      ["undated", "بلا موعد"],
                    ] as const
                  ).map(([value, label]) => (
                    <label className="micro-radio-choice" key={value}>
                      <input
                        type="radio"
                        name="orders-date"
                        checked={draft.datePresence === value}
                        onChange={() => setDraft(current => ({ ...current, datePresence: value }))}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </fieldset>
                <fieldset>
                  <legend>الترتيب</legend>
                  {(
                    [
                      ["recent", "الأحدث تعديلًا"],
                      ["byDate", "بالموعد المعلن"],
                    ] as const
                  ).map(([value, label]) => (
                    <label className="micro-radio-choice" key={value}>
                      <input
                        type="radio"
                        name="orders-ordering"
                        checked={draft.ordering === value}
                        onChange={() => setDraft(current => ({ ...current, ordering: value }))}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </fieldset>
                <div className="micro-form-actions">
                  <Button action="save" onClick={applyFilter}>
                    تطبيق
                  </Button>
                  <Button action="secondary" onClick={resetFilter}>
                    إعادة ضبط
                  </Button>
                  <Button
                    action="quiet"
                    onClick={() => {
                      setDraft(applied);
                      setFilterOpen(false);
                    }}
                  >
                    إلغاء
                  </Button>
                </div>
              </section>
            ) : null}

            {/* وصف النطاق بحدّ القراءة الفعلية (COPY-12 — UXR-03): العدد
                لنطاق القراءة فعلًا ودرجة الجزئية عند وجودها؛ تعريف النطاق
                عند تفعيله/الفراغ لا سطرًا دائمًا (N2). */}
            <p className="micro-scope-line" role="status">
              {scopeTitle} · {filteredOrders.length}
              {filteredOrders.length > shownCount ? ` (يُعرض ${shownCount})` : ""}
            </p>

            {filteredOrders.length === 0 ? (
              ordersReady.length === 0 ? (
                <EmptyState
                  aria-labelledby="orders-empty-title"
                  symbol={<ClipboardPlus />}
                  state={<StatusChip state="no-data">لا توجد طلبات محفوظة</StatusChip>}
                  title={<h2 id="orders-empty-title">لا طلبات بعد</h2>}
                  description={<>«طلب جديد» يفتح مسودة الطلب مباشرة؛ العميل والمنتج المحفوظان اختياريان.</>}
                  action={
                    <Button
                      action="create"
                      onClick={() => open("/orders/draft/new?intent=customer_order")}
                      disabled={disabledCapabilities.includes("orders")}
                    >
                      طلب جديد
                    </Button>
                  }
                />
              ) : applied.query.trim() !== "" ? (
                /* COPY-15 (UXR-03): بحث بلا نتائج — مسح البحث لا تحويله لعدم
                 * وجود طلبات أصلًا؛ ومدخل السجين محفوظ كقدرة عند وجوده. */
                <section className="micro-empty-inline">
                  <p>لا نتائج تطابق بحثك</p>
                  <div className="micro-form-actions micro-contextual-actions">
                    <Button
                      action="quiet"
                      onClick={() => {
                        setApplied(current => ({ ...current, query: "" }));
                        setDraft(current => ({ ...current, query: "" }));
                      }}
                    >
                      مسح البحث
                    </Button>
                    {pastCount > 0 && applied.scope === "current" ? (
                      <Button
                        action="quiet"
                        onClick={() => {
                          setApplied(current => ({ ...current, scope: "past" }));
                          setDraft(current => ({ ...current, scope: "past" }));
                        }}
                      >
                        الطلبات السابقة ({pastCount})
                      </Button>
                    ) : null}
                  </div>
                </section>
              ) : applied.datePresence !== "all" ? (
                <section className="micro-empty-inline">
                  <p>لا نتائج تطابق التصفية في هذا النطاق.</p>
                  <Button action="quiet" onClick={() => resetFilter()}>
                    إعادة ضبط التصفية
                  </Button>
                </section>
              ) : applied.scope === "current" && pastCount > 0 ? (
                /* COPY-14 (UXR-03): لا جملة «هذا لا يعني…» دائمة — الحالة
                 * الصادقة ومدخل السجل التاريخي المعلوم مع عدده فقط. */
                <section className="micro-empty-inline">
                  <p>لا طلبات حالية</p>
                  <Button
                    action="quiet"
                    onClick={() => {
                      setApplied(current => ({ ...current, scope: "past" }));
                      setDraft(current => ({ ...current, scope: "past" }));
                    }}
                  >
                    الطلبات السابقة ({pastCount})
                  </Button>
                </section>
              ) : (
                <p className="micro-empty-inline">لا طلبات في هذا النطاق.</p>
              )
            ) : (
              <div className="micro-draft-list" aria-label="قائمة الطلبات">
                {filteredOrders.slice(0, shownCount).map(stored => (
                  <OrderRow key={stored.id} stored={stored} onOpen={open} />
                ))}
                {/* A2-4/ORD-A3: مدخل السابق ظاهر حتى في فراغ الحالية */}
                {applied.scope === "current" && pastCount > 0 ? (
                  <button
                    className="micro-draft-row"
                    type="button"
                    onClick={() => {
                      setApplied(current => ({ ...current, scope: "past" }));
                      setDraft(current => ({ ...current, scope: "past" }));
                    }}
                  >
                    <span className="micro-draft-symbol">
                      <CalendarDays aria-hidden="true" />
                    </span>
                    <span>
                      <strong>الطلبات السابقة</strong>
                      <small>{pastCount} طلبًا منتهيًا أو ملغى — دينها وتصحيحها باقيان عند مصدرها.</small>
                    </span>
                    <ChevronLeft aria-hidden="true" />
                  </button>
                ) : null}
                {filteredOrders.length > shownCount ? (
                  <Button action="secondary" onClick={() => setShownCount(count => count + DISPLAY_CAP)}>
                    عرض المزيد ({filteredOrders.length - shownCount} متبقية)
                  </Button>
                ) : null}
              </div>
            )}

            {/* A2-5/A3: المسودة غير المرتبطة تظهر مرة بوصف «مسودة» ومدخل إكمال 007 */}
            {applied.scope !== "past" && draftsReady.length > 0 ? (
              <section className="micro-draft-list" aria-labelledby="orders-drafts-title">
                <div className="micro-section-title">
                  <ClipboardPlus aria-hidden="true" />
                  <div>
                    <span className="micro-overline">لم تتحول إلى اتفاق بعد</span>
                    <h2 id="orders-drafts-title">مسودات قيد الإكمال</h2>
                  </div>
                </div>
                {draftsReady.map(draftRow => (
                  <button
                    className="micro-draft-row"
                    type="button"
                    key={draftRow.id}
                    onClick={() => open(`/orders/draft/${draftRow.id}`)}
                  >
                    <span className="micro-draft-symbol">
                      <ClipboardPlus aria-hidden="true" />
                    </span>
                    <span>
                      <strong dir="auto">{draftRow.itemName || "مسودة تحتاج وصفًا"}</strong>
                      <small>
                        {draftRow.intent === "customer_order" ? "طلب من عميل" : "تصميم مخطط"} · مسودة — لا
                        موعد ولا مال منها
                      </small>
                      <small className="micro-row-next-action">الخطوة التالية: أكمل المسودة من محررها.</small>
                    </span>
                    <ChevronLeft aria-hidden="true" />
                  </button>
                ))}
              </section>
            ) : null}
          </>
        )
      ) : communityState.phase === "error" ? (
        /* S13-MR-001: فشل قراءة المواعيد معزول — الطلبات والمسودات السليمة
         * تظل مقروءة في القائمة، والتقويم يعلن حقيقته هو وإعادة المحاولة
         * تعيد مصدره وحده (لا تعيد قراءة الطلبات السليمة). */
        <section className="micro-source-errors" aria-label="تعذر تحميل مواعيد التقويم">
          <p className="micro-field-error" role="alert">
            {communityState.message} — التقويم تعذر وحده؛ القائمة السليمة متاحة من عرض «قائمة الطلبات».
          </p>
          <Button action="secondary" onClick={() => setCommunityRetryToken(token => token + 1)}>
            أعد قراءة مواعيد التقويم
          </Button>
        </section>
      ) : communityState.phase === "ready" ? (
        <OrdersCalendar
          community={communityState.community}
          mode={calendarMode}
          anchorDate={anchorDate}
          selectedDate={selectedDate}
          onMode={setCalendarMode}
          onAnchor={setAnchorDate}
          onSelect={setSelectedDate}
          onOpen={open}
          ordersEntryEnabled={!disabledCapabilities.includes("orders")}
        />
      ) : (
        <div className="micro-route-loading" role="status">
          جارٍ تحميل مواعيد التقويم…
        </div>
      )}

      {/* S13-MR-001: فشل قراءة الطلبات معزول — التقويم السليم يبقى متاحًا
       * والقائمة تعلن حقيقتها وإعادة محاولتها خاصة بها. */}
      {state.phase === "error" ? (
        <section className="micro-source-errors" aria-label="تعذر تحميل الطلبات">
          <p className="micro-field-error" role="alert">
            {state.message} — الطلبات تعذرت وحدها؛{" "}
            {communityState.phase === "ready" ? " التقويم السليم متاح من عرض «التقويم»." : ""}
          </p>
          <Button action="secondary" onClick={() => setReloadToken(token => token + 1)}>
            أعد قراءة الطلبات
          </Button>
        </section>
      ) : null}

      {/* A2-6: مدخلان ثانويان إلى المرجعين نفسيهما — لا CRM ولا كتالوج مستقل */}
      <div className="micro-form-actions micro-contextual-actions">
        <Button action="quiet" onClick={() => open("/parties")}>
          العملاء
        </Button>
        {disabledCapabilities.includes("catalog") ? null : (
          <Button action="quiet" onClick={() => open("/catalog")}>
            المنتجات والخدمات
          </Button>
        )}
      </div>
    </section>
  );
}

/* ─── صف الطلب (ORD-A4): أقل معلومات مفيدة — لا updatedAt كموعد ولا «متأخر» ─── */

function OrderRow({ stored, onOpen }: { stored: StoredCraftOrder; onOpen: (href: string) => void }) {
  const agreement = getAgreementPresentation({
    status: stored.order.status,
    agreedPriceMinor: stored.order.agreedPriceMinor,
    deliveryDate: stored.deliveryDate,
    nextAction: stored.order.nextAction,
  });
  const showRemaining =
    stored.order.receivableMinor > 0 &&
    (stored.order.status === "delivered" || stored.order.settlementStatus === "debt");
  return (
    <button className="micro-draft-row" type="button" onClick={() => onOpen(`/orders/${stored.id}`)}>
      <span className="micro-draft-symbol">
        <CalendarDays aria-hidden="true" />
      </span>
      <span>
        <strong dir="auto">{stored.order.itemName || "طلب بلا وصف"}</strong>
        <small>
          {agreement.label}
          {stored.order.customerName ? ` · ${stored.order.customerName}` : ""}
        </small>
        <small>
          {stored.deliveryDate === null ? (
            "بلا موعد معلن"
          ) : (
            <>
              التسليم: <LocalDateValue value={stored.deliveryDate} />
            </>
          )}
        </small>
        {showRemaining ? (
          <small>
            {stored.order.settlementStatus === "debt" ? "دين مسجل (د.أ): " : "المتبقي (د.أ): "}
            <MoneyValue minor={stored.order.receivableMinor} className="micro-inline-number" />
          </small>
        ) : null}
        {stored.order.nextAction?.trim() ? (
          <small className="micro-row-next-action">الخطوة التالية: {stored.order.nextAction}</small>
        ) : null}
      </span>
      <ChevronLeft aria-hidden="true" />
    </button>
  );
}

/* ─── التقويم (ORD-A6/CAL-01): شهر/أسبوع/يوم من المصدر نفسه — عرض فقط ─── */

function OrdersCalendar({
  community,
  mode,
  anchorDate,
  selectedDate,
  onMode,
  onAnchor,
  onSelect,
  onOpen,
  ordersEntryEnabled,
}: {
  community: ScheduleCommunity;
  mode: "month" | "week" | "day";
  anchorDate: string;
  selectedDate: string | null;
  onMode: (mode: "month" | "week" | "day") => void;
  onAnchor: (date: string) => void;
  onSelect: (date: string | null) => void;
  onOpen: (href: string) => void;
  ordersEntryEnabled: boolean;
}) {
  const today = todayInAmman();
  const effectiveSelected = selectedDate ?? today;
  const window = useMemo(() => windowOf(community, anchorDate, mode), [community, anchorDate, mode]);
  const dayEntries = useMemo(() => window.byDate.get(effectiveSelected) ?? [], [window, effectiveSelected]);
  /* S13-MR-006 (أمر ba2ce7b4 §4): دلالات شبكة حقيقية — رصف أسبوعي بأدوار
   * صفوف، ومسار تجوال واحد (roving tabindex)، وأسهم بلغة الاتجاه RTL
   * (اليسار = اليوم التالي)، وHome/End لطرفَي الأسبوع، وعبور حد الشهر
   * ينقل المرصوف نفسه إلى الشهر المجاور؛ الإعلان بالتاريخ المختار
   * (aria-selected) لا بالضغط. */
  const [focusedDate, setFocusedDate] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const monthDates = mode === "month" ? window.dates : [];
  const rovingDate =
    focusedDate !== null && monthDates.includes(focusedDate)
      ? focusedDate
      : monthDates.includes(effectiveSelected)
        ? effectiveSelected
        : monthDates.includes(today)
          ? today
          : (monthDates[0] ?? null);
  /* الأسهم تحرك التركيز فقط — الاختيار فعل صريح (Enter/Space/نقر) كما كان. */
  const moveGridFocus = (from: string, days: number) => {
    const next = localDatePlusDays(from, days);
    if (next === null) return;
    if (!monthDates.includes(next)) onAnchor(next);
    setFocusedDate(next);
  };
  const handleGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = focusedDate ?? rovingDate;
    if (from === null) return;
    const weekday = localDateWeekdayIndex(from) ?? 0;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveGridFocus(from, 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveGridFocus(from, -1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveGridFocus(from, -7);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      moveGridFocus(from, 7);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveGridFocus(from, -weekday);
    } else if (event.key === "End") {
      event.preventDefault();
      moveGridFocus(from, 6 - weekday);
    }
  };
  useEffect(() => {
    if (focusedDate === null || mode !== "month") return;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focusedDate}"]`)?.focus();
  }, [focusedDate, mode, anchorDate]);
  const monthTitle =
    mode === "month"
      ? formatMonthLabel(anchorDate.slice(0, 7))
      : mode === "week"
        ? `أسبوع ${formatLocalDate(anchorDate) ?? ""}`
        : (formatLocalDate(effectiveSelected) ?? "");
  /* ملكية حساب التاريخ عند صاحبه الكنوني (R4) — لا قص خام ولا UTC هنا. */
  const shiftAnchor = (days: number) => {
    onAnchor(localDatePlusDays(anchorDate, days) ?? anchorDate);
  };

  return (
    <section aria-labelledby="orders-calendar-title">
      <div className="micro-section-title">
        <CalendarDays aria-hidden="true" />
        <div>
          <span className="micro-overline">مواعيد التسليم من الجدول نفسه</span>
          <h2 id="orders-calendar-title">{monthTitle}</h2>
        </div>
      </div>
      <div className="micro-form-actions micro-calendar-controls">
        <Button
          action="quiet"
          onClick={() =>
            mode === "month" ? shiftMonth(anchorDate, -1) : shiftAnchor(mode === "week" ? -7 : -1)
          }
        >
          السابق
        </Button>
        <Button
          action="quiet"
          onClick={() => {
            onAnchor(today);
            onSelect(today);
          }}
        >
          اليوم
        </Button>
        <Button
          action="quiet"
          onClick={() =>
            mode === "month" ? shiftMonth(anchorDate, 1) : shiftAnchor(mode === "week" ? 7 : 1)
          }
        >
          التالي
        </Button>
      </div>
      {/* DEC-ORD-02 (UXR-03 — F-009): نطاق العرض (شهر/أسبوع/يوم) — نفس
          المفتاح المضغوط داخل وضع التقويم فقط (نطاق العرض يظهر هنا
          وحده — عقد 02-ORD)، فوق radio أصلية بلا بطاقات كبيرة. */}
      <fieldset className="micro-payment-mode micro-view-toggle">
        <legend>نطاق العرض</legend>
        {(
          [
            ["month", "شهر"],
            ["week", "أسبوع"],
            ["day", "يوم"],
          ] as const
        ).map(([value, label]) => (
          <label className="micro-view-segment" key={value}>
            <input
              type="radio"
              name="calendar-mode"
              checked={mode === value}
              onChange={() => onMode(value)}
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      {mode === "month" ? (
        <div
          className="micro-month-grid micro-orders-month"
          role="grid"
          aria-label={`تقويم ${monthTitle}`}
          ref={gridRef}
          onKeyDown={handleGridKeyDown}
        >
          <div role="row" className="micro-month-header-row">
            {weekdayLabels.map(label => (
              <span className="micro-month-weekday" key={label} role="columnheader">
                {label}
              </span>
            ))}
          </div>
          {monthWeekRows(window.dates).map((row, rowIndex) => (
            <div role="row" className="micro-month-week-row" key={`week-${rowIndex}`}>
              {row.map((date, dayIndex) =>
                date === null ? (
                  <span key={`pad-${rowIndex}-${dayIndex}`} role="presentation" />
                ) : (
                  (() => {
                    const entries = window.byDate.get(date) ?? [];
                    const isToday = date === today;
                    const isSelected = date === effectiveSelected;
                    return (
                      <button
                        type="button"
                        role="gridcell"
                        key={date}
                        data-date={date}
                        className="micro-month-day"
                        data-today={isToday || undefined}
                        data-selected={isSelected || undefined}
                        aria-label={`${formatLocalDate(date) ?? date} — ${entries.length} موعدًا`}
                        aria-selected={isSelected}
                        tabIndex={date === rovingDate ? 0 : -1}
                        onClick={() => {
                          setFocusedDate(date);
                          onSelect(date);
                        }}
                      >
                        <span className="micro-month-day-number">{date.slice(8, 10)}</span>
                        {entries.length > 0 ? (
                          <span className="micro-month-day-count">{entries.length}</span>
                        ) : null}
                      </button>
                    );
                  })()
                ),
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="micro-week-strip" role="list">
          {window.dates.map(date => {
            const entries = window.byDate.get(date) ?? [];
            const isToday = date === today;
            return (
              <button
                type="button"
                role="listitem"
                key={date}
                className="micro-week-day"
                data-today={isToday || undefined}
                data-selected={date === effectiveSelected || undefined}
                onClick={() => {
                  onAnchor(date);
                  onSelect(date);
                }}
              >
                <span>{weekdayLabels[localDateWeekdayIndex(date) ?? 0]}</span>
                <span className="micro-month-day-number">{date.slice(8, 10)}</span>
                {entries.length > 0 ? <span className="micro-month-day-count">{entries.length}</span> : null}
              </button>
            );
          })}
        </div>
      )}

      {/* قائمة اليوم المختار: نوع الموعد ووقته معلوم/دون وقت والطلب وعميله وحالته */}
      <section aria-labelledby="calendar-day-title" className="micro-draft-list">
        <h3 id="calendar-day-title">
          مواعيد {formatLocalDate(effectiveSelected) ?? effectiveSelected} ({dayEntries.length})
        </h3>
        {dayEntries.length === 0 ? (
          /* عقد 02-ORD: يوم فارغ — الحالة الصادقة بلا فقرة «لا يعني…» دائمة. */
          <p className="micro-empty-inline">لا مواعيد لهذا اليوم</p>
        ) : (
          dayEntries.map((entry: ScheduleCommunityEntry) => (
            <button
              className="micro-draft-row"
              type="button"
              key={entry.schedule.id}
              onClick={() => onOpen(`/orders/${entry.order.id}`)}
            >
              <span className="micro-draft-symbol">
                <CalendarDays aria-hidden="true" />
              </span>
              <span>
                <strong dir="auto">{entry.order.order.itemName || "موعد تسليم"}</strong>
                <small>
                  موعد تسليم ·{" "}
                  {entry.schedule.scheduledTime ? (
                    <TimeValue value={entry.schedule.scheduledTime} />
                  ) : (
                    "دون وقت محدد"
                  )}
                  {entry.order.order.customerName ? ` · ${entry.order.order.customerName}` : ""}
                </small>
                <small className="micro-row-next-action">
                  الخطوة التالية: افتح الطلب لمتابعته — الموعد لا يسجل تسليمًا.
                </small>
              </span>
              <ChevronLeft aria-hidden="true" />
            </button>
          ))
        )}
        {/* CAL-A: طلبات بلا موعد بمدخل واضح — لا تختفي لعدم صلاحيتها ليوم */}
        <button className="micro-draft-row" type="button" onClick={() => onOpen("/orders")}>
          <span className="micro-draft-symbol">
            <ClipboardPlus aria-hidden="true" />
          </span>
          <span>
            <strong>طلبات بلا موعد</strong>
            <small>
              {community.noDateOrders.length} طلبًا مؤكدًا لم يُحدد له موعد — مدخلها من القائمة، والموعد يُحدد
              من صاحبه.
            </small>
          </span>
          <ChevronLeft aria-hidden="true" />
        </button>
        {/* S13-R4-F02: الموعد غير الصالح حقيقة مستقلة — تُعلن باسمها لا
            تُخفى في «بلا موعد» ولا تُعد «معلنًا»؛ تصحيحها عند مالكها. */}
        {community.invalidDateOrders.length > 0 ? (
          <button className="micro-draft-row" type="button" onClick={() => onOpen("/orders")}>
            <span className="micro-draft-symbol">
              <CircleAlert aria-hidden="true" />
            </span>
            <span>
              <strong>طلبات بموعد يحتاج تصحيحًا</strong>
              <small>
                {community.invalidDateOrders.length} طلبًا بقيمة موعد غير صالحة — القيمة محفوظة كما هي
                وتصحيحها من الطلب نفسه.
              </small>
            </span>
            <ChevronLeft aria-hidden="true" />
          </button>
        ) : null}
        {/* S13-MR-004 (أمر ba2ce7b4 §4): الموعد النشط بقيمة غير صالحة حالة
            إصلاح معلنة — لا يختفي من التقويم ولا يُعرض «—»؛ الميعاد نفسه
            نشط لطلب حي فمدخله المستقل يفتح مصدره لتصحيحه عند مالكه. */}
        {community.invalidScheduleEntries.length > 0 ? (
          <section aria-label="مواعيد نشطة تحتاج تصحيحًا">
            {community.invalidScheduleEntries.map(entry => (
              <button
                className="micro-draft-row"
                type="button"
                key={entry.schedule.id}
                onClick={() => onOpen(`/orders/${entry.order.id}`)}
              >
                <span className="micro-draft-symbol">
                  <CircleAlert aria-hidden="true" />
                </span>
                <span>
                  <strong dir="auto">{entry.order.order.itemName || "موعد تسليم"}</strong>
                  <small>
                    موعد نشط بقيمة غير صالحة ({entry.schedule.scheduledFor}) — لا يظهر في أي يوم؛ صحّحه من
                    الطلب.
                  </small>
                  <small className="micro-row-next-action">
                    الخطوة التالية: افتح الطلب وصحّح موعده عند مالكه — القيمة كما هي لم تُمحَ.
                  </small>
                </span>
                <ChevronLeft aria-hidden="true" />
              </button>
            ))}
          </section>
        ) : null}
        {ordersEntryEnabled ? (
          /* CAL-C: اليوم المختار يصل اقتراحًا ظاهرًا قابلًا للتعديل/الإزالة —
           * لا حفظ من الفتح ولا حقل خفي ولا حجز يوم. */
          <Button
            action="secondary"
            onClick={() =>
              onOpen(
                `/orders/draft/new?intent=customer_order${selectedDate ? `&propose=${selectedDate}` : ""}`,
              )
            }
          >
            <Plus aria-hidden="true" /> طلب جديد
          </Button>
        ) : null}
      </section>
    </section>
  );
}

/* S13-R4-F01 (تصحيح المراجعة الرابعة): إزاحة الشهر بالمساعد الكنوني
 * (مالك حساب التاريخ) — لا كائن Date خام ولا حساب UTC هنا. */
function shiftMonth(anchor: string, offset: number): string {
  return localDatePlusMonthsClamped(anchor, offset) ?? anchor;
}

/* S13-MR-006 (أمر ba2ce7b4 §4): رصف أسابيع الشهر في صفوف شبكة سليمة —
 * الأيام في صفوف من 7 مع حشو البداية (أيام الأسبوع قبل أول يوم) والنهاية
 * (بعد آخر يوم) خلايا عرض بلا دور؛ الصف الأول يبدأ عند فهرس يوم أول الشهر
 * من الأحد (المالك الكنوني: localDateWeekdayIndex). */
function monthWeekRows(dates: readonly string[]): Array<Array<string | null>> {
  if (dates.length === 0) return [];
  const leading = localDateWeekdayIndex(dates[0]!) ?? 0;
  const cells: Array<string | null> = [...Array.from({ length: leading }, (): null => null), ...dates];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: Array<Array<string | null>> = [];
  for (let index = 0; index < cells.length; index += 7) rows.push(cells.slice(index, index + 7));
  return rows;
}
