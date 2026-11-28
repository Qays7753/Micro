/**
 * M5.4 (UX P-31 «قائمة الدخل»): من وين إجا الربح للفترة المختارة — أرقام
 * فقط (أعمدة الربح جوا بطاقة صافي الربح بـP-30 بقرار «الرسومات جوا
 * البطاقات»): المبيعات، المرتجعات والخصومات بإشارة سالب، صافي المبيعات،
 * المصاريف بصفوف تصنيفات §10.2، صافي الربح، ثم معدات/فرق غير مفسَّر/
 * بيانات غير مكتملة بشرطها. كل المبالغ 3 منازل (R-20) نصًا من الخادم.
 *
 * الفترة المختارة تصل بالوصل ?period= (معجم المعاملات الموثق) من P-30 —
 * لتغييرها يرجع إليه (عقد P-31).
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Button, EmptyState, Notice } from "@/components/primitives";
import { t, type ManageStringKey } from "@/application/manage/strings";
import { fill } from "@/application/manage/presentation";
import {
  fetchManageFigures,
  isNetworkFailure,
  type ManageFiguresResponse,
  type ManagePeriod,
} from "@/application/manage/api";

const PERIOD_KINDS: readonly ManagePeriod[] = ["week", "month", "year", "since_start"];

function periodOf(search: string): ManagePeriod {
  const kind = new URLSearchParams(search).get("period");
  return PERIOD_KINDS.includes(kind as ManagePeriod) ? (kind as ManagePeriod) : "month";
}

type IncomeState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; figures: ManageFiguresResponse };

export default function IncomePage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const [state, setState] = useState<IncomeState>({ phase: "loading" });

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      setState({ phase: "ready", figures: await fetchManageFigures(periodOf(search)) });
    } catch (error) {
      if (isNetworkFailure(error)) {
        setState({ phase: "error", message: t("E-OFFLINE") });
        return;
      }
      navigate("/manage/start");
    }
  }, [navigate, search]);
  useEffect(() => {
    void load();
  }, [load]);

  if (state.phase === "loading") {
    return (
      <div className="micro-manage-page" aria-busy="true">
        <span className="micro-manage-page__loading" />
      </div>
    );
  }
  if (state.phase === "error") {
    return (
      <div className="micro-manage-page">
        <Notice tone="error" role="alert">
          {state.message}
        </Notice>
        <Button action="secondary" onClick={() => void load()}>
          {t("a.ok")}
        </Button>
      </div>
    );
  }

  const { figures } = state;

  const periodEmpty = figures.sales.fils === 0 && figures.expenses.fils === 0 && figures.netProfit.fils === 0;

  return (
    <div className="micro-manage-page">
      <header className="micro-manage-head">
        <h1 className="micro-manage-head__title">
          {t("rep.income")} · {figures.period.labelText}
        </h1>
      </header>

      {periodEmpty ? (
        <EmptyState title={t("e.empty_period")} />
      ) : (
        <section className="micro-manage-card">
          <p className="micro-manage-card__line">
            {t("rep.sales")}: {figures.sales.text}
          </p>
          {/* المرتجعات والخصومات بإشارة سالب (§8: نص الخادم يحمل الإشارة). */}
          <p className="micro-manage-card__line">
            {t("rep.returns")}: {figures.returnsAndDiscounts.text}
          </p>
          <p className="micro-manage-card__line">
            {t("rep.net_sales")}: {figures.netSales.text}
          </p>
          <p className="micro-manage-card__line">
            {t("rep.expenses")}: {figures.expenses.text}
          </p>
          {figures.expensesByCategory.map(category => (
            <p key={category.category} className="micro-manage-card__line micro-manage-card__line--secondary">
              {t(category.category as ManageStringKey)}: {category.text}
            </p>
          ))}
          <p className="micro-manage-card__line micro-manage-card__title">
            {t("rep.net_profit")}: {figures.netProfit.text}
          </p>
          {figures.equipment.fils > 0 ? (
            <p className="micro-manage-card__line micro-manage-card__line--secondary">
              {fill("c.equipment", { amount: figures.equipment.text })}
            </p>
          ) : null}
          {figures.unexplained.shown && figures.unexplained.fils !== 0 ? (
            <p className="micro-manage-card__line micro-manage-card__line--secondary">
              {fill(figures.unexplained.fils < 0 ? "r.unexplained_less" : "r.unexplained_more", {
                amount: figures.unexplained.text,
              })}
            </p>
          ) : null}
          {figures.flags.incompletePeriod ? (
            <p className="micro-manage-card__line micro-manage-card__line--secondary">{t("l.incomplete")}</p>
          ) : null}
        </section>
      )}

      <Button action="secondary" onClick={() => navigate("/manage/finance")}>
        {t("a.back")}
      </Button>
    </div>
  );
}
