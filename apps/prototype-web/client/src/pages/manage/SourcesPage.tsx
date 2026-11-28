/**
 * M5.4 (UX P-33 «مصادر صافي القيمة»): فحص INV-1 الظاهر للمستخدم — من وين
 * إجت قيمة المشروع: الرصيد الافتتاحي، الإيداعات الشخصية، السحوبات الشخصية
 * بإشارة سالب، صافي الربح منذ البداية، الفرق غير المفسَّر إن وجد، ثم صافي
 * قيمة المشروع (نفس رقم P-32). كل نص جاهز من الخادم (٣ منازل — تقرير
 * §10.6)، ولا معادلة جمع في الواجهة (المجموع نص الخادم).
 *
 * رصيد غير معروف: الرصيد الافتتاحي وصافي القيمة «غير معروف حتى المطابقة»
 * (§8.2) — والباقي يبقى كما ورد من موديول القراءة.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button, Notice } from "@/components/primitives";
import { t } from "@/application/manage/strings";
import { fetchManageFigures, isNetworkFailure, type ManageFiguresResponse } from "@/application/manage/api";

type SourcesState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; figures: ManageFiguresResponse };

export default function SourcesPage() {
  const [, navigate] = useLocation();
  const [state, setState] = useState<SourcesState>({ phase: "loading" });

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      setState({ phase: "ready", figures: await fetchManageFigures("month") });
    } catch (error) {
      if (isNetworkFailure(error)) {
        setState({ phase: "error", message: t("E-OFFLINE") });
        return;
      }
      navigate("/manage/start");
    }
  }, [navigate]);
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
  const sources = figures.netWorthSources;

  return (
    <div className="micro-manage-page">
      <header className="micro-manage-head">
        <h1 className="micro-manage-head__title">{t("rep.sources")}</h1>
      </header>

      <section className="micro-manage-card">
        <p className="micro-manage-card__line">
          {t("rep.opening")}: {sources.openingText ?? t("l.unknown_balance")}
        </p>
        <p className="micro-manage-card__line">
          {t("rep.deposits")}: {sources.ownerDepositsText}
        </p>
        {/* السحوبات بإشارة سالب (§8 — النص من الخادم يحمل الإشارة). */}
        <p className="micro-manage-card__line">
          {t("rep.withdrawals")}: {sources.ownerWithdrawalsText}
        </p>
        <p className="micro-manage-card__line">
          {t("rep.profit_since")}: {sources.netProfitSinceStartText}
        </p>
        {sources.unexplainedFils !== 0 ? (
          <p className="micro-manage-card__line micro-manage-card__line--secondary">
            {t("rep.unexplained")}: {sources.unexplainedText}
          </p>
        ) : null}
        <p className="micro-manage-card__line micro-manage-card__title">
          {t("rep.networth")}: {sources.totalText ?? t("l.unknown_balance")}
        </p>
      </section>

      <Button action="secondary" onClick={() => navigate("/manage/finance/position")}>
        {t("a.back")}
      </Button>
    </div>
  );
}
