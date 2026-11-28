/**
 * M5.6 (UX P-44 «المستحقات والالتزامات» + §8.2): مين إلك ومين عليك —
 * مفتاح «لك/عليك» يفتح على الجهة التي جاء منها (?tab=)، صفوف الخطوط
 * المفتوحة (النوع بتسمية الكتالوف والمتبقي نص الخادم G-03 والعمر C-11
 * R-19)، والمجموعة «الدفعات المقدمة لطلبات قادمة»، وزرا الإضافة.
 *
 * سطح قراءة يبقي الشريط (U-005). المسددة بالكامل لا تظهر.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Button, ChoiceRow, ChoiceButton, EmptyState, Notice } from "@/components/primitives";
import { t, type ManageStringKey } from "@/application/manage/strings";
import { ageTextR19, fill, jodDashboardAmount } from "@/application/manage/presentation";
import { todayInAmman } from "@/application/time";
import { fetchManageFigures, isNetworkFailure, type ManageFiguresResponse } from "@/application/manage/api";

/** تسمية نوع الخط (§10 — N-27/N-28/N-29 بمفاتيحها). */
const LINE_KIND_KEYS: Readonly<Record<string, ManageStringKey>> = {
  sale_remainder: "l.kind_sale_remainder",
  supplier: "l.kind_supplier",
  customer_refund: "l.kind_customer_refund",
  prior_receivable: "f.prior_receivable",
  prior_payable: "f.prior_payable",
  borrowed: "f.source_borrowed",
  loan_given: "f.withdraw_loan",
};

type BalancesState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; figures: ManageFiguresResponse; tab: "to_me" | "by_me" };

export default function BalancesPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const tab = new URLSearchParams(search).get("tab") === "by_me" ? "by_me" : "to_me";
  const [state, setState] = useState<BalancesState>({ phase: "loading" });

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      setState({ phase: "ready", figures: await fetchManageFigures("month"), tab });
    } catch (error) {
      if (isNetworkFailure(error)) {
        setState({ phase: "error", message: t("E-OFFLINE") });
        return;
      }
      navigate("/manage/start");
    }
  }, [navigate, tab]);
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
  const today = todayInAmman();
  /* الخطوط المفتوحة فقط (المسددة بالكامل لا تظهر) — من الأقدم. */
  const open = figures.balanceLines
    .filter(line => line.direction === tab && line.outstandingFils > 0)
    .sort((a, b) => a.originOn.localeCompare(b.originOn));
  /* الدفعات المقدمة لطلبات قادمة (G-03): طلب غير مسلَّم عليه دفعة. */
  const prepaySales = figures.salesList
    .filter(sale => sale.deliveredOn === null && sale.prepaymentFils > 0)
    .sort((a, b) => a.registeredOn.localeCompare(b.registeredOn));

  return (
    <div className="micro-manage-page">
      <header className="micro-manage-head">
        <h1 className="micro-manage-head__title">{t("s.balances")}</h1>
      </header>

      {/* 2. مفتاح «لك / عليك» — يفتح على الجهة التي جاء منها. */}
      <ChoiceRow>
        <ChoiceButton selected={tab === "to_me"} onClick={() => navigate("/manage/balances?tab=to_me")}>
          {t("t.to_me")}
        </ChoiceButton>
        <ChoiceButton selected={tab === "by_me"} onClick={() => navigate("/manage/balances?tab=by_me")}>
          {t("t.by_me")}
        </ChoiceButton>
      </ChoiceRow>

      {tab === "to_me" ? (
        <>
          {/* 3. لك: الجملة ثم صفوف الخطوط + زر الإضافة. */}
          <p className="micro-manage-card__line">
            {fill("s.receivables", { amount: figures.receivables.textDashboard })}
          </p>
          {open.length === 0 ? (
            <EmptyState title={t("e.empty_receivables")} />
          ) : (
            <div className="micro-manage-rows">
              {open.map(line => (
                <button
                  key={line.id}
                  type="button"
                  className="micro-manage-row"
                  onClick={() => navigate(`/manage/balances/${line.id}`)}
                >
                  <span className="micro-manage-row__main">
                    <span className="micro-manage-row__title">
                      {(line.counterpartyName ?? t("l.no_name")) +
                        " · " +
                        (LINE_KIND_KEYS[line.kind] === undefined ? line.kind : t(LINE_KIND_KEYS[line.kind]!))}
                    </span>
                    <span className="micro-manage-row__amount">{line.text}</span>
                  </span>
                  <span className="micro-manage-row__meta">
                    {ageTextR19(line.originOn, today)}
                    {line.overdue ? ` · ${t("st.overdue")}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
          <Button action="secondary" onClick={() => navigate("/manage/balances/add-prior?direction=to_me")}>
            {t("a.add_prior")}
          </Button>
        </>
      ) : (
        <>
          {/* 4. عليك: الجملة ثم صفوف الخطوط ثم مجموعة الدفعات المقدمة + زر الإضافة. */}
          <p className="micro-manage-card__line">
            {figures.payablesPrepayments.fils > 0
              ? fill("s.payables", {
                  amount: figures.payables.textDashboard,
                  pre: figures.payablesPrepayments.textDashboard,
                })
              : fill("s.payables_no_pre", { amount: figures.payables.textDashboard })}
          </p>
          {open.length === 0 ? (
            <EmptyState title={t("e.empty_payables")} />
          ) : (
            <div className="micro-manage-rows">
              {open.map(line => (
                <button
                  key={line.id}
                  type="button"
                  className="micro-manage-row"
                  onClick={() => navigate(`/manage/balances/${line.id}`)}
                >
                  <span className="micro-manage-row__main">
                    <span className="micro-manage-row__title">
                      {(line.counterpartyName ?? t("l.no_name")) +
                        " · " +
                        (LINE_KIND_KEYS[line.kind] === undefined ? line.kind : t(LINE_KIND_KEYS[line.kind]!))}
                    </span>
                    <span className="micro-manage-row__amount">{line.text}</span>
                  </span>
                  <span className="micro-manage-row__meta">{ageTextR19(line.originOn, today)}</span>
                </button>
              ))}
            </div>
          )}
          {/* مجموعة «الدفعات المقدمة لطلبات قادمة»: صف لكل طلب عليه دفعة. */}
          {prepaySales.length > 0 ? (
            <section className="micro-manage-section">
              <h2 className="micro-manage-section__title">{t("t.prepayments_group")}</h2>
              <div className="micro-manage-rows">
                {prepaySales.map(sale => (
                  <button
                    key={sale.id}
                    type="button"
                    className="micro-manage-row"
                    onClick={() => navigate(`/manage/sale/${sale.id}`)}
                  >
                    <span className="micro-manage-row__main">
                      <span className="micro-manage-row__title">{sale.customerName ?? t("l.no_name")}</span>
                      <span className="micro-manage-row__amount">
                        {jodDashboardAmount(sale.prepaymentFils)}
                      </span>
                    </span>
                    <span className="micro-manage-row__meta">{saleStatusOf(sale.status)}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          <Button action="secondary" onClick={() => navigate("/manage/balances/add-prior?direction=by_me")}>
            {t("a.add_prior_payable")}
          </Button>
        </>
      )}
    </div>
  );
}

/** حالة الطلب §6 بتسمية الكتالوج. */
function saleStatusOf(status: string): string {
  const keys: Record<string, ManageStringKey> = {
    scheduled: "st.scheduled",
    overdue: "st.overdue",
    delivered_unpaid: "st.delivered_unpaid",
    completed: "st.completed",
    cancelled: "st.cancelled",
  };
  return keys[status] === undefined ? status : t(keys[status]);
}
