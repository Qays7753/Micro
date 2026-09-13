/** المجموعة ٢ (التحصين الكامل — HIGH-001): انحدارات التزامن المحلي لسجلات
 * الموردين والمواعيد. نداءان متزامنان بمفتاحين مختلفين لم يعد أيّ منهما يختفي
 * بصمت (آخر كاتب يفوز سابقًا): واحد يثبت والآخر يُرفض برسالة تعارض صريحة
 * والمخزن بايتًا-ببايت كما تركه الفائز. وإعادة المحاولة بنفس المفتاح تعاد كما
 * هي حتى لو كتب مسار آخر بعدها — لا إعادة لأثر قديم فوق حالة جديدة. */
import { describe, expect, it } from "vitest";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";

const now = () => "2026-09-08T09:00:00.000Z";

async function saveOrder(store: MemoryLocalStore, id: string, deliveryDate: string) {
  const cost = calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: "2026-08-22T00:00:00.000Z",
    freshnessDays: null,
  });
  const order = createCraftOrder({
    id,
    customerName: "سارة",
    itemName: `طلب ${id}`,
    specifications: "اختبار",
    quantity: 1,
    agreedPriceMinor: 2000,
    costSnapshot: cost,
    createdAt: "2026-08-22T00:00:00.000Z",
  });
  await store.saveOrder({
    id,
    order: { ...order, status: "in_progress", nextAction: "أكمل التنفيذ" },
    deliveryDate,
    agreementSource: null,
    createdAt: "2026-08-22T00:00:00.000Z",
    updatedAt: "2026-08-22T00:00:00.000Z",
  });
}

async function purchaseSnapshot(store: MemoryLocalStore): Promise<unknown> {
  const list = await store.listSupplierPurchases();
  if (!list.ok) throw new Error(list.message);
  return structuredClone(list.value);
}

async function scheduleSnapshot(store: MemoryLocalStore): Promise<unknown> {
  const list = await store.listSchedules();
  if (!list.ok) throw new Error(list.message);
  return structuredClone(list.value);
}

const purchaseInput = (idempotencyKey: string) => ({
  supplierName: "مؤسسة النسيج",
  note: "شراء قماش",
  purchasedOn: "2026-09-07",
  dueOn: null,
  totalMinor: 10000,
  initialPaidMinor: 2000,
  idempotencyKey,
  materialId: null,
  expectedQuantityMilli: null,
});

