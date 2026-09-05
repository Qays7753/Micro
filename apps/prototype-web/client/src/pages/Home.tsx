import {
  ArrowLeft,
  BellRing,
  CalendarDays,
  CircleAlert,
  ClipboardList,
  CloudSun,
  FilePen,
  Gauge,
  HandCoins,
  House,
  Landmark,
  Package,
  Receipt,
  Scale,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { formatLocalDateLong, formatMoneyMinor } from "@/presentation/formatters";
import { withFrom } from "@/app/navigationContract";
import type {
  HomeControlCenterViewModel,
  HomeFinancialFact,
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
          <Icon aria-hidden="true" /> {item.title}
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

export default function Home() {
  const [, navigate] = useLocation();
  const { homeControlCenter, dataVersion } = usePrototypeServices();
  const [state, setState] = useState<HomeState>({ phase: "loading" });
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
    return () => {
      active = false;
    };
  }, [dataVersion, homeControlCenter]);
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
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => window.location.reload()}
        >
          إعادة المحاولة
        </button>
      </section>
    );
  const { model } = state;
  /* المجموعة ١ (§7.2): كل رحلة من الرئيسية تحفظ مصدرها — الرجوع يعود هنا لا لصفحة عامة. */
  const openFromHome = (href: string) => navigate(withFrom(href, "/"));
  const todayRows = model.priorityBlock
    ? model.todaySection.items.filter(item => item.id !== model.priorityBlock!.id)
    : model.todaySection.items;
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
          {/* المجموعة ١ (§7.1): ترويسة تُوجّه — اسم المشروع والتاريخ ومدخل الملف،
              بلا منافسة مع فعل «سجّل» المركزي. */}
          <button
            className="micro-text-action micro-home-profile-link"
            type="button"
            onClick={() => openFromHome("/profile")}
          >
            <House aria-hidden="true" /> ملف المالك
          </button>
        </div>
      </div>
      {/* التدفق ٢٣: بطاقة «أثناء غيابك» — تظهر بعد ٧ أيام بلا تسجيل وتختفي بالنشاط. */}
      {model.awaySection ? (
        <section className="micro-away-card" aria-label="أثناء غيابك">
          <b>
            <CloudSun aria-hidden="true" /> أثناء غيابك — آخر تسجيل قبل{" "}
            {model.awaySection.daysSinceLastActivity} يوم
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
                    ? ` بِيع ${model.awaySection.digest.salesCount} بـ ${formatMoneyMinor(
                        model.awaySection.digest.salesRevenueMinor,
                      )} د.أ`
                    : ""}
                  {model.awaySection.digest.expenseCount > 0
                    ? `${model.awaySection.digest.salesCount > 0 ? " ·" : ""} مصروف ${
                        model.awaySection.digest.expenseCount
                      } بـ ${formatMoneyMinor(model.awaySection.digest.expenseMinor)} د.أ`
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
                ? "ما في نسخة احتياطية معتمدة بعد"
                : `آخر نسخة احتياطية قبل ${model.awaySection.daysSinceLastExport} يوم`}{" "}
              —{" "}
              <button className="micro-text-action" type="button" onClick={() => openFromHome("/settings")}>
                انسخ الآن
              </button>
            </li>
          </ul>
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
      {/* المجموعة ١ (§7.1): كتلة أولوية واحدة — أهم بند قابل للفعل اليوم فوق القائمة؛
          البطاقات والصفوف لا تنافس فعل «سجّل» المركزي. */}
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
      {/* الكتلة ١ من ٣ — «اليوم»: أفعال محددة (حصّل/سلّم/أكمل/راجع) لا «افتح» العامة. */}
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
            <p>سجّل أول بيع أو طلب من زر «سجّل» في الأسفل — ما لا تسجله لا يُخترع له رقم.</p>
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
      <section className="micro-home-facts-section" aria-labelledby="home-facts-title">
        <div className="micro-section-title">
          <WalletCards aria-hidden="true" />
          <div>
            <h2 id="home-facts-title">ما هو مسجل حتى الآن؟</h2>
          </div>
        </div>
        <div className="micro-home-facts">
          {model.facts.map(fact => (
            <FactCard key={fact.id} fact={fact} onNavigate={openFromHome} />
          ))}
        </div>
      </section>
      {/* الكتلة ٢ من ٣ — «مالي»: وحدة دائمة بلا شرط (القرار ١٢). */}
      <section className="micro-home-finance-section" aria-labelledby="home-finance-title">
        <div className="micro-section-title">
          <Landmark aria-hidden="true" />
          <div>
            <h2 id="home-finance-title">مالي</h2>
          </div>
        </div>
        <div className="micro-home-finance-unit">
          <div>
            {/* القرار ٧: صفحة الأساس دائمة الوصول ولا تُغلق بعد اليوم الأول. */}
            <button className="micro-text-action" type="button" onClick={() => openFromHome("/foundation")}>
              صفحة الأساس <ArrowLeft aria-hidden="true" />
            </button>
          </div>
          <button
            className="micro-button micro-button-primary"
            type="button"
            onClick={() => openFromHome(model.financeUnit.action.href)}
          >
            {model.financeUnit.action.label}
            <ArrowLeft aria-hidden="true" />
          </button>
        </div>
      </section>
      {/* الكتلة ٣ من ٣ — «منتجاتي وخدماتي» (قرار المالك على بند ١١). */}
      <section className="micro-home-catalog-section" aria-labelledby="home-catalog-title">
        <div className="micro-section-title">
          <Package aria-hidden="true" />
          <div>
            <h2 id="home-catalog-title">منتجاتي وخدماتي</h2>
          </div>
        </div>
        <div className="micro-home-finance-unit">
          <div></div>
          <button
            className="micro-button micro-button-primary"
            type="button"
            onClick={() => openFromHome(model.catalogUnit.action.href)}
          >
            {model.catalogUnit.action.label}
            <ArrowLeft aria-hidden="true" />
          </button>
        </div>
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
                  <strong>{change.title}</strong>
                  {change.detail ? <small>{change.detail}</small> : null}
                  {change.effectWord ? (
                    <small className="micro-home-recent-effect">{change.effectWord}</small>
                  ) : null}
                </span>
                {change.amountMinor !== null && change.amountMinor !== undefined ? (
                  <b className="micro-home-recent-amount">
                    {/* مراجعة 5-RV-A: الوحدة مع الرقم — قراءة واحدة بلا لبس
                        واتساقًا مع قارئ النشاط الكامل. */}
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
