/** R9-W2 rollback/recovery rehearsals (RB-1 + RB-2) — real owner paths over
 * fake-indexeddb, no production doubles. RB-1 proves the durable snapshot
 * replacement cycle: known state A → verified backup → failed replace
 * (both documented failure shapes) → previous state provably intact →
 * restore from backup → byte-shape comparison. RB-2 proves the schema
 * migration failure cycle: historical state → migration failure injected at
 * the documented cursor boundary → no partial durable state → recovery →
 * transformed-under-contract comparison. The transfer re-derivation leg is
 * an import-path in-memory complement only (pure function, no durable I/O).
 * RB-3 (R9 continuation — R9-GA-F7 root fix) proves the hardened
 * put-inside-onsuccess listeners: a synchronous throw inside a request
 * success listener resolves with the ORIGINAL error payload (never the
 * engine's replacement AbortError, never a false success), rolls back every
 * already-queued write in the transaction, and leaves state A whole.
 */
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDirectSale } from "@micro-domain/direct-sale/index.js";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";
import type { CashContinuityEntry, CashWallet } from "@micro-domain/cash-continuity/index.js";
import type { ExpenseBudgetRecord } from "@micro-domain/budget/index.js";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { migrateTransferSnapshot } from "../../application/transfers/transferSnapshotMigrations";
import { localPreferencesId, localProfileId, type LocalStoreSnapshot } from "./types";

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
afterEach(clearDatabase);

/* Deterministic stable hash: canonical JSON (sorted keys, recursively) then a
 * 64-bit-ish FNV digest plus the payload length — same input ⇒ same digest,
 * any durable drift ⇒ different digest. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map(key => [key, canonicalize(record[key])]),
    );
  }
  return value;
}
function stableHash(snapshot: unknown): string {
  const json = JSON.stringify(canonicalize(snapshot));
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let index = 0; index < json.length; index += 1) {
    const code = json.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ code, 2246822519) >>> 0;
  }
  return `${h1.toString(16)}-${h2.toString(16)}-${json.length}`;
}

const TS = "2026-10-10T09:00:00.000Z";

/** Known state A through real adapter writes across load-bearing families:
 * identity, preferences, a draft, a cash wallet with its opening entry, a
 * financial event, and a direct sale (the family carrying the unique
 * idempotencyKey index used by the async failure leg). */
async function seedStateA(store: IndexedDbLocalStore) {
  await expect(
    store.saveProfile({
      id: localProfileId,
      activityName: "ورشة رحلة الاستعادة",
      currency: "JOD",
      activityType: "custom_craft",
      createdAt: TS,
      updatedAt: TS,
    }),
  ).resolves.toMatchObject({ ok: true });
  await expect(
    store.savePreferences({
      id: localPreferencesId,
      theme: "dark",
      dailyScheduleCapacityMinutes: null,
      workMode: null,
      actualTimeTrackingEnabled: false,
      installBannerDismissedAt: null,
      updatedAt: TS,
    }),
  ).resolves.toMatchObject({ ok: true });
  await expect(
    store.saveDraft({
      id: "rb1-draft",
      intent: "customer_order",
      customerName: "ليلى",
      itemName: "رف خشبي",
      catalogItemId: null,
      specifications: "",
      quantity: 1,
      costSnapshots: [],
      activeCostSnapshotId: null,
      linkedOrderId: null,
      createdAt: TS,
      updatedAt: TS,
    }),
  ).resolves.toMatchObject({ ok: true });
  const wallet = {
    id: "rb1-wallet",
    name: "درج البروفة",
    kind: "cash_drawer" as const,
    createdAt: TS,
    createdOperationKey: "rb1-wallet-op",
  };
  const opening = {
    id: "rb1-opening",
    walletId: wallet.id,
    type: "opening_balance" as const,
    occurredOn: "2026-10-01",
    recordedAt: TS,
    cashDeltaMinor: 25_000,
    note: "بداية معلنة",
    reason: null,
    operationKey: "rb1-opening-op",
    transferId: null,
    reversesEntryId: null,
  };
  await expect(store.commitCashContinuity(wallet, [opening])).resolves.toMatchObject({
    ok: true,
    value: { wallet: { id: wallet.id }, entries: [{ id: opening.id }] },
  });
  const event = createFinancialEvent({
    id: "rb1-event",
    type: "operating_expense_cash",
    amountMinor: 1_250,
    occurredOn: "2026-10-02",
    recordedAt: TS,
    idempotencyKey: "rb1-event-op",
    note: "مصروف بروفة",
    counterparty: null,
    expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
  });
  await expect(store.saveFinancialEvent(event)).resolves.toMatchObject({ ok: true });
  const sale = createDirectSale({
    id: "rb1-sale",
    itemName: "صينية بروفة",
    quantity: 1,
    revenueMinor: 4_500,
    collectedMinor: 4_500,
    catalogItemId: null,
    customerName: null,
    costMinor: null,
    occurredOn: "2026-10-03",
    recordedAt: TS,
    note: "بيع بروفة",
    idempotencyKey: "rb1-sale-op",
  });
  await expect(store.saveDirectSale(sale)).resolves.toMatchObject({ ok: true });
  return { wallet, opening, event, sale };
}

