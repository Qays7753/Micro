import {
  ArrowLeft,
  BadgeDollarSign,
  BellRing,
  CalendarDays,
  CircleAlert,
  CircleDollarSign,
  ClipboardList,
  ClipboardPlus,
  CloudSun,
  FilePen,
  Gauge,
  HandCoins,
  Landmark,
  Lightbulb,
  MoreHorizontal,
  Package,
  Receipt,
  Scale,
  ShieldCheck,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { useQuickRecording } from "@/app/quickRecording";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { Button } from "@/components/primitives";
import { formatArabicPlural, formatLocalDateLong, formatMoneyMinor } from "@/presentation/formatters";
import { withReturnTo } from "@/app/navigationContract";
import type {
  HomeControlCenterViewModel,
  HomeFinancialFact,
  HomeInsight,
  HomePeriodNumber,
  HomeTodayItem,
} from "@/application/home/homeControlCenterModel";

type HomeState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; model: HomeControlCenterViewModel };

const factIcon: Record<HomeFinancialFact["id"], typeof WalletCards> = {
  cash: WalletCards,
  receivables: Receipt,
  payables: ClipboardList,
  owner_capital: WalletCards,
  unallocated: Landmark,
};
/* §10.2: الحالة المعروفة يتكلم عنها الرقم نفسه — الوسم للمجهول والناقص فقط.
 * المجموعة ١: المجهول «غير محدد بعد» لا صفر ولا «—» بلا تفسير. */
const factStateLabel = (state: HomeFinancialFact["state"]) =>
  state === "incomplete" ? "غير محدد بعد" : state === "not_initialized" ? "غير مسجل" : null;

function FactCard({ fact, onNavigate }: { fact: HomeFinancialFact; onNavigate: (href: string) => void }) {
  const Icon = factIcon[fact.id];
  return (
    <article className="micro-home-fact" data-state={fact.state}>
      <div className="micro-home-fact-heading">
        <Icon aria-hidden="true" />
        <span>{fact.label}</span>
      </div>
      <strong>
        {fact.state === "known" && fact.valueMinor !== null ? (
          /* المجموعة ٦ (البند ٢): الحقيقة المعروفة تفتح مصدرها الدقيق — قيمة مال
           * المالك نقرة إلى الدفتر الموحد، بلا بطاقة ميتة. */
          fact.source ? (
            <button
              className="micro-text-action"
              type="button"
              aria-label={`افتح ${fact.label}`}
              onClick={() => onNavigate(fact.source!)}
            >
              <MoneyValue minor={fact.valueMinor} />
            </button>
          ) : (
            <MoneyValue minor={fact.valueMinor} />
          )
        ) : fact.state === "not_initialized" && fact.road ? (
          /* §2.7: الحقيقة غير المسجلة طريق — «غير مسجل — سجّله (نقرة)». */
          <button
            className="micro-text-action micro-fact-road"
            type="button"
            onClick={() => onNavigate(fact.road!.href)}
          >
            {factStateLabel(fact.state)} — {fact.road.label}
          </button>
        ) : (
          /* §6: المجهول علامة معلنة — لا رقم مختلق. */
          (factStateLabel(fact.state) ?? "—")
        )}
      </strong>
      {/* المجموعة ١ (§7.1): مؤهل الأمانة — الكاش يشمل مالًا ليس مالك؛ يظهر لا يُدفن. */}
      {fact.qualifier ? <small className="micro-home-fact-qualifier">{fact.qualifier}</small> : null}
    </article>
  );
}

/* دمج بند ١٠: أنواع «اليوم» المدمجة — أنواع المتابعة القديمة بأيقوناتها الطبيعية. */
const todayItemIcon: Record<HomeTodayItem["kind"], typeof BellRing> = {
  follow_up_due: BellRing,
  appointment_today: CalendarDays,
  due_amount: HandCoins,
  follow_up_upcoming: BellRing,
  draft: FilePen,
  cost_incomplete: Gauge,
  open_order: Package,
  result_review: Scale,
  capacity_warning: CalendarDays,
};

