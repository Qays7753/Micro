import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { createFinancialEvent, createFinancialReversal } from "@micro-domain/financial-event/index.js";
import {
  addReceivedLoanRepayment,
  createReceivedLoanRecord,
  reverseReceivedLoanRepayment,
} from "@micro-domain/received-loan/index.js";
import type { ReceivedLoanRecord } from "@micro-domain/received-loan/index.js";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { MemoryLocalStore } from "./MemoryLocalStore";
import type { PrototypeLocalStore } from "./types";

/* FIN-001 (WS-178 — Wave 6): مطابقة المحوّلين على عائلة القروض المستلمة —
 * نفس عقد الالتزام المحروس (الحتمية/التعارض الصادر/التراجع/التصحيح الذرّي)
 * ونفس اللقطة/الاستعادة؛ لا انفصام سلوكي بين بيئة الاختبار والبيئة الحية
 * (نمط adapterConformance.expenseBudget / recurringExpense). */

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const AT = "2026-09-23T08:00:00.000Z";

function principalEvent(loanId: string, amountMinor: number, eventId: string) {
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

function makeLoan(loanId: string, amountMinor: number, eventId: string, receivedOn = "2026-07-01") {
  return createReceivedLoanRecord({
    id: loanId,
    lenderName: "سامي",
    lenderType: "person",
    principalMinor: amountMinor,
    receivedOn,
    dueOn: null,
    note: null,
    walletId: null,
    principalEventId: eventId,
    operationKey: `${loanId}:create`,
    createdAt: AT,
  });
}

async function runConformanceScenarios(store: PrototypeLocalStore) {
  /* ١) الالتزام الذرّي: الإنشاء ثم إعادة إرسال نفس (السجل، الحدث) = إعادة استخدام. */
  const event = principalEvent("rloan-a", 20_000, "event-a");
  const loan = makeLoan("rloan-a", 20_000, "event-a");
  const created = await store.commitReceivedLoanRecord(loan, event);
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error(created.message);
  expect(created.value.reused).toBe(false);
  const replayed = await store.commitReceivedLoanRecord(loan, event);
  expect(replayed.ok).toBe(true);
  if (!replayed.ok) throw new Error(replayed.message);
  expect(replayed.value.reused).toBe(true);

  /* ٢) القراءة: مرتبة زمنيًا (تاريخ القبض ثم المعرف)، والسجل كما كُتب حرفيًا. */
  const laterEvent = principalEvent("rloan-b", 5_000, "event-b", "2026-08-01");
  const laterLoan = makeLoan("rloan-b", 5_000, "event-b", "2026-08-01");
  const laterSaved = await store.commitReceivedLoanRecord(laterLoan, laterEvent);
  expect(laterSaved.ok).toBe(true);
  const listed = await store.listReceivedLoans();
  expect(listed.ok && listed.value).toHaveLength(2);
  expect(listed.ok && listed.value.map(record => record.id)).toEqual(["rloan-a", "rloan-b"]);
  const read = await store.getReceivedLoan("rloan-a");
  expect(read.ok && read.value).toEqual(loan);
  const missing = await store.getReceivedLoan("rloan-void");
  expect(missing.ok && missing.value).toBeNull();

  /* ٣) التعارض الصادر (AV-02): دفعة متزامنة على السجل القديم — لا كتابة. */
  const repaymentEvent = createFinancialEvent({
    id: "event-rep-a1",
    type: "loan_received_repayment_cash",
    amountMinor: 8_000,
    occurredOn: "2026-08-15",
    recordedAt: AT,
    idempotencyKey: "rloan-a:repayment:rrep-a1",
    note: "دفعة",
    counterparty: "سامي",
    loanContext: { loanId: "rloan-a", borrower: "سامي", lender: "سامي" },
  });
  const concurrentEvent = createFinancialEvent({
    id: "event-rep-a2",
    type: "loan_received_repayment_cash",
    amountMinor: 4_000,
    occurredOn: "2026-08-15",
    recordedAt: AT,
    idempotencyKey: "rloan-a:repayment:rrep-a2",
    note: "متزامنة",
    counterparty: "سامي",
    loanContext: { loanId: "rloan-a", borrower: "سامي", lender: "سامي" },
  });
  const withFirst = addReceivedLoanRepayment(
    loan,
    { repaymentId: "rrep-a1", amountMinor: 8_000, date: "2026-08-15", eventId: "event-rep-a1" },
    AT,
  );
  const committed = await store.commitReceivedLoanRecord(withFirst, repaymentEvent);
  expect(committed.ok).toBe(true);
  const withSecond = addReceivedLoanRepayment(
    loan,
    { repaymentId: "rrep-a2", amountMinor: 4_000, date: "2026-08-15", eventId: "event-rep-a2" },
    AT,
  );
  const conflict = await store.commitReceivedLoanRecord(withSecond, concurrentEvent);
  expect(conflict.ok).toBe(false);
  if (!conflict.ok) expect(conflict.code).toBe("storage_stale");
  const afterConflict = await store.getReceivedLoan("rloan-a");
  expect(afterConflict.ok && afterConflict.value?.repayments).toHaveLength(1);
  expect(afterConflict.ok && afterConflict.value?.repayments[0]?.eventId).toBe("event-rep-a1");

  /* ٤) تراجع الدفعة: الحدث المعاكس والسجل المعلَّم في التزام واحد. */
  const reversal = createFinancialReversal({
    id: "event-rep-a1-rev",
    sourceEvent: repaymentEvent,
    occurredOn: "2026-08-16",
    recordedAt: AT,
    idempotencyKey: "rloan-a:repayment-reversal:rrep-a1",
    reason: "خطأ محفظة",
  });
  const reversedRecord = reverseReceivedLoanRepayment(
    withFirst,
    "rrep-a1",
    "خطأ محفظة",
    AT,
    "event-rep-a1-rev",
  );
  const reversalCommit = await store.commitReceivedLoanRecord(reversedRecord, reversal);
  expect(reversalCommit.ok).toBe(true);
  const storedReversed = await store.getReceivedLoan("rloan-a");
  expect(storedReversed.ok && storedReversed.value?.repayments[0]?.reversal?.reversalEventId).toBe(
    "event-rep-a1-rev",
  );

  /* ٥) التصحيح الذرّي (عكس+بديل+سجل) ثم إعادة تشغيله = إعادة استخدام. */
  const principalReversal = createFinancialReversal({
    id: "event-a-rev",
    sourceEvent: event,
    occurredOn: "2026-07-02",
    recordedAt: AT,
    idempotencyKey: "rloan-a:principal-reversal:1",
    reason: "المبلغ الصحيح أعلى",
  });
  const replacement = createFinancialEvent({
    id: "event-a-new",
    type: "loan_received_cash",
    amountMinor: 22_000,
    occurredOn: "2026-07-01",
    recordedAt: AT,
    idempotencyKey: "rloan-a:principal-replacement:1",
    note: "تصحيح قرض مستلم",
    counterparty: "سامي",
    loanContext: { loanId: "rloan-a", borrower: "سامي", lender: "سامي" },
  });
  const corrected: ReceivedLoanRecord = {
    ...reversedRecord,
    principalMinor: 22_000,
    principalEventId: "event-a-new",
    corrections: [{ reason: "المبلغ الصحيح أعلى", at: AT }],
    updatedAt: AT,
  };
  const correctionCommit = await store.commitReceivedLoanCorrection(
    corrected,
    principalReversal,
    replacement,
  );
  expect(correctionCommit.ok).toBe(true);
  if (!correctionCommit.ok) throw new Error(correctionCommit.message);
  expect(correctionCommit.value.reused).toBe(false);
  const replayCorrection = await store.commitReceivedLoanCorrection(
    corrected,
    principalReversal,
    replacement,
  );
  expect(replayCorrection.ok && replayCorrection.value.reused).toBe(true);
  const storedCorrected = await store.getReceivedLoan("rloan-a");
  expect(storedCorrected.ok && storedCorrected.value?.principalMinor).toBe(22_000);

  /* ٦) اللقطة: العائلة داخلها كما كُتبت — والاستعادة ذهابًا وإيابًا. */
  const snapshot = await store.readSnapshot();
  expect(snapshot.ok).toBe(true);
  if (!snapshot.ok) throw new Error(snapshot.message);
  expect(snapshot.value.receivedLoans).toHaveLength(2);
  const backup = structuredClone(snapshot.value);
  const replaced = await store.replaceSnapshot(backup);
  expect(replaced.ok).toBe(true);
  const reread = await store.readSnapshot();
  expect(reread.ok).toBe(true);
  if (!reread.ok) throw new Error(reread.message);
  expect(reread.value.receivedLoans).toEqual(backup.receivedLoans);

  /* ٧) استبدال بقائمة فارغة: الاستعادة تمسح العائلة كاملة لا جزئيًا. */
  const emptied = await store.replaceSnapshot({ ...backup, receivedLoans: [] });
  expect(emptied.ok).toBe(true);
  const afterEmpty = await store.listReceivedLoans();
  expect(afterEmpty.ok && afterEmpty.value).toHaveLength(0);
}

describe("FIN-001 — توائم المحوّلين لعائلة القروض المستلمة (WS-178)", () => {
  afterEach(async () => {
    await clearDatabase();
  });

  it("الذاكرة: نفس عقد الالتزام المحروس والتصحيح الذرّي كاملًا", async () => {
    await runConformanceScenarios(new MemoryLocalStore());
  });

  it("IndexedDB (fake-indexeddb): نفس عقد الالتزام المحروس والتصحيح الذرّي كاملًا", async () => {
    await clearDatabase();
    await runConformanceScenarios(new IndexedDbLocalStore());
  });

  it("لا كتابة إطلاقًا عند الفتح للقراءة فقط — لقطة قبل/بعد متطابقة", async () => {
    const store = new MemoryLocalStore();
    const event = principalEvent("rloan-read-only", 10_000, "event-read-only");
    const loan = makeLoan("rloan-read-only", 10_000, "event-read-only");
    const created = await store.commitReceivedLoanRecord(loan, event);
    expect(created.ok).toBe(true);
    const before = await store.readSnapshot();
    expect(before.ok).toBe(true);
    await store.listReceivedLoans();
    await store.getReceivedLoan("rloan-read-only");
    const after = await store.readSnapshot();
    expect(after.ok).toBe(true);
    if (!before.ok || !after.ok) throw new Error("snapshot read failed");
    expect(after.value).toEqual(before.value);
  });
});

export type __ReceivedLoanShape = ReceivedLoanRecord;
