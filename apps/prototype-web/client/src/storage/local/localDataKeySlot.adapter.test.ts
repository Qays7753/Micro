import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { MemoryLocalStore } from "./MemoryLocalStore";
import { databaseName, localDataKeySlotStore } from "./indexedDbStores";
import { localSchemaVersion, localDataKeySlotId, type LocalDataKeySlot, type PrototypeLocalStore } from "./types";

/* MNG-LOCAL-03 (أمر المالك 12AA — 2026-11-24): اختبارات مركزة لمخزن فتحة
 * مفتاح تشفير النسخ عبر المهايئين:
 *  - دورة حفظ/قراءة/حذف على مهايئ IndexedDB الحقيقي (fake-indexeddb) وعلى
 *    مهايئ الذاكرة معًا — نفس السجل بلا أي مادة مفتاح.
 *  - الترقية المحروسة: قاعدة قديمة (مخطط أدنى بلا مخزن الفتحة) تفتح بعد
 *    الترقية وتجده فارغًا — لا فقدان ولا إلغاء بيانات قائمة.
 *  - السجل الواحد بمعرّف ثابت — لا سجل ثانٍ.
 */

const SLOT: LocalDataKeySlot = {
  id: localDataKeySlotId,
  prfSalt: "0123456789abcdef0123456789abcdef",
  credentialId: "c29tZWNyZWRlbnRpYWxpZGlkMjQ=",
  createdAt: "2026-11-24T12:00:00.000Z",
  verification: { nonce: "bm9uY2UxMg", ciphertext: "Y2lwaGVydGV4dA" },
};

async function clearMainDatabase() {
  const request = indexedDB.deleteDatabase(databaseName);
  await new Promise<void>((resolve, reject) => {
    request.onerror = () => reject(new Error("main delete error"));
    request.onsuccess = () => resolve();
    request.onblocked = () => reject(new Error("main delete BLOCKED"));
  });
}
afterEach(clearMainDatabase);

async function assertRoundTrip(store: PrototypeLocalStore) {
  const initial = await store.getLocalDataKeySlot();
  if (!initial.ok) throw new Error(initial.message);
  expect(initial.value).toBeNull();
  const saved = await store.saveLocalDataKeySlot(SLOT);
  expect(saved.ok).toBe(true);
  const read = await store.getLocalDataKeySlot();
  if (!read.ok) throw new Error(read.message);
  expect(read.value).toEqual(SLOT);
  /* سجل واحد ثابت — لا تكرار ولا هوية ثانية. */
  const again = await store.saveLocalDataKeySlot(SLOT);
  expect(again.ok).toBe(true);
  const removed = await store.deleteLocalDataKeySlot();
  expect(removed.ok).toBe(true);
  const after = await store.getLocalDataKeySlot();
  if (!after.ok) throw new Error(after.message);
  expect(after.value).toBeNull();
}

describe("MNG-LOCAL-03 — مخزن فتحة مفتاح النسخ عبر المهايئين", () => {
  it("IndexedDB: دورة حفظ/قراءة/حذف كاملة — بلا أي مادة مفتاح في السجل", async () => {
    const store = new IndexedDbLocalStore();
    expect(JSON.stringify(SLOT)).not.toMatch(/"key"|keyBytes|rawKey/i);
    await assertRoundTrip(store);
  });

  it("الذاكرة: نفس العقد تمامًا (توافق المهايئين)", async () => {
    await assertRoundTrip(new MemoryLocalStore());
  });

  it("الترقية المحروسة: قاعدة بمخطط قديم أدنى تفتح وتجد مخزن الفتحة فارغًا بلا فقدان", async () => {
    /* قاعدة قديمة حقيقية بمخطط أدنى (1) — الترقية إلى المخطط الحي تنشئ
     * المخازن الناقصة بالمُنشئ المحروس ومنها مخزن الفتحة. */
    const opened = await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        /* لا مخازن — قاعدة قديمة فارغة تمامًا. */
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error ?? new Error("open failed"));
      request.onblocked = () => reject(new Error("blocked"));
    });
    expect(opened).toBeUndefined();
    const store = new IndexedDbLocalStore();
    const slot = await store.getLocalDataKeySlot();
    if (!slot.ok) throw new Error(slot.message);
    expect(slot.value).toBeNull();
    /* المخزن موجود فعلاً بعد الترقية — كتابة تعمل فورًا. */
    const saved = await store.saveLocalDataKeySlot(SLOT);
    expect(saved.ok).toBe(true);
    const read = await store.getLocalDataKeySlot();
    if (!read.ok) throw new Error(read.message);
    expect(read.value).toEqual(SLOT);
  });

  it("مخزن الفتحة خارج اللقطة والتصدير — لا يدخل الملف ولا الاستيراد أبدًا", async () => {
    const store = new IndexedDbLocalStore();
    const saved = await store.saveLocalDataKeySlot(SLOT);
    expect(saved.ok).toBe(true);
    const snapshot = await store.readSnapshot();
    if (!snapshot.ok) throw new Error(snapshot.message);
    expect(JSON.stringify(snapshot.value)).not.toContain(localDataKeySlotStore);
    expect(JSON.stringify(snapshot.value)).not.toContain(SLOT.credentialId);
    /* المخزن نفسه موجود في قاعدة البيانات الحية بالمخطط الحي. */
    const version = await new Promise<number>((resolve, reject) => {
      const request = indexedDB.open(databaseName);
      request.onsuccess = () => {
        const database = request.result;
        const hasStore = Array.from(database.objectStoreNames).includes(localDataKeySlotStore);
        const version = database.version;
        database.close();
        if (!hasStore) {
          reject(new Error("key slot store missing"));
          return;
        }
        resolve(version);
      };
      request.onerror = () => reject(request.error ?? new Error("open failed"));
    });
    expect(version).toBe(localSchemaVersion);
  });
});
