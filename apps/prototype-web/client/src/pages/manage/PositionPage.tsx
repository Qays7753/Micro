/**
 * M5.4 (UX P-32 «المركز المالي»): شو عندك وشو عليك هلأ (بدون فترة) —
 * «ما لديك» بنقده وحسابه ومستحقاته ومجموعه (§8.2 What you have)،
 * و«ما عليك» بمجموعه وتفصيله حسب النوع ومنه الدفعات المقدمة (§8.2)،
 * ثم صافي قيمة المشروع وزر المصادر (P-33). المعدات ليست ضمن «ما لديك»
 * (الكونسبت §12.3). كل نص جاهز من الخادم (٣ منازل — تقرير §10.6).
 *
 * رصيد غير معروف: الصندوق ومجموع «ما لديك» وصافي القيمة «غير معروف حتى
 * المطابقة» (§8.2/N-37). صندوق واحد: سطر نقد فقط.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button, Notice } from "@/components/primitives";
import { t } from "@/application/manage/strings";
import { fill } from "@/application/manage/presentation";
import { fetchManageFigures, isNetworkFailure, type ManageFiguresResponse } from "@/application/manage/api";

/** تسميات أنواع «ما عليك» (§8.2): العائلة الشائعة والنادران بتسميتيهما
 *  من §10 (قراءة موثقة — الكتالوج حرفي، والنوع مجهول يعرض كما ورد). */
const OWE_KIND_KEYS: Readonly<Record<string, Parameters<typeof t>[0]>> = {
  sale_remainder: "l.kind_sale_remainder",
  supplier: "l.kind_supplier",
  customer_refund: "l.kind_customer_refund",
  prior_payable: "f.prior_payable",
  borrowed: "f.source_borrowed",
};

type PositionState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; figures: ManageFiguresResponse };

export default function PositionPage() {
  const [, navigate] = useLocation();
  const [state, setState] = useState<PositionState>({ phase: "loading" });

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
  const unknownBalance = figures.flags.unknownBalance;
  const activeBoxes = figures.boxes.filter(box => box.status === "active");

  return (
    <div className="micro-manage-page">
      <header className="micro-manage-head">
        <h1 className="micro-manage-head__title">{t("rep.position")}</h1>
      </header>

      {/* ما لديك: الصناديق (مع صندوقين) + المستحقات + المجموع (§8.2). */}
      <section className="micro-manage-card">
        <p className="micro-manage-card__title">{t("rep.have")}</p>
        {activeBoxes.map(box => (
          <p key={box.id} className="micro-manage-card__line">
            {box.kind === "cash" ? t("f.cash") : t("f.account")}:{" "}
            {box.balanceFils === null ? t("l.unknown_balance") : (box.text ?? "")}
          </p>
        ))}
        <p className="micro-manage-card__line">
          {fill("s.receivables", { amount: figures.receivables.text })}
        </p>
        <p className="micro-manage-card__line micro-manage-card__title">
          {t("rep.have")}:{" "}
          {figures.whatYouHave.fils === null ? t("l.unknown_balance") : figures.whatYouHave.text}
        </p>
      </section>

      {/* ما عليك: المجموع وتفصيله حسب النوع ومنه الدفعات المقدمة (§8.2). */}
      <section className="micro-manage-card">
        <p className="micro-manage-card__title">{t("rep.owe")}</p>
        {figures.whatYouOweBreakdown.map(line => (
          <p key={line.kind} className="micro-manage-card__line micro-manage-card__line--secondary">
            {OWE_KIND_KEYS[line.kind] === undefined ? line.kind : t(OWE_KIND_KEYS[line.kind]!)}: {line.text}
          </p>
        ))}
        {figures.payablesPrepayments.fils > 0 ? (
          <p className="micro-manage-card__line micro-manage-card__line--secondary">
            {t("a.prepayment")}: {figures.payablesPrepayments.text}
          </p>
        ) : null}
        <p className="micro-manage-card__line micro-manage-card__title">
          {t("rep.owe")}: {figures.whatYouOwe.text}
        </p>
      </section>

      {/* صافي قيمة المشروع (نفس رقم P-30 — بلا فترة). */}
      <section className="micro-manage-card">
        <p className="micro-manage-card__title">{t("rep.networth")}</p>
        <p className="micro-manage-card__line">
          {unknownBalance || figures.netWorth.fils === null ? t("l.unknown_balance") : figures.netWorth.text}
        </p>
      </section>

      <Button action="secondary" onClick={() => navigate("/manage/finance/sources")}>
        {t("rep.sources")}
      </Button>
      <Button action="quiet" onClick={() => navigate("/manage/finance")}>
        {t("a.back")}
      </Button>
    </div>
  );
}
