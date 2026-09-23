/**
 * FIN-001 (WS-178 — Wave 6): خدمة القروض المستلمة — الكاتب الواحد لأحداث
 * الاقتراض. قبض القرض يرفع الكاش ويرفع التزامًا مستقلًا (loanPayable) — ليس
 * إيرادًا ولا ربحًا ولا رأس مال مالك ولا مصروفًا؛ سداد الأصل ينزل الكاش
 * وينزل الالتزام ولا يمس النتيجة أبدًا. تاريخ الاستحقاق وسم عرض فقط: لا
 * مصروف ولا تنبيه. التصحيحات المالية عكس + بديل ذرّي (نفس عقد القرض الصادر)؛
 * تصحيح بيانات العرض (النوع/الاستحقاق) قدر المجال لا يُستخدم لتبرير عكس
 * مالي — الحدث المالي لا يُلمس لأجل وسم عرض.
 */
import {
  addReceivedLoanRepayment,
  correctReceivedLoanRecord,
  createReceivedLoanRecord,
  readReceivedLoan,
  reverseReceivedLoanRepayment,
  type ReceivedLoanLenderType,
  type ReceivedLoanReading,
  type ReceivedLoanRecord,
} from "@micro-domain/received-loan/index.js";
import {
  createFinancialEvent,
  createFinancialReversal,
  type FinancialEvent,
  type FinancialEventType,
} from "@micro-domain/financial-event/index.js";
import type { PrototypeLocalStore } from "@/storage/local/types";

export type ReceivedLoanSummaryRow = {
  loan: ReceivedLoanRecord;
  reading: ReceivedLoanReading;
};

/* FIN-001 (WS-178 — Wave 6): التجميع الرسمي لقراءة القروض المستلمة في خدمة
 * القراءة (نقل P-4.4-1 نفسه) — المتبقي والأصل مجموعان مشتقان من الصفوف. */
export type ReceivedLoanOverviewTotals = {
  borrowedLoansOutstandingMinor: number;
  borrowedPrincipalMinor: number;
  openCount: number;
};

export type ReceivedLoanOverviewRead = {
  rows: readonly ReceivedLoanSummaryRow[];
  totals: ReceivedLoanOverviewTotals;
};

export type ReceivedLoanCreateInput = {
  lenderName: string;
  lenderType: ReceivedLoanLenderType;
  principalMinor: number;
  receivedOn: string;
  dueOn?: string | null;
  note?: string | null;
  walletId?: string | null;
};

export type ReceivedLoanRepaymentInput = {
  amountMinor: number;
  date: string;
  note?: string | null;
};

export type ReceivedLoanCorrectionInput = {
  lenderName?: string;
  principalMinor?: number;
  reason: string;
};

export type ReceivedLoanResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: "storage_error" | "invalid_state" | "validation_error"; message: string };

