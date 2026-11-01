/**
 * S13 (DOC-022 / UNIT-018 + 012 — أمر 2158b0fc §6): إثبات قارئ المتابعة
 * الموحدة — هوية نوعية لكل مهمة (نوع مصدر+معرف+نوع فعل+معرف موعد)،
 * ومصادر معزولة الحالة (فشل أحدها لا يخفي السليم ولا يفرغ الصفحة)،
 * وتجميع متأخر/اليوم/قادم/بلا موعد/تالف قبل أي حد عرض، والتصفية على
 * المجتمع كله بعدد صادق، والقراءة بلا أي كتابة، والدورة غير المؤكدة
 * تذكيرًا موسومًا «مقترحًا» لا دينًا (U018-F01/R16/R17/R21، SDF-013).
 */
import { describe, expect, it, vi } from "vitest";
import { UnifiedFollowUpService, projectFollowUp, type FollowUpSourceKey } from "./unifiedFollowUpService";
/* S13 (حدود OD-10): عدسة التسليمات النشطة تُركّب هنا كما تركّبها الصفحة من
 * باب الجدولة — القارئ يستقبلها بنيويًا (الاختبار يبنيها فوق المخزن الحي). */
import { activeDeliveryLens } from "@/application/scheduling/scheduleReads";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";
import type { PrototypeLocalStore, StoredCraftOrder } from "@/storage/local/types";
import type { CollectionService } from "@/application/collections/collectionService";
import type { DueDatesService } from "@/application/finance/dueDatesService";
import type { ProjectFinancialService } from "@/application/finance/projectFinancialService";

const NOW = "2026-11-02T09:00:00.000Z";
const now = () => NOW;

