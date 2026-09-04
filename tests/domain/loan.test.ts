import { describe, expect, it } from "vitest";
import {
  addLoanRepayment,
  createLoanRecord,
  readLoan,
  reverseLoanRepayment,
  correctLoanRecord,
} from "../../src/domain/loan/index.js";

const loanBase = {
  id: "loan-1",
  borrowerName: "أحمد",
  principalMinor: 15000,
  loanDate: "2026-07-01",
  principalEventId: "event-loan",
  operationKey: "loan-1:create",
  createdAt: "2026-07-01T08:00:00.000Z",
};

describe("loan domain core", () => {
  it("creates an outgoing loan with no expense, withdrawal, or revenue meaning", () => {
    const loan = createLoanRecord(loanBase);
    expect(loan.borrowerName).toBe("أحمد");
    expect(loan.repayments).toHaveLength(0);
    const reading = readLoan(loan);
    expect(reading.status).toBe("open");
    expect(reading.outstandingMinor).toBe(15000);
  });

  it("rejects blank borrowers, non-positive principals, and invalid dates", () => {
    expect(() => createLoanRecord({ ...loanBase, borrowerName: "  " })).toThrow();
    expect(() => createLoanRecord({ ...loanBase, principalMinor: 0 })).toThrow();
    expect(() => createLoanRecord({ ...loanBase, loanDate: "2026-13-01" })).toThrow();
  });

  it("supports partial repayment with a derived balance, never stored", () => {
    const loan = createLoanRecord(loanBase);
    const partial = addLoanRepayment(
      loan,
      { repaymentId: "rep-1", amountMinor: 5000, date: "2026-08-01", eventId: "event-rep-1" },
      "2026-08-01T08:00:00.000Z",
    );
    const reading = readLoan(partial);
    expect(reading.repaidActiveMinor).toBe(5000);
    expect(reading.outstandingMinor).toBe(10000);
    expect(reading.status).toBe("open");
  });

  it("settles fully with a second repayment and keeps history visible", () => {
    const loan = createLoanRecord(loanBase);
    const partial = addLoanRepayment(
      loan,
      { repaymentId: "rep-1", amountMinor: 5000, date: "2026-08-01", eventId: "event-rep-1" },
      "2026-08-01T08:00:00.000Z",
    );
    const settled = addLoanRepayment(
      partial,
      { repaymentId: "rep-2", amountMinor: 10000, date: "2026-09-01", eventId: "event-rep-2" },
      "2026-09-01T08:00:00.000Z",
    );
    const reading = readLoan(settled);
    expect(reading.status).toBe("settled");
    expect(reading.outstandingMinor).toBe(0);
    /* المسدَّد يبقى في التاريخ: سجلًا وقراءة */
    expect(settled.repayments).toHaveLength(2);
  });
});

/* المجموعة ٤: وصف ثانٍ مقتصد — حراس السداد والتصحيح تحت سقف الأسطر. */
describe("loan repayment guards and corrections", () => {
  it("guards over-repayment and payments after settlement", () => {
    const loan = createLoanRecord(loanBase);
    expect(() =>
      addLoanRepayment(
        loan,
        { repaymentId: "rep-x", amountMinor: 15001, date: "2026-08-01", eventId: "event-rep-x" },
        "2026-08-01T08:00:00.000Z",
      ),
    ).toThrow(/يتجاوز المتبقي/);
    const settled = addLoanRepayment(
      loan,
      { repaymentId: "rep-1", amountMinor: 15000, date: "2026-08-01", eventId: "event-rep-1" },
      "2026-08-01T08:00:00.000Z",
    );
    expect(() =>
      addLoanRepayment(
        settled,
        { repaymentId: "rep-2", amountMinor: 100, date: "2026-09-01", eventId: "event-rep-2" },
        "2026-09-01T08:00:00.000Z",
      ),
    ).toThrow(/مسدَّد بالكامل/);
  });
});

/* المجموعة ٤: وصف ثالث — التراجع والتصحيح الموثق. */
describe("loan repayment reversal and correction", () => {
  it("reverses a repayment traceably: the entry stays in history and the balance restores", () => {
    const loan = createLoanRecord(loanBase);
    const repaid = addLoanRepayment(
      loan,
      {
        repaymentId: "rep-1",
        amountMinor: 5000,
        date: "2026-08-01",
        note: "دفعة أولى",
        eventId: "event-rep-1",
      },
      "2026-08-01T08:00:00.000Z",
    );
    expect(readLoan(repaid).outstandingMinor).toBe(10000);
    const reversed = reverseLoanRepayment(
      repaid,
      "rep-1",
      "وصلت الدفعة خطأً",
      "2026-08-02T08:00:00.000Z",
      "event-rep-1-rev",
    );
    expect(reversed.repayments).toHaveLength(1);
    expect(reversed.repayments[0]!.reversal?.reason).toBe("وصلت الدفعة خطأً");
    expect(readLoan(reversed).outstandingMinor).toBe(15000);
    expect(() =>
      reverseLoanRepayment(reversed, "rep-1", "ثانية", "2026-08-03T08:00:00.000Z", "event-rep-1-rev-2"),
    ).toThrow(/معكوسة سابقًا/);
  });

  it("corrects loan details without dropping below active repayments", () => {
    const loan = createLoanRecord(loanBase);
    const repaid = addLoanRepayment(
      loan,
      { repaymentId: "rep-1", amountMinor: 5000, date: "2026-08-01", eventId: "event-rep-1" },
      "2026-08-01T08:00:00.000Z",
    );
    const corrected = correctLoanRecord(
      repaid,
      { borrowerName: "محمد", principalMinor: 20000 },
      "تصحيح اسم ومبلغ",
      "2026-08-05T08:00:00.000Z",
    );
    expect(corrected.borrowerName).toBe("محمد");
    expect(corrected.principalMinor).toBe(20000);
    expect(corrected.corrections).toHaveLength(1);
    expect(() =>
      correctLoanRecord(repaid, { principalMinor: 4000 }, "أقل من المسدد", "2026-08-05T08:00:00.000Z"),
    ).toThrow(/دون المسدَّد/);
  });
});
