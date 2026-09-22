import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { closeExpenseBudget, createExpenseBudget, reviseExpenseBudget } from "@micro-domain/budget/index.js";
import type { ExpenseBudgetRecord } from "@micro-domain/budget/index.js";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { expenseBudgetStore, financialEventStore } from "./indexedDbStores";

/* FIN-002 (عقد ٤٢ / نمط D-037): ترقية المخطط ٣٦→٣٧ بإنشاء محروس فقط — قاعدة
 * ٣٦ حقيقية (بمخازنها القائمة وحدث مالي قديم) تُفتح بالمحوّل الجديد فيُهيَّأ
 * مخزن الميزانيات فارغًا، والسجل القديم كما هو حرفيًا؛ لا ترحيل بيانات ولا
 * فقدًا صامتًا (نمط OPS-003 نفسه — IndexedDbLocalStore.recurringExpense.test.ts).
 * ثم عقد الالتزام المحروس: إعادة الاستخدام الحرفي، والتعارض الصادر، وزوج
 * المراجعة الذرّي في معاملة واحدة (نمط المجموعة ٤ — group4.test.ts). */

const databaseName = "micro-prototype-local";
const NOW = "2026-09-22T08:00:00.000Z";

function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function openLegacySchema36(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 36);
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
        id: "legacy-event-36",
        type: "operating_expense_cash",
        currency: "JOD",
        amountMinor: 12_000,
        occurredOn: "2026-05-05",
        recordedAt: "2026-05-05T09:00:00.000Z",
        idempotencyKey: "legacy-key-36",
        note: "حدث ما قبل عقد ٤٢",
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

function makeActiveBudget(id: string, periodKey: string, operationKey: string): ExpenseBudgetRecord {
  return createExpenseBudget(
    {
      id,
      periodKind: "month",
      periodKey,
      scope: { kind: "general_expense" },
      amountMinor: 20_000,
      knowledge: "known",
      note: "خطة صريحة",
      operationKey,
      createdAt: NOW,
    },
    [],
  );
}

describe("FIN-002 — ترقية المخطط ٣٦→٣٧ بإنشاء محروس فقط (عقد ٤٢)", () => {
  afterEach(async () => {
    await clearDatabase();
  });

  it("قاعدة ٣٦ تُفتح على ٣٧: مخزن الميزانيات فارغ والسجل القديم سليم بلا ترحيل", async () => {
    await clearDatabase();
    await openLegacySchema36();
    const store = new IndexedDbLocalStore();
    const budgets = await store.listExpenseBudgets();
    expect(budgets.ok && budgets.value).toHaveLength(0);
    const events = await store.listFinancialEvents();
    expect(events.ok && events.value).toHaveLength(1);
    expect(events.ok && events.value[0]?.id).toBe("legacy-event-36");
    expect(events.ok && events.value[0]?.amountMinor).toBe(12_000);

    /* الكتابة بعد الترقية تعمل والمخزن الجديد يستقبل طبيعيًا. */
    const created = await store.saveExpenseBudget(
      makeActiveBudget("budget-upgrade", "2026-10", "op-upgrade"),
    );
    expect(created.ok).toBe(true);
    const budgetsAfter = await store.listExpenseBudgets();
    expect(budgetsAfter.ok && budgetsAfter.value).toHaveLength(1);
    const eventsAfter = await store.listFinancialEvents();
    expect(eventsAfter.ok && eventsAfter.value).toHaveLength(1);
  });

  it("مخزن الميزانيات موجود بالاسم الكنوني بعد الترقية (بيان نقاط الاتصال)", async () => {
    await clearDatabase();
    await openLegacySchema36();
    const store = new IndexedDbLocalStore();
    await store.listExpenseBudgets();
    const names = await new Promise<string[]>((resolve, reject) => {
      const request = indexedDB.open(databaseName);
      request.onsuccess = () => {
        const database = request.result;
        resolve(Array.from(database.objectStoreNames));
        database.close();
      };
      request.onerror = () => reject(request.error);
    });
    expect(names).toContain(expenseBudgetStore);
    expect(names).toContain("expense-budgets");
  });
});

