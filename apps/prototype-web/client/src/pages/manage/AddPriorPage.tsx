/**
 * M5.6 (UX P-46 «إضافة مستحق سابق أو التزام سابق» + §5 OP-ADD-PRIOR-
 * BALANCE): تسجيل مبلغ من قبل استخدام النظام للمتابعة فقط — Q2/Q3 بلا
 * حركة فلوس. C-05 الاسم (إلزامي) + C-01 المبلغ + C-04 تاريخ النشوء
 * (الافتراضي اليوم، لا مستقبل) + جملة «لا يؤثر على ربح الفترة».
 *
 * ورقة عمق كاملة. العنوان = نص الزر الذي فتحها (?direction=).
 */
import { useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Button, Notice } from "@/components/primitives";
import { AmountField } from "@/components/manage/AmountField";
import { t } from "@/application/manage/strings";
import { manageErrorText, parseJodInputToFils } from "@/application/manage/presentation";
import { addPriorBalance, isNetworkFailure, type ManageWriteOutcome } from "@/application/manage/api";

export default function AddPriorPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const direction = new URLSearchParams(search).get("direction") === "by_me" ? "by_me" : "to_me";
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [amountText, setAmountText] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [dateText, setDateText] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /* R-25/T55: مفتاح الطلب لكل محاولة حفظ — إعادة المحاولة لا تكرر. */
  const requestId = useRef(globalThis.crypto?.randomUUID() ?? `prior-${Math.random()}`);

  const title = direction === "to_me" ? t("a.add_prior") : t("a.add_prior_payable");

  async function onSave(): Promise<void> {
    /* التحقق المحلي: الاسم إلزامي والمبلغ صالح والتاريخ قانوني (الخادم
     * يعيد التحقق من كل شيء — هذا عرض الأخطاء تحت الحقول C-08). */
    if (name.trim().length === 0) {
      setNameError(t("E-NAME-REQUIRED"));
      return;
    }
    const fils = parseJodInputToFils(amountText);
    if (amountText.length === 0 || fils === null) {
      setAmountError(t("E-AMOUNT"));
      return;
    }
    const originOn = dateText.length === 0 ? undefined : dateText;
    if (dateText.length > 0 && originOn === null) {
      setDateError(t("E-FUTURE-DATE"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const outcome: ManageWriteOutcome = await addPriorBalance({
        requestId: requestId.current,
        direction,
        counterpartyName: name.trim(),
        amountFils: fils,
        originOn,
      });
      if (outcome.outcome === "applied" || outcome.outcome === "replay") {
        navigate(`/manage/balances?tab=${direction}`);
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

  const saveDisabled = name.trim().length === 0 || amountText.length === 0 || saving;

  return (
    <div className="micro-manage-sheet" dir="rtl">
      {/* 1. العنوان = نص الزر اللي فتحها. */}
      <h1 className="micro-manage-sheet__title">{title}</h1>
      <div className="micro-manage-sheet__body">
        {/* 2. C-05 «الاسم». */}
        <div className="micro-manage-field">
          <label className="micro-manage-field__label" htmlFor="manage-prior-name">
            {t("f.name")}
          </label>
          <input
            id="manage-prior-name"
            data-testid="manage-prior-name"
            type="text"
            value={name}
            autoFocus
            autoComplete="off"
            onChange={event => {
              setName(event.target.value);
              setNameError(null);
            }}
            className="micro-manage-field__input"
          />
          {nameError ? (
            <p className="micro-manage-field__error" role="alert">
              {nameError}
            </p>
          ) : null}
        </div>

        {/* 3. C-01 «المبلغ». */}
        <AmountField
          label={t("f.amount")}
          value={amountText}
          error={amountError ?? undefined}
          testId="manage-prior-amount"
          onTextChange={text => {
            setAmountText(text);
            setAmountError(null);
          }}
        />

        {/* 4. C-04 تاريخ النشوء (الافتراضي اليوم). */}
        <div className="micro-manage-field">
          <label className="micro-manage-field__label" htmlFor="manage-prior-date">
            {t("f.actual_date")}
          </label>
          <input
            id="manage-prior-date"
            data-testid="manage-prior-date"
            type="date"
            value={dateText}
            onChange={event => {
              setDateText(event.target.value);
              setDateError(null);
            }}
            className="micro-manage-field__input"
          />
          {dateError ? (
            <p className="micro-manage-field__error" role="alert">
              {dateError}
            </p>
          ) : null}
        </div>

        {/* 5. «لا يؤثر على ربح الفترة». */}
        <p className="micro-manage-card__line micro-manage-card__line--secondary">{t("l.prior_no_profit")}</p>

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
