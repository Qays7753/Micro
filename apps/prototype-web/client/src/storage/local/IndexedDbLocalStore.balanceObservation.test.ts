import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { createCashObservation } from "@micro-domain/cash-continuity/index.js";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { balanceObservationStore, financialEventStore } from "./indexedDbStores";

/* S04 (DOC-013 / UNIT-025 — نمط D-037 نفسه): ترقية المخطط ٣٨→٣٩ بإنشاء
 * محروس فقط — قاعدة ٣٨ حقيقية (بمخازنها القائمة وحدث مالي قديم) تُفتح
 * بالمحوّل الجديد فيُهيَّأ مخزن رصد الأرصدة فارغًا والسجل القديم كما هو
 * حرفيًا؛ لا ترحيل بيانات ولا فقدًا صامت ولا إعادة تفسير (نمط FIN-001/
 * FIN-002 — IndexedDbLocalStore.receivedLoan/expenseBudget.test.ts).
 * ثم عقد حد الكتابة: الالتزام الذرّي للقياس (وحده أو مع تسويته المرتبطة)،
 * وإعادة الاستخدام الحتمي، ورفض نصف الحالة — داخل معاملات IndexedDB نفسها. */

const databaseName = "micro-prototype-local";
const NOW = "2026-10-28T09:00:00.000Z";

function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function openLegacySchema38(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 38);
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
        id: "legacy-event-38",
        type: "operating_expense_cash",
        currency: "JOD",
        amountMinor: 9_000,
        occurredOn: "2026-06-05",
        recordedAt: "2026-06-05T09:00:00.000Z",
        idempotencyKey: "legacy-key-38",
        note: "حدث ما قبل رصد الأرصدة",
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
        cashDeltaMinor: -9_000,
        payableDeltaMinor: 0,
        ownerCapitalDeltaMinor: 0,
        operatingExpenseDeltaMinor: 9_000,
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

function measurement(id: string, operationKey: string, countedMinor = 8_800) {
  return createCashObservation({
    id,
    scopeKind: "project_total",
    walletId: null,
    countedMinor,
    knowledge: "known",
    cutoff: NOW,
    observedOn: "2026-10-28",
    recordedAt: NOW,
    operationKey,
    note: "رصد ترقية المخطط",
    walletKind: null,
  });
}

describe("S04 — ترقية المخطط ٣٨→٣٩ بإنشاء محروس فقط (DOC-013)", () => {
  afterEach(async () => {
    await clearDatabase();
  });

  it("قاعدة ٣٨ تُفتح على ٣٩: مخزن رصد الأرصدة فارغ والسجل القديم سليم بلا ترحيل", async () => {
    await clearDatabase();
    await openLegacySchema38();
    const store = new IndexedDbLocalStore();
    const observations = await store.listBalanceObservations();
    expect(observations.ok && observations.value).toHaveLength(0);
    const events = await store.listFinancialEvents();
    expect(events.ok && events.value).toHaveLength(1);
    expect(events.ok && events.value[0]?.id).toBe("legacy-event-38");
    expect(events.ok && events.value[0]?.amountMinor).toBe(9_000);
    /* الكتابة بعد الترقية تعمل والمخزن الجديد يستقبل القياس طبيعيًا. */
    const committed = await store.commitCashObservation(
      measurement("obs-upgrade", "obs-upgrade-key"),
      null,
      null,
    );
    expect(committed.ok).toBe(true);
    const observationsAfter = await store.listBalanceObservations();
    expect(observationsAfter.ok && observationsAfter.value).toHaveLength(1);
    const eventsAfter = await store.listFinancialEvents();
    expect(eventsAfter.ok && eventsAfter.value).toHaveLength(1);
  });

  it("مخزن رصد الأرصدة موجود بالاسم الكنوني بعد الترقية بفهارسه الثلاثة (بيان نقاط الاتصال)", async () => {
    await clearDatabase();
    await openLegacySchema38();
    const store = new IndexedDbLocalStore();
    await store.listBalanceObservations();
    const inspected = await new Promise<{ names: string[]; indexes: string[] }>((resolve, reject) => {
      const request = indexedDB.open(databaseName);
      request.onsuccess = () => {
        const database = request.result;
        const names = Array.from(database.objectStoreNames);
        const indexes = Array.from(
          database.transaction([balanceObservationStore]).objectStore(balanceObservationStore).indexNames,
        );
        database.close();
        resolve({ names, indexes });
      };
      request.onerror = () => reject(request.error);
    });
    expect(inspected.names).toContain(balanceObservationStore);
    expect(inspected.names).toContain("balance-observations");
    expect(inspected.indexes).toContain("walletId");
    expect(inspected.indexes).toContain("observedOn");
    expect(inspected.indexes).toContain("operationKey");
  });

  it("إعادة نفس الالتزام إعادة استخدام صادقة — لا رصد مكرر ولا أثر ثانٍ", async () => {
    await clearDatabase();
    const store = new IndexedDbLocalStore();
    const first = await store.commitCashObservation(measurement("obs-idem", "obs-idem-key"), null, null);
    expect(first.ok).toBe(true);
    const repeat = await store.commitCashObservation(measurement("obs-idem", "obs-idem-key"), null, null);
    expect(repeat.ok && repeat.value.reused).toBe(true);
    const observations = await store.listBalanceObservations();
    expect(observations.ok && observations.value).toHaveLength(1);
  });
});
