/**
 * M5.4 (UX P-30 «المالية» + §8): قراءة وضع المشروع — بطاقة صافي القيمة فوق
 * أزرار الفترة (لا تتغير معها)، C-06، ثم البطاقات: صافي الربح بأسطره
 * الشرطية وتوسيع أعمدة الربح وزر قائمة الدخل، والأعلى مبيعاً/ربحاً
 * وأكبر بند مصروف بتوسيعاتها (الرسومات جوا البطاقات)، والربح والسحوبات،
 * ثم أقسام الصناديق والمستحقات والحركات (آخر 5) والأزرار السريعة C-07.
 *
 * كل رقم نص من موديول القراءة الواحد (§8) — الصيغة الوحيدة في الواجهة:
 * جمل §10.5 بصيغة اللوحة (R-20: الصحيح بلا كسور والكسري بثلاث منازل)،
 * والنسبة `{x}` بنصها الجاهز (ليست مبلغًا). أشرطة التوسيع هندسة تخطيط
 * CSS خالصة (flexGrow نسبي) — لا قسمة ولا تقريب في الواجهة.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button, ChoiceRow, ChoiceButton, EmptyState, Notice } from "@/components/primitives";
import { QuickActionBar } from "@/components/manage/QuickActionBar";
import { ActivityRowView } from "@/components/manage/ActivityRowView";
import { BarRow, ratioLines, topSalesSentence } from "@/components/manage/FinanceCards";
import { t, type ManageStringKey } from "@/application/manage/strings";
import { fill, jodDashboardAmount } from "@/application/manage/presentation";
import {
  fetchManageFigures,
  fetchRecentActivity,
  isNetworkFailure,
  type ActivityRow,
  type Figure,
  type ManageFiguresResponse,
  type ManagePeriod,
  type UnknownFigure,
} from "@/application/manage/api";

/** آخر فترة محفوظة بين الزيارات (الافتراضي شهر — C-06). */
let lastFinancePeriod: ManagePeriod = "month";

const PERIODS: ReadonlyArray<{ kind: ManagePeriod; key: ManageStringKey }> = [
  { kind: "week", key: "p.week" },
  { kind: "month", key: "p.month" },
  { kind: "year", key: "p.year" },
  { kind: "since_start", key: "p.all" },
];

/** نص الرقم أو «غير معروف حتى المطابقة» (N-37). */
function figureText(figure: Figure | UnknownFigure): string {
  return figure.fils === null ? t(figure.labelKey) : figure.textDashboard;
}

type FinanceState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; figures: ManageFiguresResponse; activity: ActivityRow[] };