/** Per-family read-back through the adapter's own readers (not the snapshot
 * path) — counts, values, and relationships must survive every rehearsal leg. */
async function assertStateAReadable(
  store: IndexedDbLocalStore,
  seeded: Awaited<ReturnType<typeof seedStateA>>,
) {
  await expect(store.getProfile()).resolves.toMatchObject({
    ok: true,
    value: { activityName: "ورشة رحلة الاستعادة" },
  });
  await expect(store.getPreferences()).resolves.toMatchObject({ ok: true, value: { theme: "dark" } });
  await expect(store.getDraft("rb1-draft")).resolves.toMatchObject({
    ok: true,
    value: { itemName: "رف خشبي" },
  });
  await expect(store.listCashWallets()).resolves.toMatchObject({
    ok: true,
    value: [{ id: seeded.wallet.id, name: seeded.wallet.name }],
  });
  await expect(store.listCashContinuityEntries()).resolves.toMatchObject({
    ok: true,
    value: [{ id: seeded.opening.id, cashDeltaMinor: 25_000, walletId: seeded.wallet.id }],
  });
  await expect(store.listFinancialEvents()).resolves.toMatchObject({
    ok: true,
    value: [{ id: seeded.event.id, amountMinor: 1_250 }],
  });
  await expect(store.listDirectSales()).resolves.toMatchObject({
    ok: true,
    value: [{ id: seeded.sale.id, revenueMinor: 4_500 }],
  });
}

