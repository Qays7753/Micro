/**
 * S11-LR-001 (أمر S13 2158b0fc §4 — تحصيص موجدة المراجعة المستقلة عند ac4429ef):
 * الإثبات الدائم أن حد هوية الدين المؤكد محروس عند حد المجال قبل الكتابة —
 * الإنشاء بدين مؤكد بلا تعريف بسيط، والتعديل الذي يُدخل دينًا جديدًا بلا
 * تعريف، يُرفضان قبل commitDirectSaleWrite: صفر نداءات لحدود الكتابة كلها،
 * ولا بيع ولا قبض ولا تخصيص محفظة ولا أي كتابة مالية على المهايئين معًا
 * (الذاكرة وIndexedDB). والقديم المجهول الاسم يبقى قابلًا للتصحيح غير المالي
 * بلا تعريف رجعي مفروض (UNIT-037 B2/AC14) — التصنيف:
 * ALREADY_PROTECTED_AT_DOMAIN_BOUNDARY؛ بوابة الواجهة التمهيدية (نموذج
 * المحرر) تمنع استدعاء الخدمة أصلًا، وهذا الاختبار يثبت أن الحارس الثاني
 * عند المجال كافٍ وحده لحماية التخزين.
 */
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import type { DirectSaleServiceStore } from "@/application/direct-sales/directSaleService";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";

const NOW = "2026-11-01T09:00:00.000Z";
const now = () => NOW;

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

type AnyStore = DirectSaleServiceStore & {
  saveDirectSale: (sale: DirectSale) => unknown;
};

