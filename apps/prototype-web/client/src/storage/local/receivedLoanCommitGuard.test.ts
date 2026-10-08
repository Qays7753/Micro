import { describe, expect, it } from "vitest";
import { findReceivedLoanEventByKey, validateReceivedLoanCommitRelation } from "./receivedLoanCommitGuard";
import {
  addReceivedLoanRepayment,
  createReceivedLoanRecord,
  reverseReceivedLoanRepayment,
} from "@micro-domain/received-loan/index.js";
import type { ReceivedLoanRecord } from "@micro-domain/received-loan/index.js";
import { createFinancialEvent, createFinancialReversal } from "@micro-domain/financial-event/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";

/* R4-A3 (إغلاق R3-N3 — التزام موثق في بطاقات R3): اختبار وحدة مباشر لحارس
 * تزامن تسديد القروض المستلمة (FIN-001/WS-178 — Wave 6، AV-02). الحارس نقي
 * مشترك بين المحوّلين — الاختبار يثبت قراره: علاقة السجل المخزّن بالوارد
 * يجب أن تطابق عملية مجال واحدة (إنشاء، دفعة سداد أصل واحدة، أو تراجعًا
 * موثقًا عن دفعة واحدة)؛ أي علاقة أخرى رفض صادر بلا كتابة. */

const AT = "2026-10-08T08:00:00.000Z";

function principalEvent(loanId: string, amountMinor: number, eventId: string): FinancialEvent {
  return createFinancialEvent({
    id: eventId,
    type: "loan_received_cash",
    amountMinor,
    occurredOn: "2026-07-01",
    recordedAt: AT,
    idempotencyKey: `${loanId}:principal`,
    note: "قرض مستلم",
    counterparty: "سامي",
    loanContext: { loanId, borrower: "سامي", lender: "سامي" },
  });
}

function makeReceivedLoan(loanId: string, amountMinor: number, eventId: string): ReceivedLoanRecord {
  return createReceivedLoanRecord({
    id: loanId,
    lenderName: "سامي",
    lenderType: "person",
    principalMinor: amountMinor,
    receivedOn: "2026-07-01",
    dueOn: null,
    note: null,
    walletId: null,
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
    type: "loan_received_repayment_cash",
    amountMinor,
    occurredOn: "2026-08-15",
    recordedAt: AT,
    idempotencyKey: `${loanId}:repayment:${repaymentId}`,
    note: "دفعة سداد أصل",
    counterparty: "سامي",
    loanContext: { loanId, borrower: "سامي", lender: "سامي" },
  });
}

