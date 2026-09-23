import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { createFinancialEvent, createFinancialReversal } from "@micro-domain/financial-event/index.js";
import {
  addReceivedLoanRepayment,
  createReceivedLoanRecord,
  reverseReceivedLoanRepayment,
} from "@micro-domain/received-loan/index.js";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { financialEventStore, receivedLoanStore } from "./indexedDbStores";

/* FIN-001 (WS-178 — Wave 6 / نمط D-037): ترقية المخطط ٣٧→٣٨ بإنشاء محروس فقط —
 * قاعدة ٣٧ حقيقية (بمخازنها القائمة وحدث مالي قديم) تُفتح بالمحوّل الجديد
 * فيُهيَّأ مخزن القروض المستلمة فارغًا والسجل القديم كما هو حرفيًا؛ لا ترحيل
 * بيانات ولا فقدًا صامت (نمط FIN-002 نفسه — IndexedDbLocalStore.expenseBudget.test.ts).
 * ثم عقد الالتزام المحروس: الالتزام الذرّي (سجل+حدث)، إعادة الاستخدام الحتمي،
 * تراجع الدفعة، والتصحيح (عكس+بديل) — كلها داخل معاملات IndexedDB نفسها. */

const databaseName = "micro-prototype-local";
const NOW = "2026-09-23T08:00:00.000Z";

function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function openLegacySchema37(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 37);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(financialEventStore)) {
        const events = database.createObjectStore(financialEventStore, { keyPath: "id" });
        events.createIndex("recordedAt", "recordedAt");
        events.createIndex("occurredOn", "occurredOn");
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction([financialEventStore], "readwrite");
      transaction.objectStore(financialEventStore).put({
        id: "legacy-event-37",
        type: "operating_expense_cash",
        currency: "JOD",
        amountMinor: 12_000,
        occurredOn: "2026-05-05",
        recordedAt: "2026-05-05T09:00:00.000Z",
        idempotencyKey: "legacy-key-37",
        note: "حدث ما قبل القروض المستلمة",
        counterparty: null,
        relatedEventId: null,
        expenseContext: {
          relationship: "project",
          behavior: "fixed",
          purpose: "period",
          knowledge: "known",
        },
        correctionType: null,
        correctionOfEventId: null,
        correctionReason: null,
        cashDeltaMinor: -12_000,
        payableDeltaMinor: 0,
        ownerCapitalDeltaMinor: 0,
        operatingExpenseDeltaMinor: 12_000,
      });
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
    request.onerror = () => reject(request.error);
  });
}

function principalEvent(loanId: string, amountMinor: number, eventId: string) {
  return createFinancialEvent({
    id: eventId,
    type: "loan_received_cash",
    amountMinor,
    occurredOn: "2026-07-01",
    recordedAt: NOW,
    idempotencyKey: `${loanId}:principal`,
    note: "قرض مستلم",
    counterparty: "سامي",
    loanContext: { loanId, borrower: "سامي", lender: "سامي" },
  });
}

function makeLoan(loanId: string, principalMinor: number, eventId: string) {
  return createReceivedLoanRecord({
    id: loanId,
    lenderName: "سامي",
    lenderType: "person",
    principalMinor,
    receivedOn: "2026-07-01",
    dueOn: null,
    note: null,
    walletId: null,
    principalEventId: eventId,
    operationKey: `${loanId}:create`,
    createdAt: NOW,
  });
}

describe("FIN-001 — ترقية المخطط ٣٧→٣٨ بإنشاء محروس فقط (WS-178)", () => {
  afterEach(async () => {
    await clearDatabase();
  });

  it("قاعدة ٣٧ تُفتح على ٣٨: مخزن القروض المستلمة فارغ والسجل القديم سليم بلا ترحيل", async () => {
    await clearDatabase();
    await openLegacySchema37();
    const store = new IndexedDbLocalStore();
    const loans = await store.listReceivedLoans();
    expect(loans.ok && loans.value).toHaveLength(0);
    const events = await store.listFinancialEvents();
    expect(events.ok && events.value).toHaveLength(1);
    expect(events.ok && events.value[0]?.id).toBe("legacy-event-37");
    expect(events.ok && events.value[0]?.amountMinor).toBe(12_000);
    /* الكتابة بعد الترقية تعمل والمخزن الجديد يستقبل طبيعيًا. */
    const event = principalEvent("rloan-upgrade", 20_000, "event-upgrade");
    const loan = makeLoan("rloan-upgrade", 20_000, "event-upgrade");
    const created = await store.commitReceivedLoanRecord(loan, event);
    expect(created.ok).toBe(true);
    const loansAfter = await store.listReceivedLoans();
    expect(loansAfter.ok && loansAfter.value).toHaveLength(1);
    const eventsAfter = await store.listFinancialEvents();
    expect(eventsAfter.ok && eventsAfter.value).toHaveLength(2);
  });

  it("مخزن القروض المستلمة موجود بالاسم الكنوني بعد الترقية (بيان نقاط الاتصال)", async () => {
    await clearDatabase();
    await openLegacySchema37();
    const store = new IndexedDbLocalStore();
    await store.listReceivedLoans();
    const names = await new Promise<string[]>((resolve, reject) => {
      const request = indexedDB.open(databaseName);
      request.onsuccess = () => {
        const database = request.result;
        resolve(Array.from(database.objectStoreNames));
        database.close();
      };
      request.onerror = () => reject(request.error);
    });
    expect(names).toContain(receivedLoanStore);
    expect(names).toContain("received-loans");
  });
});

