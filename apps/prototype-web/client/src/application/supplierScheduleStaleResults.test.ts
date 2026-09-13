/** رقعة إغلاق المجموعة ٢ (مراجعة مستقلة): عقد الأكواد المطبوعة عبر طبقة
 * التطبيق. تعارض القراءة-التعديل-الكتابة في مسارات الموردين والمواعيد
 * والتكرار يصل المستدعي «storage_stale» — لا يُطوى داخل storage_error ولا
 * يُستنتج من نص عربي؛ والفشل التخزيني الحقيقي يبقى «storage_error»؛
 * وأخطاء التحقق وعدم الوجود تبقى أصنافها. هذه عقد المجموعة ٣ لرحلة
 * إعادة المحاولة الصريحة: أعد الفتح ثم أعد المحاولة. */
import { describe, expect, it } from "vitest";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import { ScheduleRecurrenceService } from "@/application/scheduling/recurrenceService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import type { ScheduleEntry } from "@/storage/local/types";
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

/* محوّل يفشل فشلًا تخزينيًا حقيقيًا عند الالتزام — يميّز الاختبار بين
 * storage_error الحقيقي وstorage_stale التعارضي. */
class GenuineFailureStore extends MemoryLocalStore {
  public failedCommit = false;
  override async commitSupplierPurchase(commit: Parameters<MemoryLocalStore["commitSupplierPurchase"]>[0]) {
    this.failedCommit = true;
    return {
      ok: false as const,
      code: "storage_error" as const,
      message: "فشل تخزيني حقيقي مفبرك للاختبار.",
    };
  }
  override async commitScheduleUpdate(schedule: ScheduleEntry) {
    this.failedCommit = true;
    return {
      ok: false as const,
      code: "storage_error" as const,
      message: "فشل تخزيني حقيقي مفبرك للاختبار.",
    };
  }
}

async function scheduleIdFor(store: MemoryLocalStore, orderId: string): Promise<string> {
  const schedules = await store.listSchedules();
  if (!schedules.ok) throw new Error(schedules.message);
  const found = schedules.value.find(schedule => schedule.orderId === orderId);
  if (!found) throw new Error("schedule missing");
  return found.id;
}

