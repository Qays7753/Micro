import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { MemoryLocalStore } from "./MemoryLocalStore";
import { LocalTransferService } from "@/application/transfers/localTransferService";
import {
  localSchemaVersion,
  localSecurityId,
  type FormDraftEnvelope,
  type LocalSecurityRecord,
  type LocalStoreSnapshot,
} from "./types";

/* المجموعة ٢ (التحصين الكامل — MED-017/RISK-003/LOW-003): اختبارات محوّل
 * IndexedDB لحدود دورة الحياة — ترحيل O1 قبل المخطط ٢٣ (عهدة مُعاد بناؤها
 * بأمانة من عقد الترحيل نفسه: المخططات ٢١–٢٥ لم تصدر في أي مرجع محفوظ،
 * والمخازن وُلدت عند ٦٠b642e/٢٦، فالترحيل دفاعي ويُثبت هنا على شكله)،
 * والنجاح المتأخر بعد onblocked (RISK-003)، وبقاء مسودات النماذج وسجل
 * القفل عبر الاستبدال/«ابدأ من جديد» (LOW-003) — لا تصدير للأسرار أبدًا. */

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
afterEach(clearDatabase);

const TS = "2026-09-08T09:00:00.000Z";

/* عهدة O1 قبل ٢٣: مخازن حق المالك الأربعة بسجلاتها قبل الحقول المستحدثة —
 * الشكل مُستمد من عقد الترحيل نفسه (الحقول التي يكملها) وقيم السجلات
 * الأصلية محفوظة كما هي (لا اختراع مالي ولا تاريخ). */
function seedPreTwentyThreeOwnerStores(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 22);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore("owner-entitlement-policies", { keyPath: "id" });
      database.createObjectStore("owner-entitlement-records", { keyPath: "id" });
      database.createObjectStore("owner-entitlement-opening-balances", { keyPath: "id" });
      database.createObjectStore("owner-movements", { keyPath: "id" });
    };
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(
        [
          "owner-entitlement-policies",
          "owner-entitlement-records",
          "owner-entitlement-opening-balances",
          "owner-movements",
        ],
        "readwrite",
      );
      transaction.objectStore("owner-entitlement-policies").put({
        id: "policy-o1",
        kind: "percentage",
        rate: 10,
        startsOn: "2026-08-01",
        status: "active",
        idempotencyKey: "policy-o1-key",
      });
      transaction.objectStore("owner-entitlement-records").put({
        id: "record-o1",
        occurredOn: "2026-08-05",
        amountMinor: 500,
        policyId: "policy-o1",
        idempotencyKey: "record-o1-key",
      });
      transaction.objectStore("owner-entitlement-opening-balances").put({
        id: "opening-o1",
        occurredOn: "2026-08-01",
        amountMinor: 2000,
        idempotencyKey: "opening-o1-key",
      });
      transaction.objectStore("owner-movements").put({
        id: "movement-o1",
        occurredOn: "2026-08-05",
        walletId: "wallet-o1",
        amountMinor: 500,
        idempotencyKey: "movement-o1-key",
      });
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
  });
}

/* المرجع الأمين: قاعدة مخطط ٢٠ حقيقية (ما قبل دمج G3–G5) — مخازن حق المالك
 * تُنشأ فارغة عند الترقية، ولا يُخترع سجل واحد. */
function seedVersionTwenty(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 20);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("activity-profile", { keyPath: "id" });
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
  });
}

