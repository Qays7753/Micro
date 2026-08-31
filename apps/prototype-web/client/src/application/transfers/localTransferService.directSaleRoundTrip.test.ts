import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const now = () => "2026-08-30T09:00:00.000Z";

/* انحدار حرج: التصدير المُتحقق كان يرفض البيع الجزئي (X-06) ومراجعة «خفّضتُ السعر»،
 * فكان أي بيع آجل يمنع نسخة احتياطية مُتحقّقة ويوقف بوابة «ابدأ من جديد».
 * الحارس هنا: كل سلوك نطامي تنتجه الوحدة يعبر دورة التصدير-التحقق-الاستيراد كاملة. */
describe("verified export accepts partial-collection and price-cut direct sales", () => {
  it("round-trips a credit sale with a structured customer name", async () => {
    const store = new MemoryLocalStore();
    const sales = new DirectSaleService(store, now);
    const recorded = await sales.record({
      itemName: "بوكس كيك",
      quantity: 1,
      revenueMinor: 1500,
      collectedMinor: 900,
      collectionStatus: "partial_debt",
      customerName: "خالد",
      costMinor: null,
      occurredOn: "2026-08-29",
      note: "بيع آجل من ورقة الإضافة",
      idempotencyKey: "credit-sale-1",
    });
    if (!recorded.ok) throw new Error(recorded.message);
    expect(recorded.value.collectionStatus).toBe("partial_debt");

    const transfers = new LocalTransferService(store, now);
    const verified = await transfers.createVerifiedExport();
    if (!verified.ok) throw new Error(verified.message);
    expect(verified.value.summary.directSales).toBe(1);

    const target = new MemoryLocalStore();
    const targetTransfers = new LocalTransferService(target, now);
    const prepared = targetTransfers.prepareImport(JSON.stringify(verified.value.file));
    if (!prepared.ok) throw new Error(prepared.message);
    const confirmed = await targetTransfers.confirmImport(prepared.value);
    if (!confirmed.ok) throw new Error(confirmed.message);
    const restored = await new DirectSaleService(target, now).list();
    if (!restored.ok) throw new Error(restored.message);
    expect(restored.value[0]?.customerName).toBe("خالد");
    expect(restored.value[0]?.collectedMinor).toBe(900);
    expect(restored.value[0]?.collectionStatus).toBe("partial_debt");
  });

  it("round-trips a sale corrected with a documented price cut", async () => {
    const store = new MemoryLocalStore();
    const sales = new DirectSaleService(store, now);
    const recorded = await sales.record({
      itemName: "تراي",
      quantity: 1,
      revenueMinor: 1200,
      collectedMinor: 900,
      costMinor: null,
      occurredOn: "2026-08-29",
      note: "بيع مباشر",
      idempotencyKey: "cut-sale-1",
      priceCut: true,
    });
    if (!recorded.ok) throw new Error(recorded.message);
    expect(recorded.value.revisions?.[0]?.kind).toBe("price_cut");
    expect(recorded.value.revenueMinor).toBe(900);
    expect(recorded.value.collectionStatus).toBe("collected_in_full");

    const transfers = new LocalTransferService(store, now);
    const verified = await transfers.createVerifiedExport();
    if (!verified.ok) throw new Error(verified.message);
    expect(verified.value.summary.directSales).toBe(1);

    const target = new MemoryLocalStore();
    const targetTransfers = new LocalTransferService(target, now);
    const prepared = targetTransfers.prepareImport(JSON.stringify(verified.value.file));
    if (!prepared.ok) throw new Error(prepared.message);
    const confirmed = await targetTransfers.confirmImport(prepared.value);
    if (!confirmed.ok) throw new Error(confirmed.message);
    const restored = await new DirectSaleService(target, now).list();
    if (!restored.ok) throw new Error(restored.message);
    expect(restored.value[0]?.revisions?.[0]).toMatchObject({
      kind: "price_cut",
      beforeRevenueMinor: 1200,
    });
  });
});
