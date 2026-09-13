import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  createSupplierPurchase,
  recordSupplierPurchasePayment,
  reverseSupplierPurchasePayment,
  updateSupplierPurchase,
} from "@micro-domain/supplier-purchase/index.js";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { MemoryLocalStore } from "./MemoryLocalStore";
import type { PrototypeLocalStore, ScheduleEntry } from "./types";

/* المجموعة ٢ (التحصين الكامل — MED-013): مطابقة المحوّلين (الذاكرة
 * وIndexedDB/fake-indexeddb) على نفس سيناريوهات التزامن والحتمية والذرّية —
 * نفس عقد الالتزام، نفس نتائج الرفض والإعادة والتعارض، لا انفصام سلوكي بين
 * بيئة الاختبار والبيئة الحية. */

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const TS = "2026-09-08T09:00:00.000Z";

function purchaseFixture(id: string, key: string) {
  return createSupplierPurchase({
    id,
    supplierName: "مؤسسة النسيج",
    note: "شراء قماش",
    purchasedOn: "2026-09-07",
    dueOn: null,
    totalMinor: 10000,
    initialPaidMinor: 2000,
    recordedAt: TS,
    idempotencyKey: key,
    materialId: null,
    expectedQuantityMilli: null,
  });
}

function paymentInput(key: string) {
  return {
    id: `payment-${key}`,
    amountMinor: 1500,
    occurredOn: "2026-09-08",
    recordedAt: TS,
    idempotencyKey: key,
    note: "دفعة",
  };
}

function scheduleFixture(id: string, orderId: string, scheduledFor: string): ScheduleEntry {
  return {
    id,
    orderId,
    kind: "delivery",
    scheduledFor,
    scheduledTime: null,
    durationMinutes: null,
    status: "scheduled",
    postponeReason: null,
    events: [
      {
        id: `${id}:created`,
        type: "created",
        idempotencyKey: `${id}:created`,
        createdAt: TS,
        previousScheduledFor: null,
        scheduledFor,
        previousScheduledTime: null,
        scheduledTime: null,
        previousDurationMinutes: null,
        durationMinutes: null,
        reason: null,
      },
    ],
    recurrenceId: null,
    recurrenceIndex: null,
    createdAt: TS,
    updatedAt: TS,
  };
}

function postponedSchedule(base: ScheduleEntry, to: string, key: string): ScheduleEntry {
  const event = {
    id: `${base.id}:postponed:${base.events.length + 1}`,
    type: "postponed" as const,
    idempotencyKey: key,
    createdAt: TS,
    previousScheduledFor: base.scheduledFor,
    scheduledFor: to,
    previousScheduledTime: base.scheduledTime,
    scheduledTime: base.scheduledTime,
    previousDurationMinutes: base.durationMinutes,
    durationMinutes: base.durationMinutes,
    reason: "تأجيل",
  };
  return {
    ...base,
    scheduledFor: to,
    status: "postponed",
    postponeReason: "تأجيل",
    updatedAt: TS,
    events: [...base.events, event],
  };
}

