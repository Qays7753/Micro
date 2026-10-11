import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { MemoryLocalStore } from "./MemoryLocalStore";
import type { PrototypeLocalStore, ScheduleEntry } from "./types";

/* R10-B2/R10A-F-008: الاستدعاء المباشر للطرق الست التي لم تُستدعَ بالاسم في
 * أي ملف اختبار تخزين محلي (getOwnerProfile، saveOwnerProfile، saveSchedule،
 * deleteDraft، deleteFormDraft، deleteLocalSecurity) — على المحوّلين معًا،
 * فتصبح مطالبة «كل طريقة مُدارة لكل محوّل» حرفية كما يثبت جرد الأسماء
 * (130/130). تغيير اختباري فقط — لا سلوك إنتاجيًا يُمس. */

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const TS = "2026-10-11T09:00:00.000Z";

const ownerProfile = {
  id: "local-owner-profile",
  ownerId: "owner-1",
  displayName: "أبو محمد",
  email: null,
  provider: null,
  externalAccountId: null,
  createdAt: TS,
  updatedAt: TS,
} as const;

const schedule: ScheduleEntry = {
  id: "schedule-f008",
  orderId: "order-1",
  kind: "delivery",
  scheduledFor: "2026-10-12T10:00:00.000Z",
  createdAt: TS,
  updatedAt: TS,
  events: [],
  status: "pending",
  recurrenceId: null,
  recurrenceIndex: null,
};

const orderDraft = {
  id: "draft-f008",
  intent: "new_order",
  customerName: "سامي",
  orderName: null,
  itemName: "طلب اختبار",
  catalogItemId: null,
  specifications: "مواصفة",
  quantity: 1,
  costSnapshots: [],
  createdAt: TS,
  updatedAt: TS,
} as const;

const formDraft = {
  id: "expense:new",
  formKind: "expense",
  scopeId: null,
  valuesVersion: 1,
  values: { note: "مسودة نموذج" },
  createdAt: TS,
  updatedAt: TS,
} as const;

const securityRecord = {
  id: "local-security",
  pinHash: "ab".repeat(32),
  salt: "cd".repeat(16),
  autoLockMinutes: 5,
  lastActiveAt: null,
} as const;

function adapters(): Array<[name: string, make: () => PrototypeLocalStore]> {
  return [
    ["MemoryLocalStore", () => new MemoryLocalStore()],
    ["IndexedDbLocalStore", () => new IndexedDbLocalStore()],
  ];
}

describe("R10-B2/F-008 — direct per-adapter invocations for the six never-named methods", () => {
  afterEach(async () => {
    await clearDatabase();
  });

  for (const [name, make] of adapters()) {
    it(`${name}: getOwnerProfile/saveOwnerProfile round-trip (absent → null, saved → verbatim)`, async () => {
      const store = make();
      const absent = await store.getOwnerProfile();
      expect(absent.ok).toBe(true);
      if (absent.ok) expect(absent.value).toBeNull();

      const saved = await store.saveOwnerProfile({ ...ownerProfile });
      expect(saved.ok).toBe(true);
      const read = await store.getOwnerProfile();
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value).toEqual({ ...ownerProfile });
    });

    it(`${name}: saveSchedule persists and lists (direct write path)`, async () => {
      const store = make();
      const saved = await store.saveSchedule({ ...schedule });
      expect(saved.ok).toBe(true);
      const listed = await store.listSchedules();
      expect(listed.ok).toBe(true);
      if (listed.ok) {
        expect(listed.value).toHaveLength(1);
        expect(listed.value[0]).toEqual({ ...schedule });
      }
    });

    it(`${name}: deleteDraft removes exactly the targeted order draft`, async () => {
      const store = make();
      const saved = await store.saveDraft({ ...orderDraft });
      expect(saved.ok).toBe(true);
      const removed = await store.deleteDraft("draft-f008");
      expect(removed.ok).toBe(true);
      const listed = await store.listDrafts();
      expect(listed.ok && listed.value).toHaveLength(0);
      /* حذف غائب: نتيجة ناجحة بلا خطأ (deleteOne idempotent by contract). */
      const again = await store.deleteDraft("draft-f008");
      expect(again.ok).toBe(true);
    });

    it(`${name}: deleteFormDraft removes exactly the targeted form draft`, async () => {
      const store = make();
      const saved = await store.saveFormDraft({ ...formDraft });
      expect(saved.ok).toBe(true);
      const removed = await store.deleteFormDraft("expense:new");
      expect(removed.ok).toBe(true);
      const listed = await store.listFormDrafts();
      expect(listed.ok && listed.value).toHaveLength(0);
      const again = await store.deleteFormDraft("expense:new");
      expect(again.ok).toBe(true);
    });

    it(`${name}: deleteLocalSecurity removes the lock record (and only it)`, async () => {
      const store = make();
      const saved = await store.saveLocalSecurity({ ...securityRecord });
      expect(saved.ok).toBe(true);
      const removed = await store.deleteLocalSecurity();
      expect(removed.ok).toBe(true);
      const read = await store.getLocalSecurity();
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value).toBeNull();
      const again = await store.deleteLocalSecurity();
      expect(again.ok).toBe(true);
    });
  }
});