describe("supplier purchase local concurrency (HIGH-001)", () => {
  it("two concurrent distinct-key payments keep exactly one and reject the other explicitly", async () => {
    const store = new MemoryLocalStore();
    const service = new SupplierPurchaseService(store, now);
    const created = await service.recordPurchase(purchaseInput("purchase-base"));
    if (!created.ok) throw new Error(created.message);
    const purchaseId = created.value.id;
    const [first, second] = await Promise.all([
      service.recordPayment({
        purchaseId,
        amountMinor: 1000,
        occurredOn: "2026-09-08",
        note: "دفعة أولى",
        idempotencyKey: "pay-A",
      }),
      service.recordPayment({
        purchaseId,
        amountMinor: 1500,
        occurredOn: "2026-09-08",
        note: "دفعة ثانية",
        idempotencyKey: "pay-B",
      }),
    ]);
    const successes = [first, second].filter(result => result.ok);
    const failures = [first, second].filter(result => !result.ok);
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
    if (failures[0] && !failures[0].ok) {
      /* رقعة إغلاق المجموعة ٢: التعارض يصل كودًا مطبوعًا storage_stale لا
       * storage_error — المستدعي لا يفسّر النص لمعرفة الصنف. */
      expect(failures[0].code).toBe("storage_stale");
      expect(failures[0].message).toContain("أعد المحاولة");
    }
    /* الدفعة الناجلة واحدة بالضبط — لا دمج صامت ولا اختفاء. */
    const stored = await store.getSupplierPurchase(purchaseId);
    if (!stored.ok || !stored.value) throw new Error("stored purchase missing");
    expect(stored.value.payments.length).toBe(2);
    expect(stored.value.payments.some(payment => payment.idempotencyKey === "pay-A")).toBe(true);
    expect(stored.value.paidMinor).toBe(3000);
  });

  it("a same-key retry after an intervening different-key write returns the current record without replaying the old effect", async () => {
    const store = new MemoryLocalStore();
    const service = new SupplierPurchaseService(store, now);
    const created = await service.recordPurchase(purchaseInput("purchase-retry"));
    if (!created.ok) throw new Error(created.message);
    const purchaseId = created.value.id;
    await service.recordPayment({
      purchaseId,
      amountMinor: 1000,
      occurredOn: "2026-09-08",
      note: "دفعة أولى",
      idempotencyKey: "pay-A",
    });
    await service.recordPayment({
      purchaseId,
      amountMinor: 1500,
      occurredOn: "2026-09-08",
      note: "دفعة ثانية",
      idempotencyKey: "pay-B",
    });
    /* إعادة محاولة الدفعة الأولى بعد أن كتبت الثانية: تعاد كما هي على
     * الحالة الحالية (بلا حذف أثر الثانية) وبلا كتابة جديدة. */
    const before = await purchaseSnapshot(store);
    const retried = await service.recordPayment({
      purchaseId,
      amountMinor: 1000,
      occurredOn: "2026-09-08",
      note: "دفعة أولى",
      idempotencyKey: "pay-A",
    });
    if (!retried.ok) throw new Error(retried.message);
    expect(retried.reused).toBe(true);
    expect(retried.value.payments.some(payment => payment.idempotencyKey === "pay-B")).toBe(true);
    expect(retried.value.paidMinor).toBe(4500);
    const after = await purchaseSnapshot(store);
    expect(after).toEqual(before);
  });

  it("concurrent same-key payments store exactly one payment and both calls succeed", async () => {
    const store = new MemoryLocalStore();
    const service = new SupplierPurchaseService(store, now);
    const created = await service.recordPurchase(purchaseInput("purchase-same"));
    if (!created.ok) throw new Error(created.message);
    const purchaseId = created.value.id;
    const input = {
      purchaseId,
      amountMinor: 1000,
      occurredOn: "2026-09-08",
      note: "دفعة مزدوجة",
      idempotencyKey: "pay-double",
    };
    const [first, second] = await Promise.all([service.recordPayment(input), service.recordPayment(input)]);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    const stored = await store.getSupplierPurchase(purchaseId);
    if (!stored.ok || !stored.value) throw new Error("stored purchase missing");
    expect(stored.value.payments.filter(payment => payment.idempotencyKey === "pay-double").length).toBe(1);
    expect(stored.value.paidMinor).toBe(3000);
  });

  it("a stale edit is rejected and the concurrent payment survives byte-for-byte", async () => {
    const store = new MemoryLocalStore();
    const service = new SupplierPurchaseService(store, now);
    const created = await service.recordPurchase(purchaseInput("purchase-edit"));
    if (!created.ok) throw new Error(created.message);
    const purchaseId = created.value.id;
    /* كلا المسارين يقرأ الأساس نفسه قبل أي كتابة (تداخل وعدَي Promise.all). */
    const [edit, payment] = await Promise.all([
      service.editPurchase({
        purchaseId,
        supplierName: "مؤسسة النسيج المعدلة",
        note: "شراء قماش",
        purchasedOn: "2026-09-07",
        dueOn: null,
        totalMinor: 12000,
        initialPaidMinor: 2000,
        reason: "تصحيح الإجمالي",
        idempotencyKey: "edit-1",
        materialId: null,
        expectedQuantityMilli: null,
      }),
      service.recordPayment({
        purchaseId,
        amountMinor: 1000,
        occurredOn: "2026-09-08",
        note: "دفعة أثناء التعديل",
        idempotencyKey: "pay-race",
      }),
    ]);
    const successes = [edit, payment].filter(result => result.ok);
    expect(successes.length).toBe(1);
    const stored = await store.getSupplierPurchase(purchaseId);
    if (!stored.ok || !stored.value) throw new Error("stored purchase missing");
    if (payment.ok) {
      /* الدفعة فازت: أثرها قائم والتعديل المرفوض لم يمس شيئًا. */
      expect(stored.value.payments.some(paymentEntry => paymentEntry.idempotencyKey === "pay-race")).toBe(
        true,
      );
      expect(stored.value.totalMinor).toBe(10000);
      expect(stored.value.supplierName).toBe("مؤسسة النسيج");
    } else {
      expect(edit.ok).toBe(true);
      expect(stored.value.totalMinor).toBe(12000);
      expect(stored.value.supplierName).toBe("مؤسسة النسيج المعدلة");
      expect(stored.value.payments.some(entry => entry.idempotencyKey === "pay-race")).toBe(false);
    }
    const storedSnapshot = await purchaseSnapshot(store);
    const reread = await purchaseSnapshot(store);
    expect(reread).toEqual(storedSnapshot);
  });

  it("concurrent distinct-key creations both persist safely", async () => {
    const store = new MemoryLocalStore();
    const service = new SupplierPurchaseService(store, now);
    const [first, second] = await Promise.all([
      service.recordPurchase(purchaseInput("create-A")),
      service.recordPurchase(purchaseInput("create-B")),
    ]);
    if (!first.ok) throw new Error(first.message);
    if (!second.ok) throw new Error(second.message);
    expect(first.value.id).not.toBe(second.value.id);
    const list = await store.listSupplierPurchases();
    if (!list.ok) throw new Error(list.message);
    expect(list.value.length).toBe(2);
  });

  it("payment reversal is idempotent by key and a concurrent second reversal on the same payment is rejected", async () => {
    const store = new MemoryLocalStore();
    const service = new SupplierPurchaseService(store, now);
    const created = await service.recordPurchase(purchaseInput("purchase-rev"));
    if (!created.ok) throw new Error(created.message);
    const purchaseId = created.value.id;
    const payment = await service.recordPayment({
      purchaseId,
      amountMinor: 1000,
      occurredOn: "2026-09-08",
      note: "دفعة للتراجع",
      idempotencyKey: "pay-rev",
    });
    if (!payment.ok) throw new Error(payment.message);
    const paymentId = payment.value.payments.find(entry => entry.idempotencyKey === "pay-rev")!.id;
    const [first, second] = await Promise.all([
      service.reversePayment({
        purchaseId,
        paymentId,
        reason: "خطأ في المبلغ",
        occurredOn: "2026-09-09",
        idempotencyKey: "rev-1",
      }),
      service.reversePayment({
        purchaseId,
        paymentId,
        reason: "خطأ في المبلغ",
        occurredOn: "2026-09-09",
        idempotencyKey: "rev-2",
      }),
    ]);
    const successes = [first, second].filter(result => result.ok);
    expect(successes.length).toBe(1);
    const stored = await store.getSupplierPurchase(purchaseId);
    if (!stored.ok || !stored.value) throw new Error("stored purchase missing");
    expect((stored.value.paymentReversals ?? []).length).toBe(1);
    expect(stored.value.paidMinor).toBe(2000);
    /* إعادة نفس المفتاح بعد النجاح: إعادة استخدام لا تراجع ثانٍ. */
    const winnerKey = successes[0] === first ? "rev-1" : "rev-2";
    const before = await purchaseSnapshot(store);
    const retried = await service.reversePayment({
      purchaseId,
      paymentId,
      reason: "خطأ في المبلغ",
      occurredOn: "2026-09-09",
      idempotencyKey: winnerKey,
    });
    if (!retried.ok) throw new Error(retried.message);
    expect(retried.reused).toBe(true);
    const after = await purchaseSnapshot(store);
    expect(after).toEqual(before);
  });
});

