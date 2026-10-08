import { describe, expect, it } from "vitest";
import { findLoanEventByKey, validateLoanCommitRelation } from "./loanCommitGuard";
import { addLoanRepayment, createLoanRecord, reverseLoanRepayment } from "@micro-domain/loan/index.js";
import type { LoanRecord } from "@micro-domain/loan/index.js";
import { createFinancialEvent, createFinancialReversal } from "@micro-domain/financial-event/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";

/* R4-A3 (إغلاق R3-N3 — التزام موثق في بطاقات R3): اختبار وحدة مباشر لحارس
 * تزامن تسديد القروض الصادرة (AV-02). الحارس نقي مشترك بين المحوّلين
 * (يُستدعى داخل معاملة الكتابة نفسها في IndexedDB وفي الذاكرة قبل التعيين)
 * — الاختبار هنا يثبت قراره: علاقة السجل المخزّن بالوارد يجب أن تطابق عملية
 * مجال واحدة، وأي علاقة أخرى رفض بلا كتابة (لا انفصام بين السجل والأحداث). */

const AT = "2026-10-08T08:00:00.000Z";

function principalEvent(loanId: string, amountMinor: number, eventId: string): FinancialEvent {
  return createFinancialEvent({
    id: eventId,
    type: "loan_outgoing_cash",
    amountMinor,
    occurredOn: "2026-07-01",
    recordedAt: AT,
    idempotencyKey: `${loanId}:principal`,
    note: "قرض صادر",
    counterparty: "أحمد",
    loanContext: { loanId, borrower: "أحمد" },
  });
}

function makeLoan(loanId: string, amountMinor: number, eventId: string): LoanRecord {
  return createLoanRecord({
    id: loanId,
    borrowerName: "أحمد",
    principalMinor: amountMinor,
    loanDate: "2026-07-01",
    purposeNote: null,
    sourceWalletId: null,
    principalEventId: eventId,
    operationKey: `${loanId}:create`,
    createdAt: AT,
  });
}

function repaymentEvent(
  loanId: string,
  repaymentId: string,
  eventId: string,
  amountMinor: number,
): FinancialEvent {
  return createFinancialEvent({
    id: eventId,
    type: "loan_repayment_cash",
    amountMinor,
    occurredOn: "2026-08-15",
    recordedAt: AT,
    idempotencyKey: `${loanId}:repayment:${repaymentId}`,
    note: "دفعة",
    counterparty: "أحمد",
    loanContext: { loanId, borrower: "أحمد" },
  });
}

