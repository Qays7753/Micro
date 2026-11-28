/**
 * M5.5 (UX P-39 «دمج الصندوقين» + §5 OP-MERGE-BOXES): التأكيد بجملته
 * الحرفية «سيصبح رصيد النقد {amount}» (= الرصيد الإجمالي §8 من موديول
 * القراءة)؛ التأكيد → OP-MERGE-BOXES ← P-37 بصندوق واحد. أي صندوق مجهول:
 * مكان التأكيد E-MERGE-UNKNOWN + «ابدأ المطابقة» ← P-50.
 *
 * ورقة عمق كاملة (النموذج يخفي الشريط). لا مدخلات مالية إطلاقًا — عملية
 * بلا مدخلات.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button, Notice } from "@/components/primitives";
import { t } from "@/application/manage/strings";
import { fill, manageErrorText } from "@/application/manage/presentation";
import {
  fetchManageFigures,
  isNetworkFailure,
  mergeManageBoxes,
  type Figure,
  type ManageFiguresResponse,
  type ManageWriteOutcome,
  type UnknownFigure,
} from "@/application/manage/api";

/** نص الرقم أو «غير معروف حتى المطابقة» (N-37). */
function figureText(figure: Figure | UnknownFigure): string {
  return figure.fils === null ? t(figure.labelKey) : figure.textDashboard;
}

type MergeState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; figures: ManageFiguresResponse };

export default function BoxMergePage() {
  const [, navigate] = useLocation();
  const [state, setState] = useState<MergeState>({ phase: "loading" });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /* R-25/T55: مفتاح الطلب لكل محاولة — إعادة المحاولة لا تكرر الدمج. */
  const requestId = useRef(globalThis.crypto?.randomUUID() ?? `merge-${Math.random()}`);

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

  async function onConfirm(): Promise<void> {
    setSaving(true);
    setFormError(null);
    try {
      const outcome: ManageWriteOutcome = await mergeManageBoxes(requestId.current);
      if (outcome.outcome === "applied" || outcome.outcome === "replay") {
        navigate("/manage/boxes");
        return;
      }
    } catch (error) {
      if (isNetworkFailure(error)) {
        setFormError(t("E-OFFLINE"));
      } else {
        setFormError(manageErrorText(error));
      }
    }
    setSaving(false);
  }

  if (state.phase === "loading") {
    return (
      <div className="micro-manage-sheet" dir="rtl" aria-busy="true">
        <span className="micro-manage-page__loading" />
      </div>
    );
  }
  if (state.phase === "error") {
    return (
      <div className="micro-manage-sheet" dir="rtl">
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
  /* أي صندوق فعّال مجهول الافتتاح يمنع الدمج (E-MERGE-UNKNOWN — T47/T53). */
  const blocked = figures.flags.unknownBalance;

  return (
    <div className="micro-manage-sheet" dir="rtl">
      <h1 className="micro-manage-sheet__title">{t("a.merge")}</h1>
      <div className="micro-manage-sheet__body">
        {blocked ? (
          <>
            <p className="micro-manage-card__line">{t("E-MERGE-UNKNOWN")}</p>
            <div className="micro-manage-card__actions">
              <Button action="create" onClick={() => navigate("/manage/reconcile")}>
                {t("a.start_recon")}
              </Button>
            </div>
          </>
        ) : (
          /* الجملة الحرفية: {amount} = الرصيد الإجمالي §8 (نص الخادم). */
          <p className="micro-manage-card__line">
            {fill("d.merge", { amount: figureText(figures.totalBalance) })}
          </p>
        )}
        {formError ? (
          <Notice tone="error" role="alert">
            {formError}
          </Notice>
        ) : null}
      </div>
      <div className="micro-manage-sheet__save">
        {blocked ? (
          <Button action="secondary" block onClick={() => navigate("/manage/boxes")}>
            {t("a.back")}
          </Button>
        ) : (
          <Button action="commit" block loading={saving} onClick={() => void onConfirm()}>
            {t("a.confirm")}
          </Button>
        )}
      </div>
    </div>
  );
}
