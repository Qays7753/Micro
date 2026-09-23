import { assertId, assertPositiveMinor, fieldLabelAr, isValidLocalDate } from "../shared/index.js";
import { reversedEventIds, type FinancialEvent } from "../financial-event/index.js";
import type {
  AddReceivedLoanRepaymentInput,
  CreateReceivedLoanRecordInput,
  ReceivedLoanLenderType,
  ReceivedLoanReading,
  ReceivedLoanRecord,
  ReceivedLoanRepaymentRecord,
} from "./types.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LENDER_TYPES: ReadonlySet<ReceivedLoanLenderType> = new Set(["owner", "person", "institution"]);

function assertLocalDate(value: string, field: string) {
  if (!DATE_PATTERN.test(value) || !isValidLocalDate(value))
    throw new Error(`أدخل ${fieldLabelAr(field)} تاريخًا محليًا صحيحًا.`);
}

function assertLender(value: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error("أكمل اسم المُقرض قبل الحفظ.");
  if (normalized.length > 200) throw new Error("اسم المُقرض يتجاوز 200 حرف؛ اختصره.");
}

/* FIN-001: النوع الاقتصادي اختيار صريح — لا افتراضي ولا تخمين. */
function assertLenderType(type: ReceivedLoanLenderType) {
  if (!LENDER_TYPES.has(type)) throw new Error("اختر نوع المُقرض صراحةً: مالك / فرد / مؤسسة.");
}

/* تاريخ الاستحقاق إن وُجد: تاريخًا محليًا صحيحًا لا يسبق تاريخ القبض — ووسم
 * عرض فقط: لا مصروف ولا تنبيه إلزامي يُنشأ منه. */
function assertDueOn(dueOn: string | null | undefined, receivedOn: string) {
  if (dueOn === null || dueOn === undefined || dueOn === "") return;
  assertLocalDate(dueOn, "dueOn");
  if (dueOn < receivedOn) throw new Error("تاريخ الاستحقاق لا يمكن أن يسبق تاريخ قبض القرض.");
}

function activeRepayments(loan: ReceivedLoanRecord): readonly ReceivedLoanRepaymentRecord[] {
  return loan.repayments.filter(repayment => repayment.reversal === null);
}

