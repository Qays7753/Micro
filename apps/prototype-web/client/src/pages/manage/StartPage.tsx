/**
 * M5.1 (Manage v2 phase 5 — UX P-01 «البداية» + §5 OP-SETUP): إنشاء المشروع
 * بأقل من دقيقة — اسم المشروع، سؤال الصناديق، رصيد كل صندوق أو «لا أعرف
 * الآن»، وزر «ابدأ».
 *
 * قواعد UX الحرفية (P-01):
 *  1. حقل «اسم المشروع» — التركيز عليه تلقائيًا.
 *  2. «كم صندوقاً تستخدم؟»: «نقد فقط» (افتراضي) أو «نقد + حساب».
 *  3. لكل صندوق سطر: اسمه + C-01 + «لا أعرف الآن» (يعطّل المبلغ ويظهر
 *     التلميح). صفر مقبول.
 *  4. «ابدأ» معطّل حتى يكتمل كل صندوق (مبلغ أو لا أعرف — حُسم G-08).
 *  - الخطأ الوحيد الموضعي: E-NAME-REQUIREED عند اسم فارغ (تُعرض تحت
 *    الحقل)؛ أخطاء الخادم تُعرض أعلى الورقة دون مسح المدخلات (C-08).
 *  - لا أي حساب مالي: نص المبلغ يُحلَّل للإرسال فقط (presentation)، وكل
 *    قرار القبول يعاد في الخادم داخل معاملة OP-SETUP.
 */
import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button, ChoiceRow, ChoiceButton, Notice } from "@/components/primitives";
import { AmountField } from "@/components/manage/AmountField";
import { t } from "@/application/manage/strings";
import { manageErrorText, parseJodInputToFils } from "@/application/manage/presentation";
import { setupProject, type SetupBoxOpening } from "@/application/manage/api";

/** حالة صندوق واحد في النموذج: نص خام + «لا أعرف» + مسودة الخطأ. */
interface BoxDraft {
  amountText: string;
  unknown: boolean;
  error: string | null;
}

const boxDraft = (): BoxDraft => ({ amountText: "", unknown: false, error: null });

/** إدخال صندوق مكتمل: نص فارغ قانوني (لم يبدأ)، أو رقم صالح، أو مجهول. */
function boxOpening(draft: BoxDraft): { opening: SetupBoxOpening | null; error: string | null } {
  if (draft.unknown) return { opening: { unknown: true }, error: null };
  if (draft.amountText.length === 0) return { opening: null, error: null };
  const fils = parseJodInputToFils(draft.amountText);
  if (fils === null) return { opening: null, error: t("E-AMOUNT") };
  return { opening: { openingFils: fils }, error: null };
}

