/**
 * M5.7 (UX P-50…P-53 «المطابقة» + §7.1/§7.3): نافذة عمق واحدة متصلة
 * الخطوات — الأرصدة (المسجَّل من موديول القراءة والموجود مدخلًا ومطابق/
 * غير مطابق لكل صندوق فعّال والمجهول إجباره بلا «مطابق») → اقتراح
 * التحويل عند فرقين بعكس بعض → أسئلة الفرق صندوقًا صندوقًا (أزرارها إلى
 * نماذجها القانونية M5.8) → النتيجة.
 *
 * كل Δ واقتراح التحويل نصوص الخادم (قراءة reconcile-diff) — لا طرح في
 * الواجهة. الإنهاء = OP-RECONCILE (سياق routine أو first_unknown_opening
 * مع مجهول §7.3). الخروج «لاحقاً» بلا حفظ.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button, Notice } from "@/components/primitives";
import { AmountField } from "@/components/manage/AmountField";
import { t } from "@/application/manage/strings";
import { fill, manageErrorText, parseJodInputToFils } from "@/application/manage/presentation";
import {
  fetchManageFigures,
  fetchReconcileDiff,
  finishReconcile,
  isNetworkFailure,
  transferBetweenBoxes,
  type ManageFiguresResponse,
  type ManageWriteOutcome,
  type ReconcileBoxDiff,
  type ReconcileDiffResponse,
} from "@/application/manage/api";

/** مسودة صندوق في الخطوة 1: النص الخام + «مطابق». */
interface CountDraft {
  amountText: string;
  matched: boolean;
}

type Step = "balances" | "transfer" | "questions" | "result";

/** أسئلة النقص/الزيادة (P-52) — أزرارها إلى نماذجها القانونية (M5.8). */
const LESS_LINKS: ReadonlyArray<{
  key: "r.less.expense" | "r.less.withdraw" | "r.less.pay" | "r.less.lend";
  to: string;
}> = [
  { key: "r.less.expense", to: "/manage/op/expense" },
  { key: "r.less.withdraw", to: "/manage/op/owner" },
  { key: "r.less.pay", to: "/manage/op/collect" },
  { key: "r.less.lend", to: "/manage/op/owner" },
];
const MORE_LINKS: ReadonlyArray<{
  key: "r.more.collect" | "r.more.sale" | "r.more.deposit" | "r.more.borrow";
  to: string;
}> = [
  { key: "r.more.collect", to: "/manage/op/collect" },
  { key: "r.more.sale", to: "/manage/op/sale" },
  { key: "r.more.deposit", to: "/manage/op/owner" },
  { key: "r.more.borrow", to: "/manage/op/owner" },
];

