import { afterEach, describe, expect, it } from "vitest";
import { ReceivedLoanService } from "./receivedLoanService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { summarizeFinancialEvents } from "@micro-domain/financial-event/index.js";

/* FIN-001 (WS-178 — Wave 6): مرآة loanService.test.ts (MemoryLocalStore + ساعة
 * ثابتة) — «المقترض ليس دخلًا»: قبض القرض كاش والتزام (loanPayable)، وسداد
 * الأصل ينقصهما معًا؛ لا إيراد ولا مصروف ولا رأس مال في أي مسار، والمتبقي
 * مشتق من الدفعات القائمة. فصل النتيجة يُثبت فوق الأحداث المخزّنة نفسها
 * وبقارئ الفترة الكنوني قبل/بعد. */

function fixedNow() {
  let tick = 0;
  return () => {
    tick += 1;
    return new Date(Date.UTC(2026, 8, 1 + tick, 8, 0, 0)).toISOString();
  };
}

const now = fixedNow();

async function seededLoan(input?: { principalMinor?: number; dueOn?: string | null }) {
  const store = new MemoryLocalStore();
  const service = new ReceivedLoanService(store, now);
  const created = await service.create({
    lenderName: "سامي",
    lenderType: "person",
    principalMinor: input?.principalMinor ?? 20000,
    receivedOn: "2026-07-01",
    dueOn: input?.dueOn ?? null,
    note: "قرض من معرفة",
    walletId: null,
  });
  return { store, service, created };
}