describe("FIN-002 — عقد الالتزام المحروس لميزانيات IndexedDB (عقد ٤٢ §٥/§٨)", () => {
  afterEach(async () => {
    await clearDatabase();
  });

  it("الحفظ الحتمي: نفس السجل إعادة استخدام، والمختلف على المعرّف نفسه رفض صادر بلا كتابة", async () => {
    await clearDatabase();
    const store = new IndexedDbLocalStore();
    const budget = makeActiveBudget("budget-1", "2026-10", "op-create-1");
    const created = await store.saveExpenseBudget(budget);
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error(created.message);
    expect(created.value.reused).toBe(false);
    /* إعادة إرسال نفس العملية: إعادة استخدام صادقة لا كتابة ثانية. */
    const replayed = await store.saveExpenseBudget(budget);
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) throw new Error(replayed.message);
    expect(replayed.value.reused).toBe(true);
    const afterReplay = await store.listExpenseBudgets();
    expect(afterReplay.ok && afterReplay.value).toHaveLength(1);
    /* مضمون مختلف على المعرّف نفسه: رفض صادر (storage_stale) بلا كتابة. */
    const conflict = await store.saveExpenseBudget({ ...budget, amountMinor: 99_999 });
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) expect(conflict.code).toBe("storage_stale");
    const afterConflict = await store.listExpenseBudgets();
    expect(afterConflict.ok && afterConflict.value[0]?.amountMinor).toBe(20_000);
  });

  it("زوج المراجعة الذرّي: الخلف والسابقة في معاملة واحدة؛ إعادة الزوج إعادة استخدام", async () => {
    await clearDatabase();
    const store = new IndexedDbLocalStore();
    const previous = makeActiveBudget("budget-prev", "2026-11", "op-create-prev");
    const seeded = await store.saveExpenseBudget(previous);
    expect(seeded.ok).toBe(true);
    const pair = reviseExpenseBudget(previous, {
      successorId: "budget-next",
      amountMinor: 35_000,
      knowledge: "estimated",
      note: "مراجعة بعد ارتفاع الأسعار",
      operationKey: "op-revise-1",
      at: NOW,
    });
    const committed = await store.saveExpenseBudgetRevisionPair(pair.successor, pair.supersededPrevious);
    expect(committed.ok).toBe(true);
    if (!committed.ok) throw new Error(committed.message);
    expect(committed.value.reused).toBe(false);
    const budgets = await store.listExpenseBudgets();
    expect(budgets.ok && budgets.value).toHaveLength(2);
    const superseded = budgets.ok ? budgets.value.find(record => record.id === "budget-prev") : undefined;
    expect(superseded?.status).toBe("superseded");
    expect(superseded?.supersededById).toBe("budget-next");
    /* إعادة تشغيل الزوج كاملًا: إعادة استخدام لا كتابة ثانية. */
    const replay = await store.saveExpenseBudgetRevisionPair(pair.successor, pair.supersededPrevious);
    expect(replay.ok && replay.value.reused).toBe(true);
    const budgetsAfterReplay = await store.listExpenseBudgets();
    expect(budgetsAfterReplay.ok && budgetsAfterReplay.value).toHaveLength(2);
    /* الزوج المكسور (السابقة لا تربط بخلفها): رفض صادر ولا يُكتب شيء. */
    const broken = await store.saveExpenseBudgetRevisionPair(pair.successor, {
      ...pair.supersededPrevious,
      supersededById: "someone-else",
    });
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.code).toBe("storage_stale");
    const budgetsAfterBroken = await store.listExpenseBudgets();
    expect(budgetsAfterBroken.ok && budgetsAfterBroken.value).toHaveLength(2);
    /* نصف زوج (الخلف وحده قائم، السابقة غائبة): رفض صادر بلا حالة بينية. */
    const half = await store.saveExpenseBudgetRevisionPair(pair.successor, {
      ...pair.supersededPrevious,
      id: "budget-half",
    });
    expect(half.ok).toBe(false);
    if (!half.ok) expect(half.code).toBe("storage_stale");
  });

  it("readSnapshot وreplaceSnapshot تحملان عائلة الميزانيات كما كُتبت", async () => {
    await clearDatabase();
    const store = new IndexedDbLocalStore();
    const general = makeActiveBudget("budget-general", "2026-10", "op-create-general");
    await store.saveExpenseBudget(general);
    const closed = closeExpenseBudget(general, { reason: "الشهر انتهى بلا حاجة", at: NOW });
    /* الإغلاق سجل جديد المضمون على المعرّف نفسه — يُكتب عبر استبدال اللقطة
     * (مسار الاستعادة) لأن الحفظ المفرد حتمي الإنشاء؛ اللقطة تحمله كما هو. */
    const snapshot = await store.readSnapshot();
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) throw new Error(snapshot.message);
    expect(snapshot.value.expenseBudgets).toHaveLength(1);
    const replaced = await store.replaceSnapshot({ ...snapshot.value, expenseBudgets: [closed] });
    expect(replaced.ok).toBe(true);
    const budgetsAfter = await store.listExpenseBudgets();
    expect(budgetsAfter.ok && budgetsAfter.value[0]?.status).toBe("closed");
    expect(budgetsAfter.ok && budgetsAfter.value[0]?.closeReason).toBe("الشهر انتهى بلا حاجة");
    const reread = await store.readSnapshot();
    expect(reread.ok && reread.value.expenseBudgets).toEqual([closed]);
  });
});
