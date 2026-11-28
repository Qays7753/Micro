/**
 * M5.5 (UX P-38 «إضافة صندوق» + §5 OP-ADD-BOX): إضافة الحساب — النقد
 * موجود دائمًا من البداية فالصندوق الناقص هو الحساب. C-01 مبلغ الافتتاح
 * أو «لا أعرف الآن» بتلميحه؛ الحفظ → OP-ADD-BOX (Q1 اليوم إذا معروف —
 * R-26) ثم العودة إلى P-37.
 *
 * ورقة عمق كاملة (النموذج يخفي الشريط — UX §1.2). التحليل للإرسال وحده
 * (parseJodInputToFils)؛ لا معنى مالي آخر هنا.
 */
import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button, Notice } from "@/components/primitives";
import { AmountField } from "@/components/manage/AmountField";
import { t } from "@/application/manage/strings";
import { manageErrorText, parseJodInputToFils } from "@/application/manage/presentation";
import {
  addManageBox,
  isNetworkFailure,
  type ManageWriteOutcome,
  type SetupBoxOpening,
} from "@/application/manage/api";

/** حالة الافتتاح: نص خام + «لا أعرف» + مسودة خطأ (C-08: لا مسح عند الخطأ). */
interface OpeningDraft {
  amountText: string;
  unknown: boolean;
  error: string | null;
}

export default function BoxAddPage() {
  const [, navigate] = useLocation();
  const [draft, setDraft] = useState<OpeningDraft>({ amountText: "", unknown: false, error: null });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /* R-25/T55: مفتاح الطلب لكل محاولة حفظ — إعادة المحاولة بالمفتاح نفسه
   * لا تكرر العملية أبدًا (ردّ الخادم replay). */
  const requestId = useRef(globalThis.crypto?.randomUUID() ?? `add-box-${Math.random()}`);

  /* G-08 (سابقة P-01): «له مبلغ» = نص غير فارغ أو «لا أعرف الآن» — الفارغ
   * وحده يعطّل الحفظ، والصفر مقبول (افتتاح معروف بلا قيد). */
  function opening(): { opening: SetupBoxOpening | null; error: string | null } {
    if (draft.unknown) return { opening: { unknown: true }, error: null };
    if (draft.amountText.length === 0) return { opening: null, error: null };
    const fils = parseJodInputToFils(draft.amountText);
    if (fils === null) return { opening: null, error: t("E-AMOUNT") };
    return { opening: { openingFils: fils }, error: null };
  }

  const openingState = opening();
  /* G-08 (سابقة P-01): الفارغ وحده (بلا «لا أعرف») يعطّل الحفظ؛ النص غير
   * الصالح يفعّل الزر وتظهر E-AMOUNT تحت الحقل عند الحفظ (C-08). */
  const saveDisabled = (draft.amountText.length === 0 && !draft.unknown) || saving;

  async function onSave(): Promise<void> {
    if (openingState.error !== null) {
      setDraft({ ...draft, error: openingState.error });
      return;
    }
    if (openingState.opening === null) return;
    setSaving(true);
    setFormError(null);
    try {
      const outcome: ManageWriteOutcome = await addManageBox({
        requestId: requestId.current,
        kind: "account",
        opening: openingState.opening,
      });
      /* الرد (أو إعادته R-25) يقفل الورقة ← P-37. */
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

  return (
    <div className="micro-manage-sheet" dir="rtl">
      <h1 className="micro-manage-sheet__title">{t("a.add_box")}</h1>
      <div className="micro-manage-sheet__body">
        {/* 1. «حساب» + C-01: الصندوق الناقص هو الحساب دائمًا. */}
        <AmountField
          label={t("f.account")}
          value={draft.amountText}
          disabled={draft.unknown}
          error={draft.error ?? undefined}
          hint={draft.unknown ? t("t.unknown_hint") : undefined}
          testId="manage-box-add-amount"
          onTextChange={text => setDraft({ ...draft, amountText: text, error: null })}
        />
        {/* 2. «لا أعرف الآن» + التلميح عند اختياره. */}
        <label className="micro-manage-check">
          <input
            type="checkbox"
            checked={draft.unknown}
            onChange={event => setDraft({ ...draft, unknown: event.target.checked, error: null })}
          />
          <span>{t("t.unknown_now")}</span>
        </label>
        {formError ? (
          <Notice tone="error" role="alert">
            {formError}
          </Notice>
        ) : null}
      </div>
      <div className="micro-manage-sheet__save">
        <Button action="commit" block disabled={saveDisabled} loading={saving} onClick={() => void onSave()}>
          {t("a.save")}
        </Button>
      </div>
    </div>
  );
}
