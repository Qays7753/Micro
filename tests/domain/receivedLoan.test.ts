import { describe, expect, it } from "vitest";
import {
  addReceivedLoanRepayment,
  correctReceivedLoanRecord,
  createReceivedLoanRecord,
  readReceivedLoan,
  reverseReceivedLoanRepayment,
} from "../../src/domain/received-loan/index.js";

/* FIN-001 (WS-178 — Wave 6): مرآة اختبار القرض الصادر (tests/domain/loan.test.ts)
 * — «المقترض ليس دخلًا»: الأصل والتزام، والسداد ينقص الالتزام والكاش ولا يمس
 * النتيجة؛ المتبقي مشتق لا مخزن، والنوع الاقتصادي اختيار صريح لا افتراضي. */

const loanBase = {
  id: "rloan-1",
  lenderName: "سامي",
  lenderType: "person" as const,
  principalMinor: 20000,
  receivedOn: "2026-07-01",
  principalEventId: "event-rloan-1",
  operationKey: "rloan-1:create",
  createdAt: "2026-07-01T08:00:00.000Z",
};

describe("received loan domain core (FIN-001)", () => {
  it("creates a received loan with no income, capital, or expense meaning", () => {
    const loan = createReceivedLoanRecord(loanBase);
    expect(loan.lenderName).toBe("سامي");
    expect(loan.lenderType).toBe("person");
    expect(loan.dueOn).toBeNull();
    expect(loan.repayments).toHaveLength(0);
    expect(loan.corrections).toHaveLength(0);
    /* freeze: السجل يُعاد بناؤه لا يُعدل في مكانه */
    expect(Object.isFrozen(loan)).toBe(true);
    const reading = readReceivedLoan(loan);
    expect(reading.status).toBe("open");
    expect(reading.outstandingMinor).toBe(20000);
  });

  it("rejects blank lenders, non-positive principals, invalid dates, and unknown lender types", () => {
    expect(() => createReceivedLoanRecord({ ...loanBase, lenderName: "  " })).toThrow(/اسم المُقرض/);
    expect(() => createReceivedLoanRecord({ ...loanBase, principalMinor: 0 })).toThrow();
    expect(() => createReceivedLoanRecord({ ...loanBase, receivedOn: "2026-13-01" })).toThrow();
    /* FIN-001: النوع الاقتصادي صريح — لا افتراضي ولا تخمين. */
    expect(() => createReceivedLoanRecord({ ...loanBase, lenderType: "bank" as never })).toThrow(
      /نوع المُقرض/,
    );
  });

  it("rejects a due date before the received date — display-only but still coherent", () => {
    expect(() => createReceivedLoanRecord({ ...loanBase, dueOn: "2026-06-30" })).toThrow(/لا يمكن أن يسبق/);
    /* الاستحقاق الصحيح وسم عرض فقط: لا مصروف ولا تغيير في المتبقي */
    const loan = createReceivedLoanRecord({ ...loanBase, dueOn: "2026-12-01" });
    expect(loan.dueOn).toBe("2026-12-01");
    expect(readReceivedLoan(loan).outstandingMinor).toBe(20000);
  });
});

