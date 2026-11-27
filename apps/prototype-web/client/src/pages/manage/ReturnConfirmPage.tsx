/**
 * M5.2 (UX P-14 «تأكيد حُصِّل أو سُدِّد» — صندوقان فقط): اختيار الصندوق
 * قبل تسوية كامل المتبقي (غير قابل للتعديل §7.2) — الاسم والمبلغ للعرض
 * وC-02 للخيار، ثم OP-COLLECT/OP-PAY فوريًا بتاريخ اليوم (استثناء R-26).
 * صندوق واحد: الصفحة ما بتبين أصلًا (زر P-13 ينفّذ مباشرة).
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Button, ChoiceRow, ChoiceButton, Notice } from "@/components/primitives";
import { t } from "@/application/manage/strings";
import { manageErrorText } from "@/application/manage/presentation";
import {
  collectPayment,
  fetchManageFigures,
  payDebt,
  type ManageFiguresResponse,
} from "@/application/manage/api";
import { todayInAmman } from "@/application/time";

export default function ReturnConfirmPage() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(useSearch());
  const lineId = params.get("line") ?? "";
  const [figures, setFigures] = useState<ManageFiguresResponse | null>(null);
  const [box, setBox] = useState<"cash" | "account">("cash");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setFigures(await fetchManageFigures());
  }, []);

  useEffect(() => {
    load().catch(() => navigate("/"));
  }, [load, navigate]);

  if (figures === null) {
    return (
      <div className="micro-manage-page" aria-busy="true">
        <span className="micro-manage-page__loading" />
      </div>
    );
  }

  const line = figures.balanceLines.find(candidate => candidate.id === lineId);
  if (line === undefined) {
    navigate("/manage/return/balances");
    return (
      <div className="micro-manage-page" aria-busy="true">
        <span className="micro-manage-page__loading" />
      </div>
    );
  }

  async function onConfirm() {
    setError(null);
    setSaving(true);
    try {
      const input = {
        requestId: globalThis.crypto?.randomUUID() ?? `settle-${Math.random()}`,
        amountFils: line!.outstandingFils,
        box,
        balanceLineId: line!.id,
        effectiveOn: todayInAmman(),
      };
      if (line!.direction === "to_me") {
        await collectPayment(input);
      } else {
        await payDebt(input);
      }
      navigate("/manage/return/balances");
    } catch (cause) {
      setError(manageErrorText(cause));
      setSaving(false);
    }
  }

  return (
    <div className="micro-manage-sheet" dir="rtl">
      <h1 className="micro-manage-sheet__title">{t("r.settled")}</h1>
      <div className="micro-manage-sheet__body">
        <p className="micro-manage-card__line">
          {line.counterpartyName ?? t("l.no_name")} · {line.text}
        </p>
        <div className="micro-manage-field" role="group" aria-label={t("f.box")}>
          <p className="micro-manage-field__label">{t("f.box")}</p>
          <ChoiceRow>
            <ChoiceButton selected={box === "cash"} onClick={() => setBox("cash")}>
              {t("f.cash")}
            </ChoiceButton>
            <ChoiceButton selected={box === "account"} onClick={() => setBox("account")}>
              {t("f.account")}
            </ChoiceButton>
          </ChoiceRow>
        </div>
        {error !== null ? (
          <Notice tone="error" role="alert">
            {error}
          </Notice>
        ) : null}
      </div>
      <div className="micro-manage-sheet__save">
        <Button action="secondary" onClick={() => navigate("/manage/return/balances")}>
          {t("a.back")}
        </Button>
        <Button action="commit" block loading={saving} onClick={() => void onConfirm()}>
          {t("a.confirm")}
        </Button>
      </div>
    </div>
  );
}
