import { afterEach, describe, expect, it } from "vitest";
import { LoanService } from "./loanService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { assertOk } from "@/testing/resultAssertions";
import { createLoanRecord } from "@micro-domain/loan/index.js";
import { createFinancialEvent, type FinancialEvent } from "@micro-domain/financial-event/index.js";

/* UNIT-035 (تنفيذ S15 بالأمر الموحد §5): إنشاء الإقراض ملغى — الاختبارات
 * تزرع قرضًا تاريخيًا مباشرة عند حد المخزن (نفس مسار توافق النقل) لا عبر
 * خدمة الإنشاء الملغاة؛ القروض هنا بيانات موروثة للقراءة والصيانة. */
async function seedLegacyLoan() {
  const store = new MemoryLocalStore();
  const event = createFinancialEvent({
    id: "event-seed-loan-1",
    type: "loan_outgoing_cash",
    amountMinor: 15000,
    occurredOn: "2026-07-01",
    recordedAt: "2026-08-01T09:00:00.000Z",
    idempotencyKey: "seed-loan-1:principal",
    note: "قرض تاريخي للاختبار",
    counterparty: "أحمد",
    loanContext: { loanId: "seed-loan-1", borrower: "أحمد" },
  }) as FinancialEvent;
  const loan = createLoanRecord({
    id: "seed-loan-1",
    borrowerName: "أحمد",
    principalMinor: 15000,
    loanDate: "2026-07-01",
    purposeNote: "مساعدة لحاجة",
    sourceWalletId: null,
    principalEventId: event.id,
    operationKey: "seed-loan-1:create",
    createdAt: "2026-08-01T09:00:00.000Z",
  });
  const commit = await store.commitLoanRecord(loan, event);
  assertOk(commit);
  return { store, service: new LoanService(store, now), loan, event };
}

function fixedNow() {
  let tick = 0;
  return () => {
    tick += 1;
    return new Date(Date.UTC(2026, 8, 1 + tick, 8, 0, 0)).toISOString();
  };
}

const now = fixedNow();


