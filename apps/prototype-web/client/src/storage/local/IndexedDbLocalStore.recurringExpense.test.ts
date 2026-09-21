import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { createRecurringExpenseDraftSeries } from "@micro-domain/recurring-expense/index.js";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { financialEventStore, recurringExpenseOccurrenceStore } from "./indexedDbStores";

/* OPS-003 (عقد ٤١ / D-037): ترقية المخطط ٣٥→٣٦ بإنشاء محروس فقط — قاعدة
 * ٣٥ حقيقية (بمخازنها القائمة وحدث مالي قديم) تُفتح بالمحوّل الجديد فتُهيَّأ
 * المخازن الثلاثة فارغة، والسجل القديم كما هو حرفيًا؛ لا ترحيل بيانات ولا
 * فقدًا صامتًا (نمط المجموعة ٥ نفسه — IndexedDbLocalStore.test.ts:281-354). */

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function openLegacySchema35(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 35);
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
        id: "legacy-event-1",
        type: "operating_expense_cash",
        currency: "JOD",
        amountMinor: 12_000,
        occurredOn: "2026-05-05",
        recordedAt: "2026-05-05T09:00:00.000Z",
        idempotencyKey: "legacy-key-1",
        note: "حدث ما قبل عقد ٤١",
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

describe("OPS-003 — ترقية المخطط ٣٥→٣٦ بإنشاء محروس فقط (عقد ٤١ §١٠)", () => {
  afterEach(async () => {
    await clearDatabase();
  });

  it("قاعدة ٣٥ تُفتح على ٣٦: المخازن الجديدة فارغة والسجل القديم سليم بلا ترحيل", async () => {
    await clearDatabase();
    await openLegacySchema35();
    const store = new IndexedDbLocalStore();
    const series = await store.listRecurringExpenseSeries();
    expect(series.ok && series.value).toHaveLength(0);
    const revisions = await store.listRecurringExpenseRevisions();
    expect(revisions.ok && revisions.value).toHaveLength(0);
    const occurrences = await store.listRecurringExpenseOccurrences();
    expect(occurrences.ok && occurrences.value).toHaveLength(0);
    const events = await store.listFinancialEvents();
    expect(events.ok && events.value).toHaveLength(1);
    expect(events.ok && events.value[0]?.id).toBe("legacy-event-1");
    expect(events.ok && events.value[0]?.amountMinor).toBe(12_000);

    /* الكتابة بعد الترقية تعمل والمخزن الجديد يستقبل طبيعيًا. */
    const draft = createRecurringExpenseDraftSeries({
      id: "series-upgrade",
      title: "إنترنت المحل",
      createdAt: "2026-09-21T08:00:00.000Z",
      rule: {
        effectiveFromPeriod: "2026-01",
        frequency: "monthly",
        interval: 1,
        anchorDate: "2026-01-10",
        dueDay: 10,
        monthEndPolicy: "last_valid_day",
        timezone: "Asia/Amman",
        amountMode: "manual",
        suggestedAmountMinor: null,
        suggestedWalletId: null,
        categoryLabel: null,
        changeReason: null,
      },
    });
    const created = await store.commitRecurringExpenseDraft(draft.series, draft.revision);
    expect(created.ok).toBe(true);
    const seriesAfter = await store.listRecurringExpenseSeries();
    expect(seriesAfter.ok && seriesAfter.value).toHaveLength(1);
    const eventsAfter = await store.listFinancialEvents();
    expect(eventsAfter.ok && eventsAfter.value).toHaveLength(1);
  });

  it("مخزن الفترات موجود بالاسم الكنوني بعد الترقية (بيان نقاط الاتصال)", async () => {
    await clearDatabase();
    await openLegacySchema35();
    const store = new IndexedDbLocalStore();
    await store.listRecurringExpenseOccurrences();
    const names = await new Promise<string[]>((resolve, reject) => {
      const request = indexedDB.open(databaseName);
      request.onsuccess = () => {
        const database = request.result;
        resolve(Array.from(database.objectStoreNames));
        database.close();
      };
      request.onerror = () => reject(request.error);
    });
    expect(names).toContain(recurringExpenseOccurrenceStore);
    expect(names).toContain("recurring-expense-series");
    expect(names).toContain("recurring-expense-revisions");
  });
});