describe("received loan repayment reading and guards (FIN-001)", () => {
  it("derives the outstanding from active repayments — never stored", () => {
    const loan = createReceivedLoanRecord(loanBase);
    const partial = addReceivedLoanRepayment(
      loan,
      { repaymentId: "rrep-1", amountMinor: 7500, date: "2026-08-01", eventId: "event-rrep-1" },
      "2026-08-01T08:00:00.000Z",
    );
    const reading = readReceivedLoan(partial);
    expect(reading.repaidActiveMinor).toBe(7500);
    expect(reading.outstandingMinor).toBe(12500);
    expect(reading.status).toBe("open");
  });

  it("settles fully across multiple payments and keeps the history visible", () => {
    const loan = createReceivedLoanRecord(loanBase);
    const partial = addReceivedLoanRepayment(
      loan,
      { repaymentId: "rrep-1", amountMinor: 7500, date: "2026-08-01", eventId: "event-rrep-1" },
      "2026-08-01T08:00:00.000Z",
    );
    const settled = addReceivedLoanRepayment(
      partial,
      { repaymentId: "rrep-2", amountMinor: 12500, date: "2026-09-01", eventId: "event-rrep-2" },
      "2026-09-01T08:00:00.000Z",
    );
    const reading = readReceivedLoan(settled);
    expect(reading.status).toBe("settled");
    expect(reading.outstandingMinor).toBe(0);
    expect(settled.repayments).toHaveLength(2);
  });

  it("rejects over-repayment naming the outstanding, and any payment after settlement", () => {
    const loan = createReceivedLoanRecord(loanBase);
    expect(() =>
      addReceivedLoanRepayment(
        loan,
        { repaymentId: "rrep-x", amountMinor: 20001, date: "2026-08-01", eventId: "event-rrep-x" },
        "2026-08-01T08:00:00.000Z",
      ),
    ).toThrow(/المتبقي 200 د\.أ والمُدخل 200\.01 د\.أ/);
    const settled = addReceivedLoanRepayment(
      loan,
      { repaymentId: "rrep-1", amountMinor: 20000, date: "2026-08-01", eventId: "event-rrep-1" },
      "2026-08-01T08:00:00.000Z",
    );
    expect(() =>
      addReceivedLoanRepayment(
        settled,
        { repaymentId: "rrep-2", amountMinor: 100, date: "2026-09-01", eventId: "event-rrep-2" },
        "2026-09-01T08:00:00.000Z",
      ),
    ).toThrow(/مسدَّد بالكامل/);
  });
});

describe("received loan reversal and correction (FIN-001)", () => {
  it("reverses a repayment traceably: reason, time, reversal event — and the balance restores", () => {
    const loan = createReceivedLoanRecord(loanBase);
    const repaid = addReceivedLoanRepayment(
      loan,
      {
        repaymentId: "rrep-1",
        amountMinor: 7500,
        date: "2026-08-01",
        note: "دفعة أولى",
        eventId: "event-rrep-1",
      },
      "2026-08-01T08:00:00.000Z",
    );
    expect(readReceivedLoan(repaid).outstandingMinor).toBe(12500);
    const reversed = reverseReceivedLoanRepayment(
      repaid,
      "rrep-1",
      "خرجت من المحفظة الخطأ",
      "2026-08-02T08:00:00.000Z",
      "event-rrep-1-rev",
    );
    expect(reversed.repayments).toHaveLength(1);
    expect(reversed.repayments[0]!.reversal).toEqual({
      reason: "خرجت من المحفظة الخطأ",
      at: "2026-08-02T08:00:00.000Z",
      reversalEventId: "event-rrep-1-rev",
    });
    expect(readReceivedLoan(reversed).outstandingMinor).toBe(20000);
    expect(() =>
      reverseReceivedLoanRepayment(reversed, "rrep-1", "ثانية", "2026-08-03T08:00:00.000Z", "event-rev-2"),
    ).toThrow(/معكوسة سابقًا/);
  });

  it("appends documented corrections and never drops the principal below active repayments", () => {
    const loan = createReceivedLoanRecord(loanBase);
    const repaid = addReceivedLoanRepayment(
      loan,
      { repaymentId: "rrep-1", amountMinor: 7500, date: "2026-08-01", eventId: "event-rrep-1" },
      "2026-08-01T08:00:00.000Z",
    );
    const corrected = correctReceivedLoanRecord(
      repaid,
      { lenderName: "سامي التجاري", principalMinor: 30000 },
      "تصحيح مبلغ ومُقرض",
      "2026-08-05T08:00:00.000Z",
    );
    expect(corrected.lenderName).toBe("سامي التجاري");
    expect(corrected.principalMinor).toBe(30000);
    expect(corrected.corrections).toHaveLength(1);
    expect(corrected.corrections[0]!.reason).toBe("تصحيح مبلغ ومُقرض");
    expect(() =>
      correctReceivedLoanRecord(
        repaid,
        { principalMinor: 7000 },
        "أقل من المسدد",
        "2026-08-05T08:00:00.000Z",
      ),
    ).toThrow(/دون المسدَّد/);
  });
});