describe("R9-W2 RB-1 — snapshot backup / replace / failure / restore (owner path)", () => {
  it("leg 1 (R9-GA-F1 regression): a synchronous queueing failure aborts the transaction, keeps state A whole, and restores from the backup", async () => {
    const store = new IndexedDbLocalStore();
    const seeded = await seedStateA(store);
    await assertStateAReadable(store, seeded);

    /* Backup A through the real snapshot reader + stable hash. */
    const backup = await store.readSnapshot();
    if (!backup.ok) throw new Error("backup read should succeed");
    const seededSales = backup.value.directSales;
    if (!seededSales) throw new Error("expected the seeded direct sales in the snapshot");
    const hashA = stableHash(backup.value);
    expect(backup.value.cashWallets).toHaveLength(1);
    expect(backup.value.directSales).toHaveLength(1);

    /* Failure injection at the documented synchronous boundary: an
     * uncloneable record (function-valued property) makes the structured
     * clone inside put() throw DataCloneError after the clears and earlier
     * puts are already queued. Pre-R9-GA-F1 this auto-committed and
     * destroyed state A while reporting an honest failure. */
    const poisoned = {
      ...backup.value,
      directSales: seededSales.map(sale =>
        sale.id === "rb1-sale" ? { ...sale, uncloneable: () => "poison" } : sale,
      ),
    } as LocalStoreSnapshot;
    const failed = await store.replaceSnapshot(poisoned);
    expect(failed.ok).toBe(false);
    expect(failed.ok === false && failed.code).toBe("storage_error");

    /* Previous state is not silently corrupted: full-snapshot hash equality
     * plus per-family reads through the adapter's own readers. */
    const after = await store.readSnapshot();
    if (!after.ok) throw new Error("post-failure read should succeed");
    expect(stableHash(after.value)).toBe(hashA);
    await assertStateAReadable(store, seeded);

    /* Restore from the backup through the same supported path. */
    const restored = await store.replaceSnapshot(backup.value);
    expect(restored.ok).toBe(true);
    const final = await store.readSnapshot();
    if (!final.ok) throw new Error("post-restore read should succeed");
    expect(stableHash(final.value)).toBe(hashA);
    await assertStateAReadable(store, seeded);

    /* The restored state survives a fresh adapter instance (durability). */
    await assertStateAReadable(new IndexedDbLocalStore(), seeded);
  });

  it("leg 2 (async request error): a unique-index violation inside the replace transaction fails honestly and rolls state A back fully", async () => {
    const store = new IndexedDbLocalStore();
    const seeded = await seedStateA(store);
    const backup = await store.readSnapshot();
    if (!backup.ok) throw new Error("backup read should succeed");
    const seededSales = backup.value.directSales;
    if (!seededSales) throw new Error("expected the seeded direct sales in the snapshot");
    const hashA = stableHash(backup.value);

    /* Engine-native failure injection (no test doubles): two direct sales
     * sharing the unique idempotencyKey index collide inside the same
     * readwrite transaction → ConstraintError on the second put → the
     * documented transaction.onerror path with faithful rollback. */
    const colliding = {
      ...backup.value,
      directSales: [...seededSales, { ...seededSales[0], id: "rb1-sale-clone" }],
    } as LocalStoreSnapshot;
    const failed = await store.replaceSnapshot(colliding);
    expect(failed.ok).toBe(false);
    expect(failed.ok === false && failed.code).toBe("storage_error");

    const after = await store.readSnapshot();
    if (!after.ok) throw new Error("post-failure read should succeed");
    expect(stableHash(after.value)).toBe(hashA);
    await assertStateAReadable(store, seeded);

    const restored = await store.replaceSnapshot(backup.value);
    expect(restored.ok).toBe(true);
    const final = await store.readSnapshot();
    if (!final.ok) throw new Error("post-restore read should succeed");
    expect(stableHash(final.value)).toBe(hashA);
  });
});