describe("loan service (المجموعة ٤ — عقد ٢٩)", () => {
  it("UNIT-035: creation is cancelled at the legal boundary — refusal with no write, history readable (SDF-045)", async () => {
    const { store, service } = await seedLegacyLoan();
    const refused = await service.create({
      borrowerName: "مقترض جديد",
      principalMinor: 7000,
      loanDate: "2026-09-01",
      purposeNote: null,
      sourceWalletId: null,
    });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.message).toContain("ملغى");
    /* لا كتابة أبدًا: الأحداث كما كانت — حدث القرض التاريخي وحده. */
    const events = await store.listFinancialEvents();
    assertOk(events);
    expect(events.value).toHaveLength(1);
    expect(events.value[0]?.type).toBe("loan_outgoing_cash");
    /* والتاريخ القائم يُقرأ بمعناه: قرض قائم بمتبقيه الكامل. */
    const overview = await service.overview();
    expect(overview.ok && overview.value.rows[0]!.reading.outstandingMinor).toBe(15000);
  });

  it("records partial and full repayments with cash in and loan down, never revenue", async () => {
    const { store, service, loan, event } = await seedLegacyLoan();
    
    const loanId = loan.id;
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
    expect(overview.value.rows[0]!.reading.status).toBe("settled");
    expect(overview.value.rows[0]!.reading.outstandingMinor).toBe(0);
    /* المسدَّد يبقى في التاريخ. */
    const events = await store.listFinancialEvents();
    assertOk(events);
    expect(events.value.filter(event => event.type === "loan_repayment_cash")).toHaveLength(2);
  });

  it("guards over-repayment with an honest Arabic rejection", async () => {
    const { service, loan, event } = await seedLegacyLoan();
    
    const over = await service.recordRepayment(loan.id, {
      amountMinor: 15001,
      date: "2026-08-01",
    });
    expect(over.ok).toBe(false);
    if (over.ok) return;
    expect(over.message).toContain("يتجاوز المتبقي");
  });

  it("reverses a repayment traceably: entry stays, balance restores, cash event negated", async () => {
    const { store, service, loan, event } = await seedLegacyLoan();
    
    const loanId = loan.id;
    const repaid = await service.recordRepayment(loanId, { amountMinor: 5000, date: "2026-08-01" });
    if (!repaid.ok) return;
    const reversal = await service.reverseRepayment(loanId, repaid.value.loan.repayments[0]!.id, "وصلت خطأً");
    expect(reversal.ok).toBe(true);
    if (!reversal.ok) return;
    const overview = await service.overview();
    expect(overview.ok && overview.value.rows[0]!.reading.outstandingMinor).toBe(15000);
    const events = await store.listFinancialEvents();
    assertOk(events);
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
    const { store, service, loan, event } = await seedLegacyLoan();
    
    const loanId = loan.id;
    const correction = await service.correctLoan(loanId, {
      principalMinor: 20000,
      reason: "المبلغ الصحيح أعلى",
    });
    expect(correction.ok).toBe(true);
    if (!correction.ok) return;
    expect(correction.value.loan.principalMinor).toBe(20000);
    const events = await store.listFinancialEvents();
    assertOk(events);
    expect(events.value.filter(event => event.type === "loan_outgoing_cash")).toHaveLength(3);
    const overview = await service.overview();
    expect(overview.ok && overview.value.rows[0]!.reading.outstandingMinor).toBe(20000);
  });

  it("rejects correcting below active repayments", async () => {
    const { service, loan, event } = await seedLegacyLoan();
    
    const loanId = loan.id;
    const repaid = await service.recordRepayment(loanId, { amountMinor: 10000, date: "2026-08-01" });
    expect(repaid.ok).toBe(true);
    const correction = await service.correctLoan(loanId, {
      principalMinor: 5000,
      reason: "أقل من المسدد",
    });
    expect(correction.ok).toBe(false);
  });

  it("rejects a no-change correction instead of churning history (تصحيح مراجعة 4-c)", async () => {
    const { store, service, loan, event } = await seedLegacyLoan();
    
    const loanId = loan.id;
    const correction = await service.correctLoan(loanId, {
      principalMinor: loan.principalMinor,
      borrowerName: loan.borrowerName,
      reason: "بلا تغيير",
    });
    expect(correction.ok).toBe(false);
    if (correction.ok) return;
    expect(correction.message).toContain("لا تغيير عن المسجّل");
    const events = await store.listFinancialEvents();
    /* لا عكس ولا بديل — التاريخ لم يُلوَّث. */
    assertOk(events);
    expect(events.value.filter(event => event.correctionType === "reverse")).toHaveLength(0);
  });

  it("concurrent repayments never desync the loan record from its events (AV-02)", async () => {
    const { store, service, loan, event } = await seedLegacyLoan();
    
    const loanId = loan.id;
    const [first, second] = await Promise.all([
      service.recordRepayment(loanId, { amountMinor: 3000, date: "2026-08-01", note: "متزامن أول" }),
      service.recordRepayment(loanId, { amountMinor: 3000, date: "2026-08-01", note: "متزامن ثانٍ" }),
    ]);
    /* واحد يلتزم والآخر يُرفض بصدق — لا يوجد مسار يخزّن حدثين بسجلٍ بدفعة. */
    const successes = [first, second].filter(outcome => outcome.ok).length;
    expect(successes).toBe(1);
    const refused = [first, second].find(outcome => !outcome.ok);
    expect(refused?.message).toContain("أعد المحاولة");
    const events = await store.listFinancialEvents();
    assertOk(events);
    const repaymentEvents = events.value.filter(event => event.type === "loan_repayment_cash");
    expect(repaymentEvents.length).toBe(1);
    const stored = await store.getLoan(loanId);
    if (!stored.ok || !stored.value) throw new Error("loan missing");
    expect(stored.value.repayments.length).toBe(1);
    /* السجل والأحداث متسقان: المتبقي محسوب من دفعة واحدة مسجلة في الموضعين. */
    expect(stored.value.repayments[0]!.eventId).toBe(repaymentEvents[0]!.id);
  });
});

/* R10-B3/R10A-F-012 + R10B-NF-006 (2026-10-12): الإقراض في السياق غير الآمن —
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

describe("loan service creation cancellation (UNIT-035 — S15)", () => {
  it("no circumvention path: repeated refusals never write, and the service exposes no other creator", async () => {
    const { store, service } = await seedLegacyLoan();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const refused = await service.create({
        borrowerName: `محاولة ${attempt}`,
        principalMinor: 100,
        loanDate: "2026-09-01",
        purposeNote: null,
        sourceWalletId: null,
      });
      expect(refused.ok).toBe(false);
    }
    const events = await store.listFinancialEvents();
    assertOk(events);
    expect(events.value).toHaveLength(1);
  });
});
