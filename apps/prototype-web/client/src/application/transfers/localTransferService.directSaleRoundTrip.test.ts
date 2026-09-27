import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { directSaleOutstandingMinor, type DirectSale } from "@micro-domain/direct-sale/index.js";
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

/* F-013 (W2-A): سجل ما قبل X-06 — collected === revenue بلا collectionStatus ولا
 * حقول التصحيح، كُتب مباشرة إلى التخزين كما كتبته الوحدة يومها. الحارس: صراحة
 * القبض في المجال الجديد لا تعيد تفسير السجلات القديمة عبر التصدير/الاستيراد. */
describe("legacy pre-X-06 direct-sale record round-trips unchanged", () => {
  it("exports, imports, and re-exports a legacy full-collection record without reinterpretation", async () => {
    const store = new MemoryLocalStore();
    const legacy = {
      id: "legacy-sale-1",
      itemName: "قطعة قديمة",
      quantity: 1,
      currency: "JOD",
      revenueMinor: 700,
      /* ما قبل X-06: الإنشاء كتب المقبوض = السعر كاملًا — والحالة لم تكن قد وُجدت بعد. */
      collectedMinor: 700,
      costMinor: 250,
      profitMinor: 450,
      occurredOn: "2026-08-01",
      recordedAt: "2026-08-01T10:00:00.000Z",
      note: "سجل ما قبل X-06",
      idempotencyKey: "legacy-sale-op-1",
    } as unknown as DirectSale;
    const saved = await store.saveDirectSale(legacy);
    if (!saved.ok) throw new Error("legacy fixture write failed");

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
    const sale = restored.value[0];
    /* لا إعادة تفسير: المقبوض يبقى كما كُتب، والحالة تظل غير معلنة لا مُختلقة. */
    expect(sale).toMatchObject({
      id: "legacy-sale-1",
      revenueMinor: 700,
      collectedMinor: 700,
      costMinor: 250,
      profitMinor: 450,
      status: "active",
    });
    expect(sale?.collectionStatus).toBeUndefined();
    expect(directSaleOutstandingMinor(sale!)).toBe(0);

    /* الاستقرار: الاستيراد يعيد التصدير بالعدد نفسه — لا تضخيم ولا فقد. */
    const reExport = await targetTransfers.createVerifiedExport();
    if (!reExport.ok) throw new Error(reExport.message);
    expect(reExport.value.summary.directSales).toBe(1);
  });
});
