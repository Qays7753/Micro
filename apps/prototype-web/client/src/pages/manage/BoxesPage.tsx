/**
 * M5.5 (UX P-37 «الصناديق» + §8): كل شي عن الصناديق بمكان واحد — العنوان
 * والرصيد الإجمالي (أو N-37)، صف لكل صندوق فعّال برصيده من موديول القراءة
 * (المجهول بجملته، وتحت المعروف السالب w.negative_box)، ثم أزرار الإجراءات
 * بشرط ظهورها الحرفي.
 *
 * سطح قراءة يبقي الشريط السفلي (U-005). كل رقم نص جاهز من الخادم.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button, Notice } from "@/components/primitives";
import { t } from "@/application/manage/strings";
import { fill } from "@/application/manage/presentation";
import {
  fetchManageFigures,
  isNetworkFailure,
  type Figure,
  type ManageFiguresResponse,
  type UnknownFigure,
} from "@/application/manage/api";

/** نص الرقم أو «غير معروف حتى المطابقة» (N-37). */
function figureText(figure: Figure | UnknownFigure): string {
  return figure.fils === null ? t(figure.labelKey) : figure.textDashboard;
}

type BoxesState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; figures: ManageFiguresResponse };

export default function BoxesPage() {
  const [, navigate] = useLocation();
  const [state, setState] = useState<BoxesState>({ phase: "loading" });

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      setState({ phase: "ready", figures: await fetchManageFigures("month") });
    } catch (error) {
      if (isNetworkFailure(error)) {
        setState({ phase: "error", message: t("E-OFFLINE") });
        return;
      }
      /* 404 الموحّد: لا مشروع مالي بعد ← P-01 (R-24). */
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
  const activeBoxes = figures.boxes.filter(box => box.status === "active");
  const twoActive = activeBoxes.length > 1;
  /* شرط «فصل الصندوقين»: الحساب مدموج (صف الحساب نفسه — لا يظهر أعلاه). */
  const mergedAccount = figures.boxes.some(box => box.kind === "account" && box.status === "merged");
  /* شرط «إضافة صندوق»: صندوق واحد فعّال وما في حساب مدموج. */
  const canAdd = activeBoxes.length === 1 && !mergedAccount;
  const unknownBalance = figures.flags.unknownBalance;

  return (
    <div className="micro-manage-page">
      <header className="micro-manage-head">
        <h1 className="micro-manage-head__title">{t("s.boxes")}</h1>
      </header>

      {/* 1. الرصيد الإجمالي — أو N-37 مع مجهول. */}
      <p className="micro-manage-card__line">
        {unknownBalance
          ? t("s.balance_unknown")
          : fill("s.balance", { amount: figureText(figures.totalBalance) })}
      </p>

      {/* 2. صف لكل صندوق فعّال: النوع + الرصيد أو المجهول؛ السالب تنبيهه تحته. */}
      <section className="micro-manage-section">
        <div className="micro-manage-rows">
          {activeBoxes.map(box => (
            <div key={box.id} className="micro-manage-row micro-manage-row--card">
              <span className="micro-manage-row__main">
                <span className="micro-manage-row__title">
                  {box.kind === "cash" ? t("f.cash") : t("f.account")}
                </span>
                <span className="micro-manage-row__amount">
                  {box.balanceFils === null ? t("l.unknown_balance") : (box.textDashboard ?? "")}
                </span>
              </span>
              {box.openingStatus === "known" && (box.balanceFils ?? 0) < 0 ? (
                <span className="micro-manage-row__meta micro-manage-row__meta--warning">
                  {t("w.negative_box")}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* 3. أزرار الإجراءات بشرط ظهورها. */}
      <div className="micro-manage-card__actions">
        {twoActive ? (
          <Button action="secondary" onClick={() => navigate("/manage/op/transfer")}>
            {t("op.transfer")}
          </Button>
        ) : null}
        <Button action="create" onClick={() => navigate("/manage/reconcile")}>
          {t("a.start_recon")}
        </Button>
        {canAdd ? (
          <Button action="secondary" onClick={() => navigate("/manage/boxes/add")}>
            {t("a.add_box")}
          </Button>
        ) : null}
        {twoActive ? (
          <Button action="secondary" onClick={() => navigate("/manage/boxes/merge")}>
            {t("a.merge")}
          </Button>
        ) : null}
        {mergedAccount ? (
          <Button action="secondary" onClick={() => navigate("/manage/boxes/split")}>
            {t("a.split")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
