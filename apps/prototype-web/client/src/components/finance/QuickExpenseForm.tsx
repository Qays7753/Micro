import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { formatMoneyMinor, localDateInAmman } from "@/presentation/formatters";
import { attributeToWallet, cashNow } from "./quickFormHelpers";
import type {
  QuickActionFormHandle,
  QuickActionReceipt,
  QuickActionWalletOption,
} from "./quickActionFormTypes";

/*
 * W3 — نموذج المصروف السريع (نمط مالية، لا قشرة): مبلغ إلزامي واحد وبند
 * اختياري ورقاقات وسم اختيارية بنقرة (المجموعة ١) — المسار السريع لا يفتح
 * لوحة مفاتيح للرقاقات ولا يفرض اختيارًا. معاينة الأثر الصادقة باقية.
 */

type QuickExpenseFormProps = {
  wallets: readonly QuickActionWalletOption[];
  categorySuggestions: readonly string[];
  onSubmitted: (receipt: QuickActionReceipt) => void;
  onBackToMenu: () => void;
  onSavingChange?: (saving: boolean) => void;
  hidden?: boolean;
};

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
    const [expenseWalletId, setExpenseWalletId] = useState("");
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const saveInFlightRef = useRef(false);
    const expenseKeyRef = useRef(`sheet-expense-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);

    function isDirty(): boolean {
      return Boolean(expenseAmountMinor > 0 || expenseNote.trim() || expenseWalletId || expenseCategory);
    }

    async function submit() {
      if (saveInFlightRef.current) return;
      if (!expenseAmountValid || !Number.isInteger(expenseAmountMinor) || expenseAmountMinor <= 0) {
        setFormError("أدخل مبلغ المصروف بالأرقام 0–9.");
        return;
      }
      setFormError(null);
      saveInFlightRef.current = true;
      setSaving(true);
      onSavingChange?.(true);
      let result: Awaited<ReturnType<typeof projectFinance.record>>;
      try {
        result = await projectFinance.record({
          type: "operating_expense_cash",
          amountMinor: expenseAmountMinor,
          occurredOn: localDateInAmman(),
          note: expenseNote.trim() || "مصروف مدفوع في لحظته",
          counterparty: null,
          relatedEventId: null,
          expenseContext: {
            relationship: "project",
            behavior: "unknown",
            purpose: "project_general",
            knowledge: "known",
            sharedProjectShare: null,
            /* المجموعة ١ (تصنيفي للمصاريف): وسم سريع اختياري — لا يمس الدلتا. */
            categoryLabel: expenseCategory || null,
          },
          idempotencyKey: expenseKeyRef.current,
        });
      } finally {
        saveInFlightRef.current = false;
      }
      if (!result.ok) {
        setSaving(false);
        onSavingChange?.(false);
        setFormError(result.message);
        return;
      }
      notifyDataChanged();
      /* ٥.٢: إن حُددت محفظة، يُغطى الصرف منها بتخصيص سالب — بلا تخصيص صامت. */
      let attributionNote: string | null = null;
      if (expenseWalletId && expenseAmountMinor > 0)
        attributionNote = (
          await attributeToWallet(
            projectFinance,
            expenseWalletId,
            -expenseAmountMinor,
            "تغطية مصروف من رصيد المحفظة",
            result.value.id,
            "expense",
            `${expenseKeyRef.current}:attribute`,
          )
        ).message;
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
      <div className="micro-sheet-form" hidden={hidden || undefined}>
        <label className="micro-field">
          <span>المبلغ المدفوع بالدينار الأردني</span>
          <EnglishNumberInput
            value={expenseAmountMinor}
            kind="money"
            onNumericChange={setExpenseAmountMinor}
            onTextValidityChange={setExpenseAmountValid}
            aria-label="مبلغ المصروف"
          />
        </label>
        <label className="micro-field">
          <span>
            البند <small>اختياري</small>
          </span>
          <input
            value={expenseNote}
            onChange={event => setExpenseNote(event.target.value)}
            placeholder="مثال: أكياس تغليف"
          />
        </label>
        {wallets.length > 0 ? (
          <label className="micro-field">
            <span>
              وجهة الصرف <small>غير الموزع افتراضيًا؛ المحفظة تغطي من رصيدها</small>
            </span>
            <select value={expenseWalletId} onChange={event => setExpenseWalletId(event.target.value)}>
              <option value="">من الكاش غير الموزع</option>
              {wallets.map(wallet => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.name} — تغطية من رصيدها
                </option>
              ))}
            </select>
          </label>
        ) : null}
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
            {expenseWalletId
              ? ` من «${wallets.find(wallet => wallet.id === expenseWalletId)?.name ?? ""}»`
              : " من غير الموزع"}{" "}
            — مصروف مسجل لا يُعدّ ربحًا ولا يُخصم من دين، وبلا حركة أمانة ولا سحب مالك.
          </p>
        ) : null}
        {formError ? (
          <p className="micro-field-error" role="status">
            {formError}
          </p>
        ) : null}
        <button
          className="micro-button micro-button-primary"
          type="button"
          disabled={saving}
          onClick={() => {
            void submit();
          }}
        >
          {saving ? "جارٍ التسجيل…" : "سجّل المصروف"}
        </button>
        <button className="micro-text-action" type="button" onClick={onBackToMenu}>
          رجوع إلى القائمة <ArrowRight aria-hidden="true" />
        </button>
      </div>
    );
  },
);