async function listSupplierPurchases(store: PrototypeLocalStore) {
  const result = await store.listSupplierPurchases();
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

async function getSchedule(store: PrototypeLocalStore, id: string) {
  const result = await store.getSchedule(id);
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

async function runConformanceScenarios(store: PrototypeLocalStore): Promise<void> {
  /* ١. الإنشاء والقراءة والتحديث مع الحتمية داخل المعاملة. */
  const purchase = purchaseFixture("purchase-conf-1", "conf-purchase-1");
  const created = await store.commitSupplierPurchase({
    kind: "create",
    purchase,
    idempotencyKey: "conf-purchase-1",
  });
  expect(created.ok).toBe(true);
  if (!created.ok) return;
  expect(created.value.reused).toBe(false);
  const reread = await listSupplierPurchases(store);
  expect(reread.length).toBe(1);
  expect(reread[0]!.id).toBe("purchase-conf-1");

  /* إعادة تشغيل الإنشاء بمفتاح آخر على نفس الهوية: رفض لا كتابة فوقه. */
  const conflictingCreate = await store.commitSupplierPurchase({
    kind: "create",
    purchase: purchaseFixture("purchase-conf-1", "conf-purchase-other"),
    idempotencyKey: "conf-purchase-other",
  });
  expect(conflictingCreate.ok).toBe(false);
  if (!conflictingCreate.ok) expect(conflictingCreate.code).toBe("storage_stale");

  /* ٢. إعادة التشغيل بمفتاح الشراء نفسه (هوية مختلفة): إعادة استخدام. */
  const replayCreate = await store.commitSupplierPurchase({
    kind: "create",
    purchase: purchaseFixture("purchase-conf-2", "conf-purchase-1"),
    idempotencyKey: "conf-purchase-1",
  });
  expect(replayCreate.ok).toBe(true);
  if (replayCreate.ok) expect(replayCreate.value.reused).toBe(true);
  const afterReplay = await listSupplierPurchases(store);
  expect(afterReplay.length).toBe(1);

  /* ٣. الدفعة: نفس المفتاح داخل المعاملة إعادة استخدام؛ مفتاحان متزامنان
   * أحدهما يثبت والآخر storage_stale بلا كتابة جزئية. */
  const withPayment = recordSupplierPurchasePayment(purchase, paymentInput("conf-pay-A"));
  const paymentCommit = await store.commitSupplierPurchase({
    kind: "payment",
    purchase: withPayment,
    idempotencyKey: "conf-pay-A",
  });
  expect(paymentCommit.ok).toBe(true);
  const paymentReplay = await store.commitSupplierPurchase({
    kind: "payment",
    purchase: withPayment,
    idempotencyKey: "conf-pay-A",
  });
  expect(paymentReplay.ok).toBe(true);
  if (paymentReplay.ok) expect(paymentReplay.value.reused).toBe(true);

  const stalePayment = await store.commitSupplierPurchase({
    kind: "payment",
    purchase: recordSupplierPurchasePayment(purchase, paymentInput("conf-pay-B")),
    idempotencyKey: "conf-pay-B",
  });
  expect(stalePayment.ok).toBe(false);
  if (!stalePayment.ok) expect(stalePayment.code).toBe("storage_stale");
  const storedAfterStale = await listSupplierPurchases(store);
  expect(storedAfterStale[0]!.payments.length).toBe(2);

  /* ٤. التراجع الموثق عن الدفعة: مرة واحدة بالمفتاح؛ إعادة التشغيل إعادة
   * استخدام؛ والقبض يُحسب من الدفعات ناقص التراجعات. */
  const paymentId = withPayment.payments.find(entry => entry.idempotencyKey === "conf-pay-A")!.id;
  const withReversal = reverseSupplierPurchasePayment(withPayment, {
    id: "reversal-conf-1",
    paymentId,
    reason: "خطأ",
    occurredOn: "2026-09-09",
    recordedAt: TS,
    idempotencyKey: "conf-rev-1",
  });
  const reversalCommit = await store.commitSupplierPurchase({
    kind: "payment_reversal",
    purchase: withReversal,
    idempotencyKey: "conf-rev-1",
  });
  expect(reversalCommit.ok).toBe(true);
  if (reversalCommit.ok) expect(reversalCommit.value.purchase.paidMinor).toBe(2000);
  const reversalReplay = await store.commitSupplierPurchase({
    kind: "payment_reversal",
    purchase: withReversal,
    idempotencyKey: "conf-rev-1",
  });
  expect(reversalReplay.ok).toBe(true);
  if (reversalReplay.ok) expect(reversalReplay.value.reused).toBe(true);
  const secondReversal = await store.commitSupplierPurchase({
    kind: "payment_reversal",
    purchase: reverseSupplierPurchasePayment(withPayment, {
      id: "reversal-conf-2",
      paymentId,
      reason: "خطأ ثانٍ",
      occurredOn: "2026-09-09",
      recordedAt: TS,
      idempotencyKey: "conf-rev-2",
    }),
    idempotencyKey: "conf-rev-2",
  });
  expect(secondReversal.ok).toBe(false);
  if (!secondReversal.ok) expect(secondReversal.code).toBe("storage_stale");

  /* ٥. المراجعة الموثقة: قبل* من الحالة الحية؛ التعديل القديم يُرفض. */
  const fresh = (await listSupplierPurchases(store))[0]!;
  const revised = updateSupplierPurchase(fresh, {
    supplierName: "مؤسسة النسيج",
    note: "شراء قماش",
    purchasedOn: "2026-09-07",
    dueOn: null,
    totalMinor: 11000,
    initialPaidMinor: 2000,
    recordedAt: TS,
    idempotencyKey: "conf-revise-1",
    reason: "تصحيح الإجمالي",
    materialId: null,
    expectedQuantityMilli: null,
  });
  const revisionCommit = await store.commitSupplierPurchase({
    kind: "revision",
    purchase: revised,
    idempotencyKey: "conf-revise-1",
  });
  expect(revisionCommit.ok).toBe(true);
  const staleRevision = await store.commitSupplierPurchase({
    kind: "revision",
    purchase: updateSupplierPurchase(fresh, {
      supplierName: "مؤسسة النسيج",
      note: "شراء قماش",
      purchasedOn: "2026-09-07",
      dueOn: null,
      totalMinor: 12000,
      initialPaidMinor: 2000,
      recordedAt: TS,
      idempotencyKey: "conf-revise-2",
      reason: "تصحيح قديم",
      materialId: null,
      expectedQuantityMilli: null,
    }),
    idempotencyKey: "conf-revise-2",
  });
  expect(staleRevision.ok).toBe(false);
  if (!staleRevision.ok) expect(staleRevision.code).toBe("storage_stale");
  const storedRevised = (await listSupplierPurchases(store))[0]!;
  expect(storedRevised.totalMinor).toBe(11000);

  /* ٦. الموعد: إنشاء أول + تحديث بحدث واحد + إعادة المفتاح + تعارض. */
  const schedule = scheduleFixture("schedule-conf-1", "order-conf-1", "2026-09-10");
  const scheduleCreated = await store.commitScheduleCreate(schedule);
  expect(scheduleCreated.ok).toBe(true);
  if (scheduleCreated.ok) expect(scheduleCreated.value.reused).toBe(false);
  const scheduleCreateReplay = await store.commitScheduleCreate(
    scheduleFixture("schedule-conf-1", "order-conf-1", "2026-09-10"),
  );
  expect(scheduleCreateReplay.ok).toBe(true);
  if (scheduleCreateReplay.ok) expect(scheduleCreateReplay.value.reused).toBe(true);

  const storedSchedule = await getSchedule(store, "schedule-conf-1");
  if (!storedSchedule) throw new Error("schedule missing");
  const postponed = postponedSchedule(storedSchedule, "2026-09-11", "schedule-conf-1:postponed:1");
  const scheduleUpdate = await store.commitScheduleUpdate(postponed);
  expect(scheduleUpdate.ok).toBe(true);
  if (scheduleUpdate.ok) expect(scheduleUpdate.value.reused).toBe(false);
  const scheduleUpdateReplay = await store.commitScheduleUpdate(postponed);
  expect(scheduleUpdateReplay.ok).toBe(true);
  if (scheduleUpdateReplay.ok) expect(scheduleUpdateReplay.value.reused).toBe(true);

  const staleSchedule = await store.commitScheduleUpdate(
    postponedSchedule(schedule, "2026-09-12", "schedule-conf-1:postponed:stale"),
  );
  expect(staleSchedule.ok).toBe(false);
  if (!staleSchedule.ok) expect(staleSchedule.code).toBe("storage_stale");
  const storedAfterScheduleStale = await getSchedule(store, "schedule-conf-1");
  if (!storedAfterScheduleStale) throw new Error("schedule missing");
  expect(storedAfterScheduleStale.scheduledFor).toBe("2026-09-11");
  expect(storedAfterScheduleStale.events.length).toBe(2);

  /* ٦ب. رقعة إغلاق المجموعة ٢ — سجل مزوّر داخليًا: قصة الحدث متسقة مع
   * المخزّن (المفتاح وحقول «قبل») وحقوله العليا تخالف ما يصرّح به الحدث
   * نفسه؛ يُرفض بلا كتابة في كلا المحولين. كان هذا يمر قبل الإغلاق لأن
   * الحارس لا يفحص العلاقة الأمامية. */
  const storedForForgery = await getSchedule(store, "schedule-conf-1");
  if (!storedForForgery) throw new Error("schedule missing");
  const forged: ScheduleEntry = {
    ...postponedSchedule(storedForForgery, "2026-09-12", "schedule-conf-1:postponed:forged"),
    /* الحدث يقول إن الموعد انتقل إلى 2026-09-12 والسجل يزعم 2026-09-13. */
    scheduledFor: "2026-09-13",
  };
  const forgedCommit = await store.commitScheduleUpdate(forged);
  expect(forgedCommit.ok).toBe(false);
  if (!forgedCommit.ok) expect(forgedCommit.code).toBe("storage_stale");
  const afterForgery = await getSchedule(store, "schedule-conf-1");
  if (!afterForgery) throw new Error("schedule missing");
  expect(afterForgery.scheduledFor).toBe("2026-09-11");
  expect(afterForgery.events.length).toBe(2);
  expect(afterForgery.events.some(event => event.idempotencyKey === "schedule-conf-1:postponed:forged")).toBe(
    false,
  );

  /* ٧. الذرّية المرتبطة: قالب تكرار مع مظهرين — تعارض المظهر الثاني يُرجع
   * كل شيء (لا قالب بلا مواعيده ولا مواعيد بلا قالب). */
  const recurrence = {
    id: "recurrence-conf-1",
    sourceScheduleId: "schedule-conf-1",
    orderId: "order-conf-1",
    frequency: "weekly" as const,
    occurrenceCount: 2,
    status: "active" as const,
    idempotencyKey: "recurrence-conf-1",
    cancelledAt: null,
    cancellationReason: null,
    createdAt: TS,
    updatedAt: TS,
  };
  const appearanceOne = scheduleFixture("recurrence-conf-1:1", "order-conf-1", "2026-09-17");
  const appearanceOneWithRecurrence: ScheduleEntry = {
    ...appearanceOne,
    recurrenceId: "recurrence-conf-1",
    recurrenceIndex: 1,
    events: [
      {
        ...appearanceOne.events[0]!,
        id: "recurrence-conf-1:1:created",
        idempotencyKey: "recurrence-conf-1:1:2026-09-17",
        reason: "موعد قادم من قالب تكرار محلي",
      },
    ],
  };
  /* المظهر الثاني: معرّف يشغله موعد قائم مختلف المحتوى — تعارض مفروض. */
  const occupied = scheduleFixture("recurrence-conf-1:2", "order-conf-9", "2026-09-24");
  const occupiedCreate = await store.commitScheduleCreate(occupied);
  expect(occupiedCreate.ok).toBe(true);
  const appearanceTwo = scheduleFixture("recurrence-conf-1:2", "order-conf-1", "2026-09-24");
  const appearanceTwoWithRecurrence: ScheduleEntry = {
    ...appearanceTwo,
    recurrenceId: "recurrence-conf-1",
    recurrenceIndex: 2,
    events: [
      {
        ...appearanceTwo.events[0]!,
        id: "recurrence-conf-1:2:created",
        idempotencyKey: "recurrence-conf-1:2:2026-09-24",
        reason: "موعد قادم من قالب تكرار محلي",
      },
    ],
  };
  const blockedCommit = await store.commitRecurrence(recurrence, [
    appearanceOneWithRecurrence,
    appearanceTwoWithRecurrence,
  ]);
  expect(blockedCommit.ok).toBe(false);
  if (!blockedCommit.ok) expect(blockedCommit.code).toBe("storage_stale");
  /* لا قالب (المظهر الأول لم يُكتب رغم أنه سليم) ولا مظهر أول — تراجع كامل. */
  const recurrenceRead = await store.getRecurrence("recurrence-conf-1");
  if (!recurrenceRead.ok) throw new Error(recurrenceRead.message);
  expect(recurrenceRead.value).toBeNull();
  const appearanceOneRead = await getSchedule(store, "recurrence-conf-1:1");
  expect(appearanceOneRead).toBeNull();
  const occupiedRead = await getSchedule(store, "recurrence-conf-1:2");
  if (!occupiedRead) throw new Error("occupied schedule missing");
  expect(occupiedRead.orderId).toBe("order-conf-9");

  /* ٨. دورة التصدير/الاستيراد الكاملة عبر اللقطة. */
  const snapshot = await store.readSnapshot();
  if (!snapshot.ok) throw new Error(snapshot.message);
  const target = new MemoryLocalStore();
  const replacement = await target.replaceSnapshot(snapshot.value);
  if (!replacement.ok) throw new Error(replacement.message);
  const restored = await target.readSnapshot();
  if (!restored.ok) throw new Error(restored.message);
  expect(restored.value.supplierPurchases).toEqual(snapshot.value.supplierPurchases);
  expect(restored.value.schedules).toEqual(snapshot.value.schedules);
}

describe("adapter conformance — supplier purchase and schedule contracts", () => {
  it("MemoryLocalStore satisfies the guarded commit contracts", async () => {
    await runConformanceScenarios(new MemoryLocalStore());
  });

  it("IndexedDbLocalStore (fake-indexeddb) satisfies the same guarded commit contracts", async () => {
    await clearDatabase();
    try {
      await runConformanceScenarios(new IndexedDbLocalStore());
    } finally {
      await clearDatabase();
    }
  });
});

afterEach(async () => {
  await clearDatabase();
});
