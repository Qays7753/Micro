import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { createSavedParty, renameSavedParty, setSavedPartyArchive } from "@micro-domain/party/index.js";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { counterpartyStore, directSaleStore } from "./indexedDbStores";
import type { SavedParty } from "@micro-domain/party/index.js";

/* S05 (DOC-014 / UNIT-037 — نمط D-037 نفسه): ترقية المخطط ٣٩→٤٠ بإنشاء
 * محروس فقط — قاعدة ٣٩ حقيقية (بمخازنها القائمة وبيع مباشر قديم) تُفتح
 * بالمحوّل الجديد فيُهيَّأ مخزن الأطراف فارغًا والسجل القديم كما هو حرفيًا؛
 * لا ترحيل بيانات ولا فقدًا صامت ولا اختراع أطراف من الأسماء القديمة (نمط
 * S04 — IndexedDbLocalStore.balanceObservation.test.ts).
 * ثم عقد حد الكتابة: العهدة بالمفتاح، وتعارض الإنشاء، وCAS التعديل — داخل
 * معاملات IndexedDB نفسها، بنواة القرار المشتركة مع محوّل الذاكرة. */

const databaseName = "micro-prototype-local";
const NOW = "2026-10-29T09:00:00.000Z";

function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function openLegacySchema39(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 39);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(directSaleStore)) {
        const sales = database.createObjectStore(directSaleStore, { keyPath: "id" });
        sales.createIndex("occurredOn", "occurredOn");
        sales.createIndex("idempotencyKey", "idempotencyKey");
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction([directSaleStore], "readwrite");
      /* بيع آجل قديم باسم زبون نصي فقط — لا هوية طرف؛ الترقية لا تجعل منه
       * طرفًا محفوظًا ولا تدّعي ربطه (لا اختراع هوية من الاسم). */
      transaction.objectStore(directSaleStore).put({
        id: "legacy-sale-39",
        itemName: "قطعة قديمة",
        quantity: 1,
        currency: "JOD",
        revenueMinor: 5_000,
        collectedMinor: 3_000,
        collectionStatus: "partial_debt",
        customerName: "زبون قديم بالاسم فقط",
        catalogItemId: null,
        costMinor: null,
        profitMinor: null,
        occurredOn: "2026-06-05",
        recordedAt: "2026-06-05T09:00:00.000Z",
        note: "بيع ما قبل الأطراف",
        idempotencyKey: "legacy-sale-39-key",
        status: "active",
        cancelledAt: null,
        cancellationReason: null,
        revisions: [],
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

function party(id: string, operationKey: string, label = "محمد — محل الزهور"): SavedParty {
  return createSavedParty({ id, label, phone: null, note: null, operationKey, recordedAt: NOW });
}

describe("S05 — ترقية المخطط ٣٩→٤٠ بإنشاء محروس فقط (DOC-014)", () => {
  afterEach(async () => {
    await clearDatabase();
  });

  it("قاعدة ٣٩ تُفتح على ٤٠: مخزن الأطراف فارغ والبيع القديم سليم بلا ترحيل ولا اختراع هوية", async () => {
    await clearDatabase();
    await openLegacySchema39();
    const store = new IndexedDbLocalStore();
    const counterparties = await store.listCounterparties();
    expect(counterparties.ok && counterparties.value).toHaveLength(0);
    const sales = await store.listDirectSales();
    expect(sales.ok && sales.value).toHaveLength(1);
    expect(sales.ok && sales.value[0]?.customerName).toBe("زبون قديم بالاسم فقط");
    /* الكتابة بعد الترقية تعمل والمخزن الجديد يستقبل الطرف طبيعيًا. */
    const committed = await store.commitCounterpartyWrite({
      kind: "create",
      baseUpdatedAt: null,
      next: party("party-upgrade", "party-upgrade-key"),
      operationKey: "party-upgrade-key",
    });
    expect(committed.ok).toBe(true);
    const after = await store.listCounterparties();
    expect(after.ok && after.value).toHaveLength(1);
    const salesAfter = await store.listDirectSales();
    expect(salesAfter.ok && salesAfter.value).toHaveLength(1);
  });

  it("مخزن الأطراف موجود بالاسم الكنوني بعد الترقية بفهرسيه (بيان نقاط الاتصال)", async () => {
    await clearDatabase();
    await openLegacySchema39();
    const store = new IndexedDbLocalStore();
    await store.listCounterparties();
    const inspected = await new Promise<{ names: string[]; indexes: string[] }>((resolve, reject) => {
      const request = indexedDB.open(databaseName);
      request.onsuccess = () => {
        const database = request.result;
        const names = Array.from(database.objectStoreNames);
        const indexes = Array.from(
          database.transaction([counterpartyStore]).objectStore(counterpartyStore).indexNames,
        );
        database.close();
        resolve({ names, indexes });
      };
      request.onerror = () => reject(request.error);
    });
    expect(inspected.names).toContain(counterpartyStore);
    expect(inspected.names).toContain("counterparties");
    expect(inspected.indexes).toContain("updatedAt");
    expect(inspected.indexes).toContain("operationKey");
  });
});

describe("S05 — حد كتابة الطرف المحروس داخل معاملات IndexedDB (DOC-014)", () => {
  afterEach(async () => {
    await clearDatabase();
  });

  it("إعادة نفس أمر الحفظ إعادة استخدام صادقة — لا طرف مكرر (العهدة)", async () => {
    await clearDatabase();
    const store = new IndexedDbLocalStore();
    const first = await store.commitCounterpartyWrite({
      kind: "create",
      baseUpdatedAt: null,
      next: party("party-idem", "op-idem"),
      operationKey: "op-idem",
    });
    expect(first.ok).toBe(true);
    const repeat = await store.commitCounterpartyWrite({
      kind: "create",
      baseUpdatedAt: null,
      next: party("party-idem", "op-idem"),
      operationKey: "op-idem",
    });
    expect(repeat.ok && repeat.value.reused).toBe(true);
    const list = await store.listCounterparties();
    expect(list.ok && list.value).toHaveLength(1);
  });

  it("الإنشاء فوق سجل قائم بمفتاح مختلف تعارض صادق — لا كتابة فوق مسار آخر", async () => {
    await clearDatabase();
    const store = new IndexedDbLocalStore();
    const first = await store.commitCounterpartyWrite({
      kind: "create",
      baseUpdatedAt: null,
      next: party("party-conflict", "op-first"),
      operationKey: "op-first",
    });
    expect(first.ok).toBe(true);
    const collision = await store.commitCounterpartyWrite({
      kind: "create",
      baseUpdatedAt: null,
      next: party("party-conflict", "op-second"),
      operationKey: "op-second",
    });
    expect(collision.ok).toBe(false);
    if (!collision.ok) expect(collision.code).toBe("storage_stale");
    const list = await store.listCounterparties();
    expect(list.ok && list.value).toHaveLength(1);
    expect(list.ok && list.value[0]?.operationKey).toBe("op-first");
  });

  it("تعديل تسمية فوق أساس متقدم يُرفض بلا كتابة — CAS حي (نافذتان لا تسحقان)", async () => {
    await clearDatabase();
    const store = new IndexedDbLocalStore();
    const created = await store.commitCounterpartyWrite({
      kind: "create",
      baseUpdatedAt: null,
      next: party("party-cas", "op-create"),
      operationKey: "op-create",
    });
    if (!created.ok) throw new Error(created.message);
    /* نافذة أخرى تسبق: تعديل فوق الأساس الذي قرأته النافذة الأولى يُرفض. */
    const otherWindow = await store.commitCounterpartyWrite({
      kind: "rename",
      baseUpdatedAt: created.value.party.updatedAt,
      next: renameSavedParty(created.value.party, {
        label: "محمد الزهور",
        operationKey: "op-other-window",
        recordedAt: "2026-10-29T10:00:00.000Z",
      }),
      operationKey: "op-other-window",
    });
    expect(otherWindow.ok).toBe(true);
    const stale = await store.commitCounterpartyWrite({
      kind: "rename",
      baseUpdatedAt: created.value.party.updatedAt,
      next: renameSavedParty(created.value.party, {
        label: "تسمية النافذة المتأخرة",
        operationKey: "op-late-window",
        recordedAt: "2026-10-29T11:00:00.000Z",
      }),
      operationKey: "op-late-window",
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.code).toBe("storage_stale");
    const list = await store.listCounterparties();
    expect(list.ok && list.value[0]?.label).toBe("محمد الزهور");
  });

  it("الأرشفة تمر بالحد المحروس نفسه وتحفظ الهوية والتسمية", async () => {
    await clearDatabase();
    const store = new IndexedDbLocalStore();
    const created = await store.commitCounterpartyWrite({
      kind: "create",
      baseUpdatedAt: null,
      next: party("party-archive", "op-create"),
      operationKey: "op-create",
    });
    if (!created.ok) throw new Error(created.message);
    const archived = await store.commitCounterpartyWrite({
      kind: "archive",
      baseUpdatedAt: created.value.party.updatedAt,
      next: setSavedPartyArchive(created.value.party, {
        archived: true,
        operationKey: "op-archive",
        recordedAt: "2026-10-29T12:00:00.000Z",
      }),
      operationKey: "op-archive",
    });
    expect(archived.ok).toBe(true);
    const read = await store.getCounterparty("party-archive");
    expect(read.ok && read.value?.archivedAt).toBe("2026-10-29T12:00:00.000Z");
    expect(read.ok && read.value?.label).toBe("محمد — محل الزهور");
    expect(read.ok && read.value?.id).toBe("party-archive");
  });
});
