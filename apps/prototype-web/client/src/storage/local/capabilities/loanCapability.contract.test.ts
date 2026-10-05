/**
 * Wave C (بطاقة ADR-015 مجموعة 3): عقد قدرة «القروض والقروض المستلمة
 * والعقود المصنفة» — الاستخراج الثالث بترتيب ADR-15. ثلاث طبقات إثبات،
 * بلا أي تعديل إنتاج:
 *
 *  1) العضوية: المحوّلان يكشفان طرق القدرة العشر كلها كدوال — والقائمة
 *     نفسها محكومة النوع (Pick من الواجهة التوافقية) فلا تزد ولا تنقص
 *     بصمت.
 *  2) السلوك عبر عدسة القدرة: نفس عقود الالتزام المحروس للمحوّلين
 *     (الذاكرة وIndexedDB/fake-indexeddb) — للقروض الصادرة والمستلمة:
 *     الالتزام الذرّي (سجل + حدث معًا) بإعادة استخدام صادقة، والقراءة
 *     المرتبة حرفيًا، والتعارض المتزامن storage_stale بلا كتابة (AV-02)،
 *     وتراجع الدفعة، والتصحيح الذرّي (عكس + بديل + سجل) بإعادة تشغيل؛
 *     ولتصنيف العربون المحتفظ: الالتزام وإعادة استخدامه وتصحيحه الذرّي.
 *     السيناريو يستقبل النوع الضيق `LoanStore` حصرًا — أي ما يستطيع
 *     مستهلك القدرة ملاحظته، لا أكثر؛ الآثار العابرة للحدود (اللقطة
 *     والاستعادة وتغطية أحداث التسوية الكاملة) تبقى محروسة في مصفوفة
 *     المطابقة الكاملة (adapterConformance.group10 / receivedLoan).
 *  3) الأنواع: tsc على ملف المراسي زمن التشغيل بامتداد tsconfig الـapp
 *     نفسه (نمط مراسي Wave 3B/4C) — إثبات أن المحوّلين والواجهة
 *     التوافقية ما زالوا يحققون القدرة.
 */
import "fake-indexeddb/auto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { addLoanRepayment, createLoanRecord, reverseLoanRepayment } from "@micro-domain/loan/index.js";
import type { LoanRecord } from "@micro-domain/loan/index.js";
import {
  addReceivedLoanRepayment,
  createReceivedLoanRecord,
  reverseReceivedLoanRepayment,
} from "@micro-domain/received-loan/index.js";
import type { ReceivedLoanRecord } from "@micro-domain/received-loan/index.js";
import { createFinancialEvent, createFinancialReversal } from "@micro-domain/financial-event/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import {
  calculateCostSnapshot,
  cancelOrder,
  classifyRetainedDeposit,
  collectDeposit,
  createCraftOrder,
  reclassifyRetainedDeposit,
  settleDepositRetain,
} from "@micro-domain/craft-order/index.js";
import { IndexedDbLocalStore } from "../IndexedDbLocalStore";
import { MemoryLocalStore } from "../MemoryLocalStore";
import type { StoredCraftOrder } from "../types";
import { loanStoreMethods, type LoanStore } from "./loanStore";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../../../../");
const ANCHORS_FILE = path.join(HERE, "loanCapabilityAnchors.ts");
const APP_TSCONFIG = path.join(REPO_ROOT, "apps", "prototype-web", "tsconfig.json");

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const AT = "2026-10-04T08:00:00.000Z";

/* ─── مصانع القروض الصادرة ─── */