export default function FinancePage() {
  const [, navigate] = useLocation();
  const [period, setPeriod] = useState<ManagePeriod>(lastFinancePeriod);
  const [state, setState] = useState<FinanceState>({ phase: "loading" });
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(
    async (kind: ManagePeriod) => {
      setState({ phase: "loading" });
      try {
        const [figures, activityResponse] = await Promise.all([
          fetchManageFigures(kind),
          fetchRecentActivity(),
        ]);
        setState({ phase: "ready", figures, activity: activityResponse.activity });
      } catch (error) {
        if (isNetworkFailure(error)) {
          setState({ phase: "error", message: t("E-OFFLINE") });
          return;
        }
        /* 404 الموحّد: لا مشروع مالي بعد ← P-01 (R-24). */
        navigate("/manage/start");
      }
    },
    [navigate],
  );
  useEffect(() => {
    void load(period);
  }, [load, period]);

  /* P-30 بلا عنوان ظاهر (التبويب هو العنوان) — h1 خفي للوصولية فقط. */
  const pageTitle = <h1 className="micro-visually-hidden">{t("tab.finance")}</h1>;

  if (state.phase === "loading") {
    return (
      <div className="micro-manage-page" aria-busy="true">
        {pageTitle}
        <span className="micro-manage-page__loading" />
      </div>
    );
  }
  if (state.phase === "error") {
    return (
      <div className="micro-manage-page">
        {pageTitle}
        <Notice tone="error" role="alert">
          {state.message}
        </Notice>
        <Button action="secondary" onClick={() => void load(period)}>
          {t("a.ok")}
        </Button>
      </div>
    );
  }

  const { figures, activity } = state;

  const { flags } = figures;
  const newUser = flags.newUser;
  /* «فترة بدون بيانات»: البطاقات 3–7 تُنشل — لا مبيعات ولا مصاريف ولا
   * ربح في الفترة (قراءة موثقة للفراغ). */
  const periodEmpty = figures.sales.fils === 0 && figures.expenses.fils === 0 && figures.netProfit.fils === 0;
  const unknownBalance = flags.unknownBalance;
  const twoBoxes = figures.boxes.filter(box => box.status === "active").length > 1;
  const materials = figures.expensesByCategory.find(c => c.category === "materials_packaging");

  return (
    <div className="micro-manage-page micro-manage-page--with-quickbar">
      {pageTitle}
      {/* 1. صافي القيمة فوق الفترة (لا يتغير معها) — كبسة ← P-32. */}
      <button
        type="button"
        className="micro-manage-card micro-manage-card--clickable"
        onClick={() => navigate("/manage/finance/position")}
      >
        <p className="micro-manage-card__title">{t("rep.networth")}</p>
        <p className="micro-manage-card__line">
          {unknownBalance
            ? t("c.networth_unknown")
            : fill("c.networth", { amount: figureText(figures.netWorth) })}
        </p>
      </button>

      {/* 2. C-06 أزرار الفترة — إلا للمستخدم الجديد. */}
      {!newUser ? (
        <ChoiceRow>
          {PERIODS.map(item => (
            <ChoiceButton
              key={item.kind}
              selected={period === item.kind}
              onClick={() => {
                setPeriod(item.kind);
                lastFinancePeriod = item.kind;
              }}
            >
              {t(item.key)}
            </ChoiceButton>
          ))}
        </ChoiceRow>
      ) : null}

      {newUser ? (
        /* مستخدم جديد: مكان الفترة والبطاقات 3–7 (G-13). */
        <EmptyState title={t("c.empty")} />
      ) : periodEmpty ? (
        <EmptyState title={t("e.empty_period")} />
      ) : (
        <>
          {/* 3. صافي الربح بأسطره الشرطية + توسيع الأعمدة + قائمة الدخل. */}
          <section className="micro-manage-card">
            <button
              type="button"
              className="micro-manage-card__title micro-manage-card__toggle"
              onClick={() => setExpanded(open => (open === "profit" ? null : "profit"))}
            >
              {t("rep.net_profit")}
            </button>
            <p className="micro-manage-card__line">
              {fill("c.profit", { amount: figures.netProfit.textDashboard })}
            </p>
            {figures.equipment.fils > 0 ? (
              <p className="micro-manage-card__line micro-manage-card__line--secondary">
                {fill("c.equipment", { amount: figures.equipment.textDashboard })}
              </p>
            ) : null}
            {figures.materialsAlert && materials !== undefined ? (
              <p className="micro-manage-card__line micro-manage-card__line--secondary">
                {fill("c.materials_alert", { amount: materials.text })}
              </p>
            ) : null}
            {figures.unexplained.shown && figures.unexplained.fils !== 0 ? (
              <p className="micro-manage-card__line micro-manage-card__line--secondary">
                {fill(figures.unexplained.fils < 0 ? "r.unexplained_less" : "r.unexplained_more", {
                  amount: figures.unexplained.text,
                })}
              </p>
            ) : null}
            {flags.incompletePeriod ? (
              <p className="micro-manage-card__line micro-manage-card__line--secondary">
                {t("l.incomplete")}
              </p>
            ) : null}
            {expanded === "profit" ? (
              <div className="micro-manage-bars" aria-label={t("rep.net_profit")}>
                {figures.bars.map(bar => (
                  <BarRow
                    key={bar.label}
                    label={bar.label}
                    value={bar.netProfitFils}
                    peers={figures.bars.map(b => b.netProfitFils)}
                    incomplete={bar.incomplete}
                  />
                ))}
              </div>
            ) : null}
            <Button action="secondary" onClick={() => navigate(`/manage/finance/income?period=${period}`)}>
              {t("rep.income_open")}
            </Button>
          </section>

          {/* 4. الأعلى مبيعاً — أول منتج + توسيع الأشرطة (P-34). */}
          {figures.topSellers.length > 0 ? (
            <section className="micro-manage-card">
              <button
                type="button"
                className="micro-manage-card__title micro-manage-card__toggle"
                onClick={() => setExpanded(open => (open === "sellers" ? null : "sellers"))}
              >
                {t("c.title_top_sales")}
              </button>
              <p className="micro-manage-card__line">{topSalesSentence(figures.topSellers[0]!)}</p>
              {expanded === "sellers" ? (
                <div className="micro-manage-bars" aria-label={t("c.title_top_sales")}>
                  {figures.topSellers.map(product => (
                    <BarRow
                      key={product.productId}
                      label={product.name}
                      value={product.valueFils}
                      peers={figures.topSellers.map(p => p.valueFils)}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {/* 5. الأعلى ربحاً — معروفة التكلفة فقط (P-35). */}
          {figures.topProfit.length > 0 ? (
            <section className="micro-manage-card">
              <button
                type="button"
                className="micro-manage-card__title micro-manage-card__toggle"
                onClick={() => setExpanded(open => (open === "profit-top" ? null : "profit-top"))}
              >
                {t("c.title_top_profit")}
              </button>
              <p className="micro-manage-card__line">
                {fill("c.top_profit", {
                  product: figures.topProfit[0]!.name,
                  amount: jodDashboardAmount(figures.topProfit[0]!.profitFils),
                  per_unit: figures.topProfit[0]!.perUnitText,
                })}
              </p>
              {expanded === "profit-top" ? (
                <div className="micro-manage-bars" aria-label={t("c.title_top_profit")}>
                  {figures.topProfit.map(product => (
                    <BarRow
                      key={product.productId}
                      label={product.name}
                      value={product.profitFils}
                      peers={figures.topProfit.map(p => p.profitFils)}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {/* 6. أكبر بند مصروف — يختفي إذا المصاريف صفر (P-36). */}
          {figures.expenses.fils > 0 && figures.biggestExpense !== null ? (
            <section className="micro-manage-card">
              <button
                type="button"
                className="micro-manage-card__title micro-manage-card__toggle"
                onClick={() => setExpanded(open => (open === "expense" ? null : "expense"))}
              >
                {t("c.title_biggest_expense")}
              </button>
              <p className="micro-manage-card__line">
                {fill("c.biggest_expense", {
                  category: t(figures.biggestExpense.category as ManageStringKey),
                  amount: figures.biggestExpense.text,
                  total: figures.expenses.text,
                })}
              </p>
              {expanded === "expense" ? (
                <div className="micro-manage-bars" aria-label={t("rep.expenses_by_category")}>
                  {figures.expensesByCategory.map(category => (
                    <BarRow
                      key={category.category}
                      label={t(category.category as ManageStringKey)}
                      value={category.fils}
                      peers={figures.expensesByCategory.map(c => c.fils)}
                      valueText={category.text}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {/* 7. الربح والسحوبات — بلا كبسة ولا رسم (الكونسبت §12.2). */}
          <section className="micro-manage-card">
            <p className="micro-manage-card__title">{t("c.title_ratio")}</p>
            {ratioLines(figures)}
          </section>
        </>
      )}

      {/* 8. قسم الصناديق — كبسة ← P-37. */}
      <button type="button" className="micro-manage-section" onClick={() => navigate("/manage/boxes")}>
        <h2 className="micro-manage-section__title">{t("s.boxes")}</h2>
        <p className="micro-manage-card__line">
          {unknownBalance
            ? t("l.unknown_balance")
            : fill("s.balance", { amount: figureText(figures.totalBalance) })}
        </p>
        {twoBoxes ? (
          <p className="micro-manage-card__line micro-manage-card__line--secondary">
            {figures.boxes
              .filter(box => box.status === "active")
              .map(
                box =>
                  `${box.kind === "cash" ? t("f.cash") : t("f.account")} ${box.balanceFils === null ? t("l.unknown_balance") : (box.textDashboard ?? "")}`,
              )
              .join(" · ")}
          </p>
        ) : null}
      </button>

      {/* 9. المستحقات والالتزامات — الصفر يخفي السطر؛ كل سطر ← P-44. */}
      <section className="micro-manage-section">
        <h2 className="micro-manage-section__title">{t("s.balances")}</h2>
        {figures.receivables.fils > 0 ? (
          <button
            type="button"
            className="micro-manage-row"
            onClick={() => navigate("/manage/balances?tab=to_me")}
          >
            <span className="micro-manage-row__title">
              {fill("s.receivables", { amount: figures.receivables.textDashboard })}
            </span>
          </button>
        ) : null}
        {figures.payables.fils > 0 ? (
          <button
            type="button"
            className="micro-manage-row"
            onClick={() => navigate("/manage/balances?tab=by_me")}
          >
            <span className="micro-manage-row__title">
              {figures.payablesPrepayments.fils > 0
                ? fill("s.payables", {
                    amount: figures.payables.textDashboard,
                    pre: figures.payablesPrepayments.textDashboard,
                  })
                : fill("s.payables_no_pre", { amount: figures.payables.textDashboard })}
            </span>
          </button>
        ) : null}
      </section>

      {/* 10. الحركات — آخر 5؛ القسم يختفي فارغًا. */}
      {activity.length > 0 ? (
        <section className="micro-manage-section">
          <h2 className="micro-manage-section__title">{t("s.activity")}</h2>
          <div className="micro-manage-rows">
            {activity.map(row => (
              <ActivityRowView key={row.operationId} row={row} twoBoxes={twoBoxes} />
            ))}
          </div>
          <Button action="secondary" onClick={() => navigate("/manage/activity")}>
            {t("a.view_all")}
          </Button>
        </section>
      ) : null}

      {/* 11. C-07 الأزرار السريعة. */}
      <QuickActionBar />
    </div>
  );
}