describe("R4-A3 — حارس التزام القرض الصادر (validateLoanCommitRelation)", () => {
  it("إنشاء جديد: لا سجل قائم + حدث إنشاء نظيف = مقبول", () => {
    const loan = makeLoan("loan-1", 20_000, "event-1");
    const event = principalEvent("loan-1", 20_000, "event-1");
    expect(validateLoanCommitRelation(undefined, loan, event)).toEqual({ ok: true });
  });

  it("لا يُبعث السجل من مسار دفعة: حدث دفعة بلا سجل قائم = رفض", () => {
    const loan = makeLoan("loan-2", 20_000, "event-2");
    const event = repaymentEvent("loan-2", "rep-1", "event-rep", 5_000);
    const result = validateLoanCommitRelation(undefined, loan, event);
    expect(result.ok).toBe(false);
  });

  it("لا يُبعث السجل من مسار تراجع: حدث تراجع بلا سجل قائم = رفض", () => {
    const loan = makeLoan("loan-3", 20_000, "event-3");
    const source = repaymentEvent("loan-3", "rep-1", "event-rep-3", 5_000);
    const reversal = createFinancialReversal({
      id: "event-rev-3",
      idempotencyKey: "loan-3:reverse:rep-1",
      reason: "خطأ في التسجيل",
      occurredOn: "2026-08-20",
      recordedAt: AT,
      sourceEvent: source,
    });
    const result = validateLoanCommitRelation(undefined, loan, reversal);
    expect(result.ok).toBe(false);
  });

  it("إضافة دفعة واحدة بالضبط تحمل حدث هذه الكتابة = مقبول", () => {
    const stored = makeLoan("loan-4", 20_000, "event-4");
    const event = repaymentEvent("loan-4", "rep-4", "event-rep-4", 5_000);
    const record = addLoanRepayment(
      stored,
      { repaymentId: "rep-4", amountMinor: 5_000, date: "2026-08-15", note: null, eventId: event.id },
      AT,
    );
    expect(validateLoanCommitRelation(stored, record, event)).toEqual({ ok: true });
  });

  it("دفعتان متزامنتان: الطول زاد بواحدين = رفض صادر (لا حدثان مقابل دفعة واحدة)", () => {
    const stored = makeLoan("loan-5", 20_000, "event-5");
    const first = repaymentEvent("loan-5", "rep-5a", "event-rep-5a", 5_000);
    const second = repaymentEvent("loan-5", "rep-5b", "event-rep-5b", 4_000);
    let record = addLoanRepayment(
      stored,
      { repaymentId: "rep-5a", amountMinor: 5_000, date: "2026-08-15", note: null, eventId: first.id },
      AT,
    );
    record = addLoanRepayment(
      record,
      { repaymentId: "rep-5b", amountMinor: 4_000, date: "2026-08-16", note: null, eventId: second.id },
      AT,
    );
    const result = validateLoanCommitRelation(stored, record, first);
    expect(result.ok).toBe(false);
  });

  it("الدفعة المضافة تحمل حدثًا مختلفًا عن حدث هذه الكتابة = رفض", () => {
    const stored = makeLoan("loan-6", 20_000, "event-6");
    const other = repaymentEvent("loan-6", "rep-6", "event-other", 5_000);
    const record = addLoanRepayment(
      stored,
      { repaymentId: "rep-6", amountMinor: 5_000, date: "2026-08-15", note: null, eventId: other.id },
      AT,
    );
    const unrelated = repaymentEvent("loan-6", "rep-6-unrelated", "event-unrelated", 3_000);
    const result = validateLoanCommitRelation(stored, record, unrelated);
    expect(result.ok).toBe(false);
  });

  it("تراجع موثق عن دفعة واحدة بالضبط = مقبول", () => {
    const stored = makeLoan("loan-7", 20_000, "event-7");
    const original = repaymentEvent("loan-7", "rep-7", "event-rep-7", 5_000);
    const withRepayment = addLoanRepayment(
      stored,
      { repaymentId: "rep-7", amountMinor: 5_000, date: "2026-08-15", note: null, eventId: original.id },
      AT,
    );
    const reversal = createFinancialReversal({
      id: "event-rev-7",
      idempotencyKey: "loan-7:reverse:rep-7",
      reason: "خطأ في المبلغ",
      occurredOn: "2026-08-20",
      recordedAt: AT,
      sourceEvent: original,
    });
    const record = reverseLoanRepayment(withRepayment, "rep-7", "خطأ في المبلغ", AT, reversal.id);
    expect(validateLoanCommitRelation(withRepayment, record, reversal)).toEqual({ ok: true });
  });

  it("تراجع ثانٍ عن الدفعة نفسها: لا جديد يُعكس لهذا الحدث = رفض", () => {
    const stored = makeLoan("loan-8", 20_000, "event-8");
    const original = repaymentEvent("loan-8", "rep-8", "event-rep-8", 5_000);
    const withRepayment = addLoanRepayment(
      stored,
      { repaymentId: "rep-8", amountMinor: 5_000, date: "2026-08-15", note: null, eventId: original.id },
      AT,
    );
    const firstReversal = createFinancialReversal({
      id: "event-rev-8a",
      idempotencyKey: "loan-8:reverse:rep-8:a",
      reason: "خطأ أول",
      occurredOn: "2026-08-20",
      recordedAt: AT,
      sourceEvent: original,
    });
    const reversedOnce = reverseLoanRepayment(withRepayment, "rep-8", "خطأ أول", AT, firstReversal.id);
    const secondReversal = createFinancialReversal({
      id: "event-rev-8b",
      idempotencyKey: "loan-8:reverse:rep-8:b",
      reason: "خطأ ثانٍ",
      occurredOn: "2026-08-21",
      recordedAt: AT,
      sourceEvent: original,
    });
    const result = validateLoanCommitRelation(withRepayment, reversedOnce, secondReversal);
    expect(result.ok).toBe(false);
  });

  it("نوع حدث آخر مع سجل قائم (مسار غير متوقع) = رفض", () => {
    const stored = makeLoan("loan-9", 20_000, "event-9");
    const stranger = createFinancialEvent({
      id: "event-stranger",
      type: "operating_expense_cash",
      amountMinor: 1_000,
      occurredOn: "2026-08-15",
      recordedAt: AT,
      idempotencyKey: "stranger",
      note: "حدث غريب",
      counterparty: null,
      expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
    });
    const result = validateLoanCommitRelation(stored, stored, stranger);
    expect(result.ok).toBe(false);
  });
});

describe("R4-A3 — عهدة مفتاح حدث القرض (findLoanEventByKey)", () => {
  it("يجد الحدث بنفس مفتاح الحتمية مستثنيًا معرّف هذه الكتابة", () => {
    const first = repaymentEvent("loan-10", "rep-10", "event-rep-10", 5_000);
    const second = repaymentEvent("loan-10", "rep-10b", "event-rep-10b", 4_000);
    const found = findLoanEventByKey([first, second], first.idempotencyKey, "event-rep-10b");
    expect(found?.id).toBe("event-rep-10");
  });

  it("لا يجد الحدث المعني نفسه (المستثنى بمعرّفه) ولا ما خالف مفتاحه", () => {
    const first = repaymentEvent("loan-11", "rep-11", "event-rep-11", 5_000);
    expect(findLoanEventByKey([first], first.idempotencyKey, first.id)).toBeUndefined();
    expect(findLoanEventByKey([first], "مفتاح-آخر", "event-unrelated")).toBeUndefined();
  });
});