/** عدّاد حدود الكتابة — يلف المخزن ويسجل كل نداء لأي التزام كتابة (commit*). */
function withCommitCounter(store: AnyStore) {
  const commitCalls: string[] = [];
  const tracked = new Proxy(store, {
    get(target, prop: string) {
      const value = Reflect.get(target, prop);
      if (prop.startsWith("commit") && typeof value === "function")
        return (...args: unknown[]) => {
          commitCalls.push(prop);
          return (value as (...a: unknown[]) => unknown).apply(target, args);
        };
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
  return { store: tracked as AnyStore, commitCalls };
}

/** بيع كامل معرّف بلا دين — أساس سليم لمسار التعديل. */
async function recordFullSale(directSales: DirectSaleService) {
  const result = await directSales.record({
    itemName: "صندوق هدايا",
    quantity: 1,
    revenueMinor: 1200,
    collectedMinor: 1200,
    collectionStatus: "collected_in_full",
    customerName: null,
    costMinor: null,
    occurredOn: "2026-10-20",
    note: "بيع مباشر",
    idempotencyKey: "s11lr-full-op",
  });
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

const adapters = [
  ["الذاكرة", () => new MemoryLocalStore() as unknown as AnyStore],
  ["IndexedDB", () => new IndexedDbLocalStore() as unknown as AnyStore],
] as const;

describe("S11-LR-001 — هوية الدين المؤكد عند حد الكتابة (المهايئان معًا)", () => {
  afterEach(async () => {
    await clearDatabase();
  });

  for (const [label, makeStore] of adapters) {
    it(`${label}: الإنشاء بدين مؤكد بلا تعريف يُرفض قبل حد الكتابة — صفر كتابات`, async () => {
      if (label === "IndexedDB") await clearDatabase();
      const { store, commitCalls } = withCommitCounter(makeStore());
      const directSales = new DirectSaleService(store, now);

      const rejected = await directSales.record({
        itemName: "صندوق هدايا",
        quantity: 1,
        revenueMinor: 1500,
        collectedMinor: 500,
        collectionStatus: "partial_debt",
        customerName: null,
        customerPartyId: null,
        costMinor: null,
        occurredOn: "2026-10-20",
        note: "بيع مباشر",
        idempotencyKey: "s11lr-create-op",
        wallet: null,
      });

      /* الرفض من حد المجال — رسالة تعريف المتبقي نفسها. */
      expect(rejected.ok).toBe(false);
      if (rejected.ok) throw new Error("unreachable");
      expect(rejected.code).toBe("validation_error");
      expect(rejected.message).toContain("المتبقي بلا تعريف");

      /* صفر نداءات لحدود الكتابة: لم يصل أي بيع/قبض/تخصيص إلى التخزين. */
      expect(commitCalls).toEqual([]);

      /* المخزن بلا أي أثر: لا بيعًا ولا حركة نقد ولا محفظة مكتوبة. */
      const sales = await store.listDirectSales();
      expect(sales.ok && sales.value).toEqual([]);
      const cashEntries = await store.listCashContinuityEntries();
      expect(cashEntries.ok && cashEntries.value).toEqual([]);
    });

    it(`${label}: تعديل يُدخل دينًا جديدًا بلا تعريف يُرفض قبل حد الكتابة والأصل سليم`, async () => {
      if (label === "IndexedDB") await clearDatabase();
      const { store, commitCalls } = withCommitCounter(makeStore());
      const directSales = new DirectSaleService(store, now);

      const sale = await recordFullSale(directSales);
      const commitsAfterSetup = commitCalls.length;
      expect(commitsAfterSetup).toBeGreaterThan(0);

      const rejected = await directSales.update(sale.id, {
        itemName: sale.itemName,
        quantity: 1,
        revenueMinor: 1500,
        collectedMinor: 500,
        collectionStatus: "partial_debt",
        catalogItemId: null,
        customerName: null,
        customerPartyId: null,
        costMinor: null,
        occurredOn: sale.occurredOn,
        note: "تصحيح يجعل المتبقي دينًا",
        idempotencyKey: "s11lr-edit-op",
        expectedRevisionCount: 0,
      });

      expect(rejected.ok).toBe(false);
      if (rejected.ok) throw new Error("unreachable");
      expect(rejected.code).toBe("validation_error");
      expect(rejected.message).toContain("المتبقي بلا تعريف");

      /* لا كتابة جديدة بعد الأساس السليم — والأصل لم يتغير بشيء. */
      expect(commitCalls.length).toBe(commitsAfterSetup);
      const after = await store.listDirectSales();
      expect(after.ok && after.value).toHaveLength(1);
      const unchanged = after.ok ? after.value[0] : null;
      expect(unchanged?.revenueMinor).toBe(1200);
      expect(unchanged?.collectedMinor).toBe(1200);
      expect(unchanged?.collectionStatus).toBe("collected_in_full");
      expect(unchanged?.revisions ?? []).toHaveLength(0);
      const cashEntries = await store.listCashContinuityEntries();
      expect(cashEntries.ok && cashEntries.value).toEqual([]);
    });

    it(`${label}: القديم المجهول الاسم يبقى دينًا حيًّا ويقبل تصحيحًا غير مالي بلا تعريف رجعي`, async () => {
      if (label === "IndexedDB") await clearDatabase();
      const { store, commitCalls } = withCommitCounter(makeStore());
      const directSales = new DirectSaleService(store, now);

      /* بذر دين قديم مجهول الاسم مباشرة عند المخزن (بيانات موروثة لا تمر
       * ببانٍ اليوم) — بيع 12.00 قُبض 5.00 دين بلا اسم. */
      const named = await directSales.record({
        itemName: "صندوق هدايا",
        quantity: 1,
        revenueMinor: 1200,
        collectedMinor: 500,
        collectionStatus: "partial_debt",
        customerName: "اسم سيُمحى",
        costMinor: null,
        occurredOn: "2026-09-01",
        note: "بيع مباشر",
        idempotencyKey: "s11lr-legacy-op",
      });
      if (!named.ok) throw new Error(named.message);
      const stripped: DirectSale = { ...named.value, customerName: null, customerPartyId: null };
      const seeded = await store.saveDirectSale(stripped);
      if (!seeded.ok) throw new Error("seed failed");
      const commitsAfterSetup = commitCalls.length;

      const corrected = await directSales.update(stripped.id, {
        itemName: stripped.itemName,
        quantity: 1,
        revenueMinor: 1200,
        collectedMinor: 500,
        collectionStatus: "partial_debt",
        catalogItemId: null,
        customerName: null,
        customerPartyId: null,
        costMinor: null,
        occurredOn: stripped.occurredOn,
        note: "تصحيح وصف غير مالي لدين قديم مجهول الاسم",
        idempotencyKey: "s11lr-legacy-edit-op",
        expectedRevisionCount: 0,
      });

      /* النجاح هو الصدق: الدين القائم لا يُطالب بتعريف رجعي (B2/AC14). */
      expect(corrected.ok).toBe(true);
      expect(commitCalls.length).toBe(commitsAfterSetup + 1);
      const after = await store.listDirectSales();
      const updated = after.ok ? after.value[0] : null;
      expect(updated?.collectionStatus).toBe("partial_debt");
      expect(updated?.revenueMinor).toBe(1200);
      expect(updated?.collectedMinor).toBe(500);
      expect(updated?.customerName).toBeNull();
      expect(updated?.revisions ?? []).toHaveLength(1);
    });

    it(`${label}: الدين المعرف باسم أو طرف محفوظ يعبر الحد بكتابة واحدة سليمة`, async () => {
      if (label === "IndexedDB") await clearDatabase();
      const { store, commitCalls } = withCommitCounter(makeStore());
      const directSales = new DirectSaleService(store, now);

      const byName = await directSales.record({
        itemName: "صندوق هدايا",
        quantity: 1,
        revenueMinor: 1500,
        collectedMinor: 500,
        collectionStatus: "partial_debt",
        customerName: "ليان — جارة المحل",
        customerPartyId: null,
        costMinor: null,
        occurredOn: "2026-10-20",
        note: "بيع مباشر",
        idempotencyKey: "s11lr-named-op",
      });
      expect(byName.ok).toBe(true);

      const byParty = await directSales.record({
        itemName: "ترتيب حفل",
        quantity: 1,
        revenueMinor: 2000,
        collectedMinor: 600,
        collectionStatus: "partial_debt",
        customerName: "مؤسسة النخبة — لقطة الطرف",
        customerPartyId: "party-7",
        costMinor: null,
        occurredOn: "2026-10-21",
        note: "بيع مباشر",
        idempotencyKey: "s11lr-party-op",
      });
      expect(byParty.ok).toBe(true);

      /* كل بيع عبر الحد بكتابة واحدة — لا كتابة إضافية ولا بديل. */
      expect(commitCalls).toEqual(["commitDirectSaleWrite", "commitDirectSaleWrite"]);
      const sales = await store.listDirectSales();
      expect(sales.ok && sales.value).toHaveLength(2);
    });
  }
});
