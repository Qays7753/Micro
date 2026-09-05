/**
 * المجموعة ٤ (عقد ٢٩): خدمة القروض الصادرة — الكاتب الواحد لأحداث القروض.
 * الإقراض يُخرج كاش ويُنشئ ذمّة لصالح المشروع؛ السداد يعيد الكاش ويخفض
 * الذمّة؛ كلاهما لا يمس الربح ولا مال المالك. التصحيحات عكس + بديل ذرّي.
 */
import {
  addLoanRepayment,
  correctLoanRecord,
  createLoanRecord,
  readLoan,
  reverseLoanRepayment,
  type LoanRecord,
  type LoanReading,
} from "@micro-domain/loan/index.js";
import {
  createFinancialEvent,
  createFinancialReversal,
  type FinancialEvent,
  type FinancialEventType,
} from "@micro-domain/financial-event/index.js";
import type { PrototypeLocalStore } from "@/storage/local/types";

export type LoanSummaryRow = {
  loan: LoanRecord;
  reading: LoanReading;
};

export type LoanCreateInput = {
  borrowerName: string;
  principalMinor: number;
  loanDate: string;
  purposeNote?: string | null;
  sourceWalletId?: string | null;
};

export type LoanRepaymentInput = {
  amountMinor: number;
  date: string;
  note?: string | null;
};

export type LoanCorrectionInput = {
  borrowerName?: string;
  principalMinor?: number;
  reason: string;
};

export type LoanResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: "storage_error" | "invalid_state" | "validation_error"; message: string };

