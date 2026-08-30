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
  Landmark,
  Package,
  Receipt,
  Scale,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { formatLocalDateLong } from "@/presentation/formatters";
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
};
/* §10.2: الحالة المعروفة يتكلم عنها الرقم نفسه — الوسم للمجهول والناقص فقط. */
const factStateLabel = (state: HomeFinancialFact["state"]) =>
  state === "incomplete" ? "غير مكتمل" : state === "not_initialized" ? "غير مسجل" : null;

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
          <MoneyValue minor={fact.valueMinor} />
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
          /* §6: المجهول علامة — لا جملة. */
          (factStateLabel(fact.state) ?? "—")
        )}
      </strong>
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
    setState({ phase: "loading" });
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
  return (
    <section className="micro-page micro-home-control-center">
      <div className="micro-page-heading micro-home-heading">
        <span className="micro-overline">مشروعي الآن</span>
        <h1>{model.heading.activityName}</h1>
        <p>
          <CalendarDays aria-hidden="true" />{" "}
          <time dateTime={model.heading.todayLocal}>
            {formatLocalDateLong(model.heading.todayLocal) ?? model.heading.todayLocal}
          </time>
        </p>
      </div>
      {/* التدفق ٢٣: بطاقة «أثناء غيابك» — تظهر بعد ٧ أيام بلا تسجيل وتختفي بالنشاط. */}
      {model.awaySection ? (
        <section className="micro-away-card" aria-label="أثناء غيابك">
          <b>
            <CloudSun aria-hidden="true" /> أثناء غيابك — آخر تسجيل قبل {model.awaySection.daysSinceLastActivity} يوم
          </b>
          <ul>
            {model.awaySection.overdueDebtCount > 0 ? (
              <li>
                {model.awaySection.overdueDebtCount} دين فات موعد متابعته —{" "}
                <button
                  className="micro-text-action"
                  type="button"
                  onClick={() => navigate("/parties")}
                >
                  راجع دفتر الناس
                </button>
              </li>
            ) : null}
            <li>
              {model.awaySection.daysSinceLastExport === null
                ? "ما في نسخة احتياطية معتمدة بعد"
                : `آخر نسخة احتياطية قبل ${model.awaySection.daysSinceLastExport} يوم`}{" "}
              —{" "}
              <button className="micro-text-action" type="button" onClick={() => navigate("/settings")}>
                انسخ الآن
              </button>
            </li>
          </ul>
        </section>
      ) : null}
      {model.truthLine ? (
        <p className="micro-home-truth-line" role="status">
          <CircleAlert aria-hidden="true" /> {model.truthLine}{" "}
          <button className="micro-text-action" type="button" onClick={() => navigate("/settings")}>
            افتح الإعدادات
          </button>
        </p>
      ) : null}
      {/* الكتلة ١ من ٣ — «اليوم» (قرار المالك على بندي ١٠ و١٣ من السجل): قسم واحد يجيب
          «ماذا عليّ اليوم؟» — استوعب ما كان في «ما يحتاج فعلًا الآن» و«الأولوية الآن» بلا
          إلغاء ولا تكرار؛ أول بند في القائمة هو الأولوية. الحالة الفارغة صادقة (رحلة ١). */}
      <section className="micro-home-today-section" aria-labelledby="home-today-title">
        <div className="micro-section-title">
          <BellRing aria-hidden="true" />
          <div>
            <span className="micro-overline">قراءة الصباح</span>
            <h2 id="home-today-title">اليوم</h2>
          </div>
        </div>
        {model.todaySection.items.length > 0 ? (
          <div className="micro-home-today-list">
            {model.todaySection.items.map(item => (
              <TodayItemRow key={item.id} item={item} onNavigate={navigate} />
            ))}
          </div>
        ) : (
          <div className="micro-home-quiet">
            <strong>لا متابعات بعد.</strong>
          </div>
        )}
        {model.todaySection.upcomingCount > 0 && model.todaySection.nextUpcomingDate ? (
          <p className="micro-home-truth-line">
            قادمة: {formatLocalDateLong(model.todaySection.nextUpcomingDate)} —{" "}
            <button
              className="micro-text-action"
              type="button"
              onClick={() =>
                model.todaySection.nextUpcomingHref ? navigate(model.todaySection.nextUpcomingHref) : null
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
            <span className="micro-overline">أربع حقائق محلية</span>
            <h2 id="home-facts-title">ما هو مسجل حتى الآن؟</h2>
          </div>
        </div>
        <div className="micro-home-facts">
          {model.facts.map(fact => (
            <FactCard key={fact.id} fact={fact} onNavigate={navigate} />
          ))}
        </div>
      </section>
      {/* الكتلة ٢ من ٣ — «مالي» (القرار ١٢): وحدة دائمة بلا شرط؛ الأسطح بلا شرط (§2.1)،
          وperiod_result يحتفظ بشرطه في وحدته دون أن ترث غيره رؤيته (القرار ١٤). */}
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
            <button className="micro-text-action" type="button" onClick={() => navigate("/foundation")}>
              صفحة الأساس <ArrowLeft aria-hidden="true" />
            </button>
          </div>
          <button
            className="micro-button micro-button-primary"
            type="button"
            onClick={() => navigate(model.financeUnit.action.href)}
          >
            {model.financeUnit.action.label}
            <ArrowLeft aria-hidden="true" />
          </button>
        </div>
      </section>
      {/* الكتلة ٣ من ٣ — «منتجاتي وخدماتي» (قرار المالك على بند ١١): كتلة دائمة مستقلة
          مثل «مالي»؛ سؤالها (§2.3): ما أكرره وبكم؟ وهل هو رابح؟ */}
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
            onClick={() => navigate(model.catalogUnit.action.href)}
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
              <span className="micro-overline">وحدات عند الحاجة</span>
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
                    onClick={() => navigate(module.action!.href)}
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
              <span className="micro-overline">آخر التغيرات المفيدة</span>
              <h2 id="home-recent-title">ما تغير مؤخرًا</h2>
            </div>
          </div>
          <div className="micro-home-recent-list">
            {model.recentChanges.map(change => (
              <button
                className="micro-home-recent-item"
                type="button"
                key={change.id}
                onClick={() => navigate(change.href)}
              >
                <span>
                  <time dateTime={change.occurredOn}>
                    {formatLocalDateLong(change.occurredOn) ?? change.occurredOn}
                  </time>
                  <strong>{change.title}</strong>
                  <small>{change.detail}</small>
                </span>
                <ArrowLeft aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {/* §10: الحدود في النطاق لا على الوجه — الطريق يبقى والجملة تُحذف. */}
      <div className="micro-scope-line">
        <CircleAlert aria-hidden="true" />
        <button className="micro-text-action" type="button" onClick={() => navigate("/finance")}>
          فتح مالي <ArrowLeft aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
