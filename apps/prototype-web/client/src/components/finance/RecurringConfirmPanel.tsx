/**
 * OPS-003 (عقد ٤١ §٨/§١٢): لوحة مراجعة وتأكيد فترة مصروف متكرر — المراجعة ثم
 * المعاينة ثم التأكيد الصريح، فالنتيجة الصادقة وحدها تُعرض:
 * «تم تسجيل المصروف» / «المصروف مسجل مسبقًا لهذه الفترة» / «لم يُسجل المصروف».
 * الاقتراح (المبلغ/المحفظة/التصنيف) عرض قابل للتعديل معلنًا — ليس حدثًا ماليًا
 * ولا يصير نهائيًا بغير تأكيد. `occurredOn` يُعلنه المستخدم بتسمية «تاريخ حدوث
 * المصروف» المميزة عن `dueOn` المجدول؛ والتأكيد يمر بالكاتب الكنوني وحده.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck } from "lucide-react";
import type { OperatingExpenseContext } from "@micro-domain/financial-event/index.js";
import type { RecurringExpenseAmountMode } from "@micro-domain/recurring-expense/index.js";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EventEffectPreview } from "@/components/presentation/EventEffectPreview";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { Button } from "@/components/primitives";

export type RecurringConfirmOutcomeView =
  | { status: "recorded"; eventAmountMinor: number; eventOccurredOn: string }
  | { status: "reused"; eventAmountMinor: number; eventOccurredOn: string }
  | { status: "record_failed"; message: string };

const PURPOSE_OPTIONS: readonly { value: OperatingExpenseContext["purpose"]; label: string }[] = [
  { value: "period", label: "مصروف فترة متكرر" },
  { value: "project_general", label: "عام على المشروع" },
  { value: "order", label: "على طلب محدد" },
  { value: "product", label: "على منتج" },
  { value: "campaign", label: "حملة" },
  { value: "unallocated", label: "غير مخصص بعد" },
];
const BEHAVIOR_OPTIONS: readonly { value: OperatingExpenseContext["behavior"]; label: string }[] = [
  { value: "fixed", label: "ثابت يتكرر" },
  { value: "variable", label: "متغير" },
  { value: "mixed", label: "مختلط" },
  { value: "unknown", label: "لا أعرف بعد" },
];
const KNOWLEDGE_OPTIONS: readonly { value: OperatingExpenseContext["knowledge"]; label: string }[] = [
  { value: "known", label: "أعرف المبلغ والتفاصيل" },
  { value: "estimated", label: "تقدير" },
  { value: "needs_review", label: "يحتاج مراجعة" },
];

export function RecurringConfirmPanel({
  seriesTitle,
  periodKey,
  dueOn,
  amountMode,
  suggestedAmountMinor,
  suggestedCategoryLabel,
  suggestedWalletId,
  occurrenceId,
  today,
  onSettled,
}: {
  seriesTitle: string;
  periodKey: string;
  dueOn: string;
  amountMode: RecurringExpenseAmountMode;
  suggestedAmountMinor: number | null;
  suggestedCategoryLabel: string | null;
  suggestedWalletId: string | null;
  occurrenceId: string;
  today: string;
  onSettled: () => void;
}) {
  const { recurringExpenses, cashContinuity, notifyDataChanged } = usePrototypeServices();
  const [type, setType] = useState<"operating_expense_cash" | "operating_expense_payable">(
    "operating_expense_cash",
  );
  const [amountMinor, setAmountMinor] = useState<number | null>(suggestedAmountMinor);
  const [occurredOn, setOccurredOn] = useState(today);
  const [note, setNote] = useState(`${seriesTitle} — فترة ${periodKey}`);
  const [counterparty, setCounterparty] = useState("");
  const [relationship, setRelationship] = useState<OperatingExpenseContext["relationship"]>("project");
  const [behavior, setBehavior] = useState<OperatingExpenseContext["behavior"]>("fixed");
  const [purpose, setPurpose] = useState<OperatingExpenseContext["purpose"]>("period");
  const [knowledge, setKnowledge] = useState<OperatingExpenseContext["knowledge"]>("known");
  const [categoryLabel, setCategoryLabel] = useState(suggestedCategoryLabel ?? "");
  const [wallets, setWallets] = useState<readonly { id: string; name: string }[]>([]);
  const [walletId, setWalletId] = useState<string>(suggestedWalletId ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<RecurringConfirmOutcomeView | null>(null);
  const [confirming, setConfirming] = useState(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let active = true;
    cashContinuity.overview().then(result => {
      if (!active || !result.ok) return;
      setWallets(result.value.wallets.map(wallet => ({ id: wallet.id, name: wallet.name })));
    });
    return () => {
      active = false;
    };
  }, [cashContinuity]);

  const expenseContext = useMemo<OperatingExpenseContext>(
    () => ({
      relationship,
      behavior,
      purpose,
      knowledge,
      sharedProjectShare: null,
      categoryLabel: categoryLabel.trim() || null,
    }),
    [relationship, behavior, purpose, knowledge, categoryLabel],
  );

  const proposalNote =
    amountMode === "suggested"
      ? "مقترح قابل للتعديل — ليس تسجيلًا ولا التزامًا"
      : amountMode === "fixed_suggested"
        ? "المقترح المتكرر — راجعه وعدّله قبل التأكيد"
        : null;

  async function confirm(): Promise<void> {
    if (inFlightRef.current) return;
    if (!recurringExpenses) {
      setMessage("جارٍ تهيئة خدمة التذكيرات — أعد المحاولة بعد لحظة.");
      return;
    }
    if (amountMinor === null || amountMinor <= 0) {
      setMessage("أدخل مبلغ المصروف قبل التأكيد — الاقتراح ليس مبلغًا نهائيًا بلا مراجعتك.");
      return;
    }
    if (!note.trim()) {
      setMessage("اكتب ملاحظة تصف المصروف قبل التأكيد.");
      return;
    }
    inFlightRef.current = true;
    setConfirming(true);
    setMessage(null);
    const result = await recurringExpenses.confirm(occurrenceId, {
      type,
      amountMinor,
      occurredOn,
      note: note.trim(),
      counterparty: counterparty.trim() || null,
      expenseContext,
      walletId: walletId || null,
    });
    inFlightRef.current = false;
    setConfirming(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    const value = result.value;
    const settled: RecurringConfirmOutcomeView =
      value.status === "record_failed"
        ? { status: "record_failed", message: value.message }
        : {
            status: value.status,
            eventAmountMinor: value.event.amountMinor,
            eventOccurredOn: value.event.occurredOn,
          };
    setOutcome(settled);
    notifyDataChanged();
  }

  if (outcome) {
    return (
      <div className="micro-cancel-panel" role="status">
        {outcome.status === "recorded" ? (
          <>
            <p>تم تسجيل المصروف — بتاريخ حدوثه المعلن، ويمكن تصحيحه بالتراجع الموثق من سجل الأحداث.</p>
            <p>
              المبلغ: <MoneyValue minor={outcome.eventAmountMinor} className="micro-inline-number" />
            </p>
          </>
        ) : outcome.status === "reused" ? (
          <p>المصروف مسجل مسبقًا لهذه الفترة — لم يُنشأ حدث ثانٍ، والقائم هو المعتمد.</p>
        ) : (
          <>
            <p>لم يُسجل المصروف — بياناتك كما هي؛ أعد المحاولة أو تخطَّ الفترة بقرار موثق.</p>
            <small>{outcome.message}</small>
          </>
        )}
        <Button
          action="secondary"
          onClick={() => {
            setOutcome(null);
            onSettled();
          }}
        >
          مراجعة أخرى لهذه الفترة
        </Button>
      </div>
    );
  }

  return (
    <section className="micro-form-card" aria-label="مراجعة وتأكيد فترة المصروف المتكرر">
      <div className="micro-section-title">
        <CalendarCheck aria-hidden="true" />
        <div>
          <span className="micro-overline">مراجعة قبل أي كتابة مالية</span>
          <h2>سجّل مصروف هذه الفترة</h2>
        </div>
      </div>
      <EventEffectPreview
        intent={{ type, amountMinor: amountMinor ?? undefined, occurredOn, expenseContext }}
        walletName={wallets.find(wallet => wallet.id === walletId)?.name ?? null}
        fallbackText="أكمل المبلغ والتاريخ لمعاينة أثر التسجيل قبل تأكيده."
      />
      <label className="micro-field">
        <span>نوع المصروف</span>
        <select value={type} onChange={event => setType(event.target.value as typeof type)}>
          <option value="operating_expense_cash">مصروف نقدي مدفوع</option>
          <option value="operating_expense_payable">مصروف مستحق بالذمم</option>
        </select>
      </label>
      <label className="micro-field">
        <span>
          المبلغ (د.أ)
          {proposalNote ? <small> — {proposalNote}</small> : null}
        </span>
        <EnglishNumberInput
          kind="money"
          value={amountMinor}
          allowEmpty={true}
          onNumericChange={minor => setAmountMinor(minor)}
          onEmptyChange={() => setAmountMinor(null)}
          aria-label="مبلغ المصروف بالدينار"
        />
      </label>
      <LocalDateField
        label="تاريخ حدوث المصروف"
        description={`تاريخ الواقعة الذي تعلنه أنت — يختلف عن موعد التذكير المجدول ${dueOn}`}
        value={occurredOn}
        onChange={event => setOccurredOn(event.target.value)}
      />
      <label className="micro-field">
        <span>ملاحظة المصروف</span>
        <input value={note} onChange={event => setNote(event.target.value)} />
      </label>
      <label className="micro-field">
        <span>الجهة (اختياري)</span>
        <input value={counterparty} onChange={event => setCounterparty(event.target.value)} />
      </label>
      <details className="micro-decision-layer micro-expense-details">
        <summary className="micro-decision-layer-summary">
          <span>
            <b>سياق المصروف وتصنيفه</b>
            <small>علاقته بالمشروع وسلوكه وغرضه ودرجة معرفته</small>
          </span>
          <strong>افتح التفاصيل</strong>
        </summary>
        <label className="micro-field">
          <span>علاقة المبلغ بالمشروع</span>
          <select
            value={relationship}
            onChange={event => setRelationship(event.target.value as typeof relationship)}
          >
            <option value="project">على المشروع</option>
            <option value="shared">مشترك</option>
          </select>
        </label>
        <label className="micro-field">
          <span>سلوك المصروف</span>
          <select value={behavior} onChange={event => setBehavior(event.target.value as typeof behavior)}>
            {BEHAVIOR_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="micro-field">
          <span>غرض المصروف</span>
          <select value={purpose} onChange={event => setPurpose(event.target.value as typeof purpose)}>
            {PURPOSE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="micro-field">
          <span>درجة معرفتك بالمصروف</span>
          <select value={knowledge} onChange={event => setKnowledge(event.target.value as typeof knowledge)}>
            {KNOWLEDGE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="micro-field">
          <span>تصنيف نصي (اختيارك، ٨٠ حرفًا)</span>
          <input
            maxLength={80}
            value={categoryLabel}
            onChange={event => setCategoryLabel(event.target.value)}
          />
        </label>
      </details>
      {type === "operating_expense_cash" ? (
        <label className="micro-field">
          <span>المحفظة{suggestedWalletId ? <small> — مقترح قابل للتغيير</small> : null}</span>
          <select value={walletId} onChange={event => setWalletId(event.target.value)}>
            <option value="">بدون تخصيص محفظة</option>
            {wallets.map(wallet => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {message ? (
        <p className="micro-field-error" role="alert">
          {message}
        </p>
      ) : null}
      <div className="micro-form-actions micro-sticky-save">
        <Button action="save" block disabled={confirming} onClick={confirm}>
          {confirming ? "جارٍ التسجيل…" : "أكّد تسجيل المصروف"}
        </Button>
      </div>
    </section>
  );
}
