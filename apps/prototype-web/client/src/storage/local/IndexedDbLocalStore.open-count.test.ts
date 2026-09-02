import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
afterEach(clearDatabase);

/* S5-07 (المجموعة ٦ — البند ٦): حارس أداء — قراءة «مالي» الكاملة (المخزن +
 * الخدمات) تفتح اتصال IndexedDB واحدًا لا مصافحة لكل عملية (كان القياس ٥٣
 * فتحًا قبل التخزين المؤقت للاتصال). */
describe("S5-07 — cached connection: one open per fan-out", () => {
  it("a full position read fan-out opens the database once, not per operation", async () => {
    const openSpy = vi.spyOn(indexedDB, "open");
    const store = new IndexedDbLocalStore();
    /* قراءة المركز المالي: أوامر + أحداث + مشتريات + محافظ + حركات + مالك +
     * مبيعات — سبع قوائم عبر نفس الاتصال المخزَّن. */
    const reads = await Promise.all([
      store.listOrders(),
      store.listFinancialEvents(),
      store.listSupplierPurchases(),
      store.listCashWallets(),
      store.listCashContinuityEntries(),
      store.listOwnerMovements(),
      store.listDirectSales(),
    ]);
    for (const result of reads) expect(result.ok).toBe(true);
    /* الاتصال المخزَّن: فتح واحد لأول عملية والبقية يعيد استخدامه. */
    expect(openSpy.mock.calls.length).toBe(1);
    openSpy.mockRestore();
  });

  it("a failed open never poisons the cache — the next call reopens", async () => {
    const store = new IndexeddbFailureFirst();
    const first = await store.listOrders();
    expect(first.ok).toBe(false);
    /* المحاولة التالية تفتح من جديد — لا وعد مرفوض يعلق إلى الأبد. */
    const openSpy = vi.spyOn(indexedDB, "open");
    const retry = await new IndexedDbLocalStore().listOrders();
    expect(retry.ok).toBe(true);
    expect(openSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    openSpy.mockRestore();
  });
});

/* مخزن يفشل فتحه مرة واحدة (محاكاة عطل فتح عابر) ثم ينجح. */
class IndexeddbFailureFirst extends IndexedDbLocalStore {
  private failed = false;
  private originalOpen = indexedDB.open.bind(indexedDB);
  constructor() {
    super();
    const self = this;
    vi.spyOn(indexedDB, "open").mockImplementationOnce((...args: Parameters<typeof indexedDB.open>) => {
      self.failed = true;
      throw new Error("عطل فتح عابر");
    });
  }
  get didFail() {
    return this.failed;
  }
}