describe("R9C RB-3 (R9-GA-F7) — hardened put-inside-onsuccess listeners fail honestly with the original error and roll back fully", () => {
  /* بطاقة الدليل: قبل التحصين كان أي رمي متزامن داخل مستمع onsuccess (مثل
   * DataCloneError من put بسجل غير قابل للاستنساخ) يعتمد على معالجة المحرك
   * لاستثناء المستمع: المواصفة (IndexedDB 3.0 §5.9) تُحبِط المعاملة بحمولة
   * AbortError بديلة تفقد رسالة الخطأ الأصلي، وأي محرك لا يحترم الراية
   * القديمة يترك المعاملة تكتمل فيُنجَح الوعد بقيمة لم تُكتب. الحدود المثبتة
   * هنا على fake-indexeddb (المتاح في CI): (١) فشل صادق محسوم بلا رفض، (٢)
   * رسالة الخطأ الأصلي نفسها لا بديل AbortError الفارغ — وهذا هو الخطاف
   * الذي يفشل عند إزالة التحصين، (٣) كل كتابة ارتُتبت سلفًا في المعاملة
   * نفسها تتدحرج، (٤) الحالة A سليمة بالكامل. الطرف المتصفح-الحقيقي
   * (المحرك لا يحترم الراية) لا يمكن استنساخه على fake-indexeddb ومسجل
   * بحدوده في التقرير. */

  it("leg A (primitive writeOneIdempotent via saveDirectSale): the original DataCloneError payload survives, no sale is written, and state A stays whole", async () => {
    const store = new IndexedDbLocalStore();
    const seeded = await seedStateA(store);
    const backup = await store.readSnapshot();
    if (!backup.ok) throw new Error("backup read should succeed");
    const hashA = stableHash(backup.value);

    const poisonedSale = {
      ...createDirectSale({
        id: "rb3-sale-poison",
        itemName: "بيع مسموم",
        quantity: 1,
        revenueMinor: 9_000,
        collectedMinor: 9_000,
        catalogItemId: null,
        customerName: null,
        costMinor: null,
        occurredOn: "2026-10-04",
        recordedAt: TS,
        note: "حقن فشل متزامن",
        idempotencyKey: "rb3-sale-poison-op",
      }),
      uncloneable: () => "poison",
    } as unknown as DirectSale;
    const failed = await store.saveDirectSale(poisonedSale);
    expect(failed.ok).toBe(false);
    expect(failed.ok === false && failed.code).toBe("storage_error");
    expect(failed.ok === false && failed.message).toContain("could not be cloned");

    const after = await store.readSnapshot();
    if (!after.ok) throw new Error("post-failure read should succeed");
    expect(after.value.directSales).toHaveLength(1);
    expect(stableHash(after.value)).toBe(hashA);
    await assertStateAReadable(store, seeded);
  });

  it("leg B (Style A commitFinancialEventCorrection): a poisoned reversal fails with the original error and the events family is untouched", async () => {
    const store = new IndexedDbLocalStore();
    const seeded = await seedStateA(store);
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    const source = events.value.find(event => event.id === seeded.event.id);
    if (!source) throw new Error("seeded source event missing");

    const poisonedReversal = {
      ...source,
      id: "rb3-reversal-poison",
      idempotencyKey: "rb3-reversal-poison-op",
      correctionType: "reverse",
      correctionOfEventId: source.id,
      cashDeltaMinor: -source.cashDeltaMinor,
      payableDeltaMinor: -source.payableDeltaMinor,
      ownerCapitalDeltaMinor: -source.ownerCapitalDeltaMinor,
      operatingExpenseDeltaMinor: -source.operatingExpenseDeltaMinor,
      uncloneable: () => "poison",
    } as unknown as FinancialEvent;
    const failed = await store.commitFinancialEventCorrection(source.id, poisonedReversal);
    expect(failed.ok).toBe(false);
    expect(failed.ok === false && failed.code).toBe("storage_error");
    expect(failed.ok === false && failed.message).toContain("could not be cloned");

    await expect(store.listFinancialEvents()).resolves.toMatchObject({
      ok: true,
      value: [{ id: seeded.event.id, amountMinor: seeded.event.amountMinor }],
    });
    await assertStateAReadable(store, seeded);
  });

  it("leg C (Style B saveExpenseBudget): a poisoned fresh budget record fails with the original error and nothing is written", async () => {
    const store = new IndexedDbLocalStore();
    const seeded = await seedStateA(store);
    const poisonedBudget = {
      id: "rb3-budget-poison",
      periodKind: "month",
      periodKey: "2026-10",
      scope: { kind: "general_expense" },
      amountMinor: 12_000,
      note: null,
      createdAt: TS,
      status: "active",
      supersededById: null,
      uncloneable: () => "poison",
    } as unknown as ExpenseBudgetRecord;
    const failed = await store.saveExpenseBudget(poisonedBudget);
    expect(failed.ok).toBe(false);
    expect(failed.ok === false && failed.code).toBe("storage_error");
    expect(failed.ok === false && failed.message).toContain("could not be cloned");

    await expect(store.listExpenseBudgets()).resolves.toMatchObject({ ok: true, value: [] });
    await assertStateAReadable(store, seeded);
  });

  it("leg C2 (special commitCashContinuity): a poisoned entry rolls back the wallet write queued in the same transaction and state A stays whole", async () => {
    const store = new IndexedDbLocalStore();
    const seeded = await seedStateA(store);
    const backup = await store.readSnapshot();
    if (!backup.ok) throw new Error("backup read should succeed");
    const hashA = stableHash(backup.value);

    const poisonedWallet = {
      id: "rb3-wallet-poison",
      name: "درج السم",
      kind: "cash_drawer",
      createdAt: TS,
      createdOperationKey: "rb3-wallet-poison-op",
    } as CashWallet;
    const poisonedEntry = {
      id: "rb3-entry-poison",
      walletId: poisonedWallet.id,
      type: "opening_balance",
      occurredOn: "2026-10-05",
      recordedAt: TS,
      cashDeltaMinor: 1_000,
      note: "افتتاح مسموم",
      reason: null,
      operationKey: "rb3-entry-poison-op",
      transferId: null,
      reversesEntryId: null,
      uncloneable: () => "poison",
    } as unknown as CashContinuityEntry;
    const failed = await store.commitCashContinuity(poisonedWallet, [poisonedEntry]);
    expect(failed.ok).toBe(false);
    expect(failed.ok === false && failed.code).toBe("storage_error");
    expect(failed.ok === false && failed.message).toContain("could not be cloned");

    const after = await store.readSnapshot();
    if (!after.ok) throw new Error("post-failure read should succeed");
    expect(stableHash(after.value)).toBe(hashA);
    await assertStateAReadable(store, seeded);
  });

  it("leg D (exact-message negative proof): a deterministic injected put failure surfaces its own message verbatim — removing the guard turns it into the empty engine AbortError", async () => {
    const store = new IndexedDbLocalStore();
    const seeded = await seedStateA(store);
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    const source = events.value.find(event => event.id === seeded.event.id);
    if (!source) throw new Error("seeded source event missing");
    const injected = {
      ...source,
      id: "rb3-reversal-injected",
      idempotencyKey: "rb3-reversal-injected-op",
      correctionType: "reverse",
      correctionOfEventId: source.id,
      cashDeltaMinor: -source.cashDeltaMinor,
      payableDeltaMinor: -source.payableDeltaMinor,
      ownerCapitalDeltaMinor: -source.ownerCapitalDeltaMinor,
      operatingExpenseDeltaMinor: -source.operatingExpenseDeltaMinor,
    } as unknown as FinancialEvent;

    const originalPut = IDBObjectStore.prototype.put;
    const putSpy = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
    ) {
      if (
        value !== null &&
        typeof value === "object" &&
        (value as { id?: unknown }).id === "rb3-reversal-injected"
      ) {
        throw new Error("F7-injected");
      }
      return originalPut.call(this, value as never);
    });
    let failed: Awaited<ReturnType<typeof store.commitFinancialEventCorrection>>;
    try {
      failed = await store.commitFinancialEventCorrection(source.id, injected);
    } finally {
      putSpy.mockRestore();
    }
    expect(failed.ok).toBe(false);
    expect(failed.ok === false && failed.code).toBe("storage_error");
    expect(failed.ok === false && failed.message).toBe("F7-injected");

    await expect(store.listFinancialEvents()).resolves.toMatchObject({
      ok: true,
      value: [{ id: seeded.event.id }],
    });
    await assertStateAReadable(store, seeded);
  });
});

