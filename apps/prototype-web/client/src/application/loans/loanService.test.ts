import { describe, expect, it } from "vitest";
import { LoanService } from "./loanService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

function fixedNow() {
  let tick = 0;
  return () => {
    tick += 1;
    return new Date(Date.UTC(2026, 8, 1 + tick, 8, 0, 0)).toISOString();
  };
}

const now = fixedNow();

async function seededLoan() {
  const store = new MemoryLocalStore();
  const service = new LoanService(store, now);
  const created = await service.create({
    borrowerName: "أحمد",
    principalMinor: 15000,
    loanDate: "2026-07-01",
    purposeNote: "مساعدة لحاجة",
    sourceWalletId: null,
  });
  return { store, service, created };
}

describe("loan service (المجموعة ٤ — عقد ٢٩)", () => {
  it("creates a loan: cash out and loan receivable up — no expense, no owner effect", async () => {
    const { service, created, store } = await seededLoan();
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const events = await store.listFinancialEvents();
    const principal = events.value.find(event => event.type === "loan_outgoing_cash");
    expect(principal?.cashDeltaMinor).toBe(-15000);
    expect(principal?.loanDeltaMinor).toBe(15000);
    expect(principal?.operatingExpenseDeltaMinor).toBe(0);
    expect(principal?.ownerCapitalDeltaMinor).toBe(0);
    const overview = await service.overview();
    expect(overview.ok && overview.value[0]!.reading.outstandingMinor).toBe(15000);
  });

  it("records partial and full repayments with cash in and loan down, never revenue", async () => {
    const { service, created, store } = await seededLoan();
    if (!created.ok) return;
    const loanId = created.value.loan.id;
    const partial = await service.recordRepayment(loanId, {
      amountMinor: 5000,
      date: "2026-08-01",
      note: "دفعة أولى",
    });
    expect(partial.ok).toBe(true);
    if (!partial.ok) return;
    expect(partial.value.event.cashDeltaMinor).toBe(5000);
    expect(partial.value.event.loanDeltaMinor).toBe(-5000);
    expect(partial.value.event.revenueDeltaMinor ?? 0).toBe(0);
    const full = await service.recordRepayment(loanId, { amountMinor: 10000, date: "2026-09-01" });
    expect(full.ok).toBe(true);
    const overview = await service.overview();
    if (!overview.ok) return;
    expect(overview.value[0]!.reading.status).toBe("settled");
    expect(overview.value[0]!.reading.outstandingMinor).toBe(0);
    /* المسدَّد يبقى في التاريخ. */
    const events = await store.listFinancialEvents();
    expect(events.value.filter(event => event.type === "loan_repayment_cash")).toHaveLength(2);
  });

  it("guards over-repayment with an honest Arabic rejection", async () => {
    const { service, created } = await seededLoan();
    if (!created.ok) return;
    const over = await service.recordRepayment(created.value.loan.id, {
      amountMinor: 15001,
      date: "2026-08-01",
    });
    expect(over.ok).toBe(false);
    if (over.ok) return;
    expect(over.message).toContain("يتجاوز المتبقي");
  });

  it("reverses a repayment traceably: entry stays, balance restores, cash event negated", async () => {
    const { service, created, store } = await seededLoan();
    if (!created.ok) return;
    const loanId = created.value.loan.id;
    const repaid = await service.recordRepayment(loanId, { amountMinor: 5000, date: "2026-08-01" });
    if (!repaid.ok) return;
    const reversal = await service.reverseRepayment(loanId, repaid.value.loan.repayments[0]!.id, "وصلت خطأً");
    expect(reversal.ok).toBe(true);
    if (!reversal.ok) return;
    const overview = await service.overview();
    expect(overview.ok && overview.value[0]!.reading.outstandingMinor).toBe(15000);
    const events = await store.listFinancialEvents();
    const reversals = events.value.filter(event => event.correctionType === "reverse");
    expect(reversals).toHaveLength(1);
    expect(reversals[0]!.cashDeltaMinor).toBe(-5000);
    /* الدفعة باقية في التاريخ معلمة معكوسة. */
    const detail = await service.read(loanId);
    expect(detail.ok && detail.value.loan.repayments).toHaveLength(1);
    expect(detail.ok && detail.value.loan.repayments[0]!.reversal?.reason).toBe("وصلت خطأً");
    /* تراجع ثانٍ عن نفس الدفعة مرفوض. */
    const again = await service.reverseRepayment(loanId, repaid.value.loan.repayments[0]!.id, "ثانية");
    expect(again.ok).toBe(false);
  });

  it("corrects the loan principal with reversal + replacement and keeps history", async () => {
    const { service, created, store } = await seededLoan();
    if (!created.ok) return;
    const loanId = created.value.loan.id;
    const correction = await service.correctLoan(loanId, {
      principalMinor: 20000,
      reason: "المبلغ الصحيح أعلى",
    });
    expect(correction.ok).toBe(true);
    if (!correction.ok) return;
    expect(correction.value.loan.principalMinor).toBe(20000);
    const events = await store.listFinancialEvents();
    expect(events.value.filter(event => event.type === "loan_outgoing_cash")).toHaveLength(3);
    const overview = await service.overview();
    expect(overview.ok && overview.value[0]!.reading.outstandingMinor).toBe(20000);
  });

  it("rejects correcting below active repayments", async () => {
    const { service, created } = await seededLoan();
    if (!created.ok) return;
    const loanId = created.value.loan.id;
    const repaid = await service.recordRepayment(loanId, { amountMinor: 10000, date: "2026-08-01" });
    expect(repaid.ok).toBe(true);
    const correction = await service.correctLoan(loanId, {
      principalMinor: 5000,
      reason: "أقل من المسدد",
    });
    expect(correction.ok).toBe(false);
  });
});