function TodayItemRow({ item, onNavigate }: { item: HomeTodayItem; onNavigate: (href: string) => void }) {
  const Icon = todayItemIcon[item.kind];
  return (
    <article className="micro-home-today-item" data-kind={item.kind}>
      <div>
        <strong>
          <Icon aria-hidden="true" /> <bdi dir="auto">{item.title}</bdi>
        </strong>
        {item.detail ? <p>{item.detail}</p> : null}
        {item.dateLocal ? (
          <small>
            <time dateTime={item.dateLocal}>{formatLocalDateLong(item.dateLocal) ?? item.dateLocal}</time>
            {item.timeLocal ? (
              <bdi dir="ltr" className="micro-inline-number">
                {" "}
                · {item.timeLocal}
              </bdi>
            ) : null}
          </small>
        ) : null}
      </div>
      <button className="micro-text-action" type="button" onClick={() => onNavigate(item.href)}>
        {item.actionLabel}
        <ArrowLeft aria-hidden="true" />
      </button>
    </article>
  );
}

/* Wave 4.3 — P-4.3-2 (D7): رقم فترة واحد من القراءة الرسمية — قابل للفتح إلى
 * مصدره (عرض الفترة)، والناقص وصف صادق لا صفر مضلل. */
function PeriodNumberRow({
  number,
  onNavigate,
}: {
  number: HomePeriodNumber;
  onNavigate: (href: string) => void;
}) {
  return (
    <article className="micro-home-number" data-state={number.state}>
      <span>{number.label}</span>
      <strong>
        {number.state === "known" && number.valueMinor !== null ? (
          number.source ? (
            <button
              className="micro-text-action"
              type="button"
              aria-label={`افتح ${number.label}`}
              onClick={() => onNavigate(number.source!)}
            >
              <MoneyValue minor={number.valueMinor} />
            </button>
          ) : (
            <MoneyValue minor={number.valueMinor} />
          )
        ) : (
          <span className="micro-home-number-note">{number.honestNote ?? "غير مكتملة"}</span>
        )}
      </strong>
    </article>
  );
}

/* P-4.3-2 (D6): Insight قصير — ماذا حدث، لماذا يهم، فعل منطقي واحد. */
function InsightRow({ insight, onNavigate }: { insight: HomeInsight; onNavigate: (href: string) => void }) {
  return (
    <li className="micro-home-insight" data-testid="home-insight">
      <Lightbulb aria-hidden="true" />
      <div>
        <p>{insight.what}</p>
        {insight.why ? <small>{insight.why}</small> : null}
      </div>
      {insight.action ? (
        <button className="micro-text-action" type="button" onClick={() => onNavigate(insight.action!.href)}>
          {insight.action.label}
          <ArrowLeft aria-hidden="true" />
        </button>
      ) : null}
    </li>
  );
}

