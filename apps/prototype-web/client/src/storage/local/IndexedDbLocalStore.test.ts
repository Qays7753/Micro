import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";
import { localProfileId, type ActivityProfile, type OrderDraft, type StoredCraftOrder } from "./types";

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

describe("IndexedDbLocalStore", () => {
  it("persists the profile and draft through a fresh adapter instance", async () => {
    const profile: ActivityProfile = { id: localProfileId, activityName: "مشغل ليان", currency: "JOD", activityType: "custom_craft", createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z" };
    const draft: OrderDraft = { id: "draft-1", intent: "customer_order", customerName: "سارة", itemName: "صندوق خشبي", specifications: "نقش", quantity: 2, costSnapshots: [], activeCostSnapshotId: null, linkedOrderId: null, createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:01:00.000Z" };
    const first = new IndexedDbLocalStore();
    await expect(first.saveProfile(profile)).resolves.toMatchObject({ ok: true, value: profile });
    await expect(first.saveDraft(draft)).resolves.toMatchObject({ ok: true, value: draft });
    const resumed = new IndexedDbLocalStore();
    await expect(resumed.getProfile()).resolves.toMatchObject({ ok: true, value: profile });
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
});
