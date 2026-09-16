/** EXE-010 (AUD-NEW-04): عكس تحصيل البيع المباشر — السجل والتخصيص والذمم
 * تصحح في خطوة موثقة واحدة ذرّية. يثبت هذا الملف:
 * ١) القبض على محفظة ثم عكسه يعيد المحفظة والذمم إلى القيم الصحيحة، والقيد
 *    الأصلي يبقى ظاهرًا ويرتبط بالعكس (reversesEntryId + مراجعة السبب).
 * ٢) إعادة تنفيذ العكس نفسه لا تكرر الأثر (reused صادق بلا كتابة ثانية).
 * ٣) النقر المزدوج (نفس المفتاح) يكتب مرة واحدة.
 * ٤) البيع الملغى يُرفض برسالة تشرح أن تخصيصاته عُكست عند الإلغاء.
 * ٥) التخصيص المُعكوس سابقًا لا يُعرض أصلًا في القائمة القابلة للعكس.
 * ٦) التحصيل غير المخصص (كاش غير موزع) لا يظهر في القائمة — يُصحح من المحرر.
 */
import { describe, expect, it } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { SaleCollectionReversalService } from "./saleCollectionReversalService";

const NOW = "2026-09-16T09:00:00.000Z";

async function setup() {
  const store = new MemoryLocalStore();
  const projectFinance = new ProjectFinancialService(store, () => NOW);
  const directSales = new DirectSaleService(store, () => NOW);
  const reversal = new SaleCollectionReversalService(store, projectFinance, () => NOW);
  return { store, projectFinance, directSales, reversal };
}

/** بيع بدين ثم تحصيل على محفظة عبر ورقة التحصيل نفسها (المسار الإنتاجي). */
async function saleWithWalletCollection(walletName = "درج العكس") {
  const { store, projectFinance, directSales, reversal } = await setup();
  /* محفظة برصيد افتتاحي 100.00 */
  const walletOpening = await projectFinance.distributeUnallocated;
  void walletOpening;
  const cash = new (await import("@/application/cash/cashContinuityService")).CashContinuityService(
    store,
    () => NOW,
  );
  const wallet = await cash.openWallet({
    name: walletName,
    kind: "cash_drawer",
    openingMinor: 10000,
    occurredOn: "2026-09-15",
    note: "رصيد بداية",
    operationKey: "exe010-sale-open",
  });
  if (!wallet.ok) throw new Error(wallet.message);
  const walletId = wallet.value.wallet.id;
  /* بيع بدين: سعر 80.00، مقبوض 0 بحالة دين صريحة ليظهر في مصادر التحصيل. */
  const recorded = await directSales.record({
    itemName: "طقم أكواب",
    quantity: 1,
    revenueMinor: 8000,
    collectedMinor: 0,
    collectionStatus: "partial_debt",
    catalogItemId: null,
    customerName: "ليان",
    costMinor: 3000,
    occurredOn: "2026-09-15",
    note: "بيع بدين",
    idempotencyKey: "exe010-sale-record",
  });
  if (!recorded.ok) throw new Error(recorded.message);
  const sale = recorded.value;
  /* تحصيل 30.00 على المحفظة عبر مسار التحصيل القائم (مراجعة edit + تخصيص). */
  const collections = new (await import("./collectionService")).CollectionService(
    store,
    new (await import("@/application/fulfillment/fulfillmentService")).FulfillmentService(store, () => NOW),
    directSales,
    projectFinance,
  );
  const collected = await collections.collect({
    sourceKind: "direct_sale",
    sourceId: sale.id,
    amountMinor: 3000,
    idempotencyKey: "exe010-sheet-key",
    walletId,
  });
  if (!collected.ok) throw new Error(collected.message);
  return { store, projectFinance, directSales, reversal, sale, walletId };
}

