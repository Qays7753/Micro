import { afterEach, describe, expect, it } from "vitest";
import { ReceivedLoanService } from "./receivedLoanService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { summarizeFinancialEvents } from "@micro-domain/financial-event/index.js";
import { assertOk } from "@/testing/resultAssertions";
import { createReceivedLoanRecord } from "@micro-domain/received-loan/index.js";
import { createFinancialEvent, type FinancialEvent } from "@micro-domain/financial-event/index.js";

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

/* UNIT-036 (تنفيذ S15 بالأمر الموحد §5): الاقتراض مؤجل — الاختبارات تزرع
 * قرضًا مستلمًا تاريخيًا مباشرة عند حد المخزن (مسار توافق النقل) لا عبر
 * خدمة الإنشاء المؤجلة؛ البيانات هنا موروثة للقراءة والصيانة. */
async function seededLoan(input?: { principalMinor?: number; dueOn?: string | null }) {
  const { store, service, loan, event } = await seedLegacyReceivedLoan(input);
  return { store, service, created: { ok: true as const, value: { loan, event } } };
}

async function seedLegacyReceivedLoan(input?: {
  principalMinor?: number;
  dueOn?: string | null;
  store?: MemoryLocalStore;
}) {
  const store = input?.store ?? new MemoryLocalStore();
  const service = new ReceivedLoanService(store, now);
  const principalMinor = input?.principalMinor ?? 20000;
  const event = createFinancialEvent({
    id: "event-seed-rloan-1",
    type: "loan_received_cash",
    amountMinor: principalMinor,
    occurredOn: "2026-07-01",
    recordedAt: "2026-08-01T09:00:00.000Z",
    idempotencyKey: "seed-rloan-1:principal",
    note: "قرض تاريخي للاختبار",
    counterparty: "سامي",
    loanContext: { loanId: "seed-rloan-1", borrower: "سامي", lender: "سامي" },
  }) as FinancialEvent;
  const loan = createReceivedLoanRecord({
    id: "seed-rloan-1",
    lenderName: "سامي",
    lenderType: "person",
    principalMinor,
    receivedOn: "2026-07-01",
    dueOn: input?.dueOn ?? null,
    note: "قرض من معرفة",
    walletId: null,
    principalEventId: event.id,
    operationKey: "seed-rloan-1:create",
    createdAt: "2026-08-01T09:00:00.000Z",
  });
  const commit = await store.commitReceivedLoanRecord(loan, event);
  assertOk(commit);
  return { store, service, loan, event };
}

describe("received loan service (FIN-001 — WS-178 Wave 6)", () => {
  it("UNIT-036: borrowing creation is deferred at the legal boundary — refusal with no write, history readable (SDF-045)", async () => {
    const { store, service } = await seedLegacyReceivedLoan();
    const refused = await service.create({
      lenderName: "جهة جديدة",
      lenderType: "person",
      principalMinor: 9000,
      receivedOn: "2026-09-01",
      dueOn: null,
      note: null,
      walletId: null,
    });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.message).toContain("مؤجل");
    const events = await store.listFinancialEvents();
    assertOk(events);
    expect(events.value).toHaveLength(1);
    const overview = await service.overview();
    expect(overview.ok && overview.value.rows[0]!.reading.outstandingMinor).toBe(20000);
  });

  it("keeps two independent legacy received loans with independent outstanding balances (store-seeded)", async () => {
    const { store, service } = await seedLegacyReceivedLoan();
    const event = createFinancialEvent({
      id: "event-seed-rloan-2",
      type: "loan_received_cash",
      amountMinor: 5000,
      occurredOn: "2026-07-02",
      recordedAt: "2026-08-01T09:00:00.000Z",
      idempotencyKey: "seed-rloan-2:principal",
      note: "قرض تاريخي ثانٍ",
      counterparty: "المؤسسة التجارية",
      loanContext: { loanId: "seed-rloan-2", borrower: "المؤسسة التجارية", lender: "المؤسسة التجارية" },
    }) as FinancialEvent;
    const loan = createReceivedLoanRecord({
      id: "seed-rloan-2",
      lenderName: "المؤسسة التجارية",
      lenderType: "institution",
      principalMinor: 5000,
      receivedOn: "2026-07-02",
      dueOn: null,
      note: null,
      walletId: null,
      principalEventId: event.id,
      operationKey: "seed-rloan-2:create",
      createdAt: "2026-08-01T09:00:00.000Z",
    });
    assertOk(await store.commitReceivedLoanRecord(loan, event));
    const overview = await service.overview();
    expect(overview.ok && overview.value.rows).toHaveLength(2);
    const totals = overview.ok ? overview.value.totals : null;
    expect(totals?.borrowedLoansOutstandingMinor).toBe(25000);
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
    assertOk(events);
    expect(events.value).toHaveLength(1);
    const repaid = await service.recordRepayment(loanId, { amountMinor: 5000, date: "2026-08-01" });
    expect(repaid.ok).toBe(true);
    if (!repaid.ok) return;
    const replayRepayment = await store.commitReceivedLoanRecord(repaid.value.loan, repaid.value.event);
    expect(replayRepayment.ok && replayRepayment.value.reused).toBe(true);
    events = await store.listFinancialEvents();
    assertOk(events);
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
    assertOk(events);
    expect(events.value.filter(event => event.correctionType === "reverse")).toHaveLength(1);
  });

  it("SEPARATION PROOF: borrowing and its repayment never touch the period result (revenue/expense/capital all zero; cash +principal then −repayment)", async () => {
    const store = new MemoryLocalStore();
    const service = new ReceivedLoanService(store, now);
    const finance = new ProjectFinancialService(store, now);
    const before = await finance.readRecordedPeriodResult("2026-07-01", "2026-09-30");
    if (!before.ok) throw new Error(before.message);
    /* زرع القرض التاريخي مباشرة عند حد المخزن — الإنشاء مؤجل (UNIT-036)؛
     * القراءة قبل الزرع وبعده مع السداد تُثبت أن القرض الموروث لا يمس
     * النتيجة كما لم يمسها الإنشاء قبل الإلغاء. */
    const seeded = await seedLegacyReceivedLoan({ store });
    const repaid = await service.recordRepayment(seeded.loan.id, {
      amountMinor: 5000,
      date: "2026-08-15",
    });
    expect(repaid.ok).toBe(true);
    const events = await store.listFinancialEvents();
    assertOk(events);
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
    assertOk(events);
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
  it("UNIT-036 repeated: no circumvention — repeated refusals never write", async () => {
    const { store, service } = await seedLegacyReceivedLoan();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const refused = await service.create({
        lenderName: `محاولة ${attempt}`,
        lenderType: "person",
        principalMinor: 100,
        receivedOn: "2026-09-01",
        dueOn: null,
        note: null,
        walletId: null,
      });
      expect(refused.ok).toBe(false);
    }
    const events = await store.listFinancialEvents();
    assertOk(events);
    expect(events.value).toHaveLength(1);
  });
});