function failure(code: "storage_error" | "invalid_state" | "validation_error", message: string) {
  return { ok: false as const, code, message };
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export class ReceivedLoanService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async overview(): Promise<ReceivedLoanResult<ReceivedLoanOverviewRead>> {
    const loansResult = await this.store.listReceivedLoans();
    if (!loansResult.ok) return failure("storage_error", "تعذر قراءة سجل القروض المستلمة المحلي.");
    const rows = loansResult.value.map(loan => ({ loan, reading: readReceivedLoan(loan) }));
    return {
      ok: true,
      value: {
        rows,
        totals: {
          borrowedLoansOutstandingMinor: rows.reduce((sum, row) => sum + row.reading.outstandingMinor, 0),
          borrowedPrincipalMinor: rows.reduce((sum, row) => sum + row.reading.principalMinor, 0),
          openCount: rows.filter(row => row.reading.status === "open").length,
        },
      },
    };
  }

  async read(loanId: string): Promise<
    ReceivedLoanResult<{
      loan: ReceivedLoanRecord;
      reading: ReceivedLoanReading;
      events: readonly FinancialEvent[];
    }>
  > {
    const [loanResult, eventsResult] = await Promise.all([
      this.store.getReceivedLoan(loanId),
      this.store.listFinancialEvents(),
    ]);
    if (!loanResult.ok || !eventsResult.ok)
      return failure("storage_error", "تعذر قراءة سجل القرض المستلم المحلي.");
    const loan = loanResult.value;
    if (!loan) return failure("invalid_state", "القرض المستلم غير متاح محليًا.");
    const events = eventsResult.value
      .filter(event => event.loanContext?.loanId === loanId)
      .sort(
        (left, right) => right.recordedAt.localeCompare(left.recordedAt) || right.id.localeCompare(left.id),
      );
    return { ok: true, value: { loan, reading: readReceivedLoan(loan), events } };
  }

  async create(
    input: ReceivedLoanCreateInput,
  ): Promise<ReceivedLoanResult<{ loan: ReceivedLoanRecord; event: FinancialEvent }>> {
    try {
      const loanId = newId("rloan");
      const createdAt = this.now();
      const lenderName = input.lenderName.trim();
      const event = createFinancialEvent({
        id: newId("event"),
        type: "loan_received_cash" as FinancialEventType,
        amountMinor: input.principalMinor,
        occurredOn: input.receivedOn,
        recordedAt: createdAt,
        idempotencyKey: `${loanId}:principal`,
        note: input.note?.trim() || `قرض مستلم من ${lenderName}`,
        counterparty: lenderName,
        loanContext: { loanId, borrower: lenderName, lender: lenderName },
      });
      const loan = createReceivedLoanRecord({
        id: loanId,
        lenderName: input.lenderName,
        lenderType: input.lenderType,
        principalMinor: input.principalMinor,
        receivedOn: input.receivedOn,
        dueOn: input.dueOn ?? null,
        note: input.note ?? null,
        walletId: input.walletId ?? null,
        principalEventId: event.id,
        operationKey: `${loanId}:create`,
        createdAt,
      });
      const commit = await this.store.commitReceivedLoanRecord(loan, event);
      if (!commit.ok) return failure("storage_error", commit.message);
      return { ok: true, value: { loan: commit.value.record, event: commit.value.event } };
    } catch (error) {
      return failure(
        "validation_error",
        error instanceof Error ? error.message : "بيانات القرض المستلم غير صالحة.",
      );
    }
  }

  async recordRepayment(
    loanId: string,
    input: ReceivedLoanRepaymentInput,
  ): Promise<ReceivedLoanResult<{ loan: ReceivedLoanRecord; event: FinancialEvent }>> {
    const loanResult = await this.store.getReceivedLoan(loanId);
    if (!loanResult.ok) return failure("storage_error", "تعذر قراءة سجل القرض المستلم المحلي.");
    const loan = loanResult.value;
    if (!loan) return failure("invalid_state", "القرض المستلم غير متاح محليًا.");
    try {
      const now = this.now();
      const repaymentId = newId("rrep");
      const eventId = newId("event");
      const event = createFinancialEvent({
        id: eventId,
        type: "loan_received_repayment_cash" as FinancialEventType,
        amountMinor: input.amountMinor,
        occurredOn: input.date,
        recordedAt: now,
        idempotencyKey: `${loanId}:repayment:${repaymentId}`,
        note: input.note?.trim() || `سداد أصل من قرض ${loan.lenderName}`,
        counterparty: loan.lenderName,
        loanContext: { loanId, borrower: loan.lenderName, lender: loan.lenderName },
      });
      const next = addReceivedLoanRepayment(
        loan,
        { repaymentId, amountMinor: input.amountMinor, date: input.date, note: input.note ?? null, eventId },
        now,
      );
      const commit = await this.store.commitReceivedLoanRecord(next, event);
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
  ): Promise<ReceivedLoanResult<{ loan: ReceivedLoanRecord; reversal: FinancialEvent }>> {
    const [loanResult, eventsResult] = await Promise.all([
      this.store.getReceivedLoan(loanId),
      this.store.listFinancialEvents(),
    ]);
    if (!loanResult.ok || !eventsResult.ok)
      return failure("storage_error", "تعذر قراءة سجل القرض المستلم المحلي.");
    const loan = loanResult.value;
    if (!loan) return failure("invalid_state", "القرض المستلم غير متاح محليًا.");
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
      const next = reverseReceivedLoanRepayment(loan, repaymentId, reason, now, reversalEventId);
      const commit = await this.store.commitReceivedLoanRecord(next, reversal);
      if (!commit.ok) return failure("storage_error", commit.message);
      return { ok: true, value: { loan: commit.value.record, reversal: commit.value.event } };
    } catch (error) {
      return failure("validation_error", error instanceof Error ? error.message : "تراجع الدفعة غير صالح.");
    }
  }

  async correctLoan(
    loanId: string,
    input: ReceivedLoanCorrectionInput,
  ): Promise<
    ReceivedLoanResult<{ loan: ReceivedLoanRecord; reversal: FinancialEvent; replacement: FinancialEvent }>
  > {
    const [loanResult, eventsResult] = await Promise.all([
      this.store.getReceivedLoan(loanId),
      this.store.listFinancialEvents(),
    ]);
    if (!loanResult.ok || !eventsResult.ok)
      return failure("storage_error", "تعذر قراءة سجل القرض المستلم المحلي.");
    const loan = loanResult.value;
    if (!loan) return failure("invalid_state", "القرض المستلم غير متاح محليًا.");
    const source = eventsResult.value.find(event => event.id === loan.principalEventId);
    if (!source) return failure("invalid_state", "حدث أصل القرض المستلم غير موجود.");
    if (source.correctionType === "reverse")
      return failure("invalid_state", "حدث أصل القرض المستلم معكوس سابقًا.");
    /* لا تصحيح بلا تغيير — عكس وبديل بلا فرق فعلي يلوّثان التاريخ بضجيج؛
     * وبيانات العرض (النوع/الاستحقاق) لا تبرر عكسًا ماليًا أبدًا. */
    const nextPrincipal = input.principalMinor ?? loan.principalMinor;
    const nextLender = (input.lenderName ?? loan.lenderName).trim();
    if (nextPrincipal === loan.principalMinor && nextLender === loan.lenderName.trim())
      return failure("validation_error", "لا تغيير عن المسجّل — عدّل المبلغ أو المُقرض قبل التصحيح.");
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
        type: "loan_received_cash" as FinancialEventType,
        amountMinor: nextPrincipal,
        occurredOn: loan.receivedOn,
        recordedAt: now,
        idempotencyKey: `${loanId}:principal-replacement:${now}`,
        note: `تصحيح قرض مستلم: ${input.reason.trim()}`,
        counterparty: nextLender.trim(),
        loanContext: { loanId, borrower: nextLender.trim(), lender: nextLender.trim() },
      });
      const corrected = correctReceivedLoanRecord(
        loan,
        { lenderName: nextLender, principalMinor: nextPrincipal },
        input.reason,
        now,
      );
      const next: ReceivedLoanRecord = { ...corrected, principalEventId: replacement.id };
      const commit = await this.store.commitReceivedLoanCorrection(next, reversal, replacement);
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
      return failure(
        "validation_error",
        error instanceof Error ? error.message : "تصحيح القرض المستلم غير صالح.",
      );
    }
  }
}