describe("SaleCollectionReversalService — عكس تحصيل البيع المباشر (EXE-010)", () => {
  it("reverses a wallet-attributed collection: sale, wallet, and receivables all return to truth, original stays and is linked", async () => {
    const { store, projectFinance, reversal, sale, walletId } = await saleWithWalletCollection();
    const before = await projectFinance.readPosition();
    if (!before.ok) throw new Error(before.message);
    expect(before.value.walletCashMinor).toBe(13000);
    const collections = await reversal.listReversibleCollections(sale.id);
    expect(collections.ok && collections.value).toHaveLength(1);
    const target = collections.ok ? collections.value[0] : null;
    expect(target).not.toBeNull();
    expect(target!.amountMinor).toBe(3000);
    const preview = await reversal.preview({ saleId: sale.id, allocationEntryId: target!.allocationEntryId });
    expect(preview.ok && preview.value.status).toBe("full_match");
    if (!preview.ok || preview.value.status !== "full_match") return;
    expect(preview.value.collectedAfterMinor).toBe(0);
    expect(preview.value.receivableAfterMinor).toBe(8000);
    expect(preview.value.walletBalanceAfterMinor).toBe(10000);
    const result = await reversal.reverse({
      saleId: sale.id,
      allocationEntryId: target!.allocationEntryId,
      reason: "القبض سُجل على البيع الخطأ",
      operationKey: "exe010-reverse-a",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    /* السجل: المقبوض عاد صفرًا والدين عاد كاملًا — بمراجعة عكس موثقة السبب. */
    expect(result.value.sale.collectedMinor).toBe(0);
    expect(result.value.sale.collectionStatus).toBe("partial_debt");
    const reversalRevision = (result.value.sale.revisions ?? []).find(
      revision => revision.idempotencyKey === "sale-collect-reverse:exe010-reverse-a",
    );
    expect(reversalRevision).toBeDefined();
    expect(reversalRevision!.reason).toContain("عكس تحصيل");
    expect(reversalRevision!.reason).toContain("القبض سُجل على البيع الخطأ");
    /* الأصل باقٍ: مراجعة التحصيل الأصلية لم تُحذف. */
    expect(
      (result.value.sale.revisions ?? []).some(revision => revision.idempotencyKey === "exe010-sheet-key"),
    ).toBe(true);
    /* المحفظة: قيد عكس مرآة مرتبط بالأصل. */
    const entries = await store.listCashContinuityEntries();
    if (!entries.ok) throw new Error(entries.message);
    const originalAllocation = entries.value.find(entry => entry.operationKey === "exe010-sheet-key:attribute");
    expect(originalAllocation).toBeDefined();
    const cashReversal = entries.value.find(
      entry => entry.operationKey === "exe010-reverse-a:unattribute",
    );
    expect(cashReversal).toBeDefined();
    expect(cashReversal!.cashDeltaMinor).toBe(-3000);
    expect(cashReversal!.reversesEntryId).toBe(originalAllocation!.id);
    expect(cashReversal!.reason).toBe("القبض سُجل على البيع الخطأ");
    /* المعادلة: المحفظة عادت للافتتاح، وغير الموزع صافي صفر. */
    const after = await projectFinance.readPosition();
    if (!after.ok) throw new Error(after.message);
    expect(after.value.walletCashMinor).toBe(10000);
    expect(after.value.unallocatedCashMinor).toBe(0);
    expect(after.value.recordedCashMinor).toBe(before.value.recordedCashMinor - 3000);
  });

  it("replays the same reversal as an honest reused outcome — no second revision, no second cash entry", async () => {
    const { store, reversal, sale } = await saleWithWalletCollection();
    const collections = await reversal.listReversibleCollections(sale.id);
    const target = collections.ok ? collections.value[0] : null;
    if (!target) throw new Error("no reversible collection");
    const first = await reversal.reverse({
      saleId: sale.id,
      allocationEntryId: target.allocationEntryId,
      reason: "سبب موثق",
      operationKey: "exe010-replay",
    });
    expect(first.ok).toBe(true);
    const replay = await reversal.reverse({
      saleId: sale.id,
      allocationEntryId: target.allocationEntryId,
      reason: "سبب موثق",
      operationKey: "exe010-replay",
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.reused).toBe(true);
    const entries = await store.listCashContinuityEntries();
    const reversals = entries.ok
      ? entries.value.filter(entry => entry.operationKey === "exe010-replay:unattribute")
      : [];
    expect(reversals).toHaveLength(1);
    const reversalRevisions = (replay.value.sale.revisions ?? []).filter(revision =>
      revision.idempotencyKey.startsWith("sale-collect-reverse:exe010-replay"),
    );
    expect(reversalRevisions).toHaveLength(1);
  });

  it("an already-reversed allocation is no longer listed as reversible", async () => {
    const { reversal, sale } = await saleWithWalletCollection();
    const first = await reversal.listReversibleCollections(sale.id);
    const target = first.ok ? first.value[0] : null;
    if (!target) throw new Error("no reversible collection");
    const result = await reversal.reverse({
      saleId: sale.id,
      allocationEntryId: target.allocationEntryId,
      reason: "عكس أول",
      operationKey: "exe010-consume",
    });
    expect(result.ok).toBe(true);
    const after = await reversal.listReversibleCollections(sale.id);
    expect(after.ok && after.value).toHaveLength(0);
  });

  it("refuses a cancelled sale with the honest explanation (allocations were already reversed at cancellation)", async () => {
    const { directSales, reversal, sale } = await saleWithWalletCollection();
    const cancelled = await directSales.cancel(sale.id, "إلغاء لاختبار الرفض", "exe010-cancel-key");
    expect(cancelled.ok).toBe(true);
    const collections = await reversal.listReversibleCollections(sale.id);
    expect(collections.ok && collections.value).toHaveLength(0);
    const preview = await reversal.preview({ saleId: sale.id, allocationEntryId: "whatever" });
    expect(preview.ok && preview.value.status).toBe("sale_cancelled");
    if (preview.ok && preview.value.status === "sale_cancelled")
      expect(preview.value.refusalReason).toContain("عُكست تلقائيًا عند الإلغاء");
  });

  it("offers nothing to reverse for a sale collected into unallocated only", async () => {
    const { store, projectFinance, directSales, reversal } = await setup();
    const recorded = await directSales.record({
      itemName: "بيع نقدي غير موزع",
      quantity: 1,
      revenueMinor: 5000,
      collectedMinor: 5000,
      collectionStatus: "collected_in_full",
      catalogItemId: null,
      customerName: null,
      costMinor: null,
      occurredOn: "2026-09-15",
      note: "قبض كامل بلا محفظة",
      idempotencyKey: "exe010-unallocated-sale",
    });
    expect(recorded.ok).toBe(true);
    const collections = await reversal.listReversibleCollections(recorded.ok ? recorded.value.id : "");
    expect(collections.ok && collections.value).toHaveLength(0);
    void store;
    void projectFinance;
  });

  it("a blank reason is refused before any read or write", async () => {
    const { reversal, sale } = await saleWithWalletCollection();
    const result = await reversal.reverse({
      saleId: sale.id,
      allocationEntryId: "any",
      reason: "   ",
      operationKey: "exe010-no-reason",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("أكمل سبب عكس التحصيل");
  });
});
