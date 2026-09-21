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
import { useDisabledCapabilities } from "@/app/useDisabledCapabilities";
import { useQuickRecording } from "@/app/quickRecording";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { Button, Row, RowList } from "@/components/primitives";
import { formatArabicPlural, formatLocalDateLong, formatMoneyMinor } from "@/presentation/formatters";
import { withReturnTo } from "@/app/navigationContract";
import type {
  HomeControlCenterViewModel,
  HomeFinancialFact,
  HomeInsight,
  HomePeriodNumber,
  HomeTodayItem,
} from "@/application/home/homeControlCenterModel";

/* Z1.4 (§3.1 — حالات القراءة): الإقلاع الأول له بوابة تحميل كاملة وسطح خطأ
 * كامل؛ أما فشل التحديث الخلفي مع جهوزية قائمة فيُعلن خطأً مضمّنًا فوق
 * المحتوى الجاهز الذي يبقى في مكانه، مع إعادة محاولة آمنة تعيد القراءة
 * نفسها في مكانها (لا إعادة تحميل الصفحة أبدًا). */
type HomeState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; model: HomeControlCenterViewModel; refreshError: string | null };

const factIcon: Record<HomeFinancialFact["id"], typeof WalletCards> = {
  cash: WalletCards,
  receivables: Receipt,
  payables: ClipboardList,
  owner_capital: WalletCards,
  unallocated: Landmark,
};
/* §10.2: الحالة المعروضة يتكلم عنها الرقم نفسه — الوسم للمجهول والناقص فقط.
 * المجموعة ١: المجهول «غير محدد بعد» لا صفر ولا «—» بلا تفسير. */
const factStateLabel = (state: HomeFinancialFact["state"]) =>
  state === "incomplete" ? "غير محدد بعد" : state === "not_initialized" ? "غير مسجل" : null;

/* Z1.5 (تقليل حمل البطاقات): الحقائق القائمة صفوف تشغيلية مفتوحة (Row) —
 * قيمة خانة خلفية، ومؤهل الأمانة شرحًا تحت العنوان؛ نفس الأسماء المتاحة
 * (افتح X) ونفس عروض الطريق/غير المسجل بلا أي تغيير في المعنى. */
