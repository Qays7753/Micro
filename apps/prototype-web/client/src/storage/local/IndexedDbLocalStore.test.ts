import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";
import { localPreferencesId, localProfileId, type ActivityProfile, type OrderDraft, type StoredCraftOrder } from "./types";

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
afterEach(clearDatabase);

function seedVersionOneDraft() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("activity-profile", { keyPath: "id" });
      const drafts = request.result.createObjectStore("order-drafts", { keyPath: "id" });
      drafts.createIndex("updatedAt", "updatedAt");
    };
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("order-drafts", "readwrite");
      transaction.objectStore("order-drafts").put({ id: "legacy", intent: "customer_order", customerName: "", itemName: "مسودة قديمة", specifications: "", quantity: 1, createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z" });
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    };
  });
}

function seedVersionSevenSchedule() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 7);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => { request.result.createObjectStore("activity-profile", { keyPath: "id" }); request.result.createObjectStore("local-preferences", { keyPath: "id" }); request.result.createObjectStore("order-drafts", { keyPath: "id" }); request.result.createObjectStore("craft-orders", { keyPath: "id" }); request.result.createObjectStore("financial-events", { keyPath: "id" }); request.result.createObjectStore("schedule-entries", { keyPath: "id" }); };
    request.onsuccess = () => { const database = request.result; const transaction = database.transaction(["local-preferences", "schedule-entries"], "readwrite"); transaction.objectStore("local-preferences").put({ id: localPreferencesId, theme: "light", updatedAt: "2026-08-22T00:00:00.000Z" }); transaction.objectStore("schedule-entries").put({ id: "legacy-schedule", orderId: "legacy-order", kind: "delivery", scheduledFor: "2026-08-23", status: "scheduled", postponeReason: null, events: [{ id: "legacy-created", type: "created", idempotencyKey: "legacy-created", createdAt: "2026-08-22T00:00:00.000Z", previousScheduledFor: null, scheduledFor: "2026-08-23", reason: null }], createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z" }); transaction.oncomplete = () => { database.close(); resolve(); }; transaction.onerror = () => reject(transaction.error); };
  });
}

