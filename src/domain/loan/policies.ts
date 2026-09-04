import { assertId, assertPositiveMinor, fieldLabelAr, isValidLocalDate } from "../shared/index.js";
import { reversedEventIds, type FinancialEvent } from "../financial-event/index.js";
import type {
  AddLoanRepaymentInput,
  CreateLoanRecordInput,
  LoanReading,
  LoanRecord,
  LoanRepaymentRecord,
} from "./types.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertLocalDate(value: string, field: string) {
  if (!DATE_PATTERN.test(value) || !isValidLocalDate(value))
    throw new Error(`أدخل ${fieldLabelAr(field)} تاريخًا محليًا صحيحًا.`);
}

function assertBorrower(value: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error("أكمل اسم المستدين قبل الحفظ.");
  if (normalized.length > 200) throw new Error("اسم المستدين يتجاوز ٢٠٠ حرف؛ اختصره.");
}

function activeRepayments(loan: LoanRecord): readonly LoanRepaymentRecord[] {
  return loan.repayments.filter(repayment => repayment.reversal === null);
}

export function createLoanRecord(input: CreateLoanRecordInput): LoanRecord {
  assertId(input.id, "id");
  assertBorrower(input.borrowerName);
  assertPositiveMinor(input.principalMinor, "principalMinor");
  assertLocalDate(input.loanDate, "loanDate");
  if (input.purposeNote && input.purposeNote.trim().length > 500)
    throw new Error("ملاحظة القرض تتجاوز ٥٠٠ حرف؛ اختصرها.");
  if (!input.operationKey.trim()) throw new Error("مفتاح عملية القرض مطلوب.");
  if (Number.isNaN(Date.parse(input.createdAt))) throw new Error("أدخل وقت إنشاء القرض وقتًا صحيحًا.");
  return Object.freeze({
    id: input.id,
    borrowerName: input.borrowerName.trim(),
    principalMinor: input.principalMinor,
    loanDate: input.loanDate,
    purposeNote: input.purposeNote?.trim() || null,
    sourceWalletId: input.sourceWalletId ?? null,
    principalEventId: input.principalEventId,
    repayments: [],
    corrections: [],
    operationKey: input.operationKey,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

/** قراءة القرض: المتبقي مشتق من الدفعات القائمة — لا رصيد مخزن. */
export function readLoan(loan: LoanRecord): LoanReading {
  const repaid = activeRepayments(loan).reduce((sum, repayment) => sum + repayment.amountMinor, 0);
  const outstanding = Math.max(0, loan.principalMinor - repaid);
  return {
    status: outstanding <= 0 ? "settled" : "open",
    principalMinor: loan.principalMinor,
    repaidActiveMinor: repaid,
    outstandingMinor: outstanding,
    repaymentCount: activeRepayments(loan).length,
  };
}

/** سداد دفعة: حارس التجاوز — الدفعة لا تتخطى المتبقي القائم. */
export function addLoanRepayment(loan: LoanRecord, input: AddLoanRepaymentInput, at: string): LoanRecord {
  assertId(input.repaymentId, "repaymentId");
  assertPositiveMinor(input.amountMinor, "amountMinor");
  assertLocalDate(input.date, "date");
  if (loan.repayments.some(repayment => repayment.id === input.repaymentId))
    throw new Error("دفعة بهذا المعرف مسجلة سابقًا.");
  const reading = readLoan(loan);
  if (reading.status === "settled")
    throw new Error("هذا القرض مسدَّد بالكامل بالفعل — لا دفعات بعد التسديد.");
  if (input.amountMinor > reading.outstandingMinor)
    throw new Error(
      `مبلغ الدفعة يتجاوز المتبقي من القرض — المتبقي ${reading.outstandingMinor / 100} د.أ والمُدخل ${input.amountMinor / 100} د.أ.`,
    );
  const repayment: LoanRepaymentRecord = Object.freeze({
    id: input.repaymentId,
    amountMinor: input.amountMinor,
    date: input.date,
    note: input.note?.trim() || null,
    eventId: input.eventId,
    reversal: null,
  });
  return Object.freeze({
    ...loan,
    repayments: [...loan.repayments, repayment],
    updatedAt: at,
  });
}

/** تراجع دفعة: يُعلَّم معكوسًا بسببه ووقته — الدفعة تبقى في التاريخ ولا تُحذف. */
export function reverseLoanRepayment(
  loan: LoanRecord,
  repaymentId: string,
  reason: string,
  at: string,
  reversalEventId: string,
): LoanRecord {
  if (!reason.trim()) throw new Error("أكمل سبب تراجع الدفعة قبل الحفظ.");
  const target = loan.repayments.find(repayment => repayment.id === repaymentId);
  if (!target) throw new Error("الدفعة غير موجودة في هذا القرض.");
  if (target.reversal) throw new Error("هذه الدفعة معكوسة سابقًا.");
  return Object.freeze({
    ...loan,
    repayments: loan.repayments.map(repayment =>
      repayment.id === repaymentId
        ? {
            ...repayment,
            reversal: { reason: reason.trim(), at, reversalEventId },
          }
        : repayment,
    ),
    updatedAt: at,
  });
}

/** تصحيح بيانات القرض (مبلغ/مستدين): يُوثق سببه ويُنفذ عبر عكس الحدث الأصلي وبديله. */
export function correctLoanRecord(
  loan: LoanRecord,
  input: { borrowerName?: string; principalMinor?: number },
  reason: string,
  at: string,
): LoanRecord {
  if (!reason.trim()) throw new Error("أكمل سبب تصحيح القرض قبل الحفظ.");
  if (input.borrowerName !== undefined) assertBorrower(input.borrowerName);
  if (input.principalMinor !== undefined) assertPositiveMinor(input.principalMinor, "principalMinor");
  const repaymentsActive = activeRepayments(loan).reduce((sum, r) => sum + r.amountMinor, 0);
  if (input.principalMinor !== undefined && input.principalMinor < repaymentsActive)
    throw new Error("التصحيح لا يمكن أن ينزل الأصل دون المسدَّد القائم — راجع الدفعات أولًا.");
  return Object.freeze({
    ...loan,
    borrowerName: input.borrowerName !== undefined ? input.borrowerName.trim() : loan.borrowerName,
    principalMinor: input.principalMinor ?? loan.principalMinor,
    corrections: [...loan.corrections, { reason: reason.trim(), at }],
    updatedAt: at,
  });
}

/** الأحداث النشطة المرتبطة بقرض — للتسوية وربط المصدر. */
export function activeLoanEvents(
  events: readonly FinancialEvent[],
  loanId: string,
): readonly FinancialEvent[] {
  const reversed = reversedEventIds(events);
  return events.filter(
    event =>
      event.correctionType !== "reverse" && !reversed.has(event.id) && event.loanContext?.loanId === loanId,
  );
}