describe("FIN-001 — عقد الالتزام المحروس للقروض المستلمة في IndexedDB (AV-02)", () => {
  afterEach(async () => {
    await clearDatabase();
  });

  it("الالتزام الذرّي (سجل+حدث) ثم القراءة ذهابًا وإيابًا كما كُتبت", async () => {
    await clearDatabase();
    const store = new IndexedDbLocalStore();
    const event = principalEvent("rloan-1", 20_000, "event-rloan-1");
    const loan = makeLoan("rloan-1", 20_000, "event-rloan-1");
    const committed = await store.commitReceivedLoanRecord(loan, event);
    expect(committed.ok).toBe(true);
    if (!committed.ok) throw new Error(committed.message);
    expect(committed.value.reused).toBe(false);
    const read = await store.getReceivedLoan("rloan-1");
    expect(read.ok && read.value?.id).toBe("rloan-1");
    expect(read.ok && read.value?.lenderType).toBe("person");
    expect(read.ok && read.value?.principalEventId).toBe("event-rloan-1");
    const events = await store.listFinancialEvents();
    expect(events.ok && events.value.some(stored => stored.id === "event-rloan-1")).toBe(true);
  });

  it("الحتمية: إعادة نفس الالتزام إعادة استخدام بلا حدث ثانٍ ولا كتابة", async () => {
    await clearDatabase();
    const store = new IndexedDbLocalStore();
    const event = principalEvent("rloan-2", 15_000, "event-rloan-2");
    const loan = makeLoan("rloan-2", 15_000, "event-rloan-2");
    await store.commitReceivedLoanRecord(loan, event);
    const replay = await store.commitReceivedLoanRecord(loan, event);
    expect(replay.ok).toBe(true);
    if (!replay.ok) throw new Error(replay.message);
    expect(replay.value.reused).toBe(true);
    const events = await store.listFinancialEvents();
    expect(events.ok && events.value.filter(stored => stored.type === "loan_received_cash")).toHaveLength(1);
    const loans = await store.listReceivedLoans();
    expect(loans.ok && loans.value).toHaveLength(1);
    /* إعادة التشغيل بمفتاح الحتمية نفسه وحدث جديد: إعادة استخدام أيضًا. */
    const replayByKey = await store.commitReceivedLoanRecord(loan, {
      ...event,
      id: "event-rloan-2-replay",
    });
    expect(replayByKey.ok && replayByKey.value.reused).toBe(true);
  });

  it("تراجع دفعة: الحدث المعاكس والسجل المعلَّم في التزام واحد، والدفعات المتزامنة تُرفض", async () => {
    await clearDatabase();
    const store = new IndexedDbLocalStore();
    const principal = principalEvent("rloan-3", 20_000, "event-rloan-3");
    const loan = makeLoan("rloan-3", 20_000, "event-rloan-3");
    await store.commitReceivedLoanRecord(loan, principal);
    const repaymentEvent = createFinancialEvent({
      id: "event-rrep-1",
      type: "loan_received_repayment_cash",
      amountMinor: 5_000,
      occurredOn: "2026-08-01",
      recordedAt: NOW,
      idempotencyKey: "rloan-3:repayment:rrep-1",
      note: "دفعة أولى",
      counterparty: "سامي",
      loanContext: { loanId: "rloan-3", borrower: "سامي", lender: "سامي" },
    });
    const repaid = addReceivedLoanRepayment(
      loan,
      {
        repaymentId: "rrep-1",
        amountMinor: 5_000,
        date: "2026-08-01",
        note: "دفعة أولى",
        eventId: "event-rrep-1",
      },
      NOW,
    );
    const committed = await store.commitReceivedLoanRecord(repaid, repaymentEvent);
    expect(committed.ok).toBe(true);
    /* دفعة متزامنة ثانية على السجل القديم (AV-02): رفض صادر بلا كتابة. */
    const concurrentEvent = createFinancialEvent({
      id: "event-rrep-2",
      type: "loan_received_repayment_cash",
      amountMinor: 3_000,
      occurredOn: "2026-08-01",
      recordedAt: NOW,
      idempotencyKey: "rloan-3:repayment:rrep-2",
      note: "متزامنة",
      counterparty: "سامي",
      loanContext: { loanId: "rloan-3", borrower: "سامي", lender: "سامي" },
    });
    const concurrent = addReceivedLoanRepayment(
      loan,
      {
        repaymentId: "rrep-2",
        amountMinor: 3_000,
        date: "2026-08-01",
        note: "متزامنة",
        eventId: "event-rrep-2",
      },
      NOW,
    );
    const refused = await store.commitReceivedLoanRecord(concurrent, concurrentEvent);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.code).toBe("storage_stale");
    /* التراجع الموثق عن الدفعة الأولى: حدث معاكس + علامة في التزام واحد. */
    const reversal = createFinancialReversal({
      id: "event-rrep-1-rev",
      sourceEvent: repaymentEvent,
      occurredOn: "2026-08-02",
      recordedAt: NOW,
      idempotencyKey: "rloan-3:repayment-reversal:rrep-1",
      reason: "خرجت من المحفظة الخطأ",
    });
    const reversed = reverseReceivedLoanRepayment(
      repaid,
      "rrep-1",
      "خرجت من المحفظة الخطأ",
      NOW,
      "event-rrep-1-rev",
    );
    const reversalCommit = await store.commitReceivedLoanRecord(reversed, reversal);
    expect(reversalCommit.ok).toBe(true);
    const stored = await store.getReceivedLoan("rloan-3");
    expect(stored.ok && stored.value?.repayments).toHaveLength(1);
    expect(stored.ok && stored.value?.repayments[0]?.reversal?.reversalEventId).toBe("event-rrep-1-rev");
    const events = await store.listFinancialEvents();
    expect(events.ok && events.value.filter(stored => stored.correctionType === "reverse").length).toBe(1);
  });

  it("التصحيح: العكس والبديل والسجل المصحح في التزام واحد، وإعادته إعادة استخدام", async () => {
    await clearDatabase();
    const store = new IndexedDbLocalStore();
    const principal = principalEvent("rloan-4", 20_000, "event-rloan-4");
    const loan = makeLoan("rloan-4", 20_000, "event-rloan-4");
    await store.commitReceivedLoanRecord(loan, principal);
    const reversal = createFinancialReversal({
      id: "event-rloan-4-rev",
      sourceEvent: principal,
      occurredOn: "2026-07-02",
      recordedAt: NOW,
      idempotencyKey: "rloan-4:principal-reversal:1",
      reason: "المبلغ الصحيح أعلى",
    });
    const replacement = createFinancialEvent({
      id: "event-rloan-4-new",
      type: "loan_received_cash",
      amountMinor: 25_000,
      occurredOn: "2026-07-01",
      recordedAt: NOW,
      idempotencyKey: "rloan-4:principal-replacement:1",
      note: "تصحيح قرض مستلم: المبلغ الصحيح أعلى",
      counterparty: "سامي",
      loanContext: { loanId: "rloan-4", borrower: "سامي", lender: "سامي" },
    });
    const corrected = {
      ...loan,
      principalMinor: 25_000,
      principalEventId: "event-rloan-4-new",
      corrections: [{ reason: "المبلغ الصحيح أعلى", at: NOW }],
      updatedAt: NOW,
    };
    const committed = await store.commitReceivedLoanCorrection(corrected, reversal, replacement);
    expect(committed.ok).toBe(true);
    if (!committed.ok) throw new Error(committed.message);
    expect(committed.value.reused).toBe(false);
    const stored = await store.getReceivedLoan("rloan-4");
    expect(stored.ok && stored.value?.principalMinor).toBe(25_000);
    expect(stored.ok && stored.value?.principalEventId).toBe("event-rloan-4-new");
    expect(stored.ok && stored.value?.corrections).toHaveLength(1);
    const events = await store.listFinancialEvents();
    expect(events.ok && events.value).toHaveLength(3);
    /* إعادة تشغيل التصحيح كاملًا: إعادة استخدام لا كتابة ثانية. */
    const replay = await store.commitReceivedLoanCorrection(corrected, reversal, replacement);
    expect(replay.ok && replay.value.reused).toBe(true);
    const eventsAfterReplay = await store.listFinancialEvents();
    expect(eventsAfterReplay.ok && eventsAfterReplay.value).toHaveLength(3);
  });

  it("readSnapshot وreplaceSnapshot تحملان عائلة القروض المستلمة كما كُتبت", async () => {
    await clearDatabase();
    const store = new IndexedDbLocalStore();
    const event = principalEvent("rloan-5", 30_000, "event-rloan-5");
    const loan = makeLoan("rloan-5", 30_000, "event-rloan-5");
    await store.commitReceivedLoanRecord(loan, event);
    const snapshot = await store.readSnapshot();
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) throw new Error(snapshot.message);
    expect(snapshot.value.receivedLoans).toHaveLength(1);
    expect(snapshot.value.receivedLoans[0]?.id).toBe("rloan-5");
    const replaced = await store.replaceSnapshot({ ...snapshot.value, receivedLoans: [] });
    expect(replaced.ok).toBe(true);
    const loansAfter = await store.listReceivedLoans();
    expect(loansAfter.ok && loansAfter.value).toHaveLength(0);
    const eventsAfter = await store.listFinancialEvents();
    /* الاستبدال الكامل للقروض المستلمة لا يمس الأحداث المالية — مصدر الحقيقة. */
    expect(eventsAfter.ok && eventsAfter.value.length).toBeGreaterThan(0);
  });
});