describe("schedule local concurrency (HIGH-001)", () => {
  it("two concurrent distinct timing updates keep one and reject the other with zero writes", async () => {
    const store = new MemoryLocalStore();
    await saveOrder(store, "order-race", "2026-09-10");
    const service = new ScheduleService(store, now);
    const overview = await service.overview();
    if (!overview.ok) throw new Error(overview.message);
    const scheduleId = overview.value.today[0]?.schedule.id ?? overview.value.upcoming[0]?.schedule.id;
    if (!scheduleId) throw new Error("schedule missing");
    const before = await scheduleSnapshot(store);
    const [first, second] = await Promise.all([
      service.updateTiming(scheduleId, {
        scheduledFor: "2026-09-11",
        scheduledTime: "10:00",
        durationMinutes: 60,
        reason: "تأجيل أول",
      }),
      service.updateTiming(scheduleId, {
        scheduledFor: "2026-09-12",
        scheduledTime: "12:00",
        durationMinutes: 90,
        reason: "تأجيل ثانٍ",
      }),
    ]);
    const successes = [first, second].filter(result => result.ok);
    const failures = [first, second].filter(result => !result.ok);
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
    if (failures[0] && !failures[0].ok) {
      /* رقعة إغلاق المجموعة ٢: التعارض المواعيدي كود مطبوع storage_stale. */
      expect(failures[0].code).toBe("storage_stale");
      expect(failures[0].message).toContain("أعد المحاولة");
    }
    /* حدث تأجيل واحد بالضبط — حدث الخاسر لا وجود له في المخزن. */
    const after = await scheduleSnapshot(store);
    const afterList = after as { events: { type: string }[] }[];
    const postponedEvents = afterList[0]!.events.filter(event => event.type === "postponed");
    expect(postponedEvents.length).toBe(1);
    expect(afterList[0]!.events.filter(event => event.type === "created").length).toBe(1);
  });

  it("a same-key timing retry is idempotent and returns the stored schedule", async () => {
    const store = new MemoryLocalStore();
    await saveOrder(store, "order-retry", "2026-09-10");
    const service = new ScheduleService(store, now);
    const overview = await service.overview();
    if (!overview.ok) throw new Error(overview.message);
    const scheduleId = overview.value.today[0]?.schedule.id ?? overview.value.upcoming[0]?.schedule.id;
    if (!scheduleId) throw new Error("schedule missing");
    const input = {
      scheduledFor: "2026-09-11",
      scheduledTime: "10:00" as string | null,
      durationMinutes: 60 as number | null,
      reason: "تأجيل واحد",
    };
    const first = await service.updateTiming(scheduleId, input);
    if (!first.ok) throw new Error(first.message);
    const before = await scheduleSnapshot(store);
    const second = await service.updateTiming(scheduleId, input);
    if (!second.ok) throw new Error(second.message);
    expect(second.value.events.filter(event => event.type === "postponed").length).toBe(1);
    const after = await scheduleSnapshot(store);
    expect(after).toEqual(before);
  });

  it("concurrent overview calls complete a delivered order's schedule exactly once", async () => {
    const store = new MemoryLocalStore();
    await saveOrder(store, "order-done", "2026-09-10");
    /* سلّم الطلب (حدث تسليم موثق) ليُفعّل الإكمال التلقائي. */
    const stored = await store.getOrder("order-done");
    if (!stored.ok || !stored.value) throw new Error("order missing");
    const delivered = {
      ...stored.value,
      order: {
        ...stored.value.order,
        status: "delivered" as const,
        events: [
          ...stored.value.order.events,
          {
            id: "order-done:status:deliver-1",
            type: "status_changed" as const,
            idempotencyKey: "status:deliver-1",
            createdAt: "2026-09-09T10:00:00.000Z",
            fromStatus: "in_progress" as const,
            toStatus: "delivered" as const,
          },
        ],
      },
      updatedAt: "2026-09-09T10:00:00.000Z",
    };
    await store.saveOrder(delivered);
    const service = new ScheduleService(store, now);
    const [first, second] = await Promise.all([service.overview(), service.overview()]);
    if (!first.ok) throw new Error(first.message);
    if (!second.ok) throw new Error(second.message);
    /* كلا القراءتين نجحت (المسار المقروء لا يفشل بالتزامن) والإكمال مرة
     * واحدة بمفتاحه الحتمي. */
    const list = await store.listSchedules();
    if (!list.ok) throw new Error(list.message);
    const schedule = list.value.find(entry => entry.orderId === "order-done");
    if (!schedule) throw new Error("schedule missing");
    expect(schedule.status).toBe("completed");
    expect(schedule.events.filter(event => event.type === "completed").length).toBe(1);
  });

  it("a stale completion after a concurrent postpone never reverts the postpone", async () => {
    const store = new MemoryLocalStore();
    await saveOrder(store, "order-stale", "2026-09-10");
    const stored = await store.getOrder("order-stale");
    if (!stored.ok || !stored.value) throw new Error("order missing");
    const delivered = {
      ...stored.value,
      order: {
        ...stored.value.order,
        status: "delivered" as const,
        events: [
          ...stored.value.order.events,
          {
            id: "order-stale:status:deliver-1",
            type: "status_changed" as const,
            idempotencyKey: "status:deliver-1",
            createdAt: "2026-09-09T10:00:00.000Z",
            fromStatus: "in_progress" as const,
            toStatus: "delivered" as const,
          },
        ],
      },
      updatedAt: "2026-09-09T10:00:00.000Z",
    };
    await store.saveOrder(delivered);
    const service = new ScheduleService(store, now);
    /* قراءتان متزامنتان: واحدة تكمل الموعد تلقائيًا وواحدة تؤجله — الأول
     * يفوز والثاني يُحل بإعادة قراءة صادقة لا بكتابة فوق تغيير الآخر. */
    const [first, second] = await Promise.all([service.overview(), service.overview()]);
    if (!first.ok) throw new Error(first.message);
    if (!second.ok) throw new Error(second.message);
    const list = await store.listSchedules();
    if (!list.ok) throw new Error(list.message);
    const schedule = list.value.find(entry => entry.orderId === "order-stale");
    if (!schedule) throw new Error("schedule missing");
    expect(schedule.status).toBe("completed");
    expect(schedule.events.filter(event => event.type === "completed").length).toBe(1);
    expect(schedule.events.filter(event => event.type === "postponed").length).toBe(0);
  });
});