function makeStoredOrder(
  id: string,
  options: {
    status?: string;
    deliveryDate?: string | null;
    followUpDate?: string | null;
    receivableMinor?: number;
  } = {},
): StoredCraftOrder {
  const cost = calculateCostSnapshot(`${id}-cost`, {
    source: "draft",
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: NOW,
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
    createdAt: NOW,
  });
  const receivableMinor = options.receivableMinor ?? 0;
  return {
    id,
    order: {
      ...order,
      status: (options.status ?? "in_progress") as never,
      settlementStatus: receivableMinor > 0 ? ("debt" as never) : order.settlementStatus,
      receivableMinor,
    },
    catalogItemId: null,
    deliveryDate: options.deliveryDate ?? null,
    agreementSource: null,
    followUpSummary: options.followUpDate ? "اتصال بعد التسليم" : null,
    followUpDate: options.followUpDate ?? null,
    followUpReason: options.followUpDate ? "اتفاق مع العميل" : null,
    followUpEvents: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeSchedule(id: string, orderId: string, date: string, time: string | null) {
  return {
    id,
    orderId,
    kind: "delivery" as const,
    scheduledFor: date,
    scheduledTime: time,
    durationMinutes: null,
    status: "scheduled" as const,
    postponeReason: null,
    events: [],
    recurrenceId: null,
    recurrenceIndex: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

/* كعبا الخدمات عند حد النتيجة — المنطق المفحوص هنا إسقاط القارئ وعزله،
 * والخدمات المصدر لها اختباراتها الخاصة؛ المخزن حقيقي للمواعيد/الطلبات. */
function stubServices(overrides: { dueDatesFailure?: string } = {}) {
  const collections = {
    listReceivableSources: vi.fn().mockResolvedValue({
      ok: true,
      value: [
        {
          id: "order-debt",
          kind: "order",
          personName: "سارة",
          itemName: "طلب عليه دين",
          outstandingMinor: 1000,
          occurredOn: "2026-11-01",
          sourceHref: "/orders/order-debt",
          qualifier: "دين مسجل بعد التسليم",
        },
      ],
    }),
  } as unknown as CollectionService;
  const dueDates = overrides.dueDatesFailure
    ? ({
        readPayablesAging: vi.fn().mockResolvedValue({ ok: false, message: overrides.dueDatesFailure }),
      } as unknown as DueDatesService)
    : ({
        readPayablesAging: vi.fn().mockResolvedValue({
          ok: true,
          value: {
            rows: [
              {
                purchaseId: "purchase-1",
                supplierName: "مورد الخشب",
                payableMinor: 3000,
                dueOn: "2026-11-01",
                dueState: "overdue" as const,
              },
            ],
            totals: null,
          },
        }),
      } as unknown as DueDatesService);
  const projectFinance = {
    listSettleablePayables: vi.fn().mockResolvedValue({
      ok: true,
      value: [{ event: { id: "event-1", note: "كهرباء الورشة" }, remainingMinor: 2500 }],
    }),
  } as unknown as ProjectFinancialService;
  return { collections, dueDates, projectFinance };
}

function recurringLens(occurrences: Array<{ id: string; seriesId: string; dueOn: string; status: string }>) {
  return {
    listRecurringExpenseSeries: vi.fn().mockResolvedValue({
      ok: true,
      value: [
        {
          id: "series-rent",
          title: "إيجار الورشة",
          status: "active",
          createdAt: NOW,
          updatedAt: NOW,
          currentRevision: 1,
          cancelledAt: null,
          cancelReason: null,
          archivedAt: null,
          resumedFromPeriod: null,
        },
      ],
    }),
    listRecurringExpenseRevisions: vi.fn().mockResolvedValue({
      ok: true,
      value: [
        {
          id: "series-rent:r1",
          seriesId: "series-rent",
          revision: 1,
          effectiveFromPeriod: "2026-10",
          frequency: "monthly",
          interval: 1,
          anchorDate: "2026-10-01",
          dueDay: 1,
          monthEndPolicy: "exact",
          timezone: "Asia/Amman",
          amountMode: "fixed_suggested",
          suggestedAmountMinor: 12000,
          suggestedWalletId: null,
          categoryLabel: null,
          changeReason: null,
          createdAt: NOW,
        },
      ],
    }),
    listRecurringExpenseOccurrences: vi.fn().mockResolvedValue({
      ok: true,
      value: occurrences.map(occurrence => ({
        id: occurrence.id,
        seriesId: occurrence.seriesId,
        revision: 1,
        periodKey: "2026-11",
        dueOn: occurrence.dueOn,
        occurrenceSlot: 0,
        status: occurrence.status,
        snoozedUntil: null,
        skippedAt: null,
        skipReason: null,
        reviewedAmountMinor: null,
        reviewedWalletId: null,
        reviewedOccurredOn: null,
        recordedFinancialEventId: null,
        recordingIdempotencyKey: "rec-key",
        actionHistory: [],
        createdAt: NOW,
        updatedAt: NOW,
      })),
    }),
  };
}

async function seededStore() {
  const store = new MemoryLocalStore();
  await store.saveOrder(makeStoredOrder("order-overdue", { deliveryDate: "2026-11-01" }));
  await store.saveOrder(makeStoredOrder("order-today", { deliveryDate: "2026-11-02" }));
  await store.saveOrder(
    makeStoredOrder("order-upcoming", { deliveryDate: "2026-11-20", followUpDate: "2026-11-21" }),
  );
  await store.saveOrder(makeStoredOrder("order-nodate", { deliveryDate: null }));
  await store.saveOrder(
    makeStoredOrder("order-debt", { status: "delivered", deliveryDate: "2026-10-20", receivableMinor: 1000 }),
  );
  await store.saveSchedule(makeSchedule("schedule-overdue", "order-overdue", "2026-11-01", null));
  await store.saveSchedule(makeSchedule("schedule-today", "order-today", "2026-11-02", "14:00"));
  await store.saveSchedule(makeSchedule("schedule-upcoming", "order-upcoming", "2026-11-20", null));
  return store;
}

const ALL_SOURCES: FollowUpSourceKey[] = [
  "schedules",
  "customerFollowUps",
  "receivables",
  "supplierPayables",
  "expensePayables",
  "recurringReviews",
];

describe("S13 — قارئ المتابعة الموحدة (UNIT-018/012)", () => {
  it("قراءة كل المصادر بلا أي كتابة — اللقطة بالبايت كما كانت", async () => {
    const store = await seededStore();
    const commits = vi.fn();
    const guarded = new Proxy(store, {
      get(target, prop: string) {
        if (prop.startsWith("commit")) {
          const value = Reflect.get(target, prop, target) as unknown;
          return function wrapped(this: unknown, ...args: unknown[]) {
            commits();
            return (value as (...a: unknown[]) => unknown).apply(target, args);
          };
        }
        const value = Reflect.get(target, prop, target) as unknown;
        return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
      },
    }) as unknown as PrototypeLocalStore;
    const before = await store.readSnapshot();
    const service = new UnifiedFollowUpService(
      activeDeliveryLens(guarded),
      guarded,
      stubServices().collections,
      stubServices().dueDates,
      stubServices().projectFinance,
      recurringLens([
        { id: "occ-1", seriesId: "series-rent", dueOn: "2026-11-01", status: "planned" },
      ]) as never,
      now,
    );
    const reading = await service.read();
    expect(reading.ok).toBe(true);
    expect(commits).toHaveBeenCalledTimes(0);
    const after = await store.readSnapshot();
    expect(after.ok && JSON.stringify(after.value)).toBe(before.ok ? JSON.stringify(before.value) : "");
  });

  it("هوية نوعية: التسليم والمتابعة والتحصيل لنفس الطلب ثلاث مهام مستقلة", async () => {
    const store = await seededStore();
    const service = new UnifiedFollowUpService(
      activeDeliveryLens(store),
      store,
      stubServices().collections,
      stubServices().dueDates,
      stubServices().projectFinance,
      recurringLens([]) as never,
      now,
    );
    const reading = await service.read();
    if (!reading.ok) throw new Error("read failed");
    const keys = new Set<string>();
    for (const key of ALL_SOURCES) {
      const source = reading.value.sources[key];
      if (source.state !== "ready") continue;
      for (const task of source.tasks) keys.add(task.itemKey);
    }
    expect(keys.has("schedule:schedule-upcoming:delivery")).toBe(true);
    expect(keys.has("order:order-upcoming:customer_followup")).toBe(true);
    expect(keys.has("order:order-debt:receivable")).toBe(true);
  });

  it("التجميع متأخر/اليوم/قادم/بلا موعد بترتيب التاريخ ثم الوقت ثم الهوية — وعدد كامل قبل التصفية", async () => {
    const store = await seededStore();
    const service = new UnifiedFollowUpService(
      activeDeliveryLens(store),
      store,
      stubServices().collections,
      stubServices().dueDates,
      stubServices().projectFinance,
      recurringLens([
        { id: "occ-1", seriesId: "series-rent", dueOn: "2026-11-01", status: "planned" },
      ]) as never,
      now,
    );
    const reading = await service.read();
    if (!reading.ok) throw new Error("read failed");
    const projection = projectFollowUp(reading.value, { taskKind: "all", period: null });
    const byGroup = new Map(projection.groups.map(group => [group.group, group.tasks]));
    expect(byGroup.get("overdue")!.map(task => task.itemKey)).toContain("schedule:schedule-overdue:delivery");
    expect(byGroup.get("overdue")!.map(task => task.itemKey)).toContain(
      "supplier_purchase:purchase-1:payable",
    );
    expect(byGroup.get("overdue")!.map(task => task.itemKey)).toContain("recurring:series-rent:review:occ-1");
    expect(byGroup.get("today")!.map(task => task.itemKey)).toContain("schedule:schedule-today:delivery");
    expect(byGroup.get("upcoming")!.map(task => task.itemKey)).toContain(
      "schedule:schedule-upcoming:delivery",
    );
    expect(byGroup.get("upcoming")!.map(task => task.itemKey)).toContain(
      "order:order-upcoming:customer_followup",
    );
    /* بلا موعد: التحصيل والسداد وموعد الطلب المجهول — لا يدخلون «متأخرًا». */
    expect(byGroup.get("undated")!.map(task => task.itemKey)).toContain("order:order-debt:receivable");
    expect(byGroup.get("undated")!.map(task => task.itemKey)).toContain(
      "financial_event:event-1:expense_payable",
    );
    /* الطلب بلا موعد لا يولد مهمة موعد أصلًا — «بلا موعد معلن» تمثيله في
     * وجهة الطلبات، والمهام المؤرخة فقط تدخل المجموعات المؤرخة. */
    const allKeys = projection.groups.flatMap(group => group.tasks).map(task => task.itemKey);
    expect(allKeys.some(key => key.startsWith("schedule:") && key.includes("nodate"))).toBe(false);
    /* العدد الكامل للمصادر الجاهزة قبل التصفية — صادق عند القراءة الجزئية. */
    expect(projection.readyTaskCount).toBeGreaterThanOrEqual(7);
  });

  it("تصفية النوع والفترة على المجتمع كله — وبلا موعد لا يدخل فترة مخصصة خفية", async () => {
    const store = await seededStore();
    const service = new UnifiedFollowUpService(
      activeDeliveryLens(store),
      store,
      stubServices().collections,
      stubServices().dueDates,
      stubServices().projectFinance,
      recurringLens([]) as never,
      now,
    );
    const reading = await service.read();
    if (!reading.ok) throw new Error("read failed");
    const onlyReceivables = projectFollowUp(reading.value, { taskKind: "receivable", period: null });
    expect(onlyReceivables.groups.flatMap(group => group.tasks).map(task => task.taskKind)).toEqual([
      "receivable",
    ]);
    const november = projectFollowUp(reading.value, {
      taskKind: "all",
      period: { from: "2026-11-01", to: "2026-11-30" },
    });
    const novemberKeys = november.groups.flatMap(group => group.tasks).map(task => task.itemKey);
    expect(novemberKeys).toContain("schedule:schedule-today:delivery");
    expect(novemberKeys).not.toContain("order:order-debt:receivable");
    /* العدد الكامل ما زال يعلن الجاهز كله رغم التصفية. */
    expect(november.readyTaskCount).toBeGreaterThanOrEqual(7);
  });

  it("فشل مصدر يعزل نفسه — السليم يبقى والإعلان باسم المصدر المتعذر", async () => {
    const store = await seededStore();
    const service = new UnifiedFollowUpService(
      activeDeliveryLens(store),
      store,
      stubServices().collections,
      stubServices({ dueDatesFailure: "قاعدة المورد مقفلة" }).dueDates,
      stubServices().projectFinance,
      recurringLens([]) as never,
      now,
    );
    const reading = await service.read();
    if (!reading.ok) throw new Error("read failed");
    expect(reading.value.sources.supplierPayables.state).toBe("error");
    const projection = projectFollowUp(reading.value, { taskKind: "all", period: null });
    expect(projection.errorSources.map(source => source.key)).toEqual(["supplierPayables"]);
    const keys = projection.groups.flatMap(group => group.tasks).map(task => task.itemKey);
    expect(keys).toContain("schedule:schedule-today:delivery");
    expect(keys).toContain("order:order-debt:receivable");
  });

  it("الدورة غير المؤكدة تذكير بمبلغ مقترح موسوم — لا دين ولا كتابة عند الفتح", async () => {
    const store = await seededStore();
    const service = new UnifiedFollowUpService(
      activeDeliveryLens(store),
      store,
      stubServices().collections,
      stubServices().dueDates,
      stubServices().projectFinance,
      recurringLens([
        { id: "occ-1", seriesId: "series-rent", dueOn: "2026-11-05", status: "planned" },
      ]) as never,
      now,
    );
    const reading = await service.read();
    if (!reading.ok) throw new Error("read failed");
    const source = reading.value.sources.recurringReviews;
    if (source.state !== "ready") throw new Error("recurring source should be ready");
    const task = source.tasks[0]!;
    expect(task.taskKind).toBe("recurring_review");
    expect(task.amountProposed).toBe(true);
    expect(task.amountMinor).toBe(12000);
    expect(task.amountRole).toContain("مقترح");
    expect(task.sourceHref).toBe("/finance/recurring/series-rent");
  });

  it("موعد بلا وقت يبقى بلا 00:00 — والوقت المعلوم يظهر كما سجل", async () => {
    const store = await seededStore();
    const service = new UnifiedFollowUpService(
      activeDeliveryLens(store),
      store,
      stubServices().collections,
      stubServices().dueDates,
      stubServices().projectFinance,
      recurringLens([]) as never,
      now,
    );
    const reading = await service.read();
    if (!reading.ok) throw new Error("read failed");
    const source = reading.value.sources.schedules;
    if (source.state !== "ready") throw new Error("schedules source should be ready");
    const byKey = new Map(source.tasks.map(task => [task.itemKey, task]));
    expect(byKey.get("schedule:schedule-overdue:delivery")!.scheduledTime).toBeNull();
    expect(byKey.get("schedule:schedule-today:delivery")!.scheduledTime).toBe("14:00");
  });
});