describe("O1 pre-23 migration (MED-017) — defensively reconstructed fixture", () => {
  it("backfills seriesId, sourceKeys, reversal fields, and opening deltas without inventing values", async () => {
    await seedPreTwentyThreeOwnerStores();
    const store = new IndexedDbLocalStore();
    const policies = await store.listOwnerEntitlementPolicies();
    if (!policies.ok) throw new Error(policies.message);
    expect(policies.value).toHaveLength(1);
    expect(policies.value[0]).toMatchObject({
      id: "policy-o1",
      seriesId: "policy-o1",
      successorOfPolicyId: null,
      rate: 10,
      status: "active",
    });
    const records = await store.listOwnerEntitlementRecords();
    if (!records.ok) throw new Error(records.message);
    expect(records.value).toHaveLength(1);
    expect(records.value[0]).toMatchObject({
      id: "record-o1",
      sourceKeys: ["legacy:record:record-o1"],
      reversalOfId: null,
      reversalReason: null,
      amountMinor: 500,
    });
    const openings = await store.listOwnerEntitlementOpeningBalances();
    if (!openings.ok) throw new Error(openings.message);
    expect(openings.value).toHaveLength(1);
    expect(openings.value[0]).toMatchObject({
      id: "opening-o1",
      reversalOfId: null,
      reversalReason: null,
      amountMinor: 2000,
    });
    const movements = await store.listOwnerMovements();
    if (!movements.ok) throw new Error(movements.message);
    expect(movements.value).toHaveLength(1);
    expect(movements.value[0]).toMatchObject({
      id: "movement-o1",
      relatedOpeningBalanceId: null,
      openingBalanceDeltaMinor: 0,
      reversalOfId: null,
      reversalReason: null,
      amountMinor: 500,
    });
  });

  it("creates empty owner stores for a genuine schema-20 database — zero invented records", async () => {
    await seedVersionTwenty();
    const store = new IndexedDbLocalStore();
    const policies = await store.listOwnerEntitlementPolicies();
    if (!policies.ok) throw new Error(policies.message);
    const records = await store.listOwnerEntitlementRecords();
    if (!records.ok) throw new Error(records.message);
    const openings = await store.listOwnerEntitlementOpeningBalances();
    if (!openings.ok) throw new Error(openings.message);
    const movements = await store.listOwnerMovements();
    if (!movements.ok) throw new Error(movements.message);
    expect(policies.value).toHaveLength(0);
    expect(records.value).toHaveLength(0);
    expect(openings.value).toHaveLength(0);
    expect(movements.value).toHaveLength(0);
  });
});

describe("blocked open and late success lifecycle (RISK-003)", () => {
  it("rejects with storage_blocked, closes the late-success connection, and recovers", async () => {
    await seedPreTwentyThreeOwnerStores();
    /* اتصال قديم مفتوح يحجب الترقية — على غرار نافذة قديمة مفتوحة. */
    const blocking = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 22);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    expect(blocking.version).toBe(22);

    const originalClose = IDBDatabase.prototype.close;
    const closedDatabases: IDBDatabase[] = [];
    const closeSpy = vi.spyOn(IDBDatabase.prototype, "close").mockImplementation(function (
      this: IDBDatabase,
    ) {
      closedDatabases.push(this);
      return originalClose.call(this);
    });

    try {
      const store = new IndexedDbLocalStore();
      const blocked = await store.listOwnerEntitlementPolicies();
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) expect(blocked.code).toBe("storage_blocked");

      /* إغلاق الحاجز يسمح للفتح المعلق بالنجاح متأخرًا — وعد الرفض حُسم
       * فلا مالك لهذا الاتصال: يُغلق فورًا ولا يبقى معلقًا يحجب الترقيات. */
      blocking.close();
      await new Promise(resolve => setTimeout(resolve, 50));
      const lateConnections = closedDatabases.filter(database => database.version === localSchemaVersion);
      expect(lateConnections.length).toBeGreaterThan(0);

      /* العملية التالية تفتح اتصالًا جديدًا سليمًا وتقرأ البيانات المُرحَّلة. */
      const recovered = await store.listOwnerEntitlementPolicies();
      expect(recovered.ok).toBe(true);
      if (recovered.ok) expect(recovered.value).toHaveLength(1);
    } finally {
      closeSpy.mockRestore();
    }
  });
});

/* ─── مسودات النماذج وسجل القفل: بقاء صريح عبر الاستبدال والاستعادة ─── */

const draft: FormDraftEnvelope = {
  id: "asset:new",
  formKind: "asset",
  scopeId: null,
  valuesVersion: 1,
  values: { name: "ماكينة خياطة" },
  createdAt: TS,
  updatedAt: TS,
};

const security: LocalSecurityRecord = {
  id: localSecurityId,
  pinHash: "0123456789abcdef",
  salt: "fedcba9876543210",
  autoLockMinutes: 5,
};

async function replaceWithEmptySnapshot(store: {
  replaceSnapshot(snapshot: LocalStoreSnapshot): Promise<{ ok: boolean }>;
}): Promise<{ ok: boolean }> {
  return store.replaceSnapshot(LocalTransferService.emptySnapshot());
}