function loanPrincipalEvent(loanId: string, amountMinor: number, eventId: string): FinancialEvent {
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

function loanRepaymentEvent(
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

/* ─── مصانع القروض المستلمة ─── */

function receivedPrincipalEvent(loanId: string, amountMinor: number, eventId: string): FinancialEvent {
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

function receivedRepaymentEvent(
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
    note: "دفعة",
    counterparty: "سامي",
    loanContext: { loanId, borrower: "سامي", lender: "سامي" },
  });
}

/* ─── مصانع العربون المحتفظ (نمط مصفوفة المطابقة الكاملة) ─── */

function depositSnapshot(id: string) {
  return calculateCostSnapshot(id, {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: AT,
    source: "draft",
  });
}

function retainedDepositStored(id: string): StoredCraftOrder {
  let order = createCraftOrder({
    id,
    customerName: "سارة",
    itemName: "صندوق",
    specifications: "نقش",
    quantity: 1,
    agreedPriceMinor: 5000,
    costSnapshot: depositSnapshot(`snap-${id}`),
    createdAt: AT,
  });
  order = collectDeposit(order, 2000, `${id}:dep`, AT);
  order = cancelOrder(order, "إلغاء", `${id}:cancel`, AT);
  order = settleDepositRetain(order, 2000, "احتفاظ", `${id}:retain`, AT);
  return {
    id,
    order,
    catalogItemId: null,
    deliveryDate: "2026-09-12",
    agreementSource: null,
    createdAt: AT,
    updatedAt: AT,
  };
}

/* ─── السيناريو: عدسة مستهلك القدرة الضيقة حصرًا ─── */

async function runLoanCapabilityScenario(store: LoanStore) {
  /* ═══ القسم الأول: القروض الصادرة ═══ */

  /* ١) الالتزام الذرّي: الإنشاء ثم إعادة إرسال نفس (السجل، الحدث) = إعادة استخدام. */
  const loanEvent = loanPrincipalEvent("loan-cap-a", 15_000, "event-loan-cap-a");
  const loan = makeLoan("loan-cap-a", 15_000, "event-loan-cap-a");
  const created = await store.commitLoanRecord(loan, loanEvent);
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error(created.message);
  expect(created.value.reused).toBe(false);
  const replayed = await store.commitLoanRecord(loan, loanEvent);
  expect(replayed.ok).toBe(true);
  if (!replayed.ok) throw new Error(replayed.message);
  expect(replayed.value.reused).toBe(true);

  /* ٢) القراءة: السجل كما كُتب حرفيًا؛ والغائب null. */
  const laterLoanEvent = loanPrincipalEvent("loan-cap-b", 5_000, "event-loan-cap-b");
  const laterLoan = { ...makeLoan("loan-cap-b", 5_000, "event-loan-cap-b"), loanDate: "2026-08-01" };
  const laterSaved = await store.commitLoanRecord(laterLoan, laterLoanEvent);
  expect(laterSaved.ok).toBe(true);
  const loanList = await store.listLoans();
  expect(loanList.ok && loanList.value.map(record => record.id)).toEqual(["loan-cap-a", "loan-cap-b"]);
  const loanRead = await store.getLoan("loan-cap-a");
  expect(loanRead.ok && loanRead.value).toEqual(loan);
  const loanMissing = await store.getLoan("loan-cap-void");
  expect(loanMissing.ok && loanMissing.value).toBeNull();

  /* ٣) التعارض المتزامن (AV-02): دفعة على قاعدة قديمة — رفض صادر بلا كتابة. */
  const repaymentEvent = loanRepaymentEvent("loan-cap-a", "rep-a1", "event-rep-a1", 5_000);
  const concurrentEvent = loanRepaymentEvent("loan-cap-a", "rep-a2", "event-rep-a2", 4_000);
  const withFirst = addLoanRepayment(
    loan,
    { repaymentId: "rep-a1", amountMinor: 5_000, date: "2026-08-15", eventId: "event-rep-a1" },
    AT,
  );
  const committed = await store.commitLoanRecord(withFirst, repaymentEvent);
  expect(committed.ok).toBe(true);
  const withSecond = addLoanRepayment(
    loan,
    { repaymentId: "rep-a2", amountMinor: 4_000, date: "2026-08-15", eventId: "event-rep-a2" },
    AT,
  );
  const conflict = await store.commitLoanRecord(withSecond, concurrentEvent);
  expect(conflict.ok).toBe(false);
  if (!conflict.ok) expect(conflict.code).toBe("storage_stale");
  const afterConflict = await store.getLoan("loan-cap-a");
  expect(afterConflict.ok && afterConflict.value?.repayments).toHaveLength(1);
  expect(afterConflict.ok && afterConflict.value?.repayments[0]?.eventId).toBe("event-rep-a1");

  /* ٤) تراجع الدفعة: الحدث المعاكس والسجل المعلَّم في التزام واحد. */
  const repaymentReversal = createFinancialReversal({
    id: "event-rep-a1-rev",
    sourceEvent: repaymentEvent,
    occurredOn: "2026-08-16",
    recordedAt: AT,
    idempotencyKey: "loan-cap-a:repayment-reversal:rep-a1",
    reason: "خطأ محفظة",
  });
  const reversedLoan = reverseLoanRepayment(withFirst, "rep-a1", "خطأ محفظة", AT, "event-rep-a1-rev");
  const reversalCommit = await store.commitLoanRecord(reversedLoan, repaymentReversal);
  expect(reversalCommit.ok).toBe(true);
  const storedReversed = await store.getLoan("loan-cap-a");
  expect(storedReversed.ok && storedReversed.value?.repayments[0]?.reversal?.reversalEventId).toBe(
    "event-rep-a1-rev",
  );

  /* ٥) التصحيح الذرّي (عكس + بديل + سجل) ثم إعادة تشغيله = إعادة استخدام. */
  const loanReversal = createFinancialReversal({
    id: "event-loan-cap-a-rev",
    sourceEvent: loanEvent,
    occurredOn: "2026-07-02",
    recordedAt: AT,
    idempotencyKey: "loan-cap-a:principal-reversal:1",
    reason: "المبلغ الصحيح أعلى",
  });
  const loanReplacement = createFinancialEvent({
    id: "event-loan-cap-a-new",
    type: "loan_outgoing_cash",
    amountMinor: 17_000,
    occurredOn: "2026-07-01",
    recordedAt: AT,
    idempotencyKey: "loan-cap-a:principal-replacement:1",
    note: "تصحيح قرض صادر",
    counterparty: "أحمد",
    loanContext: { loanId: "loan-cap-a", borrower: "أحمد" },
  });
  const correctedLoan: LoanRecord = {
    ...reversedLoan,
    principalMinor: 17_000,
    principalEventId: "event-loan-cap-a-new",
    corrections: [{ reason: "المبلغ الصحيح أعلى", at: AT }],
    updatedAt: AT,
  };
  const loanCorrection = await store.commitLoanCorrection(correctedLoan, loanReversal, loanReplacement);
  expect(loanCorrection.ok).toBe(true);
  if (!loanCorrection.ok) throw new Error(loanCorrection.message);
  expect(loanCorrection.value.reused).toBe(false);
  const loanCorrectionReplay = await store.commitLoanCorrection(correctedLoan, loanReversal, loanReplacement);
  expect(loanCorrectionReplay.ok && loanCorrectionReplay.value.reused).toBe(true);
  const storedCorrectedLoan = await store.getLoan("loan-cap-a");
  expect(storedCorrectedLoan.ok && storedCorrectedLoan.value?.principalMinor).toBe(17_000);

  /* ═══ القسم الثاني: القروض المستلمة ═══ */

  /* ٦) الالتزام الذرّي مع إعادة الاستخدام الصادقة. */
  const receivedEvent = receivedPrincipalEvent("rloan-cap-a", 20_000, "event-rloan-cap-a");
  const receivedLoan = makeReceivedLoan("rloan-cap-a", 20_000, "event-rloan-cap-a");
  const receivedCreated = await store.commitReceivedLoanRecord(receivedLoan, receivedEvent);
  expect(receivedCreated.ok).toBe(true);
  if (!receivedCreated.ok) throw new Error(receivedCreated.message);
  expect(receivedCreated.value.reused).toBe(false);
  const receivedReplay = await store.commitReceivedLoanRecord(receivedLoan, receivedEvent);
  expect(receivedReplay.ok && receivedReplay.value.reused).toBe(true);

  /* ٧) القراءة: مرتبة زمنيًا (تاريخ القبض ثم المعرف)؛ والسجل كما كُتب. */
  const laterReceivedEvent = receivedPrincipalEvent("rloan-cap-b", 5_000, "event-rloan-cap-b");
  const laterReceivedLoan = {
    ...makeReceivedLoan("rloan-cap-b", 5_000, "event-rloan-cap-b"),
    receivedOn: "2026-08-01",
  };
  const laterReceivedSaved = await store.commitReceivedLoanRecord(laterReceivedLoan, laterReceivedEvent);
  expect(laterReceivedSaved.ok).toBe(true);
  const receivedList = await store.listReceivedLoans();
  expect(receivedList.ok && receivedList.value.map(record => record.id)).toEqual([
    "rloan-cap-a",
    "rloan-cap-b",
  ]);
  const receivedRead = await store.getReceivedLoan("rloan-cap-a");
  expect(receivedRead.ok && receivedRead.value).toEqual(receivedLoan);
  const receivedMissing = await store.getReceivedLoan("rloan-cap-void");
  expect(receivedMissing.ok && receivedMissing.value).toBeNull();

  /* ٨) التعارض المتزامن (AV-02) — نفس عهدة الصادرة. */
  const receivedRepayment = receivedRepaymentEvent("rloan-cap-a", "rrep-a1", "event-rrep-a1", 8_000);
  const receivedConcurrent = receivedRepaymentEvent("rloan-cap-a", "rrep-a2", "event-rrep-a2", 4_000);
  const receivedWithFirst = addReceivedLoanRepayment(
    receivedLoan,
    { repaymentId: "rrep-a1", amountMinor: 8_000, date: "2026-08-15", eventId: "event-rrep-a1" },
    AT,
  );
  const receivedCommitted = await store.commitReceivedLoanRecord(receivedWithFirst, receivedRepayment);
  expect(receivedCommitted.ok).toBe(true);
  const receivedWithSecond = addReceivedLoanRepayment(
    receivedLoan,
    { repaymentId: "rrep-a2", amountMinor: 4_000, date: "2026-08-15", eventId: "event-rrep-a2" },
    AT,
  );
  const receivedConflict = await store.commitReceivedLoanRecord(receivedWithSecond, receivedConcurrent);
  expect(receivedConflict.ok).toBe(false);
  if (!receivedConflict.ok) expect(receivedConflict.code).toBe("storage_stale");
  const receivedAfterConflict = await store.getReceivedLoan("rloan-cap-a");
  expect(receivedAfterConflict.ok && receivedAfterConflict.value?.repayments).toHaveLength(1);

  /* ٩) تراجع الدفعة المستلمة في التزام واحد. */
  const receivedReversal = createFinancialReversal({
    id: "event-rrep-a1-rev",
    sourceEvent: receivedRepayment,
    occurredOn: "2026-08-16",
    recordedAt: AT,
    idempotencyKey: "rloan-cap-a:repayment-reversal:rrep-a1",
    reason: "خطأ محفظة",
  });
  const receivedReversed = reverseReceivedLoanRepayment(
    receivedWithFirst,
    "rrep-a1",
    "خطأ محفظة",
    AT,
    "event-rrep-a1-rev",
  );
  const receivedReversalCommit = await store.commitReceivedLoanRecord(receivedReversed, receivedReversal);
  expect(receivedReversalCommit.ok).toBe(true);
  const storedReceivedReversed = await store.getReceivedLoan("rloan-cap-a");
  expect(
    storedReceivedReversed.ok && storedReceivedReversed.value?.repayments[0]?.reversal?.reversalEventId,
  ).toBe("event-rrep-a1-rev");

  /* ١٠) التصحيح الذرّي ثم إعادة تشغيله = إعادة استخدام. */
  const receivedPrincipalReversal = createFinancialReversal({
    id: "event-rloan-cap-a-rev",
    sourceEvent: receivedEvent,
    occurredOn: "2026-07-02",
    recordedAt: AT,
    idempotencyKey: "rloan-cap-a:principal-reversal:1",
    reason: "المبلغ الصحيح أعلى",
  });
  const receivedReplacement = createFinancialEvent({
    id: "event-rloan-cap-a-new",
    type: "loan_received_cash",
    amountMinor: 22_000,
    occurredOn: "2026-07-01",
    recordedAt: AT,
    idempotencyKey: "rloan-cap-a:principal-replacement:1",
    note: "تصحيح قرض مستلم",
    counterparty: "سامي",
    loanContext: { loanId: "rloan-cap-a", borrower: "سامي", lender: "سامي" },
  });
  const correctedReceived: ReceivedLoanRecord = {
    ...receivedReversed,
    principalMinor: 22_000,
    principalEventId: "event-rloan-cap-a-new",
    corrections: [{ reason: "المبلغ الصحيح أعلى", at: AT }],
    updatedAt: AT,
  };
  const receivedCorrection = await store.commitReceivedLoanCorrection(
    correctedReceived,
    receivedPrincipalReversal,
    receivedReplacement,
  );
  expect(receivedCorrection.ok).toBe(true);
  if (!receivedCorrection.ok) throw new Error(receivedCorrection.message);
  expect(receivedCorrection.value.reused).toBe(false);
  const receivedCorrectionReplay = await store.commitReceivedLoanCorrection(
    correctedReceived,
    receivedPrincipalReversal,
    receivedReplacement,
  );
  expect(receivedCorrectionReplay.ok && receivedCorrectionReplay.value.reused).toBe(true);
  const storedCorrectedReceived = await store.getReceivedLoan("rloan-cap-a");
  expect(storedCorrectedReceived.ok && storedCorrectedReceived.value?.principalMinor).toBe(22_000);

  /* ═══ القسم الثالث: تصنيف العربون المحتفظ ═══ */

  /* ١١) التصنيف: الطلب المصنف والحدث في التزام واحد؛ إعادة التشغيل إعادة استخدام. */
  const retained = retainedDepositStored("order-deposit-cap");
  const classificationEvent = createFinancialEvent({
    id: "event-deposit-classify",
    type: "deposit_retained_revenue",
    amountMinor: 2_000,
    occurredOn: "2026-09-20",
    recordedAt: AT,
    idempotencyKey: "order-deposit-cap:deposit-classify:1",
    note: "تصنيف عربون محتفظ به (إيراد مشروع): تعويض الإلغاء",
    counterparty: "سارة",
    depositContext: { orderId: "order-deposit-cap" },
  });
  const classifiedOrder = classifyRetainedDeposit(
    retained.order,
    "revenue",
    "تعويض الإلغاء",
    "order-deposit-cap:classify:1",
    AT,
  );
  const classified: StoredCraftOrder = { ...retained, order: classifiedOrder, updatedAt: AT };
  const classificationCommit = await store.commitDepositClassification(classified, classificationEvent);
  expect(classificationCommit.ok).toBe(true);
  if (!classificationCommit.ok) throw new Error(classificationCommit.message);
  expect(classificationCommit.value.reused).toBe(false);
  const classificationReplay = await store.commitDepositClassification(classified, classificationEvent);
  expect(classificationReplay.ok && classificationReplay.value.reused).toBe(true);

  /* ١٢) تصحيح التصنيف: التراجع والبديل والطلب المعاد تصنيفه معًا؛ ثم إعادة
   *     التشغيل إعادة استخدام. */
  const classificationReversal = createFinancialReversal({
    id: "event-deposit-classify-rev",
    sourceEvent: classificationEvent,
    occurredOn: "2026-09-21",
    recordedAt: AT,
    idempotencyKey: "order-deposit-cap:deposit-reclassify-reversal:1",
    reason: "إعادة تصنيف",
  });
  const classificationReplacement = createFinancialEvent({
    id: "event-deposit-classify-new",
    type: "deposit_retained_owner",
    amountMinor: 2_000,
    occurredOn: "2026-09-21",
    recordedAt: AT,
    idempotencyKey: "order-deposit-cap:deposit-reclassify-replacement:1",
    note: "تصحيح تصنيف عربون محتفظ به (مال مالك)",
    counterparty: "سارة",
    depositContext: { orderId: "order-deposit-cap" },
  });
  const reclassifiedOrder = reclassifyRetainedDeposit(classifiedOrder, {
    fromMeaning: "revenue",
    fromAmountMinor: 2_000,
    toMeaning: "owner",
    toAmountMinor: 2_000,
    reason: "إعادة تصنيف",
    idempotencyKey: "order-deposit-cap:reclassify:1",
    createdAt: AT,
  });
  const reclassified: StoredCraftOrder = { ...classified, order: reclassifiedOrder, updatedAt: AT };
  const reclassifyCommit = await store.commitDepositClassificationCorrection(
    reclassified,
    classificationReversal,
    classificationReplacement,
  );
  expect(reclassifyCommit.ok).toBe(true);
  if (!reclassifyCommit.ok) throw new Error(reclassifyCommit.message);
  expect(reclassifyCommit.value.reused).toBe(false);
  const reclassifyReplay = await store.commitDepositClassificationCorrection(
    reclassified,
    classificationReversal,
    classificationReplacement,
  );
  expect(reclassifyReplay.ok && reclassifyReplay.value.reused).toBe(true);
}

describe("Wave C — قدرة القروض (ADR-015 مجموعة 3): العضوية", () => {
  it("قائمة الطرق هي نطاق المجموعة بالضبط: 10 أسماء فريدة", () => {
    expect(loanStoreMethods).toHaveLength(10);
    expect(new Set(loanStoreMethods).size).toBe(10);
  });

  for (const [label, makeStore] of [
    ["MemoryLocalStore", () => new MemoryLocalStore()],
    ["IndexedDbLocalStore", () => new IndexedDbLocalStore()],
  ] as const) {
    it(`${label} يكشف كل طريقة قدرة كدالة`, () => {
      const store = makeStore();
      for (const method of loanStoreMethods) {
        expect(
          typeof (store as unknown as Record<string, unknown>)[method],
          `${label}: طريقة القدرة مفقودة: ${method}`,
        ).toBe("function");
      }
    });
  }
});

describe("Wave C — قدرة القروض: العقود السلوكية عبر العدسة الضيقة", () => {
  afterEach(async () => {
    await clearDatabase();
  });

  it("الذاكرة: عقد القدرة كاملًا (صادرة + مستلمة + تصنيف عربون)", async () => {
    await runLoanCapabilityScenario(new MemoryLocalStore());
  });

  it("IndexedDB (fake-indexeddb): عقد القدرة نفسه", async () => {
    await clearDatabase();
    try {
      await runLoanCapabilityScenario(new IndexedDbLocalStore());
    } finally {
      await clearDatabase();
    }
  });
});

describe("Wave C — قدرة القروض: طبقة الأنواع", () => {
  it(
    "المحوّلان والواجهة التوافقية ما زالوا يحققون القدرة (tsc على ملف المراسي)",
    { timeout: 120_000 },
    () => {
      /* ملفات الاختبار مستثناة من فحص أنواع الـapp — لذا يُفرض هنا فحص المراسي
       * وحدها بامتداد tsconfig الـapp نفسه (نمط مراسي Wave 3B/4C). أي كسر
       * للتحقيق (توقيع/إسقاط implements/انحراف الواجهة) يفشل هنا فورًا. */
      const tmp = mkdtempSync(path.join(tmpdir(), "micro-loan-capability-"));
      try {
        const tmpConfig = path.join(tmp, "tsconfig.capability.json");
        writeFileSync(
          tmpConfig,
          JSON.stringify({
            extends: APP_TSCONFIG,
            include: [ANCHORS_FILE],
            exclude: [],
            compilerOptions: { types: [] },
          }),
          "utf8",
        );
        const tscEntry = path.join(REPO_ROOT, "node_modules", "typescript", "bin", "tsc");
        execFileSync(process.execPath, [tscEntry, "--noEmit", "--project", tmpConfig], {
          cwd: REPO_ROOT,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
      expect(true).toBe(true);
    },
  );
});
