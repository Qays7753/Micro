import { ArrowLeft, CalendarDays, CircleAlert, ClipboardList, Receipt, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import type {
  HomeControlCenterViewModel,
  HomeFinancialFact,
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
const factStateLabel = (state: HomeFinancialFact["state"]) =>
  state === "known" ? "معروف من السجل" : state === "incomplete" ? "غير مكتمل" : "غير مهيأ";

function FactCard({ fact }: { fact: HomeFinancialFact }) {
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
        ) : (
          factStateLabel(fact.state)
        )}
      </strong>
      <small>{fact.helper}</small>
      <small>
        {fact.source} · {fact.period}
      </small>
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
        جارٍ تجهيز مركز قيادة المشروع…
      </div>
    );
  if (state.phase === "error")
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر تحميل مركز القيادة</h1>
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
        <span className="micro-overline">مشروعي اليوم</span>
        <h1>{model.heading.activityName}</h1>
        <p>
          <CalendarDays aria-hidden="true" />{" "}
          <time dateTime={model.heading.todayLocal}>{model.heading.todayLocal}</time>
        </p>
      </div>
      <section className="micro-decision-surface" data-tone="accent" aria-labelledby="home-primary-title">
        <span className="micro-overline">الأولوية الآن</span>
        <h2 id="home-primary-title">{model.primaryAction.label}</h2>
        <p>{model.primaryAction.reason}</p>
        <p className="micro-home-truth-line">{model.truthLine}</p>
        <button
          className="micro-button micro-button-primary micro-button-block"
          type="button"
          onClick={() => navigate(model.primaryAction.href)}
        >
          {model.primaryAction.label}
          <ArrowLeft aria-hidden="true" />
        </button>
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
            <FactCard key={fact.id} fact={fact} />
          ))}
        </div>
      </section>
      <section className="micro-home-attention-section" aria-labelledby="home-attention-title">
        <div className="micro-section-title">
          <CircleAlert aria-hidden="true" />
          <div>
            <span className="micro-overline">انتباه محدود</span>
            <h2 id="home-attention-title">ما يحتاج فعلًا الآن</h2>
          </div>
        </div>
        {model.attention.length > 0 ? (
          <div className="micro-home-attention-list">
            {model.attention.map(item => (
              <article className="micro-home-attention-item" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.reason}</p>
                </div>
                <button
                  className="micro-text-action"
                  type="button"
                  onClick={() => navigate(item.action.href)}
                >
                  {item.action.label}
                  <ArrowLeft aria-hidden="true" />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="micro-home-quiet">
            <strong>لا توجد أولوية إضافية مسجلة الآن.</strong>
            <p>يمكنك مراجعة السجل عند الحاجة أو البدء بفعل جديد.</p>
          </div>
        )}
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
                  <p>
                    {module.state === "available"
                      ? "بيانات محلية متاحة للمراجعة."
                      : "الوحدة مرتبطة ببيانات الطلبات، لكنها تحتاج إعدادًا."}
                  </p>
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
                  <time dateTime={change.occurredOn}>{change.occurredOn}</time>
                  <strong>{change.title}</strong>
                  <small>{change.detail}</small>
                </span>
                <ArrowLeft aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <div className="micro-scope-line">
        <CircleAlert aria-hidden="true" />
        <p>
          هذه قراءة محلية محدودة. لا تعرض صافي ربح المشروع ولا تستبدل صفحة المال أو الطلبات؛ الأرقام الناقصة
          تبقى غير معروفة.
        </p>
        <button className="micro-text-action" type="button" onClick={() => navigate("/review")}>
          فتح المراجعة <ArrowLeft aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