/** Seed a historical v25 database with one legacy per-unit allocation policy
 * (the same historical fixture shape the migration suite uses). */
function seedVersionTwentyFiveLegacyPolicy() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 25);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const policies = request.result.createObjectStore("allocation-policies", { keyPath: "id" });
      policies.put({
        id: "rb2-legacy",
        seriesId: "rb2-series",
        successorOfPolicyId: null,
        version: 1,
        catalogItemId: "rb2-catalog",
        kind: "per_output_unit",
        amountMinor: null,
        rateMinor: 50,
        percentageBps: null,
        unitId: "unit-piece",
        periodFrom: "2026-08-01",
        periodTo: "2026-08-31",
        startsOn: "2026-08-01",
        endsOn: "2026-08-31",
        source: "سجل تاريخي",
        reason: "بروفة ترحيل",
        note: "معدل لكل وحدة",
        status: "active",
        idempotencyKey: "rb2-legacy-op",
        createdAt: TS,
        updatedAt: TS,
      });
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
  });
}

/** Direct durable read at the historical version (bypassing the adapter) —
 * the pre-migration capture and the rollback proof both use it. */
function readLegacyPolicyDirectly(): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 25);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const read = database
        .transaction("allocation-policies", "readonly")
        .objectStore("allocation-policies")
        .get("rb2-legacy");
      read.onerror = () => reject(read.error);
      read.onsuccess = () => {
        const value = read.result as Record<string, unknown>;
        database.close();
        resolve(value);
      };
    };
  });
}

