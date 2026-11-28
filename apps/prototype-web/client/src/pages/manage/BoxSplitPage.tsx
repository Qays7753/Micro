/**
 * M5.5 (UX P-40 «فصل الصندوقين» + §5 OP-SPLIT-BOXES): إعادة تفعيل الحساب
 * المدموج — «نقد» برصيده الحالي (§8 نص الخادم) + «مبلغ الحساب» C-01
 * (صفر مقبول: تفعيل بلا قيد T59)؛ التأكيد → OP-SPLIT-BOXES ← P-37
 * بصندوقين. نقد مجهول ← E-MERGE-UNKNOWN + «ابدأ المطابقة» ← P-50.
 *
 * ورقة عمق كاملة. التحليل للإرسال وحده؛ E-SPLIT-AMOUNT يرد من الخادم
 * (المبلغ أكبر من رصيد النقد) ويُعرض برسالة §11 — لا مقارنة في العميل.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button, Notice } from "@/components/primitives";
import { AmountField } from "@/components/manage/AmountField";
import { t } from "@/application/manage/strings";
import { manageErrorText, parseJodInputToFils } from "@/application/manage/presentation";
import {
  fetchManageFigures,
  isNetworkFailure,
  splitManageBoxes,
  type ManageFiguresResponse,
  type ManageWriteOutcome,
} from "@/application/manage/api";

type SplitState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; figures: ManageFiguresResponse };

export default function BoxSplitPage() {
  const [, navigate] = useLocation();
  const [state, setState] = useState<SplitState>({ phase: "loading" });
  const [amountText, setAmountText] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /* R-25/T55: مفتاح الطلب لكل محاولة — إعادة المحاولة لا تكرر الفصل. */
  const requestId = useRef(globalThis.crypto?.randomUUID() ?? `split-${Math.random()}`);

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

  /* الصفر مقبول (تفعيل بلا قيد T59)؛ الفارغ يعطّل؛ غير الصالح E-AMOUNT. */
  function amountFils(): { fils: number | null; error: string | null } {
    if (amountText.length === 0) return { fils: null, error: null };
    const fils = parseJodInputToFils(amountText);
    if (fils === null) return { fils: null, error: t("E-AMOUNT") };
    return { fils, error: null };
  }

  const amountState = amountFils();

  async function onConfirm(): Promise<void> {
    if (amountState.error !== null) {
      setFieldError(amountState.error);
      return;
    }
    if (amountState.fils === null) return;
    setSaving(true);
    setFormError(null);
    try {
      const outcome: ManageWriteOutcome = await splitManageBoxes({
        requestId: requestId.current,
        amountFils: amountState.fils,
      });
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
  const cashBox = figures.boxes.find(box => box.kind === "cash" && box.status === "active");
  /* نقد مجهول الافتتاح يمنع الفصل (E-MERGE-UNKNOWN — سابقة الدمج). */
  const blocked = figures.flags.unknownBalance;

  return (
    <div className="micro-manage-sheet" dir="rtl">
      <h1 className="micro-manage-sheet__title">{t("a.split")}</h1>
      <div className="micro-manage-sheet__body">
        {/* 1. «نقد» برصيده الحالي — نص الخادم (§8). */}
        <p className="micro-manage-card__line">
          {t("f.cash")}:{" "}
          {cashBox === undefined || cashBox.balanceFils === null
            ? t("l.unknown_balance")
            : (cashBox.textDashboard ?? "")}
        </p>
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
          <>
            {/* 2. «مبلغ الحساب» C-01 — صفر مقبول. */}
            <AmountField
              label={t("t.split_amount")}
              value={amountText}
              error={fieldError ?? undefined}
              testId="manage-box-split-amount"
              onTextChange={text => {
                setAmountText(text);
                setFieldError(null);
              }}
            />
          </>
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
          <Button
            action="commit"
            block
            /* الفارغ وحده يعطّل؛ غير الصالح يفعّل ويعرض E-AMOUNT (C-08). */
            disabled={amountText.length === 0 || saving}
            loading={saving}
            onClick={() => void onConfirm()}
          >
            {t("a.confirm")}
          </Button>
        )}
      </div>
    </div>
  );
}