async function expectDraftsAndSecuritySurvive(store: {
  getFormDraft(id: string): Promise<{ ok: boolean; value: FormDraftEnvelope | null }>;
  saveFormDraft(draft: FormDraftEnvelope): Promise<{ ok: boolean }>;
  getLocalSecurity(): Promise<{ ok: boolean; value: LocalSecurityRecord | null }>;
  saveLocalSecurity(security: LocalSecurityRecord): Promise<{ ok: boolean }>;
  readSnapshot(): Promise<{ ok: boolean; value: LocalStoreSnapshot }>;
  replaceSnapshot(snapshot: LocalStoreSnapshot): Promise<{ ok: boolean }>;
}): Promise<void> {
  await store.saveFormDraft(draft);
  await store.saveLocalSecurity(security);
  const replacement = await replaceWithEmptySnapshot(store);
  expect(replacement.ok).toBe(true);
  const draftRead = await store.getFormDraft("asset:new");
  if (!draftRead.ok) throw new Error("draft read failed");
  expect(draftRead.value).not.toBeNull();
  if (draftRead.value) expect(draftRead.value.values).toEqual({ name: "ماكينة خياطة" });
  const securityRead = await store.getLocalSecurity();
  if (!securityRead.ok) throw new Error("security read failed");
  expect(securityRead.value).not.toBeNull();
  if (securityRead.value) expect(securityRead.value.pinHash).toBe("0123456789abcdef");
  /* اللقطة لا تحمل أيًّا منهما — الأسرار والمسودات النصية لا تغادر الجهاز. */
  const snapshot = await store.readSnapshot();
  if (!snapshot.ok) throw new Error(snapshot.message);
  expect(
    JSON.stringify(snapshot.value).includes("0123456789abcdef") ||
      JSON.stringify(snapshot.value).includes("ماكينة خياطة"),
  ).toBe(false);
}

describe("form-drafts and local-security survive reset/import (LOW-003)", () => {
  it("IndexedDbLocalStore keeps drafts and the security record through replaceSnapshot and resetAll", async () => {
    const store = new IndexedDbLocalStore();
    await expectDraftsAndSecuritySurvive(store);
    const transfers = new LocalTransferService(store, () => TS);
    const reset = await transfers.resetAll();
    if (!reset.ok) throw new Error(reset.message);
    const draftRead = await store.getFormDraft("asset:new");
    if (!draftRead.ok) throw new Error("draft read failed");
    expect(draftRead.value).not.toBeNull();
    const securityRead = await store.getLocalSecurity();
    if (!securityRead.ok) throw new Error("security read failed");
    expect(securityRead.value).not.toBeNull();
  });

  it("MemoryLocalStore keeps drafts and the security record through replaceSnapshot", async () => {
    await expectDraftsAndSecuritySurvive(new MemoryLocalStore());
  });

  it("survives a full import through a verified round-trip as well", async () => {
    const source = new MemoryLocalStore();
    const saved = await source.saveFinancialEvent({
      id: "fin-reset-1",
      type: "owner_investment_cash",
      currency: "JOD",
      amountMinor: 5000,
      occurredOn: "2026-09-08",
      recordedAt: TS,
      idempotencyKey: "fin-reset-key",
      note: "استثمار",
      counterparty: null,
      relatedEventId: null,
      cashDeltaMinor: 5000,
      payableDeltaMinor: 0,
      ownerCapitalDeltaMinor: 5000,
      operatingExpenseDeltaMinor: 0,
    });
    if (!saved.ok) throw new Error(saved.message);
    const transfers = new LocalTransferService(source, () => TS);
    const exported = await transfers.createVerifiedExport();
    if (!exported.ok) throw new Error(exported.message);
    await source.saveFormDraft(draft);
    await source.saveLocalSecurity(security);
    const prepared = transfers.prepareImport(JSON.stringify(exported.value.file));
    if (!prepared.ok) throw new Error(prepared.message);
    const confirmed = await transfers.confirmImport(prepared.value);
    if (!confirmed.ok) throw new Error(confirmed.message);
    const draftRead = await source.getFormDraft("asset:new");
    if (!draftRead.ok) throw new Error("draft read failed");
    expect(draftRead.value).not.toBeNull();
    const securityRead = await source.getLocalSecurity();
    if (!securityRead.ok) throw new Error("security read failed");
    expect(securityRead.value).not.toBeNull();
  });
});
