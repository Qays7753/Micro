import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { localProfileId, type ActivityProfile, type OrderDraft } from "./types";

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
afterEach(clearDatabase);

describe("IndexedDbLocalStore", () => {
  it("persists the profile and draft through a fresh adapter instance", async () => {
    const profile: ActivityProfile = { id: localProfileId, activityName: "مشغل ليان", currency: "JOD", activityType: "custom_craft", createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z" };
    const draft: OrderDraft = { id: "draft-1", intent: "customer_order", customerName: "سارة", itemName: "صندوق خشبي", specifications: "نقش", quantity: 2, createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:01:00.000Z" };
    const first = new IndexedDbLocalStore();
    await expect(first.saveProfile(profile)).resolves.toMatchObject({ ok: true, value: profile });
    await expect(first.saveDraft(draft)).resolves.toMatchObject({ ok: true, value: draft });
    const resumed = new IndexedDbLocalStore();
    await expect(resumed.getProfile()).resolves.toMatchObject({ ok: true, value: profile });
    await expect(resumed.getDraft("draft-1")).resolves.toMatchObject({ ok: true, value: draft });
  });

  it("returns local drafts with the latest update first", async () => {
    const store = new IndexedDbLocalStore();
    const early: OrderDraft = { id: "early", intent: "planned_design", customerName: "", itemName: "قطعة أولى", specifications: "", quantity: 1, createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z" };
    const late: OrderDraft = { ...early, id: "late", itemName: "قطعة أحدث", updatedAt: "2026-08-22T01:00:00.000Z" };
    await store.saveDraft(early); await store.saveDraft(late);
    const listed = await store.listDrafts();
    expect(listed).toMatchObject({ ok: true, value: [{ id: "late" }, { id: "early" }] });
  });
});