describe("supplier service typed result codes (closure patch)", () => {
  it("a stale concurrent payment surfaces as typed storage_stale", async () => {
    const store = new MemoryLocalStore();
    const service = new SupplierPurchaseService(store, now);
    const created = await service.recordPurchase(purchaseInput("typed-pay"));
    if (!created.ok) throw new Error(created.message);
    const purchaseId = created.value.id;
    const [first, second] = await Promise.all([
      service.recordPayment({
        purchaseId,
        amountMinor: 1000,
        occurredOn: "2026-09-08",
        note: "دفعة أولى",
        idempotencyKey: "typed-pay-A",
      }),
      service.recordPayment({
        purchaseId,
        amountMinor: 1500,
        occurredOn: "2026-09-08",
        note: "دفعة ثانية",
        idempotencyKey: "typed-pay-B",
      }),
    ]);
    const failures = [first, second].filter(result => !result.ok);
    if (failures.length !== 1) throw new Error("expected exactly one stale failure");
    const failure = failures[0]!;
    if (!failure.ok) {
      /* الكود المطبوع نفسه — بلا تفسير للنص العربي. */
      expect(failure.code).toBe("storage_stale");
      expect(failure.message).toContain("أعد المحاولة");
    }
  });

  it("a stale concurrent edit surfaces as typed storage_stale", async () => {
    const store = new MemoryLocalStore();
    const service = new SupplierPurchaseService(store, now);
    const created = await service.recordPurchase(purchaseInput("typed-edit"));
    if (!created.ok) throw new Error(created.message);
    const purchaseId = created.value.id;
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
        idempotencyKey: "typed-edit-1",
        materialId: null,
        expectedQuantityMilli: null,
      }),
      service.recordPayment({
        purchaseId,
        amountMinor: 1000,
        occurredOn: "2026-09-08",
        note: "دفعة أثناء التعديل",
        idempotencyKey: "typed-pay-race",
      }),
    ]);
    const failures = [edit, payment].filter(result => !result.ok);
    if (failures.length !== 1) throw new Error("expected exactly one stale failure");
    const failure = failures[0]!;
    if (!failure.ok) expect(failure.code).toBe("storage_stale");
  });

  it("a stale concurrent payment reversal surfaces as typed storage_stale", async () => {
    const store = new MemoryLocalStore();
    const service = new SupplierPurchaseService(store, now);
    const created = await service.recordPurchase(purchaseInput("typed-rev"));
    if (!created.ok) throw new Error(created.message);
    const purchaseId = created.value.id;
    const payment = await service.recordPayment({
      purchaseId,
      amountMinor: 1000,
      occurredOn: "2026-09-08",
      note: "دفعة للتراجع",
      idempotencyKey: "typed-pay-rev",
    });
    if (!payment.ok) throw new Error(payment.message);
    const paymentId = payment.value.payments.find(entry => entry.idempotencyKey === "typed-pay-rev")!.id;
    const [first, second] = await Promise.all([
      service.reversePayment({
        purchaseId,
        paymentId,
        reason: "خطأ في المبلغ",
        occurredOn: "2026-09-09",
        idempotencyKey: "typed-rev-1",
      }),
      service.reversePayment({
        purchaseId,
        paymentId,
        reason: "خطأ في المبلغ",
        occurredOn: "2026-09-09",
        idempotencyKey: "typed-rev-2",
      }),
    ]);
    const failures = [first, second].filter(result => !result.ok);
    if (failures.length !== 1) throw new Error("expected exactly one stale failure");
    const failure = failures[0]!;
    if (!failure.ok) expect(failure.code).toBe("storage_stale");
  });

  it("a genuine storage failure on a supplier commit stays storage_error", async () => {
    const store = new GenuineFailureStore();
    const service = new SupplierPurchaseService(store, now);
    /* الإنشاء نفسه يمر عبر الالتزام: فشل تخزيني حقيقي لا تعارض. */
    const result = await service.recordPurchase(purchaseInput("typed-genuine"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("storage_error");
      expect(result.code).not.toBe("storage_stale");
    }
    expect(store.failedCommit).toBe(true);
  });

  it("validation failures remain validation_error and do not touch storage", async () => {
    const store = new GenuineFailureStore();
    const service = new SupplierPurchaseService(store, now);
    const result = await service.recordPayment({
      purchaseId: "missing-purchase",
      amountMinor: 1000,
      occurredOn: "2026-09-08",
      note: "دفعة",
      idempotencyKey: "typed-validation",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_error");
    expect(store.failedCommit).toBe(false);
  });
});

describe("schedule service typed result codes (closure patch)", () => {
  it("a stale concurrent timing update surfaces as typed storage_stale", async () => {
    const store = new MemoryLocalStore();
    await saveOrder(store, "order-typed", "2026-09-10");
    const service = new ScheduleService(store, now);
    const overview = await service.overview();
    if (!overview.ok) throw new Error(overview.message);
    const id = overview.value.today[0]?.schedule.id ?? overview.value.upcoming[0]?.schedule.id;
    if (!id) throw new Error("schedule missing");
    const [first, second] = await Promise.all([
      service.updateTiming(id, {
        scheduledFor: "2026-09-11",
        scheduledTime: "10:00",
        durationMinutes: 60,
        reason: "تأجيل أول",
      }),
      service.updateTiming(id, {
        scheduledFor: "2026-09-12",
        scheduledTime: "12:00",
        durationMinutes: 90,
        reason: "تأجيل ثانٍ",
      }),
    ]);
    const failures = [first, second].filter(result => !result.ok);
    if (failures.length !== 1) throw new Error("expected exactly one stale failure");
    const failure = failures[0]!;
    if (!failure.ok) {
      expect(failure.code).toBe("storage_stale");
      expect(failure.message).toContain("أعد المحاولة");
    }
  });

  it("a stale concurrent postpone surfaces as typed storage_stale", async () => {
    const store = new MemoryLocalStore();
    await saveOrder(store, "order-postpone", "2026-09-10");
    const service = new ScheduleService(store, now);
    const overview = await service.overview();
    if (!overview.ok) throw new Error(overview.message);
    const id = overview.value.today[0]?.schedule.id ?? overview.value.upcoming[0]?.schedule.id;
    if (!id) throw new Error("schedule missing");
    const [first, second] = await Promise.all([
      service.postpone(id, "2026-09-13", "تأجيل أول"),
      service.postpone(id, "2026-09-14", "تأجيل ثانٍ"),
    ]);
    const failures = [first, second].filter(result => !result.ok);
    if (failures.length !== 1) throw new Error("expected exactly one stale failure");
    const failure = failures[0]!;
    if (!failure.ok) expect(failure.code).toBe("storage_stale");
  });

  it("a genuine storage failure on a schedule commit stays storage_error", async () => {
    const store = new GenuineFailureStore();
    await saveOrder(store, "order-genuine", "2026-09-10");
    const service = new ScheduleService(store, now);
    /* التسديد الأول يمر عبر commitScheduleCreate (غير المُعطّل) ثم يفشل
     * تحديث التوقيت فشلًا تخزينيًا حقيقيًا — لا تعارض. */
    const overview = await service.overview();
    if (!overview.ok) throw new Error(overview.message);
    const id = await scheduleIdFor(store, "order-genuine");
    const result = await service.updateTiming(id, {
      scheduledFor: "2026-09-11",
      scheduledTime: "10:00",
      durationMinutes: 60,
      reason: "تأجيل",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("storage_error");
      expect(result.code).not.toBe("storage_stale");
    }
    expect(store.failedCommit).toBe(true);
  });

  it("validation failures remain validation_error and not-found remains not_found", async () => {
    const store = new MemoryLocalStore();
    const service = new ScheduleService(store, now);
    const invalid = await service.updateTiming("whatever", {
      scheduledFor: "not-a-date",
      scheduledTime: null,
      durationMinutes: null,
      reason: "",
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.code).toBe("validation_error");
    const missing = await service.get("no-such-schedule");
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("not_found");
  });
});

describe("recurrence service typed result codes (closure patch)", () => {
  it("a recurrence cancel racing a concurrent schedule write surfaces as typed storage_stale", async () => {
    /* حقن السباق حتميًا: بين قراءة الإيقاف والتزامه يكتب مسار آخر تأجيلًا
     * على المظهر المتأثر — الالتزام يكتشف الحدث الإضافي ويرفض بـ
     * storage_stale دون كتابة أي موعد أو قالب. */
    let armed = false;
    let injectedAppearanceId = "";
    const racingStore = new (class RacingStore extends MemoryLocalStore {
      override async commitRecurrence(
        recurrence: Parameters<MemoryLocalStore["commitRecurrence"]>[0],
        schedules: Parameters<MemoryLocalStore["commitRecurrence"]>[1],
      ) {
        if (armed) {
          const current = await this.getSchedule(injectedAppearanceId);
          if (current.ok && current.value) {
            await this.saveSchedule({
              ...current.value,
              scheduledFor: "2026-09-25",
              status: "postponed",
              postponeReason: "سباق متزامن",
              updatedAt: now(),
              events: [
                ...current.value.events,
                {
                  id: `${injectedAppearanceId}:postponed:race`,
                  type: "postponed" as const,
                  idempotencyKey: `${injectedAppearanceId}:postponed:race`,
                  createdAt: now(),
                  previousScheduledFor: current.value.scheduledFor,
                  scheduledFor: "2026-09-25",
                  previousScheduledTime: current.value.scheduledTime,
                  scheduledTime: current.value.scheduledTime,
                  previousDurationMinutes: current.value.durationMinutes,
                  durationMinutes: current.value.durationMinutes,
                  reason: "سباق متزامن",
                },
              ],
            });
          }
        }
        return super.commitRecurrence(recurrence, schedules);
      }
    })();
    await saveOrder(racingStore, "order-recurrence", "2026-09-10");
    const scheduleService = new ScheduleService(racingStore, now);
    const overview = await scheduleService.overview();
    if (!overview.ok) throw new Error(overview.message);
    const sourceId = overview.value.today[0]?.schedule.id ?? overview.value.upcoming[0]?.schedule.id;
    if (!sourceId) throw new Error("schedule missing");
    const service = new ScheduleRecurrenceService(racingStore, now);
    const created = await service.create({
      sourceScheduleId: sourceId,
      frequency: "weekly",
      occurrenceCount: 2,
    });
    if (!created.ok) throw new Error(created.message);
    const recurrenceId = created.value.recurrence.id;
    /* موعد ظهور قادم متأثر بالإيقاف. */
    const appearanceId = created.value.created[0]?.id;
    if (!appearanceId) throw new Error("appearance missing");
    injectedAppearanceId = appearanceId;
    armed = true;
    const result = await service.cancel(recurrenceId, "إيقاف متأخر");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("storage_stale");
    /* لا شيء كُتب: القالب ما زال نشطًا والمظهر ما زال مؤجلًا لا ملغى. */
    const recurrenceRead = await racingStore.getRecurrence(recurrenceId);
    if (!recurrenceRead.ok) throw new Error(recurrenceRead.message);
    expect(recurrenceRead.value?.status).toBe("active");
    const appearanceRead = await racingStore.getSchedule(appearanceId);
    if (!appearanceRead.ok) throw new Error(appearanceRead.message);
    expect(appearanceRead.value?.status).toBe("postponed");
    expect(appearanceRead.value?.events.some(event => event.type === "cancelled")).toBe(false);
  });

  it("a genuine storage failure on a recurrence commit stays storage_error", async () => {
    const store = new (class GenuineRecurrenceFailure extends MemoryLocalStore {
      override async commitRecurrence(
        recurrence: Parameters<MemoryLocalStore["commitRecurrence"]>[0],
        schedules: Parameters<MemoryLocalStore["commitRecurrence"]>[1],
      ) {
        return {
          ok: false as const,
          code: "storage_error" as const,
          message: "فشل تخزيني حقيقي مفبرك للاختبار.",
        };
      }
    })();
    await saveOrder(store, "order-rec-genuine", "2026-09-10");
    const scheduleService = new ScheduleService(store, now);
    const overview = await scheduleService.overview();
    if (!overview.ok) throw new Error(overview.message);
    const sourceId = overview.value.today[0]?.schedule.id ?? overview.value.upcoming[0]?.schedule.id;
    if (!sourceId) throw new Error("schedule missing");
    const service = new ScheduleRecurrenceService(store, now);
    const result = await service.create({
      sourceScheduleId: sourceId,
      frequency: "weekly",
      occurrenceCount: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("storage_error");
      expect(result.code).not.toBe("storage_stale");
    }
  });
});