export default function ReconcilePage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>("balances");
  const [figures, setFigures] = useState<ManageFiguresResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<string, CountDraft>>({});
  const [diff, setDiff] = useState<ReconcileDiffResponse | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /* R-25/T55: مفتاح طلب واحد للإنهاء (إعادة المحاولة لا تكرر Q19). */
  const finishId = useRef(globalThis.crypto?.randomUUID() ?? `recon-${Math.random()}`);
  const transferId = useRef(globalThis.crypto?.randomUUID() ?? `trans-${Math.random()}`);
  const [unexplained, setUnexplained] = useState<Array<{ kind: string; text: string }>>([]);

  const load = useCallback(async () => {
    try {
      const response = await fetchManageFigures("month");
      setFigures(response);
      const initial: Record<string, CountDraft> = {};
      for (const box of response.boxes.filter(b => b.status === "active")) {
        initial[box.id] = { amountText: "", matched: false };
      }
      setDrafts(initial);
    } catch (error) {
      if (isNetworkFailure(error)) {
        setFormError(t("E-OFFLINE"));
        return;
      }
      navigate("/manage/start");
    }
  }, [navigate]);
  useEffect(() => {
    void load();
  }, [load]);

  /** الموجود لكل صندوق: مطابق → المسجَّل، وإلا النص المحلول (صفر مقبول). */
  function countedOf(): { boxes: Array<{ boxId: string; countedFils: number }>; error: string | null } {
    if (figures === null) return { boxes: [], error: null };
    const boxes: Array<{ boxId: string; countedFils: number }> = [];
    for (const box of figures.boxes.filter(b => b.status === "active")) {
      const draft = drafts[box.id] ?? { amountText: "", matched: false };
      if (draft.matched) {
        boxes.push({ boxId: box.id, countedFils: box.balanceFils ?? 0 });
        continue;
      }
      const fils = draft.amountText.length === 0 ? null : parseJodInputToFils(draft.amountText);
      if (fils === null) return { boxes: [], error: t("E-AMOUNT") };
      boxes.push({ boxId: box.id, countedFils: fils });
    }
    return { boxes, error: null };
  }

  /** «التالي»: فروق الخادم تقرر الوجهة (الكل صفر ← إنهاء ← P-53؛ فرقان
   *  بعكس بعض ← P-51؛ وإلا ← P-52). */
  async function onNext(): Promise<void> {
    const counted = countedOf();
    if (counted.error !== null) {
      setFormError(counted.error);
      return;
    }
    /* المجهول إجباري: لا «مطابق» له — تحقق العرض فقط (الخادم يعيد
     * التحقق عند الإنهاء). */
    setBusy(true);
    setFormError(null);
    try {
      const response = await fetchReconcileDiff(counted.boxes);
      setDiff(response);
      if (response.allZero) {
        await doFinish(counted.boxes);
      } else if (response.transferProposal !== null) {
        setStep("transfer");
      } else {
        setStep("questions");
      }
    } catch (error) {
      setFormError(isNetworkFailure(error) ? t("E-OFFLINE") : manageErrorText(error));
    }
    setBusy(false);
  }

  /** الإنهاء = OP-RECONCILE: السياق first_unknown_opening مع صندوق مجهول
   *  (§7.3) وإلا routine؛ النتيجة Q19 لكل صندوق بفرق غير صفر. */
  /** الإنهاء = OP-RECONCILE؛ نتيجة P-53 تُبنى من فروق اللحظة نفسها
   *  (Q19 لكل صندوق بفرق ≠ 0 — نص الخادم). */
  async function doFinish(counted: Array<{ boxId: string; countedFils: number }>): Promise<void> {
    const context = (figures?.flags.unknownBalance ?? false) ? "first_unknown_opening" : "routine";
    const result: ManageWriteOutcome = await finishReconcile({
      requestId: finishId.current,
      context,
      boxes: counted,
    });
    void result;
    setUnexplained(
      ((diff?.boxes ?? []) as ReconcileBoxDiff[])
        .filter((box: ReconcileBoxDiff) => box.deltaFils !== 0)
        .map((box: ReconcileBoxDiff) => ({ kind: box.kind, text: box.deltaText })),
    );
    setStep("result");
  }

  /** P-51 «تأكيد»: OP-TRANSFER باقتراح §7.1-2 ثم إعادة الفروق. */
  async function onConfirmTransfer(): Promise<void> {
    if (diff?.transferProposal === null || diff === null) return;
    const proposal = diff.transferProposal;
    setBusy(true);
    setFormError(null);
    try {
      await transferBetweenBoxes({
        requestId: transferId.current,
        fromBox: proposal.fromBox as "cash" | "account",
        toBox: proposal.toBox as "cash" | "account",
        amountFils: proposal.amountFils,
      });
      const counted = countedOf();
      const response = await fetchReconcileDiff(counted.boxes);
      setDiff(response);
      if (response.allZero) {
        await doFinish(counted.boxes);
      } else {
        setStep("questions");
      }
    } catch (error) {
      setFormError(isNetworkFailure(error) ? t("E-OFFLINE") : manageErrorText(error));
    }
    setBusy(false);
  }

  if (figures === null) {
    return (
      <div className="micro-manage-sheet" dir="rtl" aria-busy="true">
        <span className="micro-manage-page__loading" />
      </div>
    );
  }

  const activeBoxes = figures.boxes.filter(box => box.status === "active");
  const twoBoxes = activeBoxes.length > 1;
  const unknownBalance = figures.flags.unknownBalance;
  const totalText = figures.totalBalance.fils === null ? "" : figures.totalBalance.textDashboard;
  const breakdown =
    twoBoxes && !unknownBalance
      ? activeBoxes
          .map(
            box =>
              `${box.kind === "cash" ? t("f.cash") : t("f.account")} ${
                box.balanceFils === null ? t("l.unknown_balance") : (box.textDashboard ?? "")
              }`,
          )
          .join(" · ")
      : "";

  return (
    <div className="micro-manage-sheet" dir="rtl">
      <h1 className="micro-manage-sheet__title">{t("op.reconcile")}</h1>
      <div className="micro-manage-sheet__body">
        {step === "balances" ? (
          <>
            {/* 2. الجملة (سابقة G-09: مجهول بلا جملة). */}
            {unknownBalance ? null : (
              <p className="micro-manage-card__line">
                {twoBoxes
                  ? fill("r.prompt", { total: totalText, breakdown })
                  : fill("r.prompt_single", { total: totalText })}
              </p>
            )}
            {/* 3. صف لكل صندوق فعّال (النقد أول — ترتيب الخادم). */}
            {activeBoxes.map(box => {
              const known = box.openingStatus === "known";
              const draft = drafts[box.id] ?? { amountText: "", matched: false };
              return (
                <div key={box.id} className="micro-manage-field">
                  <p className="micro-manage-field__label">
                    {(box.kind === "cash" ? t("f.cash") : t("f.account")) +
                      (known ? `: ${box.textDashboard ?? ""}` : `: ${t("l.unknown_balance")}`)}
                  </p>
                  {known ? (
                    <label className="micro-manage-check">
                      <input
                        type="checkbox"
                        checked={draft.matched}
                        onChange={event =>
                          setDrafts({
                            ...drafts,
                            [box.id]: { ...draft, matched: event.target.checked, amountText: "" },
                          })
                        }
                      />
                      <span>{t("r.match")}</span>
                    </label>
                  ) : null}
                  {!draft.matched ? (
                    <AmountField
                      label={t("r.mismatch")}
                      value={draft.amountText}
                      testId={`manage-recon-count-${box.kind}`}
                      onTextChange={text =>
                        setDrafts({ ...drafts, [box.id]: { ...draft, amountText: text } })
                      }
                    />
                  ) : null}
                </div>
              );
            })}
            {formError ? (
              <Notice tone="error" role="alert">
                {formError}
              </Notice>
            ) : null}
          </>
        ) : null}

        {step === "transfer" && diff !== null && diff.transferProposal !== null ? (
          <>
            {/* P-51: اقتراح §7.1-2 بنص الخادم. */}
            <p className="micro-manage-card__line">
              {fill("S-RECON-TRANSFER", {
                amount: diff.transferProposal.amountText,
                from: diff.transferProposal.fromBox === "cash" ? t("f.cash") : t("f.account"),
                to: diff.transferProposal.toBox === "cash" ? t("f.cash") : t("f.account"),
              })}
            </p>
            {formError ? (
              <Notice tone="error" role="alert">
                {formError}
              </Notice>
            ) : null}
            <div className="micro-manage-card__actions">
              <Button action="commit" loading={busy} onClick={() => void onConfirmTransfer()}>
                {t("a.confirm")}
              </Button>
              <Button action="secondary" onClick={() => setStep("questions")}>
                {t("f.no")}
              </Button>
            </div>
          </>
        ) : null}

        {step === "questions" && diff !== null ? (
          <>
            {/* P-52: صندوقًا صندوقًا — الفرق نص الخادم وأسئلته. */}
            {(diff.boxes as ReconcileBoxDiff[])
              .filter(box => box.deltaFils !== 0)
              .map((box: ReconcileBoxDiff) => (
                <div key={box.boxId} className="micro-manage-field">
                  <p className="micro-manage-field__label">
                    {(twoBoxes ? `${box.kind === "cash" ? t("f.cash") : t("f.account")} · ` : "") +
                      fill(box.deltaFils < 0 ? "r.diff_less" : "r.diff_more", {
                        amount: box.deltaText.replace("-", ""),
                      })}
                  </p>
                  <div className="micro-manage-card__actions">
                    {(box.deltaFils < 0 ? LESS_LINKS : MORE_LINKS).map(item => (
                      <Button
                        key={item.key}
                        action="secondary"
                        onClick={() =>
                          navigate(
                            `${item.to}?recon=1&box=${box.kind}&amount=${encodeURIComponent(box.deltaText)}`,
                          )
                        }
                      >
                        {t(item.key)}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            {/* 3. سطر التذكير (ليس سؤالًا). */}
            <p className="micro-manage-card__line micro-manage-card__line--secondary">{t("r.all_places")}</p>
            {formError ? (
              <Notice tone="error" role="alert">
                {formError}
              </Notice>
            ) : null}
          </>
        ) : null}

        {step === "result" ? (
          <>
            {/* P-53: النتيجة وQ19 لكل صندوق بفرق. */}
            <p className="micro-manage-card__line">{t("d.recon_done")}</p>
            {unexplained.map(entry => (
              <p key={entry.kind} className="micro-manage-card__line micro-manage-card__line--secondary">
                {(twoBoxes ? `${entry.kind === "cash" ? t("f.cash") : t("f.account")} · ` : "") + entry.text}
              </p>
            ))}
          </>
        ) : null}
      </div>
      <div className="micro-manage-sheet__save">
        {step === "balances" ? (
          <>
            <Button action="commit" block loading={busy} onClick={() => void onNext()}>
              {t("a.next")}
            </Button>
            <Button action="quiet" block onClick={() => navigate("/")}>
              {t("d.recon_later")}
            </Button>
          </>
        ) : null}
        {step === "questions" ? (
          <Button
            action="commit"
            block
            loading={busy}
            onClick={() => {
              const counted = countedOf();
              void doFinish(counted.boxes);
            }}
          >
            {t("r.finish")}
          </Button>
        ) : null}
        {step === "result" ? (
          <Button action="commit" block onClick={() => navigate("/")}>
            {t("a.ok")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