describe("R9-W2 RB-2 — migration failure / recovery cycle (owner path)", () => {
  it("a cursor error mid-upgrade fails with storage_upgrade_failed, leaves no partial durable state, and the clean re-open migrates under the documented contract", async () => {
    await seedVersionTwentyFiveLegacyPolicy();

    /* Pre-migration capture through a direct historical read. */
    const preMigration = await readLegacyPolicyDirectly();
    expect(preMigration.rateMinor).toBe(50);
    expect(preMigration.rateMinorPerWholeUnit).toBeUndefined();

    /* Failure injection at the documented boundary: the upgrade cursor over
     * allocation-policies errors (the same injection the migration suite
     * uses) → guardUpgradeCursor records the cause and aborts the upgrade
     * transaction. */
    const originalOpenCursor = IDBObjectStore.prototype.openCursor;
    const cursorSpy = vi.spyOn(IDBObjectStore.prototype, "openCursor").mockImplementation(function (
      this: IDBObjectStore,
      query?,
      direction?,
    ) {
      const request = originalOpenCursor.call(this, query, direction);
      if (this.name === "allocation-policies") queueMicrotask(() => request.onerror?.(new Event("error")));
      return request;
    });
    const failing = new IndexedDbLocalStore();
    const failed = await failing.listAllocationPolicies();
    expect(failed.ok).toBe(false);
    expect(failed.ok === false && failed.code).toBe("storage_upgrade_failed");
    cursorSpy.mockRestore();

    /* No partial durable state is accepted as complete: the database still
     * opens at 25 with the legacy record byte-identical (the v26 rate-split
     * field was never half-written). */
    const rolledBack = await readLegacyPolicyDirectly();
    expect(rolledBack.rateMinor).toBe(50);
    expect(rolledBack.rateMinorPerWholeUnit).toBeUndefined();
    expect(stableHash(rolledBack)).toBe(stableHash(preMigration));

    /* Recovery: the clean re-open runs the real migration; the record is
     * intentionally transformed under the documented oldVersion<26 contract
     * (rateMinor preserved verbatim; rateMinorPerWholeUnit derived) — not
     * byte-preserving, contract-transforming by design. */
    const recovered = new IndexedDbLocalStore();
    const policies = await recovered.listAllocationPolicies();
    expect(policies.ok).toBe(true);
    /* عقد التحويل الموثق (بوابة oldVersion<26): سياسة per_output_unit
     * يُشتق لها rateMinorPerWholeUnit من rateMinor التاريخي ويُفرَّغ
     * rateMinor — تحويل مقصود بموجب عقد قائم لا حفظ للبايت. */
    expect(policies.ok && policies.value[0]?.rateMinorPerWholeUnit).toBe(50);
    expect(policies.ok && policies.value[0]?.rateMinor).toBeNull();

    /* Full-cycle restore proof over the migrated store: snapshot → replace
     * the same snapshot → identical hash (the backup/restore path is healthy
     * on the recovered database). */
    const snapshot = await recovered.readSnapshot();
    if (!snapshot.ok) throw new Error("post-recovery snapshot should read");
    const restored = await recovered.replaceSnapshot(snapshot.value);
    expect(restored.ok).toBe(true);
    const final = await recovered.readSnapshot();
    if (!final.ok) throw new Error("post-restore snapshot should read");
    expect(stableHash(final.value)).toBe(stableHash(snapshot.value));
  });

  it("import-path complement (in-memory only): migrateTransferSnapshot tolerates malformed legacy raw shapes by null-coalescing without throwing", async () => {
    /* This leg proves the shared transfer re-derivation is total (no throw,
     * every missing family normalizes) — an import-path complement, NOT
     * durable-recovery evidence (the function performs no I/O; durable
     * rollback is proven by the legs above). */
    const raw = {
      profile: { id: localProfileId, activityName: "قديم" },
      drafts: "ليست مصفوفة",
      orders: [{ id: "legacy-order", catalogItemId: null }],
      schedules: [{ id: "legacy-schedule" }],
    } as unknown as Record<string, unknown>;
    const migrated = migrateTransferSnapshot(raw, false);
    expect(migrated.ownerProfile).toBeNull();
    expect(migrated.drafts).toEqual([]);
    expect(migrated.orders).toEqual([
      {
        id: "legacy-order",
        catalogItemId: null,
        followUpSummary: null,
        followUpDate: null,
        followUpReason: null,
        followUpEvents: [],
      },
    ]);
    expect(migrated.schedules).toEqual([
      { id: "legacy-schedule", recurrenceId: null, recurrenceIndex: null },
    ]);
    expect(migrated.directSales).toEqual([]);
    expect(migrated.expenseBudgets).toEqual([]);
  });
});

