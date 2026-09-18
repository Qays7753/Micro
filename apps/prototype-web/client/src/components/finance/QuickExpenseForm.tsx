import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { formatMoneyMinor, localDateInAmman } from "@/presentation/formatters";
import { cashNow } from "./quickFormHelpers";
import {
  EXPENSE_NOTE_REQUIRED_MESSAGE,
  EXPENSE_SOURCE_UNSET,
  compactExpenseClassification,
  coverExpenseFromWallet,
  defaultExpenseSource,
  expenseSourceHint,
  expenseSourceRuleViolation,
} from "./expenseFormModel";
import type {
  QuickActionFormHandle,
  QuickActionReceipt,
  QuickActionWalletOption,
} from "./quickActionFormTypes";

import { Button } from "@/components/primitives";
/*
 * W3 — نموذج المصروف السريع (نمط مالية، لا قشرة): مبلغ إلزامي واحد وبند
 * مطلوب ورقاقات وسم اختيارية بنقرة (المجموعة ١) — المسار السريع لا يفتح
 * لوحة مفاتيح للرقاقات ولا يفرض اختيار تصنيف. معاينة الأثر الصادقة باقية.
 * EXE-007 (FIN-006): هذه ورقة «الوضع المختصر» لرحلة إدخال المصروف نفسها —
 * كل قواعد التحقق ومفردات الرسائل وتوقيع الحفظ تُستمد من expenseFormModel
 * الموحدة مع المحرر الموجه؛ لا كاتب موازٍ ولا قاعدة تحقق ثانية.
 */

type QuickExpenseFormProps = {
  wallets: readonly QuickActionWalletOption[];
  categorySuggestions: readonly string[];
  onSubmitted: (receipt: QuickActionReceipt) => void;
  onBackToMenu: () => void;
  onSavingChange?: (saving: boolean) => void;
  hidden?: boolean;
};

/* FIN-005: القيمة المحجوزة «لم يُختر بعد» مستوردة من المواصفة الموحدة —
 * تعريف واحد للمدخلين (EXE-007). */

