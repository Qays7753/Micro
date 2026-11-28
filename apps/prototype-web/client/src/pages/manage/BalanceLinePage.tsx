/**
 * M5.6 (UX P-45 «تفاصيل المستحق أو الالتزام»): الاسم والنوع، المتبقي
 * (G-03) والعمر (C-11/R-19)، «فتح الطلب» إذا الخط من طلب، وحركات الخط
 * صفوف C-10 (كبستها ← P-42)، والأساسي حسب الجهة (تحصيل/سداد ← P-63
 * مقفولًا على الخط) و«لن يُحصَّل» (لك).
 *
 * سطح قراءة يبقي الشريط (U-005). كل رقم نص الخادم.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Button, EmptyState, Notice } from "@/components/primitives";
import { ActivityRowView } from "@/components/manage/ActivityRowView";
import { t, type ManageStringKey } from "@/application/manage/strings";
import { ageTextR19 } from "@/application/manage/presentation";
import { todayInAmman } from "@/application/time";
import {
  fetchBalanceLine,
  fetchManageFigures,
  isNetworkFailure,
  type BalanceLineDetails,
} from "@/application/manage/api";

const LINE_KIND_KEYS: Readonly<Record<string, ManageStringKey>> = {
  sale_remainder: "l.kind_sale_remainder",
  supplier: "l.kind_supplier",
  customer_refund: "l.kind_customer_refund",
  prior_receivable: "f.prior_receivable",
  prior_payable: "f.prior_payable",
  borrowed: "f.source_borrowed",
  loan_given: "f.withdraw_loan",
};

type LineState =
  | { phase: "loading" }
  | { phase: "missing" }
  | { phase: "error"; message: string }
  | { phase: "ready"; details: BalanceLineDetails; twoBoxes: boolean };

export default function BalanceLinePage() {
  const [, navigate] = useLocation();
  const routeParams = useParams<{ id: string }>();
  const id = routeParams.id ?? "";
  const [state, setState] = useState<LineState>({ phase: "loading" });

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      const [details, figures] = await Promise.all([fetchBalanceLine(id), fetchManageFigures("month")]);
      const twoBoxes = figures.boxes.filter(box => box.status === "active").length > 1;
      setState({ phase: "ready", details, twoBoxes });
    } catch (error) {
      if (isNetworkFailure(error)) {
        setState({ phase: "error", message: t("E-OFFLINE") });
        return;
      }
      setState({ phase: "missing" });
    }
  }, [id]);
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
  if (state.phase === "missing") {
    return (
      <div className="micro-manage-page">
        <EmptyState title={t("e.empty_search")}>
          <Button action="secondary" onClick={() => navigate("/manage/balances")}>
            {t("a.back")}
          </Button>
        </EmptyState>
      </div>
    );
  }

  const { details, twoBoxes } = state;
  const toMe = details.line.direction === "to_me";
  const today = todayInAmman();

  return (
    <div className="micro-manage-page">
      <header className="micro-manage-head">
        <h1 className="micro-manage-head__title">{details.line.counterpartyName ?? t("l.no_name")}</h1>
      </header>

      {/* 1. الاسم + النوع. 2. المتبقي + العمر. */}
      <section className="micro-manage-card">
        <p className="micro-manage-card__line">
          {LINE_KIND_KEYS[details.line.kind] === undefined
            ? details.line.kind
            : t(LINE_KIND_KEYS[details.line.kind]!)}
        </p>
        <p className="micro-manage-card__line">
          {t("f.amount")}: {details.line.outstandingText} · {ageTextR19(details.line.originOn, today)}
        </p>
      </section>

      {/* 3. «فتح الطلب» إذا الخط من طلب. */}
      {details.line.saleId !== null ? (
        <Button action="secondary" onClick={() => navigate(`/manage/sale/${details.line.saleId}`)}>
          {t("a.open_sale")}
        </Button>
      ) : null}

      {/* الأزرار: الأساسي حسب الجهة + «لن يُحصَّل» (لك — أي خط بأي وقت). */}
      <div className="micro-manage-card__actions">
        {toMe ? (
          <>
            <Button action="create" onClick={() => navigate(`/manage/op/collect?line=${details.line.id}`)}>
              {t("a.collect_now")}
            </Button>
            <Button
              action="secondary"
              onClick={() => navigate(`/manage/op/write-off?line=${details.line.id}`)}
            >
              {t("f.short_writeoff")}
            </Button>
          </>
        ) : (
          <Button
            action="create"
            onClick={() => navigate(`/manage/op/collect?line=${details.line.id}&pay=1`)}
          >
            {t("op.pay")}
          </Button>
        )}
      </div>

      {/* 4. الحركات على الخط (C-10) — كبستها ← P-42. */}
      {details.movements.length > 0 ? (
        <section className="micro-manage-section">
          <h2 className="micro-manage-section__title">{t("s.activity")}</h2>
          <div className="micro-manage-rows">
            {details.movements.map(row => (
              <ActivityRowView key={row.operationId} row={row} twoBoxes={twoBoxes} />
            ))}
          </div>
        </section>
      ) : null}

      <Button action="quiet" onClick={() => navigate("/manage/balances")}>
        {t("a.back")}
      </Button>
    </div>
  );
}