export default function Home() {
  const [, navigate] = useLocation();
  const { preferences, homeControlCenter, dataVersion } = usePrototypeServices();
  const [state, setState] = useState<HomeState>({ phase: "loading" });
  /* NAV-001: أزرار التسجيل السريع في «مشروعي الآن» — البيع والمصروف يفتحان
   * الورقة عبر سياق القشرة في نموذجهما مباشرة، والطلب والتقدير والتحصيل
   * مساراتها العميقة. */
  const quickRecording = useQuickRecording();
  /* SET-003: القدرات المتوقفة عن الإدخال تخفي أزرار إنشائها اليومية فقط —
   * السجلات القائمة تبقى ظاهرة في كل دفاترها. */
  const [disabledCapabilities, setDisabledCapabilities] = useState<readonly string[]>([]);
  /* Wave 4.3 — P-4.3-2: «المزيد» يضم بقية الإجراءات المتكررة الأقل استخدامًا —
   * لا قائمة طويلة تنافس الإجراء الأساسي. */
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  /* SET-002: لافتة نجاح الإعداد الأول — تظهر مرة بعد الحفظ وتغادر مع التنقل. */
  const search = useSearch();
  const setupDone = new URLSearchParams((search ?? "").replace(/^\?/, "")).get("setup") === "1";
  useEffect(() => {
    let active = true;
    /* S5-08 (المجموعة ٦ — البند ٦): تحديث خلفي لا وميض تحميل — القراءة السابقة
     * تبقى معروضة حتى تصل الجديدة (stale-while-revalidate)؛ حالة التحميل الكاملة
     * للإقلاع الأول فقط. */
    setState(current => (current.phase === "ready" ? current : { phase: "loading" }));
    homeControlCenter.read().then(result => {
      if (!active) return;
      setState(
        result.ok ? { phase: "ready", model: result.value } : { phase: "error", message: result.message },
      );
    });
    /* SET-003: قراءة القدرات — غياب الخدمة في بيئة اختبار لا يُسقط السطح. */
    if (typeof preferences?.readDisabledCapabilities === "function") {
      preferences
        .readDisabledCapabilities()
        .then(result => {
          if (active && result.ok) setDisabledCapabilities(result.disabled);
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [dataVersion, homeControlCenter, preferences]);
  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ تجهيز مشروعك…
      </div>
    );
  if (state.phase === "error")
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر تحميل مشروعك</h1>
        <p>{state.message}</p>
        {/* W4: فعل الإعادة فعل اعتيادي — صنف الحفظ (سطح دافئ + حبر). */}
        <Button action="save" onClick={() => window.location.reload()}>
          إعادة المحاولة
        </Button>
      </section>
    );
  const { model } = state;
  /* المجموعة ١ (§7.2): كل رحلة من الرئيسية تحفظ مصدرها — الرجوع يعود هنا لا لصفحة عامة. */
  const openFromHome = (href: string) => navigate(withReturnTo(href, "/"));
  const todayRows = model.priorityBlock
    ? model.todaySection.items.filter(item => item.id !== model.priorityBlock!.id)
    : model.todaySection.items;
  const ordersEnabled = !disabledCapabilities.includes("orders");
  /* P-4.3-2: الإجراءات الأقل تكرارًا خلف «المزيد» — يظهر الزر فقط حين يوجد
   * شيء خلفه فعلًا (لا زر ميت). */
  const moreActions =
    ordersEnabled === false
      ? []
      : [
          {
            id: "estimate",
            label: "مسودة تصميم",
            icon: FilePen,
            open: () => navigate(withReturnTo("/orders/draft/new?intent=planned_design", "/")),
          },
        ];
  return (
    <section className="micro-page micro-home-control-center">
      <div className="micro-page-heading micro-home-heading">
        <span className="micro-overline">مشروعي الآن</span>
        <h1>{model.heading.activityName}</h1>
        <div className="micro-home-heading-row">
          <p>
            <CalendarDays aria-hidden="true" />{" "}
            <time dateTime={model.heading.todayLocal}>
              {formatLocalDateLong(model.heading.todayLocal) ?? model.heading.todayLocal}
            </time>
          </p>
          {/* Wave 4.3 — P-4.3-1: مدخل الملف انتقل إلى قائمة الشعار الدائمة —
              لا تكرار للمدخل نفسه فوق الرئيسية. */}
        </div>
      </div>
      {/* SET-002: نجاح واضح بعد الإعداد الأول — المشروع جاهز للاستخدام فورًا. */}
      {setupDone ? (
        <section className="micro-note-card" role="status" data-testid="setup-success-banner">
          <ShieldCheck aria-hidden="true" />
          <p>
            {`تم إنشاء مشروعك «${model.heading.activityName}» — ابدأ الآن بتسجيل أول عملية من أزرار التسجيل السريع هنا؛ وصفحة الأساس عمق اختياري تكمله لاحقًا من زر «صفحة الأساس» في قسم «المالية» أسفل هذه الصفحة.`}
          </p>
        </section>
      ) : null}
      {model.truthLine ? (
        <p className="micro-home-truth-line" role="status">
          <CircleAlert aria-hidden="true" /> {model.truthLine}{" "}
          <button className="micro-text-action" type="button" onClick={() => openFromHome("/settings")}>
            افتح الإعدادات
          </button>
        </p>
      ) : null}
      {/* Wave 4.3 — P-4.3-2 (D6 أولًا): الحالة الأهم الآن — تنبيه رئيسي واحد
          قابل للتصرف؛ البقية في قائمة «اليوم» المختصرة أسفل الصفحة. */}
      {model.priorityBlock ? (
        <section className="micro-home-priority" aria-labelledby="home-priority-title">
          <div className="micro-section-title">
            <BellRing aria-hidden="true" />
            <div>
              <h2 id="home-priority-title">الأهم الآن</h2>
            </div>
          </div>
          <TodayItemRow item={model.priorityBlock} onNavigate={openFromHome} />
        </section>
      ) : null}
      {/* التدفق ٢٣: بطاقة «أثناء غيابك» — تظهر بعد ٧ أيام بلا تسجيل وتختفي بالنشاط. */}
      {model.awaySection ? (
        <section className="micro-away-card" aria-label="أثناء غيابك">
          <b>
            <CloudSun aria-hidden="true" /> أثناء غيابك — آخر تسجيل قبل{" "}
            {formatArabicPlural(model.awaySection.daysSinceLastActivity, {
              zero: "أقل من يوم",
              one: "يوم واحد",
              two: "يومين",
              few: "أيام",
              many: "يومًا",
              other: "يوم",
            })}
          </b>
          <ul>
            {/* U-002 (دورة التدقيق النهائي): ملخص «آخر يوم تسجيل» الصادق — لا شيء يتحرك
                خلال الغياب في تطبيق محلي، فالملخص يصف آخر جلسة تسجيل فعلية. */}
            <li>
              {model.awaySection.digest.salesCount === 0 &&
              model.awaySection.digest.expenseCount === 0 &&
              model.awaySection.digest.newOrderCount === 0 ? (
                "آخر يوم تسجيل لم يشمل بيعًا ولا مصروفًا ولا طلبًا جديدًا."
              ) : (
                <>
                  آخر يوم تسجيل (
                  {formatLocalDateLong(model.awaySection.digest.lastRecordedOn) ??
                    model.awaySection.digest.lastRecordedOn}
                  ):
                  {model.awaySection.digest.salesCount > 0
                    ? ` ${formatArabicPlural(model.awaySection.digest.salesCount, {
                        zero: "لم يُبَع شيء",
                        one: "بِيع بيع واحد",
                        two: "بِيع بيعان",
                        few: "بيعت مبيعات",
                        many: "بِيع",
                        other: "بِيع",
                      })} بـ ${formatMoneyMinor(model.awaySection.digest.salesRevenueMinor)} د.أ`
                    : ""}
                  {model.awaySection.digest.expenseCount > 0
                    ? `${model.awaySection.digest.salesCount > 0 ? " ·" : ""} ${formatArabicPlural(
                        model.awaySection.digest.expenseCount,
                        {
                          zero: "لا مصروف",
                          one: "مصروف واحد",
                          two: "مصروفان",
                          few: "مصروفات",
                          many: "مصروفًا",
                          other: "مصروف",
                        },
                      )} بـ ${formatMoneyMinor(model.awaySection.digest.expenseMinor)} د.أ`
                    : ""}
                </>
              )}
            </li>
            {model.awaySection.digest.newOrderCount > 0 ? (
              <li>طلبات جديدة: {model.awaySection.digest.newOrderCount}</li>
            ) : null}
            {model.awaySection.digest.upcomingFollowUpCount > 0 ? (
              <li>
                متابعات قادمة: {model.awaySection.digest.upcomingFollowUpCount} —{" "}
                <button className="micro-text-action" type="button" onClick={() => openFromHome("/orders")}>
                  راجعها
                </button>
              </li>
            ) : null}
            {model.awaySection.overdueDebtCount > 0 ? (
              <li>
                {model.awaySection.overdueDebtCount} دين فات موعد متابعته —{" "}
                <button className="micro-text-action" type="button" onClick={() => openFromHome("/parties")}>
                  راجع دفتر الناس
                </button>
              </li>
            ) : null}
            <li>
              {model.awaySection.daysSinceLastExport === null
                ? "لا توجد نسخة احتياطية معتمدة بعد"
                : `آخر نسخة احتياطية قبل ${formatArabicPlural(model.awaySection.daysSinceLastExport, {
                    zero: "أقل من يوم",
                    one: "يوم واحد",
                    two: "يومين",
                    few: "أيام",
                    many: "يومًا",
                    other: "يوم",
                  })}`}{" "}
              —{" "}
              <button className="micro-text-action" type="button" onClick={() => openFromHome("/settings")}>
                انسخ الآن
              </button>
            </li>
          </ul>
        </section>
      ) : null}
      {/* P-4.3-2 (D6 ثانيًا): ملخص الأرقام — تقسيم واضح «اليوم» و«هذا الشهر»
          ثم الوضع القائم، بدل عدد كبير من البطاقات دفعة واحدة. */}
      <section className="micro-home-numbers-section" aria-labelledby="home-numbers-title">
        <div className="micro-section-title">
          <TrendingUp aria-hidden="true" />
          <div>
            <h2 id="home-numbers-title">أرقامك</h2>
          </div>
        </div>
        <div className="micro-home-numbers" data-testid="home-numbers">
          <div className="micro-home-numbers-period" data-period="today">
            <h3>اليوم</h3>
            <PeriodNumberRow number={model.periodNumbers.today.sales} onNavigate={openFromHome} />
            <PeriodNumberRow number={model.periodNumbers.today.result} onNavigate={openFromHome} />
          </div>
          <div className="micro-home-numbers-period" data-period="month">
            <h3>هذا الشهر</h3>
            <PeriodNumberRow number={model.periodNumbers.month.sales} onNavigate={openFromHome} />
            <PeriodNumberRow number={model.periodNumbers.month.result} onNavigate={openFromHome} />
          </div>
        </div>
        <div className="micro-home-facts">
          {model.facts.map(fact => (
            <FactCard key={fact.id} fact={fact} onNavigate={openFromHome} />
          ))}
        </div>
      </section>
      {/* P-4.3-2 (D6 ثالثًا): الإجراءات السريعة — إجراء أساسي بارز، حتى أربعة
          متكررة ظاهرة، والبقية في «المزيد»؛ القدرات المعطلة تخفي أزرارها. */}
      <section className="micro-home-quick-actions" aria-labelledby="home-quick-title">
        <div className="micro-section-title">
          <BadgeDollarSign aria-hidden="true" />
          <div>
            <h2 id="home-quick-title">سجّل بسرعة</h2>
          </div>
        </div>
        <div className="micro-quick-actions" data-testid="home-quick-actions">
          <button
            className="micro-quick-action micro-quick-action-primary"
            type="button"
            onClick={() => quickRecording.openQuickForm("sale-form")}
          >
            <BadgeDollarSign aria-hidden="true" /> سجّل بيعًا
          </button>
          <button
            className="micro-quick-action"
            type="button"
            onClick={() => quickRecording.openQuickForm("expense-form")}
          >
            <CircleDollarSign aria-hidden="true" /> سجّل مصروفًا
          </button>
          {ordersEnabled ? (
            <button
              className="micro-quick-action"
              type="button"
              onClick={() => navigate(withReturnTo("/orders/draft/new?intent=customer_order", "/"))}
            >
              <ClipboardPlus aria-hidden="true" /> طلب من عميل
            </button>
          ) : null}
          <button
            className="micro-quick-action"
            type="button"
            onClick={() => navigate(withReturnTo("/collect", "/"))}
          >
            <HandCoins aria-hidden="true" /> عربون أو تحصيل
          </button>
          <button
            className="micro-quick-action"
            type="button"
            onClick={() => openFromHome(model.catalogUnit.action.href)}
          >
            <Package aria-hidden="true" /> منتجاتي وخدماتي
          </button>
          {moreActions.length > 0 ? (
            <button
              className="micro-quick-action"
              type="button"
              aria-expanded={moreActionsOpen}
              onClick={() => setMoreActionsOpen(open => !open)}
            >
              <MoreHorizontal aria-hidden="true" /> المزيد
            </button>
          ) : null}
        </div>
        {moreActionsOpen && moreActions.length > 0 ? (
          <div className="micro-quick-actions micro-quick-actions-more" data-testid="home-quick-actions-more">
            {moreActions.map(entry => (
              <button key={entry.id} className="micro-quick-action" type="button" onClick={entry.open}>
                <entry.icon aria-hidden="true" /> {entry.label}
              </button>
            ))}
          </div>
        ) : null}
      </section>
      {/* P-4.3-2 (D6 رابعًا): Insights قصيرة من البيانات الحالية فقط — كل
          ملحوظة ماذا حدث ولماذا يهم وفعل منطقي واحد، بلا تكرار للسبب الجذري. */}
      {model.insights.length > 0 ? (
        <section className="micro-home-insights-section" aria-labelledby="home-insights-title">
          <div className="micro-section-title">
            <Lightbulb aria-hidden="true" />
            <div>
              <h2 id="home-insights-title">ملحوظات تهمك</h2>
            </div>
          </div>
          <ul className="micro-home-insights-list">
            {model.insights.map(insight => (
              <InsightRow key={insight.id} insight={insight} onNavigate={openFromHome} />
            ))}
          </ul>
        </section>
      ) : null}
      {/* الكتلة ٢ من ٣ — «مالي» (القرار ١٢): وحدة دائمة بلا شرط. */}
      <section className="micro-home-finance-section" aria-labelledby="home-finance-title">
        <div className="micro-section-title">
          <Landmark aria-hidden="true" />
          <div>
            <h2 id="home-finance-title">المالية</h2>
          </div>
        </div>
        <div className="micro-home-finance-unit">
          <div>
            {/* القرار ٧: صفحة الأساس دائمة الوصول ولا تُغلق بعد اليوم الأول. */}
            <button className="micro-text-action" type="button" onClick={() => openFromHome("/foundation")}>
              صفحة الأساس <ArrowLeft aria-hidden="true" />
            </button>
          </div>
          {/* W4: فعل تنقل اعتيادي إلى المالية — صنف الحفظ لا صنف الإنشاء. */}
          <Button action="save" onClick={() => openFromHome(model.financeUnit.action.href)}>
            {model.financeUnit.action.label}
            <ArrowLeft aria-hidden="true" />
          </Button>
        </div>
      </section>
      {/* الكتلة ١ من ٣ — «اليوم» (دمج بند ١٠): أفعال محددة (حصّل/سلّم/أكمل/راجع)
          لا «افتح» العامة؛ قائمة مختصرة بعد الأولوية والأرقام والإجراءات. */}
      <section className="micro-home-today-section" aria-labelledby="home-today-title">
        <div className="micro-section-title">
          <CalendarDays aria-hidden="true" />
          <div>
            <h2 id="home-today-title">اليوم</h2>
          </div>
        </div>
        {todayRows.length > 0 ? (
          <div className="micro-home-today-list">
            {todayRows.map(item => (
              <TodayItemRow key={item.id} item={item} onNavigate={openFromHome} />
            ))}
          </div>
        ) : (
          <div className="micro-home-quiet">
            <strong>يومك مفتوح</strong>
            <p>سجّل أول بيع أو طلب من أزرار «سجّل بسرعة» أعلى الصفحة — ما لا تسجله لا يُخترع له رقم.</p>
          </div>
        )}
        {model.todaySection.upcomingCount > 0 && model.todaySection.nextUpcomingDate ? (
          <p className="micro-home-truth-line">
            قادمة: {formatLocalDateLong(model.todaySection.nextUpcomingDate)} —{" "}
            <button
              className="micro-text-action"
              type="button"
              onClick={() =>
                model.todaySection.nextUpcomingHref ? openFromHome(model.todaySection.nextUpcomingHref) : null
              }
            >
              افتح أقربها
            </button>
          </p>
        ) : null}
      </section>
      {model.optionalModules.length > 0 ? (
        <section className="micro-home-optional-section" aria-labelledby="home-optional-title">
          <div className="micro-section-title">
            <ClipboardList aria-hidden="true" />
            <div>
              <h2 id="home-optional-title">مسارات مرتبطة فقط</h2>
            </div>
          </div>
          <div className="micro-home-optional-list">
            {model.optionalModules.map(module => (
              <article className="micro-home-optional-item" data-state={module.state} key={module.id}>
                <div>
                  <strong>{module.label}</strong>
                </div>
                {module.action ? (
                  <button
                    className="micro-text-action"
                    type="button"
                    onClick={() => openFromHome(module.action!.href)}
                  >
                    {module.action.label}
                    <ArrowLeft aria-hidden="true" />
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {model.recentChanges.length > 0 ? (
        <section className="micro-home-recent-section" aria-labelledby="home-recent-title">
          <div className="micro-section-title">
            <Receipt aria-hidden="true" />
            <div>
              {/* المجموعة ٥ (عقد ٣٠): نافذة هادئة من القارئ الموحّد — تسمية الأثر
               * كلمة واحدة، والمبلغ حيث يوجد رقم صادق فقط. */}
              <h2 id="home-recent-title">آخر ما حدث</h2>
            </div>
          </div>
          <div className="micro-home-recent-list">
            {model.recentChanges.map(change => (
              <button
                className="micro-home-recent-item"
                type="button"
                key={change.id}
                onClick={() => openFromHome(change.href)}
              >
                <span>
                  <time dateTime={change.occurredOn}>
                    {formatLocalDateLong(change.occurredOn) ?? change.occurredOn}
                  </time>
                  <strong dir="auto">{change.title}</strong>
                  {change.detail ? <small>{change.detail}</small> : null}
                  {change.effectWord ? (
                    <small className="micro-home-recent-effect">{change.effectWord}</small>
                  ) : null}
                </span>
                {change.amountMinor !== null && change.amountMinor !== undefined ? (
                  <b className="micro-home-recent-amount">
                    {/* مراجعة 5-RV-A: الوحدة مع الرقم — قراءة واحدة بلا لبس
                        واتساقًا مع قارئ النشاط الكامل. (W4: يبقى التكوين
                        الحرفي — حد كثافة النص يقيس الوحدة كنص مستقل هنا،
                        وتكوين MoneyWithUnit معتمد في رحلة المالية.) */}
                    <MoneyValue minor={change.amountMinor} /> د.أ
                  </b>
                ) : null}
              </button>
            ))}
          </div>
          <button
            className="micro-text-action micro-home-recent-open"
            type="button"
            onClick={() => openFromHome("/finance/activity")}
          >
            افتح السجل الكامل
          </button>
        </section>
      ) : null}
      {/* المجموعة ١ (§7.1): سطر المكان/العمل بلا اتصال — بديل صادق عن نص النطاق. */}
      <div className="micro-home-locality" role="note">
        <ShieldCheck aria-hidden="true" />
        <span>بياناتك محفوظة على هذا الجهاز</span>
      </div>
    </section>
  );
}