function failure(code: "storage_error" | "invalid_state" | "validation_error", message: string) {
  return { ok: false as const, code, message };
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export class LoanService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async overview(): Promise<LoanResult<readonly LoanSummaryRow[]>> {
    const loansResult = await this.store.listLoans();
    if (!loansResult.ok) return failure("storage_error", "تعذر قراءة سجل القروض المحلي.");
    return {
      ok: true,
      value: loansResult.value.map(loan => ({ loan, reading: readLoan(loan) })),
    };
  }

  async read(loanId: string): Promise<
    LoanResult<{
      loan: LoanRecord;
      reading: LoanReading;
      events: readonly FinancialEvent[];
    }>
  > {
    const [loanResult, eventsResult] = await Promise.all([
      this.store.getLoan(loanId),
      this.store.listFinancialEvents(),
    ]);
    if (!loanResult.ok || !eventsResult.ok) return failure("storage_error", "تعذر قراءة سجل القرض المحلي.");
    const loan = loanResult.value;
    if (!loan) return failure("invalid_state", "القرض غير متاح محليًا.");
    const events = eventsResult.value
      .filter(event => event.loanContext?.loanId === loanId)
      .sort(
        (left, right) => right.recordedAt.localeCompare(left.recordedAt) || right.id.localeCompare(left.id),
      );
    return { ok: true, value: { loan, reading: readLoan(loan), events } };
  }

  async create(input: LoanCreateInput): Promise<LoanResult<{ loan: LoanRecord; event: FinancialEvent }>> {
    try {
      const loanId = newId("loan");
      const createdAt = this.now();
      const event = createFinancialEvent({
        id: newId("event"),
        type: "loan_outgoing_cash" as FinancialEventType,
        amountMinor: input.principalMinor,
        occurredOn: input.loanDate,
        recordedAt: createdAt,
        idempotencyKey: `${loanId}:principal`,
        note: input.purposeNote?.trim() || `قرض لـ ${input.borrowerName.trim()}`,
        counterparty: input.borrowerName.trim(),
        loanContext: { loanId, borrower: input.borrowerName.trim() },
      });
      const loan = createLoanRecord({
        id: loanId,
        borrowerName: input.borrowerName,
        principalMinor: input.principalMinor,
        loanDate: input.loanDate,
        purposeNote: input.purposeNote ?? null,
        sourceWalletId: input.sourceWalletId ?? null,
        principalEventId: event.id,
        operationKey: `${loanId}:create`,
        createdAt,
      });
      const commit = await this.store.commitLoanRecord(loan, event);
      if (!commit.ok) return failure("storage_error", commit.message);
      return { ok: true, value: { loan: commit.value.record, event: commit.value.event } };
    } catch (error) {
      return failure("validation_error", error instanceof Error ? error.message : "بيانات القرض غير صالحة.");
    }
  }

  async recordRepayment(
    loanId: string,
    input: LoanRepaymentInput,
  ): Promise<LoanResult<{ loan: LoanRecord; event: FinancialEvent }>> {
    const loanResult = await this.store.getLoan(loanId);
    if (!loanResult.ok) return failure("storage_error", "تعذر قراءة سجل القرض المحلي.");
    const loan = loanResult.value;
    if (!loan) return failure("invalid_state", "القرض غير متاح محليًا.");
    try {
      const now = this.now();
      const repaymentId = newId("rep");
      const eventId = newId("event");
      const event = createFinancialEvent({
        id: eventId,
        type: "loan_repayment_cash" as FinancialEventType,
        amountMinor: input.amountMinor,
        occurredOn: input.date,
        recordedAt: now,
        idempotencyKey: `${loanId}:repayment:${repaymentId}`,
        note: input.note?.trim() || `سداد دفعة من ${loan.borrowerName}`,
        counterparty: loan.borrowerName,
        loanContext: { loanId, borrower: loan.borrowerName },
      });
      const next = addLoanRepayment(
        loan,
        { repaymentId, amountMinor: input.amountMinor, date: input.date, note: input.note ?? null, eventId },
        now,
      );
      const commit = await this.store.commitLoanRecord(next, event);
      if (!commit.ok) return failure("storage_error", commit.message);
      return { ok: true, value: { loan: commit.value.record, event: commit.value.event } };
    } catch (error) {
      return failure("validation_error", error instanceof Error ? error.message : "بيانات الدفعة غير صالحة.");
    }
  }

  async reverseRepayment(
    loanId: string,
    repaymentId: string,
    reason: string,
  ): Promise<LoanResult<{ loan: LoanRecord; reversal: FinancialEvent }>> {
    const [loanResult, eventsResult] = await Promise.all([
      this.store.getLoan(loanId),
      this.store.listFinancialEvents(),
    ]);
    if (!loanResult.ok || !eventsResult.ok) return failure("storage_error", "تعذر قراءة سجل القرض المحلي.");
    const loan = loanResult.value;
    if (!loan) return failure("invalid_state", "القرض غير متاح محليًا.");
    const repayment = loan.repayments.find(entry => entry.id === repaymentId);
    if (!repayment) return failure("invalid_state", "الدفعة غير موجودة في هذا القرض.");
    const source = eventsResult.value.find(event => event.id === repayment.eventId);
    if (!source) return failure("invalid_state", "حدث الدفعة غير موجود.");
    try {
      const now = this.now();
      const reversalEventId = newId("event");
      const reversal = createFinancialReversal({
        id: reversalEventId,
        sourceEvent: source,
        occurredOn: now.slice(0, 10),
        recordedAt: now,
        idempotencyKey: `${loanId}:repayment-reversal:${repaymentId}`,
        reason,
      });
      const next = reverseLoanRepayment(loan, repaymentId, reason, now, reversalEventId);
      const commit = await this.store.commitLoanRecord(next, reversal);
      if (!commit.ok) return failure("storage_error", commit.message);
      return { ok: true, value: { loan: commit.value.record, reversal: commit.value.event } };
    } catch (error) {
      return failure("validation_error", error instanceof Error ? error.message : "تراجع الدفعة غير صالح.");
    }
  }

  async correctLoan(
    loanId: string,
    input: LoanCorrectionInput,
  ): Promise<LoanResult<{ loan: LoanRecord; reversal: FinancialEvent; replacement: FinancialEvent }>> {
    const [loanResult, eventsResult] = await Promise.all([
      this.store.getLoan(loanId),
      this.store.listFinancialEvents(),
    ]);
    if (!loanResult.ok || !eventsResult.ok) return failure("storage_error", "تعذر قراءة سجل القرض المحلي.");
    const loan = loanResult.value;
    if (!loan) return failure("invalid_state", "القرض غير متاح محليًا.");
    const source = eventsResult.value.find(event => event.id === loan.principalEventId);
    if (!source) return failure("invalid_state", "حدث أصل القرض غير موجود.");
    if (source.correctionType === "reverse") return failure("invalid_state", "حدث أصل القرض معكوس سابقًا.");
    /* تصحيح مراجعة 4-c: لا تصحيح بلا تغيير — عكس وبديل بلا فرق فعلي يلوّثان
     * التاريخ بضجيج بلا معنى؛ الطلب نفس القيم يُرفض برسالة صريحة. */
    const nextPrincipal = input.principalMinor ?? loan.principalMinor;
    const nextBorrower = (input.borrowerName ?? loan.borrowerName).trim();
    if (nextPrincipal === loan.principalMinor && nextBorrower === loan.borrowerName.trim())
      return failure("validation_error", "لا تغيير عن المسجّل — عدّل المبلغ أو المستفيد قبل التصحيح.");
    try {
      const now = this.now();
      const reversal = createFinancialReversal({
        id: newId("event"),
        sourceEvent: source,
        occurredOn: now.slice(0, 10),
        recordedAt: now,
        idempotencyKey: `${loanId}:principal-reversal:${now}`,
        reason: input.reason,
      });
      const replacement = createFinancialEvent({
        id: newId("event"),
        type: "loan_outgoing_cash" as FinancialEventType,
        amountMinor: nextPrincipal,
        occurredOn: loan.loanDate,
        recordedAt: now,
        idempotencyKey: `${loanId}:principal-replacement:${now}`,
        note: `تصحيح قرض: ${input.reason.trim()}`,
        counterparty: nextBorrower.trim(),
        loanContext: { loanId, borrower: nextBorrower.trim() },
      });
      const corrected = correctLoanRecord(
        loan,
        { borrowerName: nextBorrower, principalMinor: nextPrincipal },
        input.reason,
        now,
      );
      const next: LoanRecord = { ...corrected, principalEventId: replacement.id };
      const commit = await this.store.commitLoanCorrection(next, reversal, replacement);
      if (!commit.ok) return failure("storage_error", commit.message);
      return {
        ok: true,
        value: {
          loan: commit.value.record,
          reversal: commit.value.reversal,
          replacement: commit.value.replacement,
        },
      };
    } catch (error) {
      return failure("validation_error", error instanceof Error ? error.message : "تصحيح القرض غير صالح.");
    }
  }
}