export default function StartPage() {
  const [, navigate] = useLocation();
  const [projectName, setProjectName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [twoBoxes, setTwoBoxes] = useState(false);
  const [cash, setCash] = useState<BoxDraft>(boxDraft);
  const [account, setAccount] = useState<BoxDraft>(boxDraft);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /* R-25/T55: مفتاح الطلب لكل محاولة حفظ — إعادة المحاولة بالمفتاح نفسه
   * لا تكرر العملية أبدًا (ردّ الخادم replay). */
  const requestId = useRef(globalThis.crypto?.randomUUID() ?? `setup-${Math.random()}`);

  const cashState = boxOpening(cash);
  const accountState = boxOpening(account);
  /* G-08 (قراءة موثقة): «له مبلغ» = نص غير فارغ أو «لا أعرف الآن» — الحقل
   * الفارغ وحده يبقي الزر معطلاً؛ أما النص غير الصالح فيفعّل الزر وتظهر
   * E-AMOUNT تحت حقل صندوقه عند «ابدأ» (عقد C-08: الخطأ لا يمسح المدخلات). */
  const startDisabled =
    (!cash.unknown && cash.amountText.length === 0) ||
    (twoBoxes && !account.unknown && account.amountText.length === 0);

  async function onStart() {
    setFormError(null);
    if (projectName.trim().length === 0) {
      setNameError(t("E-NAME-REQUIRED"));
      return;
    }
    setNameError(null);
    /* خطأ المبلغ يعرض تحت حقل صندوقه حصرًا (رسائل §11 تحت الحقل المعني). */
    setCash({ ...cash, error: cashState.error });
    if (twoBoxes) setAccount({ ...account, error: accountState.error });
    if (cashState.error !== null || (twoBoxes && accountState.error !== null)) return;
    setSaving(true);
    try {
      await setupProject({
        requestId: requestId.current,
        projectName: projectName.trim(),
        boxes: [
          { kind: "cash", opening: cashState.opening! },
          ...(twoBoxes ? [{ kind: "account" as const, opening: accountState.opening! }] : []),
        ],
      });
      /* بعد الحفظ: العودة للوجهة الافتتاحية «مشروعي الآن» (P-10) — التطبيق
       * يفتح عليها دائمًا (UX §1)، بلا رسالة نجاح (قاعدة عامة §1.2). */
      navigate("/");
    } catch (error) {
      setFormError(manageErrorText(error));
      setSaving(false);
    }
  }

  return (
    <div className="micro-manage-sheet" dir="rtl">
      <h1 className="micro-manage-sheet__title">{t("t.project_name")}</h1>
      <div className="micro-manage-sheet__body">
        <div className="micro-manage-field">
          <label className="micro-manage-field__label" htmlFor="manage-start-name">
            {t("t.project_name")}
          </label>
          <input
            id="manage-start-name"
            data-testid="manage-start-name"
            type="text"
            value={projectName}
            autoFocus
            autoComplete="off"
            onChange={event => setProjectName(event.target.value)}
            className="micro-manage-field__input"
          />
          {nameError ? (
            <p className="micro-manage-field__error" role="alert">
              {nameError}
            </p>
          ) : null}
        </div>

        <div className="micro-manage-field" role="group" aria-label={t("t.boxes_q")}>
          <p className="micro-manage-field__label">{t("t.boxes_q")}</p>
          <ChoiceRow>
            <ChoiceButton selected={!twoBoxes} onClick={() => setTwoBoxes(false)}>
              {t("t.cash_only")}
            </ChoiceButton>
            <ChoiceButton selected={twoBoxes} onClick={() => setTwoBoxes(true)}>
              {t("t.cash_account")}
            </ChoiceButton>
          </ChoiceRow>
        </div>

        <AmountField
          label={t("f.cash")}
          value={cash.amountText}
          disabled={cash.unknown}
          error={cash.error ?? undefined}
          hint={cash.unknown ? t("t.unknown_hint") : undefined}
          testId="manage-start-cash"
          onTextChange={text => setCash({ ...cash, amountText: text, error: null })}
        />
        <label className="micro-manage-check">
          <input
            type="checkbox"
            checked={cash.unknown}
            onChange={event => setCash({ ...cash, unknown: event.target.checked, error: null })}
          />
          <span>{t("t.unknown_now")}</span>
        </label>

        {twoBoxes ? (
          <>
            <AmountField
              label={t("f.account")}
              value={account.amountText}
              disabled={account.unknown}
              error={account.error ?? undefined}
              hint={account.unknown ? t("t.unknown_hint") : undefined}
              testId="manage-start-account"
              onTextChange={text => setAccount({ ...account, amountText: text, error: null })}
            />
            <label className="micro-manage-check">
              <input
                type="checkbox"
                checked={account.unknown}
                onChange={event => setAccount({ ...account, unknown: event.target.checked, error: null })}
              />
              <span>{t("t.unknown_now")}</span>
            </label>
          </>
        ) : null}

        {formError ? (
          <Notice tone="error" role="alert">
            {formError}
          </Notice>
        ) : null}
      </div>
      <div className="micro-manage-sheet__save">
        <Button action="commit" block disabled={startDisabled} loading={saving} onClick={onStart}>
          {t("a.start")}
        </Button>
      </div>
    </div>
  );
}