describe("R4-A3 — حارس التزام القرض المستلم (validateReceivedLoanCommitRelation)", () => {
  it("إنشاء جديد: لا سجل قائم + حدث قبض اقتراض نظيف = مقبول", () => {
    const loan = makeReceivedLoan("rloan-1", 20_000, "event-1");
    const event = principalEvent("rloan-1", 20_000, "event-1");
    expect(validateReceivedLoanCommitRelation(undefined, loan, event)).toEqual({ ok: true });
  });

  it("لا يُبعث السجل من مسار دفعة سداد: حدث سداد بلا سجل قائم = رفض", () => {
    const loan = makeReceivedLoan("rloan-2", 20_000, "event-2");
    const event = repaymentEvent("rloan-2", "rrep-2", "event-rep-2", 5_000);
    const result = validateReceivedLoanCommitRelation(undefined, loan, event);
    expect(result.ok).toBe(false);
  });

  it("لا يُبعث السجل من مسار تراجع: حدث تراجع بلا سجل قائم = رفض", () => {
    const loan = makeReceivedLoan("rloan-3", 20_000, "event-3");
    const source = repaymentEvent("rloan-3", "rrep-3", "event-rep-3", 5_000);
    const reversal = createFinancialReversal({
      id: "event-rev-3",
      idempotencyKey: "rloan-3:reverse:rrep-3",
      reason: "خطأ في التسجيل",
      occurredOn: "2026-08-20",
      recordedAt: AT,
      sourceEvent: source,
    });
    const result = validateReceivedLoanCommitRelation(undefined, loan, reversal);
    expect(result.ok).toBe(false);
  });

  it("إضافة دفعة سداد أصل واحدة بالضبط تحمل حدث هذه الكتابة = مقبول", () => {
    const stored = makeReceivedLoan("rloan-4", 20_000, "event-4");
    const event = repaymentEvent("rloan-4", "rrep-4", "event-rep-4", 5_000);
    const record = addReceivedLoanRepayment(
      stored,
      { repaymentId: "rrep-4", amountMinor: 5_000, date: "2026-08-15", note: null, eventId: event.id },
      AT,
    );
    expect(validateReceivedLoanCommitRelation(stored, record, event)).toEqual({ ok: true });
  });

  it("دفعتان متزامنتان: الطول زاد بواحدين = رفض صادر", () => {
    const stored = makeReceivedLoan("rloan-5", 20_000, "event-5");
    const first = repaymentEvent("rloan-5", "rrep-5a", "event-rep-5a", 5_000);
    const second = repaymentEvent("rloan-5", "rrep-5b", "event-rep-5b", 4_000);
    let record = addReceivedLoanRepayment(
      stored,
      { repaymentId: "rrep-5a", amountMinor: 5_000, date: "2026-08-15", note: null, eventId: first.id },
      AT,
    );
    record = addReceivedLoanRepayment(
      record,
      { repaymentId: "rrep-5b", amountMinor: 4_000, date: "2026-08-16", note: null, eventId: second.id },
      AT,
    );
    const result = validateReceivedLoanCommitRelation(stored, record, first);
    expect(result.ok).toBe(false);
  });

  it("الدفعة المضافة تحمل حدثًا مختلفًا عن حدث هذه الكتابة = رفض", () => {
    const stored = makeReceivedLoan("rloan-6", 20_000, "event-6");
    const other = repaymentEvent("rloan-6", "rrep-6", "event-other", 5_000);
    const record = addReceivedLoanRepayment(
      stored,
      { repaymentId: "rrep-6", amountMinor: 5_000, date: "2026-08-15", note: null, eventId: other.id },
      AT,
    );
    const unrelated = repaymentEvent("rloan-6", "rrep-6-unrelated", "event-unrelated", 3_000);
    const result = validateReceivedLoanCommitRelation(stored, record, unrelated);
    expect(result.ok).toBe(false);
  });

  it("تراجع موثق عن دفعة واحدة بالضبط = مقبول", () => {
    const stored = makeReceivedLoan("rloan-7", 20_000, "event-7");
    const original = repaymentEvent("rloan-7", "rrep-7", "event-rep-7", 5_000);
    const withRepayment = addReceivedLoanRepayment(
      stored,
      { repaymentId: "rrep-7", amountMinor: 5_000, date: "2026-08-15", note: null, eventId: original.id },
      AT,
    );
    const reversal = createFinancialReversal({
      id: "event-rev-7",
      idempotencyKey: "rloan-7:reverse:rrep-7",
      reason: "خطأ في المبلغ",
      occurredOn: "2026-08-20",
      recordedAt: AT,
      sourceEvent: original,
    });
    const record = reverseReceivedLoanRepayment(withRepayment, "rrep-7", "خطأ في المبلغ", AT, reversal.id);
    expect(validateReceivedLoanCommitRelation(withRepayment, record, reversal)).toEqual({ ok: true });
  });

  it("تراجع ثانٍ عن الدفعة نفسها: لا جديد يُعكس لهذا الحدث = رفض", () => {
    const stored = makeReceivedLoan("rloan-8", 20_000, "event-8");
    const original = repaymentEvent("rloan-8", "rrep-8", "event-rep-8", 5_000);
    const withRepayment = addReceivedLoanRepayment(
      stored,
      { repaymentId: "rrep-8", amountMinor: 5_000, date: "2026-08-15", note: null, eventId: original.id },
      AT,
    );
    const firstReversal = createFinancialReversal({
      id: "event-rev-8a",
      idempotencyKey: "rloan-8:reverse:rrep-8:a",
      reason: "خطأ أول",
      occurredOn: "2026-08-20",
      recordedAt: AT,
      sourceEvent: original,
    });
    const reversedOnce = reverseReceivedLoanRepayment(
      withRepayment,
      "rrep-8",
      "خطأ أول",
      AT,
      firstReversal.id,
    );
    const secondReversal = createFinancialReversal({
      id: "event-rev-8b",
      idempotencyKey: "rloan-8:reverse:rrep-8:b",
      reason: "خطأ ثانٍ",
      occurredOn: "2026-08-21",
      recordedAt: AT,
      sourceEvent: original,
    });
    const result = validateReceivedLoanCommitRelation(withRepayment, reversedOnce, secondReversal);
    expect(result.ok).toBe(false);
  });

  it("نوع حدث آخر مع سجل قائم (مسار غير متوقع) = رفض", () => {
    const stored = makeReceivedLoan("rloan-9", 20_000, "event-9");
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
    const result = validateReceivedLoanCommitRelation(stored, stored, stranger);
    expect(result.ok).toBe(false);
  });
});

describe("R4-A3 — عهدة مفتاح حدث القرض المستلم (findReceivedLoanEventByKey)", () => {
  it("يجد الحدث بنفس مفتاح الحتمية مستثنيًا معرّف هذه الكتابة", () => {
    const first = repaymentEvent("rloan-10", "rrep-10", "event-rep-10", 5_000);
    const second = repaymentEvent("rloan-10", "rrep-10b", "event-rep-10b", 4_000);
    const found = findReceivedLoanEventByKey([first, second], first.idempotencyKey, "event-rep-10b");
    expect(found?.id).toBe("event-rep-10");
  });

  it("لا يجد الحدث المعني نفسه (المستثنى بمعرّفه) ولا ما خالف مفتاحه", () => {
    const first = repaymentEvent("rloan-11", "rrep-11", "event-rep-11", 5_000);
    expect(findReceivedLoanEventByKey([first], first.idempotencyKey, first.id)).toBeUndefined();
    expect(findReceivedLoanEventByKey([first], "مفتاح-آخر", "event-unrelated")).toBeUndefined();
  });
});