export const QuickExpenseForm = forwardRef<QuickActionFormHandle, QuickExpenseFormProps>(
  function QuickExpenseForm(
    { wallets, categorySuggestions, onSubmitted, onBackToMenu, onSavingChange, hidden = false },
    ref,
  ) {
    const { projectFinance, notifyDataChanged } = usePrototypeServices();
    const [expenseAmountMinor, setExpenseAmountMinor] = useState(0);
    const [expenseAmountValid, setExpenseAmountValid] = useState(true);
    const [expenseNote, setExpenseNote] = useState("");
    const [expenseCategory, setExpenseCategory] = useState("");
    /* EXE-007: التاريخ قابل للتحرير كالمحرر الموجه — الوضع المختصر لا يفرض
     * «اليوم فقط»؛ الافتراضي اليوم والقيمة من حقل صريح. */
    const [expenseOccurredOn, setExpenseOccurredOn] = useState(() => localDateInAmman());
    const [expenseWalletId, setExpenseWalletId] = useState(EXPENSE_SOURCE_UNSET);
    const expenseSourceChosenRef = useRef(false);
    const [formError, setFormError] = useState<string | null>(null);
    /* Wave 4.4 — P-4.4-5: تمييز خطأ التحقق الحقلي عن فشل الحفظ — aria-invalid
     * للتحقق فقط لا لفشل التخزين. */
    const [fieldError, setFieldError] = useState(false);
    const [saving, setSaving] = useState(false);
    const saveInFlightRef = useRef(false);
    const expenseKeyRef = useRef(`sheet-expense-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);

    /* FIN-005: قاعدة مصدر الصرف الموحدة من المواصفة — بلا محافظ: الكاش غير
     * الموزع بتحذير معلن؛ محفظة واحدة: تُعيَّن مسبقًا بشكل مرئي؛ محافظ متعددة:
     * اختيار إلزامي صريح. لا تُذكر آخر محفظة اختيرت. */
    const appliedSourceRef = useRef(EXPENSE_SOURCE_UNSET);
    useEffect(() => {
      if (expenseSourceChosenRef.current) return;
      const next = defaultExpenseSource(wallets);
      appliedSourceRef.current = next;
      setExpenseWalletId(next);
    }, [wallets]);

    /* الوسخ يقارن بالقيمة المعيَّنة بالقاعدة — التعيين المسبق ليس وسخًا،
     * وتبديل المالك للقاعدة هو الاختيار الواعي. */
    function isDirty(): boolean {
      return Boolean(
        expenseAmountMinor > 0 ||
        expenseNote.trim() ||
        expenseCategory ||
        expenseWalletId !== appliedSourceRef.current,
      );
    }

    async function submit() {
      if (saveInFlightRef.current) return;
      if (!expenseAmountValid || !Number.isInteger(expenseAmountMinor) || expenseAmountMinor <= 0) {
        setFieldError(true);
        setFormError("أدخل مبلغ المصروف بالأرقام 0–9.");
        return;
      }
      /* EXE-007: الوصف إلزامي في المدخلين — القاعدة والرسالة من المواصفة
       * الموحدة؛ لا نص مصنّع يُنسب للمالك. */
      if (!expenseNote.trim()) {
        setFieldError(true);
        setFormError(EXPENSE_NOTE_REQUIRED_MESSAGE);
        return;
      }
      /* FIN-005 (قاعدة موحدة): محافظ متعددة — لا حفظ بلا اختيار صريح. */
      const sourceViolation = expenseSourceRuleViolation(wallets.length, expenseWalletId);
      if (sourceViolation) {
        setFieldError(true);
        setFormError(sourceViolation);
        return;
      }
      setFormError(null);
      setFieldError(false);
      saveInFlightRef.current = true;
      setSaving(true);
      onSavingChange?.(true);
      let result: Awaited<ReturnType<typeof projectFinance.record>>;
      try {
        result = await projectFinance.record({
          type: "operating_expense_cash",
          amountMinor: expenseAmountMinor,
          occurredOn: expenseOccurredOn,
          note: expenseNote.trim(),
          counterparty: null,
          relatedEventId: null,
          /* EXE-007: تصنيف الوضع المختصر — من المواصفة الموحدة بتعريف واحد. */
          expenseContext: compactExpenseClassification(expenseCategory),
          idempotencyKey: expenseKeyRef.current,
        });
      } finally {
        saveInFlightRef.current = false;
      }
      if (!result.ok) {
        setSaving(false);
        onSavingChange?.(false);
        setFieldError(false);
        setFormError(result.message);
        return;
      }
      /* ٥.٢: إن حُددت محفظة، يُغطى الصرف منها بتخصيص سالب — التوقيع الموحد
       * من المواصفة نفسها التي يستعملها المحرر الموجه (EXE-007). */
      let attributionNote: string | null = null;
      if (expenseWalletId && expenseWalletId !== EXPENSE_SOURCE_UNSET && expenseAmountMinor > 0)
        attributionNote = (
          await coverExpenseFromWallet(projectFinance, {
            walletId: expenseWalletId,
            amountMinor: expenseAmountMinor,
            eventId: result.value.id,
            operationKey: expenseKeyRef.current,
          })
        ).message;
      /* FIN-004 (قرار المالك المعتمد ٢٠٢٦-٠٩-١٦): إشعار واحد بعد اكتمال كل
       * الكتابات (الحدث ثم التخصيص) — الرئيسية لا تقرأ حالة وسيطة أبدًا،
       * ولا تحذير سالب كاذب بعد الحفظ الناجح. فشل النسبة بعد الحدث
       * المحفوظ يُعلن في الوصل صادقًا. */
      notifyDataChanged();
      const cashMinor = await cashNow(projectFinance);
      setSaving(false);
      onSavingChange?.(false);
      onSubmitted({
        title: "سُجّل مصروف",
        amountMinor: expenseAmountMinor,
        cashMinor,
        recordHref: `/finance?event=${encodeURIComponent(result.value.id)}`,
        detail: null,
        attributionNote,
      });
    }

    useImperativeHandle(ref, () => ({ isDirty, submit }));

    return (
      /* Wave 4.3 — P-4.3-2 (GAP-4.3-05/F13): نموذج حقيقي — Enter يسجّل المصروف
       * متى كان آمنًا: نموذج قصير، التحقق داخل submit نفسه، ومنع التكرار قائم
       * (saveInFlightRef + حتمية المخزن). ليس تصحيحًا عالي العواقب ولا حذفًا. */
      <form
        className="micro-sheet-form"
        hidden={hidden || undefined}
        onSubmit={event => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="micro-field">
          <span>المبلغ المدفوع بالدينار الأردني</span>
          <EnglishNumberInput
            value={expenseAmountMinor}
            kind="money"
            onNumericChange={setExpenseAmountMinor}
            onTextValidityChange={setExpenseAmountValid}
            aria-label="مبلغ المصروف"
            aria-invalid={fieldError}
            aria-describedby={formError ? "quick-expense-form-error" : undefined}
          />
        </label>
        <label className="micro-field">
          <span>
            البند <small>مطلوب</small>
          </span>
          <input
            value={expenseNote}
            onChange={event => setExpenseNote(event.target.value)}
            placeholder="مثال: أكياس تغليف"
            aria-invalid={fieldError}
            aria-describedby={formError ? "quick-expense-form-error" : undefined}
          />
        </label>
        {/* EXE-007: التاريخ قابل للتحرير — تكافؤ كامل مع المحرر الموجه. */}
        <LocalDateField
          label="تاريخ المصروف"
          value={expenseOccurredOn}
          onChange={event => setExpenseOccurredOn(event.target.value)}
        />
        {wallets.length > 0 ? (
          <label className="micro-field">
            <span>
              مصدر الصرف <small>{expenseSourceHint(wallets.length)}</small>
            </span>
            <select
              value={expenseWalletId}
              onChange={event => {
                expenseSourceChosenRef.current = true;
                setExpenseWalletId(event.target.value);
              }}
              aria-label="مصدر الصرف للمصروف"
            >
              {wallets.length > 1 ? (
                <option value={EXPENSE_SOURCE_UNSET} disabled>
                  اختر مصدر الصرف
                </option>
              ) : null}
              <option value="">الكاش غير الموزع</option>
              {wallets.map(wallet => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.name} — تغطية من رصيدها
                </option>
              ))}
            </select>
          </label>
        ) : (
          /* FIN-005: بلا محافظ — المصروف يُسجَّل من غير الموزع بتحذير معلن
           * قبل الحفظ، مع فعل المتابعة المتاح لاحقًا. */
          <p className="micro-offline-truth" role="status">
            لا محافظ معلنة بعد — سيُسجَّل المصروف من الكاش غير الموزع، ويمكن تغطيته من محفظة لاحقًا من مالي.
          </p>
        )}
        {categorySuggestions.length > 0 ? (
          /* المجموعة ١ (تصنيفي للمصاريف): رقاقات اختيارية بعد الحقول وقبل سطر
           * الأثر — نقرة واحدة بلا لوحة مفاتيح، ولا ترفع مدخلات المسار السريع. */
          <div className="micro-chip-list" role="group" aria-label="تصنيف سريع (اختياري)">
            {categorySuggestions.map(suggestion => (
              <button
                key={suggestion}
                type="button"
                className="micro-suggest-chip"
                aria-pressed={expenseCategory === suggestion}
                title={suggestion}
                onClick={() => setExpenseCategory(current => (current === suggestion ? "" : suggestion))}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
        {/* المجموعة ٢ (Scope A): معاينة الأثر قبل الحفظ — الصرف ينقص الكاش فقط. */}
        {expenseAmountMinor > 0 && expenseAmountValid ? (
          <p className="micro-local-truth" role="status">
            سينقص الكاش {formatMoneyMinor(expenseAmountMinor)} د.أ
            {expenseWalletId && expenseWalletId !== EXPENSE_SOURCE_UNSET
              ? ` من «${wallets.find(wallet => wallet.id === expenseWalletId)?.name ?? ""}»`
              : expenseWalletId === ""
                ? " من غير الموزع"
                : " — اختر مصدر الصرف أولًا"}{" "}
            — مصروف مسجل لا يُعدّ ربحًا ولا يُخصم من دين، وبلا حركة أمانة ولا سحب مالك.
          </p>
        ) : null}
        {formError ? (
          <p className="micro-field-error" role="status" id="quick-expense-form-error">
            {formError}
          </p>
        ) : null}
        <Button action="save" type="submit" disabled={saving}>
          {saving ? "جارٍ التسجيل…" : "سجّل المصروف"}
        </Button>
        <button className="micro-text-action" type="button" onClick={onBackToMenu}>
          رجوع إلى القائمة <ArrowRight aria-hidden="true" />
        </button>
      </form>
    );
  },
);