describe("IndexedDbLocalStore", () => {
  it("persists the profile and draft through a fresh adapter instance", async () => {
    const profile: ActivityProfile = { id: localProfileId, activityName: "مشغل ليان", currency: "JOD", activityType: "custom_craft", createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z" };
    const draft: OrderDraft = { id: "draft-1", intent: "customer_order", customerName: "سارة", itemName: "صندوق خشبي", specifications: "نقش", quantity: 2, costSnapshots: [], activeCostSnapshotId: null, linkedOrderId: null, createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:01:00.000Z" };
    const first = new IndexedDbLocalStore();
    await expect(first.saveProfile(profile)).resolves.toMatchObject({ ok: true, value: profile });
    await expect(first.savePreferences({ id: localPreferencesId, theme: "dark", dailyScheduleCapacityMinutes: null, updatedAt: "2026-08-22T00:00:00.000Z" })).resolves.toMatchObject({ ok: true, value: { theme: "dark" } });
    await expect(first.saveDraft(draft)).resolves.toMatchObject({ ok: true, value: draft });
    const resumed = new IndexedDbLocalStore();
    await expect(resumed.getProfile()).resolves.toMatchObject({ ok: true, value: profile });
    await expect(resumed.getPreferences()).resolves.toMatchObject({ ok: true, value: { theme: "dark" } });
    await expect(resumed.getDraft("draft-1")).resolves.toMatchObject({ ok: true, value: draft });
  });

  it("returns local drafts with the latest update first", async () => {
    const store = new IndexedDbLocalStore();
    const early: OrderDraft = { id: "early", intent: "planned_design", customerName: "", itemName: "قطعة أولى", specifications: "", quantity: 1, costSnapshots: [], activeCostSnapshotId: null, linkedOrderId: null, createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z" };
    const late: OrderDraft = { ...early, id: "late", itemName: "قطعة أحدث", updatedAt: "2026-08-22T01:00:00.000Z" };
    await store.saveDraft(early); await store.saveDraft(late);
    const listed = await store.listDrafts();
    expect(listed).toMatchObject({ ok: true, value: [{ id: "late" }, { id: "early" }] });
  });

  it("migrates a Slice 1 draft to the current schema without dropping its pre-domain details", async () => {
    await seedVersionOneDraft();
    const store = new IndexedDbLocalStore();
    await expect(store.getDraft("legacy")).resolves.toMatchObject({ ok: true, value: { id: "legacy", itemName: "مسودة قديمة", costSnapshots: [], activeCostSnapshotId: null, linkedOrderId: null } });
  });

  it("migrates a Slice B schedule to explicit unknown time, duration, and daily capacity fields", async () => {
    await seedVersionSevenSchedule(); const store = new IndexedDbLocalStore();
    await expect(store.getPreferences()).resolves.toMatchObject({ ok: true, value: { theme: "light", dailyScheduleCapacityMinutes: null } });
    await expect(store.getSchedule("legacy-schedule")).resolves.toMatchObject({ ok: true, value: { scheduledTime: null, durationMinutes: null, recurrenceId: null, recurrenceIndex: null, events: [{ previousScheduledTime: null, scheduledTime: null, previousDurationMinutes: null, durationMinutes: null }] } });
    await expect(store.listRecurrences()).resolves.toMatchObject({ ok: true, value: [] });
  });

  it("migrates schema 8 by adding an empty material-purchase store", async () => {
    await new Promise<void>((resolve, reject) => { const request = indexedDB.open(databaseName, 8); request.onerror = () => reject(request.error); request.onupgradeneeded = () => { request.result.createObjectStore("activity-profile", { keyPath: "id" }); request.result.createObjectStore("local-preferences", { keyPath: "id" }); request.result.createObjectStore("order-drafts", { keyPath: "id" }); request.result.createObjectStore("craft-orders", { keyPath: "id" }); request.result.createObjectStore("financial-events", { keyPath: "id" }); request.result.createObjectStore("schedule-entries", { keyPath: "id" }); }; request.onsuccess = () => { request.result.close(); resolve(); }; });
    await expect(new IndexedDbLocalStore().listSupplierPurchases()).resolves.toMatchObject({ ok: true, value: [] });
  });

  it("migrates a schema 11 database missing cash stores without touching its prior stores", async () => {
    await new Promise<void>((resolve, reject) => { const request = indexedDB.open(databaseName, 11); request.onerror = () => reject(request.error); request.onupgradeneeded = () => { ["activity-profile", "local-preferences", "order-drafts", "craft-orders", "financial-events", "schedule-entries", "supplier-purchases"].forEach((name) => request.result.createObjectStore(name, { keyPath: "id" })); }; request.onsuccess = () => { request.result.close(); resolve(); }; });
    const store = new IndexedDbLocalStore(); await expect(store.listCashWallets()).resolves.toMatchObject({ ok: true, value: [] }); await expect(store.listCashContinuityEntries()).resolves.toMatchObject({ ok: true, value: [] });
  });

  it("migrates a schema 13 database missing material stores without touching G3 stores", async () => {
    await new Promise<void>((resolve, reject) => { const request = indexedDB.open(databaseName, 13); request.onerror = () => reject(request.error); request.onupgradeneeded = () => { ["activity-profile", "local-preferences", "order-drafts", "craft-orders", "financial-events", "schedule-entries", "supplier-purchases", "cash-wallets", "cash-continuity-entries"].forEach((name) => request.result.createObjectStore(name, { keyPath: "id" })); }; request.onsuccess = () => { request.result.close(); resolve(); }; });
    const store = new IndexedDbLocalStore(); await expect(store.listMaterials()).resolves.toMatchObject({ ok: true, value: [] }); await expect(store.listInventoryMovements()).resolves.toMatchObject({ ok: true, value: [] });
  });

  it("repairs schema 16 drafts and orders when its catalog store is missing, without name matching", async () => {
    await new Promise<void>((resolve, reject) => { const request = indexedDB.open(databaseName, 16); request.onerror = () => reject(request.error); request.onupgradeneeded = () => { ["activity-profile", "local-preferences", "order-drafts", "craft-orders", "financial-events", "schedule-entries", "supplier-purchases", "cash-wallets", "cash-continuity-entries", "materials", "inventory-movements"].forEach((name) => request.result.createObjectStore(name, { keyPath: "id" })); }; request.onsuccess = () => { const database = request.result; const transaction = database.transaction(["order-drafts", "craft-orders"], "readwrite"); transaction.objectStore("order-drafts").put({ id: "legacy-draft", itemName: "صندوق هدايا" }); transaction.objectStore("craft-orders").put({ id: "legacy-order", order: { itemName: "صندوق هدايا" } }); transaction.oncomplete = () => { database.close(); resolve(); }; transaction.onerror = () => reject(transaction.error); }; });
    const store = new IndexedDbLocalStore();
    await expect(store.getDraft("legacy-draft")).resolves.toMatchObject({ ok: true, value: { itemName: "صندوق هدايا", catalogItemId: null } });
    await expect(store.getOrder("legacy-order")).resolves.toMatchObject({ ok: true, value: { catalogItemId: null, followUpSummary: null, followUpDate: null, followUpReason: null, followUpEvents: [] } });
    await expect(store.listCatalogItems()).resolves.toMatchObject({ ok: true, value: [] });
  });

  it("commits one local order and its linked draft together", async () => {
    const store = new IndexedDbLocalStore();
    const cost = calculateCostSnapshot("cost-1", { currency: "JOD", materialItems: [], time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" }, packagingMinor: 0, deliveryMinor: 0, wasteMinor: 0, safetyBufferMinor: 0, quantity: 1, createdAt: "2026-08-22T00:00:00.000Z", freshnessDays: null });
    const order = createCraftOrder({ id: "order-1", customerName: "سارة", itemName: "صندوق", specifications: "نقش", quantity: 1, agreedPriceMinor: 2000, costSnapshot: cost, createdAt: "2026-08-22T00:00:00.000Z" });
    const stored: StoredCraftOrder = { id: "order-1", order, deliveryDate: "2026-08-30", agreementSource: "conversation", createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z" };
    const draft: OrderDraft = { id: "draft-linked", intent: "customer_order", customerName: "سارة", itemName: "صندوق", specifications: "نقش", quantity: 1, costSnapshots: [], activeCostSnapshotId: null, linkedOrderId: "order-1", createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z" };
    await expect(store.commitOrderFromDraft(stored, draft)).resolves.toMatchObject({ ok: true, value: { order: { id: "order-1" }, draft: { linkedOrderId: "order-1" } } });
    const resumed = new IndexedDbLocalStore();
    await expect(resumed.listOrders()).resolves.toMatchObject({ ok: true, value: [{ id: "order-1" }] });
    await expect(resumed.getDraft("draft-linked")).resolves.toMatchObject({ ok: true, value: { linkedOrderId: "order-1" } });
  });

  it("replaces the full local snapshot in one IndexedDB transaction", async () => {
    const store = new IndexedDbLocalStore();
    const oldDraft: OrderDraft = { id: "old", intent: "customer_order", customerName: "", itemName: "قديم", specifications: "", quantity: 1, costSnapshots: [], activeCostSnapshotId: null, linkedOrderId: null, createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z" };
    await store.saveProfile({ id: localProfileId, activityName: "قديم", currency: "JOD", activityType: "custom_craft", createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z" }); await store.saveDraft(oldDraft);
    const replacement: ActivityProfile = { id: localProfileId, activityName: "مستورد", currency: "JOD", activityType: "custom_craft", createdAt: "2026-08-22T01:00:00.000Z", updatedAt: "2026-08-22T01:00:00.000Z" };
    const replacementDraft: OrderDraft = { ...oldDraft, id: "imported", itemName: "مستورد", createdAt: "2026-08-22T01:00:00.000Z", updatedAt: "2026-08-22T01:00:00.000Z" };
    const importedPreferences = { id: localPreferencesId, theme: "light" as const, dailyScheduleCapacityMinutes: null, updatedAt: "2026-08-22T01:00:00.000Z" };
    await expect(store.replaceSnapshot({ profile: replacement, preferences: importedPreferences, drafts: [replacementDraft], orders: [], schedules: [] })).resolves.toMatchObject({ ok: true, value: { profile: replacement, preferences: importedPreferences, drafts: [{ id: "imported" }], orders: [], schedules: [] } });
    const resumed = new IndexedDbLocalStore();
    await expect(resumed.getProfile()).resolves.toMatchObject({ ok: true, value: replacement }); await expect(resumed.getPreferences()).resolves.toMatchObject({ ok: true, value: importedPreferences }); await expect(resumed.listDrafts()).resolves.toMatchObject({ ok: true, value: [{ id: "imported" }] }); await expect(resumed.getDraft("old")).resolves.toMatchObject({ ok: true, value: null });
  });

  it("keeps cash wallets and their continuity entries through a snapshot replacement", async () => {
    const store = new IndexedDbLocalStore(); const wallet = { id: "drawer", name: "درج", kind: "cash_drawer" as const, createdAt: "2026-08-23T09:00:00.000Z", createdOperationKey: "wallet-1" }; const opening = { id: "opening", walletId: "drawer", type: "opening_balance" as const, occurredOn: "2026-08-01", recordedAt: "2026-08-23T09:00:00.000Z", cashDeltaMinor: 10000, note: "بداية", reason: null, operationKey: "opening-1", transferId: null, reversesEntryId: null };
    await expect(store.commitCashContinuity(wallet, [opening])).resolves.toMatchObject({ ok: true, value: { wallet: { id: "drawer" }, entries: [{ id: "opening" }] } });
    const snapshot = await store.readSnapshot(); if (!snapshot.ok) throw new Error("snapshot should read"); expect(snapshot.value).toMatchObject({ cashWallets: [{ id: "drawer" }], cashContinuityEntries: [{ id: "opening" }] });
    await expect(store.replaceSnapshot({ profile: null, preferences: null, drafts: [], orders: [], schedules: [], financialEvents: [], supplierPurchases: [], cashWallets: [wallet], cashContinuityEntries: [opening] })).resolves.toMatchObject({ ok: true, value: { cashWallets: [{ id: "drawer" }], cashContinuityEntries: [{ id: "opening" }] } });
    await expect(new IndexedDbLocalStore().listCashContinuityEntries()).resolves.toMatchObject({ ok: true, value: [{ id: "opening", cashDeltaMinor: 10000 }] });
  });

  it("keeps materials and inventory movements through a snapshot replacement", async () => {
    const store = new IndexedDbLocalStore(); const material = { id: "wood", name: "خشب", unit: "piece" as const, createdAt: "2026-08-23T09:00:00.000Z", createdOperationKey: "material-wood" }; const opening = { id: "material-opening", materialId: material.id, type: "opening" as const, occurredOn: "2026-08-01", recordedAt: "2026-08-23T09:00:00.000Z", quantityDeltaMilli: 10000, valueDeltaMinor: 4000, note: "افتتاح", reason: null, operationKey: "opening-wood", purchaseId: null, orderId: null, reversesMovementId: null };
    await expect(store.commitInventory(material, [opening])).resolves.toMatchObject({ ok: true, value: { material: { id: "wood" }, movements: [{ id: "material-opening" }] } });
    const snapshot = await store.readSnapshot(); if (!snapshot.ok) throw new Error("snapshot should read"); expect(snapshot.value).toMatchObject({ materials: [{ id: "wood" }], inventoryMovements: [{ id: "material-opening" }] });
    await expect(store.replaceSnapshot({ profile: null, preferences: null, drafts: [], orders: [], schedules: [], financialEvents: [], supplierPurchases: [], cashWallets: [], cashContinuityEntries: [], materials: [material], inventoryMovements: [opening] })).resolves.toMatchObject({ ok: true, value: { materials: [{ id: "wood" }], inventoryMovements: [{ id: "material-opening" }] } });
    await expect(new IndexedDbLocalStore().listInventoryMovements()).resolves.toMatchObject({ ok: true, value: [{ id: "material-opening", valueDeltaMinor: 4000 }] });
  });
});