describe("received loan service (FIN-001 — WS-178 Wave 6)", () => {
  it("creates a received loan: cash up and loan payable up — no revenue, no capital, no expense", async () => {
    const { service, created, store } = await seededLoan();
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.event.type).toBe("loan_received_cash");
    expect(created.value.event.cashDeltaMinor).toBe(20000);
    expect(created.value.event.loanPayableDeltaMinor).toBe(20000);
    expect(created.value.event.revenueDeltaMinor ?? 0).toBe(0);
    expect(created.value.event.operatingExpenseDeltaMinor).toBe(0);
    expect(created.value.event.ownerCapitalDeltaMinor).toBe(0);
    expect(created.value.event.loanDeltaMinor ?? 0).toBe(0);
    expect(created.value.event.loanContext?.lender).toBe("سامي");
    const overview = await service.overview();
    expect(overview.ok && overview.value.totals.borrowedLoansOutstandingMinor).toBe(20000);
    expect(overview.ok && overview.value.totals.borrowedPrincipalMinor).toBe(20000);
    expect(overview.ok && overview.value.totals.openCount).toBe(1);
    const events = await store.listFinancialEvents();
    expect(events.value).toHaveLength(1);
  });

  it("keeps two independent received loans with independent outstanding balances", async () => {
    const store = new MemoryLocalStore();
    const service = new ReceivedLoanService(store, now);
    const first = await service.create({
      lenderName: "سامي",
      lenderType: "person",
      principalMinor: 20000,
      receivedOn: "2026-07-01",
    });
    const second = await service.create({
      lenderName: "المؤسسة التجارية",
      lenderType: "institution",
      principalMinor: 50000,
      receivedOn: "2026-07-02",
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    /* سداد على الأول لا يمس الثاني — استقلال كامل. */
    const repaid = await service.recordRepayment(first.value.loan.id, {
      amountMinor: 5000,
      date: "2026-08-01",
    });
    expect(repaid.ok).toBe(true);
    const overview = await service.overview();
    if (!overview.ok) return;
    expect(overview.value.rows).toHaveLength(2);
    const byLender = new Map(overview.value.rows.map(row => [row.loan.lenderName, row.reading]));
    expect(byLender.get("سامي")!.outstandingMinor).toBe(15000);
    expect(byLender.get("المؤسسة التجارية")!.outstandingMinor).toBe(50000);
    expect(overview.value.totals.borrowedLoansOutstandingMinor).toBe(65000);
    const read = await service.read(second.value.loan.id);
    expect(read.ok && read.value.loan.repayments).toHaveLength(0);
  });

  it("settles to zero across multiple partial repayments — never over", async () => {
    const { service, created } = await seededLoan();
    if (!created.ok) return;
    const loanId = created.value.loan.id;
    const first = await service.recordRepayment(loanId, { amountMinor: 8000, date: "2026-08-01" });
    expect(first.ok && first.value.event.cashDeltaMinor).toBe(-8000);
    expect(first.ok && first.value.event.loanPayableDeltaMinor).toBe(-8000);
    const second = await service.recordRepayment(loanId, { amountMinor: 12000, date: "2026-09-01" });
    expect(second.ok).toBe(true);
    const overview = await service.overview();
    if (!overview.ok) return;
    expect(overview.value.rows[0]!.reading.status).toBe("settled");
    expect(overview.value.rows[0]!.reading.outstandingMinor).toBe(0);
    expect(overview.value.totals.borrowedLoansOutstandingMinor).toBe(0);
    const afterSettle = await service.recordRepayment(loanId, { amountMinor: 100, date: "2026-09-02" });
    expect(afterSettle.ok).toBe(false);
    if (afterSettle.ok) return;
    expect(afterSettle.message).toContain("مسدَّد بالكامل");
  });

  it("replays create and repayment commits as reused — no second event, no double reduction", async () => {
    const { store, service, created } = await seededLoan();
    if (!created.ok) return;
    const loanId = created.value.loan.id;
    /* إعادة تشغيل نفس (السجل، الحدث) عبر منفذ الالتزام = نفس النتيجة بلا نسخ ثانية. */
    const replayCreate = await store.commitReceivedLoanRecord(created.value.loan, created.value.event);
    expect(replayCreate.ok && replayCreate.value.reused).toBe(true);
    let events = await store.listFinancialEvents();
    expect(events.value).toHaveLength(1);
    const repaid = await service.recordRepayment(loanId, { amountMinor: 5000, date: "2026-08-01" });
    expect(repaid.ok).toBe(true);
    if (!repaid.ok) return;
    const replayRepayment = await store.commitReceivedLoanRecord(repaid.value.loan, repaid.value.event);
    expect(replayRepayment.ok && replayRepayment.value.reused).toBe(true);
    events = await store.listFinancialEvents();
    expect(events.value.filter(event => event.type === "loan_received_repayment_cash")).toHaveLength(1);
    const overview = await service.overview();
    expect(overview.ok && overview.value.rows[0]!.reading.outstandingMinor).toBe(15000);
  });

  it("reverses a repayment traceably: outstanding restores and the entry stays flagged", async () => {
    const { service, created, store } = await seededLoan();
    if (!created.ok) return;
    const loanId = created.value.loan.id;
    const repaid = await service.recordRepayment(loanId, {
      amountMinor: 5000,
      date: "2026-08-01",
      note: "دفعة أولى",
    });
    if (!repaid.ok) return;
    const reversal = await service.reverseRepayment(
      loanId,
      repaid.value.loan.repayments[0]!.id,
      "خرجت من المحفظة الخطأ",
    );
    expect(reversal.ok).toBe(true);
    if (!reversal.ok) return;
    expect(reversal.value.reversal.correctionType).toBe("reverse");
    expect(reversal.value.reversal.cashDeltaMinor).toBe(5000);
    expect(reversal.value.reversal.loanPayableDeltaMinor).toBe(5000);
    const overview = await service.overview();
    expect(overview.ok && overview.value.rows[0]!.reading.outstandingMinor).toBe(20000);
    const detail = await service.read(loanId);
    expect(detail.ok && detail.value.loan.repayments).toHaveLength(1);
    expect(detail.ok && detail.value.loan.repayments[0]!.reversal?.reason).toBe("خرجت من المحفظة الخطأ");
    /* التراجع الثاني عن الدفعة نفسها مرفوض. */
    const again = await service.reverseRepayment(loanId, repaid.value.loan.repayments[0]!.id, "ثانية");
    expect(again.ok).toBe(false);
    const events = await store.listFinancialEvents();
    expect(events.value.filter(event => event.correctionType === "reverse")).toHaveLength(1);
  });

  it("SEPARATION PROOF: borrowing and its repayment never touch the period result (revenue/expense/capital all zero; cash +principal then −repayment)", async () => {
    const store = new MemoryLocalStore();
    const service = new ReceivedLoanService(store, now);
    const finance = new ProjectFinancialService(store, now);
    const before = await finance.readRecordedPeriodResult("2026-07-01", "2026-09-30");
    if (!before.ok) throw new Error(before.message);
    const created = await service.create({
      lenderName: "سامي",
      lenderType: "person",
      principalMinor: 20000,
      receivedOn: "2026-08-01",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const repaid = await service.recordRepayment(created.value.loan.id, {
      amountMinor: 5000,
      date: "2026-08-15",
    });
    expect(repaid.ok).toBe(true);
    const events = await store.listFinancialEvents();
    expect(events.value).toHaveLength(2);
    const totals = summarizeFinancialEvents(events.value);
    expect(totals.retainedDepositRevenueMinor).toBe(0);
    expect(totals.operatingExpenseMinor).toBe(0);
    expect(totals.ownerCapitalMinor).toBe(0);
    expect(totals.payableMinor).toBe(0);
    expect(totals.cashMinor).toBe(20000 - 5000);
    expect(totals.loanPayableMinor).toBe(20000 - 5000);
    expect(totals.loanMinor).toBe(0);
    /* قارئ الفترة الكنوني نفسه: لا فرق واحد في النتيجة أو أي مكون لها. */
    const after = await finance.readRecordedPeriodResult("2026-07-01", "2026-09-30");
    if (!after.ok) throw new Error(after.message);
    expect(after.value).toEqual(before.value);
  });

  it("a due date is display-only: no expense event, no operatingExpense delta, no alert path", async () => {
    const { service, created, store } = await seededLoan({ dueOn: "2026-12-01" });
    if (!created.ok) return;
    expect(created.value.loan.dueOn).toBe("2026-12-01");
    const events = await store.listFinancialEvents();
    expect(events.value).toHaveLength(1);
    expect(events.value.filter(event => event.type.startsWith("operating_expense"))).toHaveLength(0);
    expect(events.value.every(event => event.operatingExpenseDeltaMinor === 0)).toBe(true);
    const overview = await service.overview();
    expect(overview.ok && overview.value.totals.borrowedLoansOutstandingMinor).toBe(20000);
  });
});

/* R10-B3/R10A-F-012 + R10B-NF-006 (2026-10-12): الاقتراض في السياق غير الآمن —
 * كان newId يستدعي crypto.randomUUID مباشرة فيرمي TypeError على الأصول
 * غير الآمنة؛ الآن مسار randomUUID الحرفي عند توفره وبديل فريد خارجه.
 * المرآة نفسها لنمط Catalog.operationKey.test.ts. */
type CryptoLike = typeof globalThis.crypto;
const originalCrypto: CryptoLike | undefined = globalThis.crypto;
function restoreCrypto() {
  if (originalCrypto === undefined) {
    delete (globalThis as { crypto?: CryptoLike }).crypto;
    return;
  }
  Object.defineProperty(globalThis, "crypto", {
    value: originalCrypto,
    configurable: true,
    writable: true,
  });
}
afterEach(restoreCrypto);

describe("received loan service insecure-context ids (R10-B3 — F-012 + NF-006)", () => {
  it("creates a received loan when crypto is absent (non-secure origin) instead of throwing", async () => {
    const store = new MemoryLocalStore();
    const service = new ReceivedLoanService(store, now);
    delete (globalThis as { crypto?: CryptoLike }).crypto;
    const created = await service.create({
      lenderName: "ليلى",
      lenderType: "person",
      principalMinor: 8000,
      receivedOn: "2026-07-01",
      dueOn: null,
      note: null,
      walletId: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.loan.id).toMatch(/^rloan-\d+-[0-9a-z]+$/);
    expect(created.value.event.id).toMatch(/^event-\d+-[0-9a-z]+$/);
    const events = await store.listFinancialEvents();
    expect(events.ok && events.value).toHaveLength(1);
  });

  it("returns the secure randomUUID id verbatim when crypto is available", async () => {
    const store = new MemoryLocalStore();
    const service = new ReceivedLoanService(store, now);
    const sentinel = "98765432-4321-8765-ba98-fedcba987654";
    Object.defineProperty(globalThis, "crypto", {
      value: { randomUUID: () => sentinel },
      configurable: true,
      writable: true,
    });
    const created = await service.create({
      lenderName: "هند",
      lenderType: "person",
      principalMinor: 1200,
      receivedOn: "2026-07-02",
      dueOn: null,
      note: null,
      walletId: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.loan.id).toBe(`rloan-${sentinel}`);
  });

  it("fallback ids stay collision-free across rapid successive creations", async () => {
    const store = new MemoryLocalStore();
    const service = new ReceivedLoanService(store, now);
    delete (globalThis as { crypto?: CryptoLike }).crypto;
    const ids = new Set<string>();
    for (let index = 0; index < 50; index += 1) {
      const created = await service.create({
        lenderName: `مقرض ${index}`,
        lenderType: "person",
        principalMinor: 100,
        receivedOn: "2026-07-01",
        dueOn: null,
        note: null,
        walletId: null,
      });
      if (created.ok) ids.add(created.value.loan.id);
    }
    expect(ids.size).toBe(50);
  });
});