function FactRow({ fact, onNavigate }: { fact: HomeFinancialFact; onNavigate: (href: string) => void }) {
  const Icon = factIcon[fact.id];
  return (
    <Row
      lead={<Icon aria-hidden="true" />}
      title={fact.label}
      caption={fact.qualifier}
      trailing={
        fact.state === "known" && fact.valueMinor !== null ? (
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
        )
      }
    />
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

function TodayItemRow({
  item,
  onNavigate,
  hideAction = false,
}: {
  item: HomeTodayItem;
  onNavigate: (href: string) => void;
  /* Z1.2 (§3.1): بند الأولوية المرفوع داخل منطقة حالة اليوم بلا فعله النصي
   * الصغير — CTA الأساسي الواحد يحمل الفعل نفسه، فلا يتكرر بجواره. */
  hideAction?: boolean;
}) {
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
      {hideAction ? null : (
        <button className="micro-text-action" type="button" onClick={() => onNavigate(item.href)}>
          {item.actionLabel}
          <ArrowLeft aria-hidden="true" />
        </button>
      )}
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
  /* Z1.4: عدّاد إعادة المحاولة الآمنة — زيادته تعيد تشغيل قراءة الواجهة نفسها
   * في مكانها (سطح الخطأ الكامل والخطأ المضمّن كلاهما)، بلا إعادة تحميل. */
  const [retryCount, setRetryCount] = useState(0);
  /* NAV-001: أزرار التسجيل السريع في «مشروعي الآن» — البيع والمصروف يفتحان
   * الورقة عبر سياق القشرة في نموذجهما مباشرة، والطلب والتقدير والتحصيل
   * مساراتها العميقة. */
  const quickRecording = useQuickRecording();
  /* SET-003 / G-004: القدرات المتوقفة عن الإدخال تخفي أزرار إنشائها اليومية
   * فقط — السجلات القائمة تبقى ظاهرة في كل دفاترها؛ القارئ المركزي المشترك
   * نفسه لكل الأسطح (useDisabledCapabilities). */
  const { disabled: disabledCapabilities } = useDisabledCapabilities();
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
      setState(current => {
        if (result.ok) return { phase: "ready", model: result.value, refreshError: null };
        /* Z1.4 (§3.1 — حالة الخطأ): فشل التحديث الخلفي مع جهوزية قائمة لا
         * يستبدلها — المحتوى الجاهز يبقى وخطأ القراءة يُعلن مضمّنًا. */
        if (current.phase === "ready")
          return { phase: "ready", model: current.model, refreshError: result.message };
        return { phase: "error", message: result.message };
      });
    });
    return () => {
      active = false;
    };
  }, [dataVersion, homeControlCenter, retryCount]);
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
        {/* W4 + Z1.4: فعل الإعادة فعل اعتيادي — صنف الحفظ (سطح دافئ + حبر)،
         * ويعيد القراءة في مكانها لا إعادة تحميل الصفحة. */}
        <Button action="save" onClick={() => setRetryCount(count => count + 1)}>
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
  /* Z1.2 (§3.1): أسماء الحقائق غير المسجلة — سطر صدق واحد لحالة «بيانات
   * ناقصة»، والطرق نفسها («سجّله») في «أرقامك» أسفل الصفحة. */
  const unregisteredFactLabels = model.facts
    .filter(fact => fact.state === "not_initialized")
    .map(fact => fact.label)
    .join("، ");
  /* Z1.3: العنقود الثانوي — مراجع أقل تكرارًا؛ يظهر فقط حين فيه محتوى. */
  const secondaryHasContent = !disabledCapabilities.includes("catalog") || moreActions.length > 0;
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
      {/* Z1.4: خطأ التحديث الخلفي — إعلان صادق قرب الأعلى والمحتوى الجاهز
          الموجود تحته يبقى في مكانه. */}
      {state.refreshError ? (
        <section className="micro-home-refresh-error" role="alert">
          <CircleAlert aria-hidden="true" />
          <p>{state.refreshError}</p>
          <Button action="save" onClick={() => setRetryCount(count => count + 1)}>
            إعادة المحاولة
          </Button>
        </section>
      ) : null}
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
      {/* Z1.2 (§3.1 — منطقة حالة اليوم): دور واحد معلن أول الصفحة — انتبه
          للأهم الآن، أو يومك مفتوح، أو بيانات ناقصة تُعلن بلا أرقام مختلقة،
          أو يوم هادئ؛ ثم يقرر المالك من الإجراءات الثابتة. */}
      <section
        className="micro-home-daily-status"
        data-testid="home-daily-status"
        role="status"
        aria-label="حالة اليوم"
      >
        {model.dailyStatus.kind === "attention" && model.priorityBlock ? (
          <div className="micro-home-priority" aria-labelledby="home-priority-title">
            <div className="micro-section-title">
              <BellRing aria-hidden="true" />
              <div>
                <h2 id="home-priority-title">الأهم الآن</h2>
              </div>
            </div>
            <TodayItemRow item={model.priorityBlock} onNavigate={openFromHome} hideAction />
            {/* Z1.3: CTA أساسي واحد مربوط بالأولوية — الفعل نفسه بلا تكرار
                نصي صغير بجواره؛ وهو الأساس الوحيد في الصفحة حين يوجد. */}
            <Button action="save" block onClick={() => openFromHome(model.priorityBlock!.href)}>
              {model.priorityBlock.actionLabel}
              <ArrowLeft aria-hidden="true" />
            </Button>
          </div>
        ) : model.dailyStatus.kind === "empty" ? (
          /* §7.1 — ما لا تسجله لا يُخترع له رقم: اليوم المفتوح بلا أرقام. */
          <div className="micro-home-quiet">
            <strong>يومك مفتوح</strong>
            <p>سجّل أول بيع أو طلب من أزرار «سجّل بسرعة» أعلى الصفحة — ما لا تسجله لا يُخترع له رقم.</p>
          </div>
        ) : model.dailyStatus.kind === "incomplete" ? (
          /* Z1.4: البيانات الناقصة تُعلن بلا استنتاج — الطرق في «أرقامك». */
          <p className="micro-home-truth-line">{`بيانات غير مسجلة: ${unregisteredFactLabels} — لا تُستنتج قبل تسجيلها، وطرق تسجيلها في «أرقامك» أسفل الصفحة.`}</p>
        ) : (
          /* اليوم الهادئ: لا شيء عاجل — أقرب عمل في «اليوم» والإجراءات الثابتة. */
          <p className="micro-home-truth-line">لا يوجد شيء عاجل اليوم</p>
        )}
      </section>
      {/* الكتلة ١ من ٣ — «اليوم» (دمج بند ١٠): أفعال محددة (حصّل/سلّم/أكمل/راجع)
          لا «افتح» العامة؛ قائمة مختصرة مباشرة بعد الحالة، والسطر القادم بعدها. */}
      {todayRows.length > 0 ||
      (model.todaySection.upcomingCount > 0 && model.todaySection.nextUpcomingDate) ? (
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
          ) : null}
          {model.todaySection.upcomingCount > 0 && model.todaySection.nextUpcomingDate ? (
            <p className="micro-home-truth-line">
              قادمة: {formatLocalDateLong(model.todaySection.nextUpcomingDate)} —{" "}
              <button
                className="micro-text-action"
                type="button"
                onClick={() =>
                  model.todaySection.nextUpcomingHref
                    ? openFromHome(model.todaySection.nextUpcomingHref)
                    : null
                }
              >
                افتح أقربها
              </button>
            </p>
          ) : null}
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
      {/* Z1.3 (§3.1 — الإجراءات الثابتة): ثلاثة بالضبط — بيع ومصروف وطلب؛
          التحصيل ليس رابعًا ثابتًا (سياقي على بند الدين والأولوية فقط)،
          والبيع يلبس الأساسية فقط حين لا توجد أولوية تحملها. */}
      <section className="micro-home-quick-actions" aria-labelledby="home-quick-title">
        <div className="micro-section-title">
          <BadgeDollarSign aria-hidden="true" />
          <div>
            <h2 id="home-quick-title">سجّل بسرعة</h2>
          </div>
        </div>
        <div className="micro-quick-actions" data-testid="home-quick-actions">
          <button
            className={`micro-quick-action${model.priorityBlock ? "" : " micro-quick-action-primary"}`}
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
        </div>
      </section>
      {/* Z1.3 (§3.1 — مراجع ثانوية): «منتجاتي وخدماتي» و«المزيد» عنقود أخف
          بعد الإجراءات الثابتة — ظاهران قابلان للاكتشاف بلا منافسة يومية. */}
      {secondaryHasContent ? (
        <div className="micro-home-secondary-actions" data-testid="home-secondary-actions">
          <div className="micro-quick-actions">
            {!disabledCapabilities.includes("catalog") ? (
              <button
                className="micro-quick-action"
                type="button"
                data-testid="home-catalog-entry"
                onClick={() => openFromHome(model.catalogUnit.action.href)}
              >
                <Package aria-hidden="true" /> منتجاتي وخدماتي
              </button>
            ) : null}
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
            <div
              className="micro-quick-actions micro-quick-actions-more"
              data-testid="home-quick-actions-more"
            >
              {moreActions.map(entry => (
                <button key={entry.id} className="micro-quick-action" type="button" onClick={entry.open}>
                  <entry.icon aria-hidden="true" /> {entry.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {/* Z1.2: الأرقام بعد الحالة والإجراءات — العمق خلف القرار اليومي. */}
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
        {/* Z1.5: الحقائق القائمة صفوف مفتوحة — لا بطاقات متساوية الوزن. */}
        <RowList className="micro-home-fact-rows">
          {model.facts.map(fact => (
            <FactRow key={fact.id} fact={fact} onNavigate={openFromHome} />
          ))}
        </RowList>
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
      {/* مسارات مرتبطة ببياناتها فقط (الجدول ونتيجة الفترة). */}
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