export function createReceivedLoanRecord(input: CreateReceivedLoanRecordInput): ReceivedLoanRecord {
  assertId(input.id, "id");
  assertLender(input.lenderName);
  assertLenderType(input.lenderType);
  assertPositiveMinor(input.principalMinor, "principalMinor");
  assertLocalDate(input.receivedOn, "receivedOn");
  assertDueOn(input.dueOn, input.receivedOn);
  if (input.note && input.note.trim().length > 500) throw new Error("ملاحظة القرض تتجاوز 500 حرف؛ اختصرها.");
  if (!input.operationKey.trim()) throw new Error("مفتاح عملية القرض المستلم مطلوب.");
  if (Number.isNaN(Date.parse(input.createdAt)))
    throw new Error("أدخل وقت إنشاء القرض المستلم وقتًا صحيحًا.");
  return Object.freeze({
    id: input.id,
    lenderName: input.lenderName.trim(),
    lenderType: input.lenderType,
    principalMinor: input.principalMinor,
    receivedOn: input.receivedOn,
    dueOn: input.dueOn?.trim() || null,
    note: input.note?.trim() || null,
    walletId: input.walletId ?? null,
    principalEventId: input.principalEventId,
    repayments: [],
    corrections: [],
    operationKey: input.operationKey,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

/** قراءة القرض المستلم: المتبقي مشتق من الدفعات القائمة — لا رصيد مخزن. */
export function readReceivedLoan(loan: ReceivedLoanRecord): ReceivedLoanReading {
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

/** سداد أصل: حارس التجاوز — الدفعة لا تتخطى المتبقي القائم ولا تدخل بعد التسديد. */
export function addReceivedLoanRepayment(
  loan: ReceivedLoanRecord,
  input: AddReceivedLoanRepaymentInput,
  at: string,
): ReceivedLoanRecord {
  assertId(input.repaymentId, "repaymentId");
  assertPositiveMinor(input.amountMinor, "amountMinor");
  assertLocalDate(input.date, "date");
  if (loan.repayments.some(repayment => repayment.id === input.repaymentId))
    throw new Error("دفعة بهذا المعرف مسجلة سابقًا.");
  const reading = readReceivedLoan(loan);
  if (reading.status === "settled")
    throw new Error("هذا القرض مسدَّد بالكامل بالفعل — لا دفعات بعد التسديد.");
  if (input.amountMinor > reading.outstandingMinor)
    throw new Error(
      `مبلغ الدفعة يتجاوز المتبقي من القرض — المتبقي ${reading.outstandingMinor / 100} د.أ والمُدخل ${input.amountMinor / 100} د.أ.`,
    );
  const repayment: ReceivedLoanRepaymentRecord = Object.freeze({
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

/** تراجع دفعة: تُعلَّم معكوسة بسببها ووقتها — الدفعة تبقى في التاريخ ولا تُحذف. */
export function reverseReceivedLoanRepayment(
  loan: ReceivedLoanRecord,
  repaymentId: string,
  reason: string,
  at: string,
  reversalEventId: string,
): ReceivedLoanRecord {
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

/* حارس تصنيف مدخلات التصحيح — شكل واحد قبل جسم التصحيح (يُبقي التعقيد داخل السقف). */
function assertReceivedCorrectionInput(
  loan: ReceivedLoanRecord,
  input: {
    lenderName?: string;
    lenderType?: ReceivedLoanLenderType;
    principalMinor?: number;
    dueOn?: string | null;
  },
) {
  if (input.lenderName !== undefined) assertLender(input.lenderName);
  if (input.lenderType !== undefined) assertLenderType(input.lenderType);
  if (input.principalMinor !== undefined) assertPositiveMinor(input.principalMinor, "principalMinor");
  assertDueOn(input.dueOn, loan.receivedOn);
  const repaymentsActive = activeRepayments(loan).reduce((sum, r) => sum + r.amountMinor, 0);
  if (input.principalMinor !== undefined && input.principalMinor < repaymentsActive)
    throw new Error("التصحيح لا يمكن أن ينزل الأصل دون المسدَّد القائم — راجع الدفعات أولًا.");
}

/** تصحيح بيانات القرض المستلم (مبلغ/مُقرض/نوع/استحقاق): سبب موثق؛ التصحيح
 * المالي (الأصل) يجري خارجها بعكس الحدث وبديله في الخدمة. */
export function correctReceivedLoanRecord(
  loan: ReceivedLoanRecord,
  input: {
    lenderName?: string;
    lenderType?: ReceivedLoanLenderType;
    principalMinor?: number;
    dueOn?: string | null;
  },
  reason: string,
  at: string,
): ReceivedLoanRecord {
  if (!reason.trim()) throw new Error("أكمل سبب تصحيح القرض قبل الحفظ.");
  assertReceivedCorrectionInput(loan, input);
  return Object.freeze({
    ...loan,
    lenderName: input.lenderName !== undefined ? input.lenderName.trim() : loan.lenderName,
    lenderType: input.lenderType ?? loan.lenderType,
    principalMinor: input.principalMinor ?? loan.principalMinor,
    dueOn: input.dueOn !== undefined ? input.dueOn?.trim() || null : loan.dueOn,
    corrections: [...loan.corrections, { reason: reason.trim(), at }],
    updatedAt: at,
  });
}

/** الأحداث النشطة المرتبطة بقرض مستلم — للتسوية وربط المصدر. */
export function activeReceivedLoanEvents(
  events: readonly FinancialEvent[],
  loanId: string,
): readonly FinancialEvent[] {
  const reversed = reversedEventIds(events);
  return events.filter(
    event =>
      event.correctionType !== "reverse" && !reversed.has(event.id) && event.loanContext?.loanId === loanId,
  );
}
