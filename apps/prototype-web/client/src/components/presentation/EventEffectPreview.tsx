/**
 * المجموعة ١ (معاينة الأثر قبل الحفظ): معاينة مشتقة من نية الالتزام الفعلية —
 * نفس توسيع `record` (`expenseRecordIntent`) ثم محاكاة جافة عبر دالة المجال
 * `createFinancialEvent` نفسها؛ لا حساب أثر مكرر في الواجهة، والمجهول/الناقص
 * يعود للنص الثابت بدل رقم متوهَّم.
 * منطقة ارتفاع محجوز ثابت (قانون عدم الاهتزاز فوق حقول الإدخال — SA-4).
 */
import { useMemo } from "react";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";
import type { FinancialEventType, OperatingExpenseContext } from "@micro-domain/financial-event/index.js";
import { expandExpenseRecordIntent } from "@/application/finance/expenseRecordIntent";
import type { SharedExpenseRecordInput } from "@/application/finance/expenseRecordIntent";
import { formatMoneyMinor, localDateInAmman } from "@/presentation/formatters";

export type EventEffectIntent = {
  type: FinancialEventType;
  amountMinor?: number;
  occurredOn?: string;
  relatedEventId?: string | null;
  expenseContext: OperatingExpenseContext | null;
  sharedExpense?: SharedExpenseRecordInput;
};

export type EventEffectPreviewProps = {
  intent: EventEffectIntent;
  /** اسم المحفظة لوجهة الصرف؛ null = من الكاش غير الموزع. */
  walletName: string | null;
  /** النص الثابت المعروف يظهر حين لا تكفي المدخلات لمعاينة صادقة. */
  fallbackText: string;
};

const PREVIEW_NOTE_PREFIX = "preview";

function describeDeltas(
  type: FinancialEventType,
  amountMinor: number,
  deltas: {
    cashDeltaMinor: number;
    payableDeltaMinor: number;
    ownerCapitalDeltaMinor: number;
    operatingExpenseDeltaMinor: number;
    amanahDeltaMinor: number;
  },
  walletName: string | null,
  categoryLabel: string | null,
): readonly string[] {
  const amount = formatMoneyMinor(amountMinor);
  const lines: string[] = [];
  if (type === "operating_expense_payable") {
    lines.push(`لا يتغير الكاش الآن — يزيد ما عليك ${amount} د.أ للمورد ويُسجل المصروف مستحقًا.`);
  } else if (deltas.cashDeltaMinor !== 0) {
    const direction = deltas.cashDeltaMinor < 0 ? "ينقص" : "يزيد";
    const source = walletName ? `من «${walletName}»` : "من الكاش غير الموزع";
    lines.push(
      type === "operating_expense_cash"
        ? `${direction} الكاش ${amount} د.أ ${source} — مصروف مسجل لا يُعدّ ربحًا ولا يُخصم من دين.`
        : `${direction} الكاش ${amount} د.أ ${source}.`,
    );
  }
  if (type === "payable_settlement_cash")
    lines.push(`ينقص ما عليك ${amount} د.أ مع الكاش — لا يُسجل المصروف مرة ثانية.`);
  if (type === "loss_non_cash") lines.push(`يخفض ربح الفترة ${amount} د.أ كتكلفة ضائعة — بلا خروج نقدي.`);
  if (deltas.ownerCapitalDeltaMinor > 0)
    lines.push(`يزيد مال المالك في المشروع ${amount} د.أ — ليس إيرادًا.`);
  if (deltas.ownerCapitalDeltaMinor < 0) lines.push(`ينقص مال المالك ${amount} د.أ — ليس مصروفًا تشغيليًا.`);
  if (deltas.amanahDeltaMinor > 0) lines.push(`يرفع رصيد الأمانات ${amount} د.أ — ليس مالك ولا ربحك.`);
  if (deltas.amanahDeltaMinor < 0) lines.push(`يخفض رصيد الأمانات ${amount} د.أ — لا أثر على الربح.`);
  if (
    type === "operating_expense_cash" &&
    deltas.operatingExpenseDeltaMinor === 0 &&
    deltas.cashDeltaMinor !== 0
  )
    lines.push("المصروف المشترك غير الموزّع لن يدخل نتيجة الفترة الآن — يُصرَّح به غير موزّع لا صفرًا.");
  if (deltas.amanahDeltaMinor === 0 && deltas.ownerCapitalDeltaMinor === 0)
    lines.push("بلا حركة أمانة ولا سحب مالك.");
  if (categoryLabel) lines.push(`التصنيف «${categoryLabel}» لقراءتك لاحقًا — لا يغيّر الأثر المالي.`);
  return lines;
}

export function describeEventEffect(
  intent: EventEffectIntent,
  walletName: string | null,
): readonly string[] | null {
  try {
    const intentType: "operating_expense_cash" | "operating_expense_payable" =
      intent.type === "operating_expense_cash" || intent.type === "operating_expense_payable"
        ? intent.type
        : "operating_expense_cash";
    const isOperatingExpense = intentType === intent.type;
    let amountMinor = intent.amountMinor;
    let expenseContext = intent.expenseContext;
    if (isOperatingExpense || intent.sharedExpense || intent.expenseContext) {
      const expanded = expandExpenseRecordIntent({
        type: intentType,
        amountMinor: intent.amountMinor,
        expenseContext: intent.expenseContext,
        sharedExpense: intent.sharedExpense,
      });
      if (!expanded.ok) return null;
      amountMinor = expanded.amountMinor;
      expenseContext = expanded.expenseContext;
    }
    if (amountMinor === undefined || !Number.isInteger(amountMinor) || amountMinor <= 0) return null;
    const occurredOn = /^\d{4}-\d{2}-\d{2}$/.test(intent.occurredOn ?? "")
      ? (intent.occurredOn as string)
      : localDateInAmman();
    const draft = createFinancialEvent({
      id: `${PREVIEW_NOTE_PREFIX}-${intent.type}`,
      type: intent.type,
      amountMinor,
      occurredOn,
      recordedAt: new Date().toISOString(),
      idempotencyKey: `${PREVIEW_NOTE_PREFIX}-${intent.type}`,
      note: "معاينة الأثر قبل الحفظ",
      counterparty: null,
      relatedEventId: intent.relatedEventId ?? null,
      expenseContext,
    });
    return describeDeltas(
      intent.type,
      amountMinor,
      {
        cashDeltaMinor: draft.cashDeltaMinor,
        payableDeltaMinor: draft.payableDeltaMinor,
        ownerCapitalDeltaMinor: draft.ownerCapitalDeltaMinor,
        operatingExpenseDeltaMinor: draft.operatingExpenseDeltaMinor,
        amanahDeltaMinor: draft.amanahDeltaMinor ?? 0,
      },
      walletName,
      expenseContext?.categoryLabel ?? null,
    );
  } catch {
    return null;
  }
}

export function EventEffectPreview({ intent, walletName, fallbackText }: EventEffectPreviewProps) {
  const lines = useMemo(() => describeEventEffect(intent, walletName), [intent, walletName]);
  return (
    <div className="micro-effect-preview" role="status" aria-live="polite">
      <span className="micro-effect-preview-label">بعد الحفظ:</span>
      {lines === null ? (
        <strong>{fallbackText}</strong>
      ) : (
        lines.map(line => (
          <p key={line} className="micro-effect-preview-line">
            {line}
          </p>
        ))
      )}
    </div>
  );
}