/* R9-GA-F7.1 (استمرار R9 الجذري — الوجه القرائي لعائلة F7): جسم مستمع
 * نجاح listAll كان يستدعي مقارن الترتيب بلا التقاط — سجل مشوّه يُفشِل
 * المقارن كان يهرب الرمي إلى المحرك فلا يُحسم الوعد أبدًا وتبقى الصفحة
 * في التحميل الأبدي. البروفة: سجلان (سليم + مشوّه updatedAt رقمية) ثم
 * قراءة القائمة داخل سباق محدود — الحارس يحسم الفشل بالخطأ الأصلي،
 * وإزالته تُعلّق القراءة فيفشل السباق (الإثبات السلبي). */
describe("R9C RB-4 (R9-GA-F7.1) — the listAll read path settles honestly when a sort comparator throws on a malformed stored record", () => {
  it("a malformed record resolves listOrders as an honest storage failure with the original error message — never an unresolved promise", async () => {
    const store = new IndexedDbLocalStore();
    /* بذر سجلين مباشرة عبر المهايئ (writeOne بلا تحقق — نفس مسار الإنتاج):
     * سليم + مشوّه (updatedAt رقمية) — المقارن يستدعي localeCompare عليها. */
    /* سجلان مشوّها التاريخ (updatedAt رقمية لا نصية): أي استدعاء للمقارن
     * يرمي — اتجاه الاستدعاء غير ذي صلة لأن كلا الطرفين فاسد. */
    const first = await store.saveOrder({
      id: "rb4-order-a",
      order: { status: "delivered" },
      updatedAt: 17_294_400_000,
      events: [],
    } as unknown as Parameters<typeof store.saveOrder>[0]);
    if (!first.ok) throw new Error(first.message);
    const second = await store.saveOrder({
      id: "rb4-order-b",
      order: { status: "delivered" },
      updatedAt: 17_295_000_000,
      events: [],
    } as unknown as Parameters<typeof store.saveOrder>[0]);
    if (!second.ok) throw new Error(second.message);

    const listing = await Promise.race([
      store.listOrders(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("RB-4: listOrders never settled — the read hang regression")),
          2_000,
        ),
      ),
    ]);
    /* الفشل الصادق: ok:false برسالة الخطأ الأصلي نفسها، لا تعليقًا أبدًا. */
    expect(listing.ok).toBe(false);
    if (!listing.ok) {
      expect(listing.code).toBe("storage_error");
      expect(listing.message).toContain("localeCompare");
    }
  });
});
