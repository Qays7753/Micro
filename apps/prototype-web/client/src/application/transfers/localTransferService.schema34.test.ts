import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { AssetService } from "@/application/assets/assetService";
import { LoanService } from "@/application/loans/loanService";
import { RetainedDepositService } from "@/application/finance/retainedDepositService";
import type { LocalExportFile } from "@/storage/local/types";

const NOW = "2026-09-04T08:00:00.000Z";

/* ملف ٢٥/٣٣ محدود بنيويًا (زوج المجموعة ٣) — يُقبل ويُهاجر بلا اختراع أصول
 * ولا قروض ولا معاني؛ الشكل هو شكل مخزن المجموعة ٣ الفارغ. */
function legacyFile(): Record<string, unknown> {
  return {
    format: "micro-prototype-local-export",
    version: 25,
    schemaVersion: 33,
    exportedAt: NOW,
    data: {
      profile: null,
      preferences: null,
      drafts: [],
      orders: [],
      schedules: [],
      recurrences: [],
      financialEvents: [],
      supplierPurchases: [],
      cashWallets: [],
      cashContinuityEntries: [],
      materials: [],
      inventoryMovements: [],
      inventoryShortages: [],
      inventoryActivation: null,
      catalogItems: [],
      measurementUnits: [],
      directConversions: [],
      catalogTemplates: [],
      actualTimeRecords: [],
      shortCashDeclarations: [],
      ownerEntitlementPolicies: [],
      ownerEntitlementRecords: [],
      ownerEntitlementOpeningBalances: [],
      ownerMovements: [],
      allocationPolicies: [],
      costEstimates: [],
    },
  };
}

describe("schema 34 export round-trip (المجموعة ٤ — عقد ٢٩)", () => {
  it("round-trips assets, loans, and retained-deposit classification verbatim through a verified export", async () => {
    const store = new MemoryLocalStore();
    const assets = new AssetService(store, () => NOW);
    const loans = new LoanService(store, () => NOW);
    const createdAsset = await assets.create({
      name: "ثلاجة عرض",
      acquisitionAmountMinor: 60000,
      acquisitionKind: "cash",
      purchaseDate: "2026-06-01",
      lifeMonths: 24,
      depreciationStartOn: "2026-06-01",
    });
    expect(createdAsset.ok).toBe(true);
    const createdLoan = await loans.create({
      borrowerName: "أحمد",
      principalMinor: 15000,
      loanDate: "2026-07-01",
    });
    expect(createdLoan.ok).toBe(true);

    const transfers = new LocalTransferService(store, () => NOW);
    const verified = await transfers.createVerifiedExport();
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.value.file.version).toBe(26);
    expect(verified.value.file.schemaVersion).toBe(34);
    expect(verified.value.summary.assets).toBe(1);
    expect(verified.value.summary.loans).toBe(1);

    const serialized = JSON.stringify(verified.value.file);
    const prepared = await transfers.prepareImport(serialized);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.value.file.data.assets).toHaveLength(1);
    expect(prepared.value.file.data.loans).toHaveLength(1);
    expect(prepared.value.file.data.assets?.[0]!.name).toBe("ثلاجة عرض");
    expect(prepared.value.file.data.loans?.[0]!.borrowerName).toBe("أحمد");
  });

  it("imports a legacy 25/33 export: absent collections become [], never invented history", async () => {
    const store = new MemoryLocalStore();
    const transfers = new LocalTransferService(store, () => NOW);
    const legacy = legacyFile();
    expect(legacy.version).toBe(25);
    expect(legacy.schemaVersion).toBe(33);
    const prepared = await transfers.prepareImport(JSON.stringify(legacy));
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.value.file.data.assets).toEqual([]);
    expect(prepared.value.file.data.loans).toEqual([]);
    expect(prepared.value.file.version).toBe(26);
    expect(prepared.value.file.schemaVersion).toBe(34);
  });

  it("rejects an asset record whose acquisition event is missing — broken file, store untouched", async () => {
    const store = new MemoryLocalStore();
    const transfers = new LocalTransferService(store, () => NOW);
    const file = {
      format: "micro-prototype-local-export",
      version: 26,
      schemaVersion: 34,
      exportedAt: NOW,
      data: {
        profile: null,
        preferences: null,
        drafts: [],
        orders: [],
        schedules: [],
        recurrences: [],
        financialEvents: [],
        supplierPurchases: [],
        cashWallets: [],
        cashContinuityEntries: [],
        materials: [],
        inventoryMovements: [],
        inventoryShortages: [],
        inventoryActivation: null,
        catalogItems: [],
        measurementUnits: [],
        directConversions: [],
        catalogTemplates: [],
        actualTimeRecords: [],
        shortCashDeclarations: [],
        ownerEntitlementPolicies: [],
        ownerEntitlementRecords: [],
        ownerEntitlementOpeningBalances: [],
        ownerMovements: [],
        allocationPolicies: [],
        costEstimates: [],
        assets: [
          {
            id: "asset-broken",
            name: "أصل بلا حدث",
            categoryLabel: null,
            acquisitionAmountMinor: 10000,
            acquisitionKind: "cash",
            purchaseDate: "2026-06-01",
            lifeMonths: null,
            depreciationStartOn: null,
            status: "active",
            acquisitionEventId: "event-missing",
            disposal: null,
            writeOff: null,
            contractRevisions: [],
            operationKey: "asset-broken:create",
            createdAt: NOW,
            updatedAt: NOW,
          },
        ],
        loans: [],
      },
    };
    const prepared = await transfers.prepareImport(JSON.stringify(file));
    expect(prepared.ok).toBe(false);
    if (prepared.ok) return;
    expect(prepared.message).toContain("بقيت بيانات هذا الجهاز دون تغيير");
  });

  it("classification events survive the round trip with their order linkage", async () => {
    const store = new MemoryLocalStore();
    const retainedDeposits = new RetainedDepositService(store, () => NOW);
    /* بذر طلب ملغى بعربون محتفظ عبر المخزن مباشرة (عقد الدومين مختبر في
     * ملفه الخاص) — ثم التصنيف عبر الخدمة، ثم التصدير المتحقق. */
    const {
      calculateCostSnapshot,
      cancelOrder,
      collectDeposit,
      createCraftOrder,
      settleDepositRetain,
    } = await import("@micro-domain/craft-order/index.js");
    const snapshot = calculateCostSnapshot("cost-g4", {
      currency: "JOD",
      materialItems: [
        { name: "خيط", quantity: 1, unit: "متر", unitPriceMinor: 300, priceDate: "2026-08-01", source: "user_input", confidence: "known" },
      ],
      time: null,
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: NOW,
      source: "price_approval",
    });
    let order = createCraftOrder({
      id: "order-roundtrip",
      customerName: "ليلى",
      itemName: "فستان",
      specifications: "قياس مخصص",
      quantity: 1,
      agreedPriceMinor: 10000,
      costSnapshot: snapshot,
      createdAt: NOW,
    });
    order = collectDeposit(order, 5000, "order-roundtrip:dep", NOW);
    order = cancelOrder(order, "إلغاء", "order-roundtrip:cancel", NOW);
    order = settleDepositRetain(order, 5000, "احتفاظ", "order-roundtrip:retain", NOW);
    await store.saveOrder({
      id: "order-roundtrip",
      order,
      catalogItemId: null,
      deliveryDate: "2026-09-01",
      agreementSource: "whatsapp",
      createdAt: NOW,
      updatedAt: NOW,
    });
    const classified = await retainedDeposits.classify("order-roundtrip", "revenue", "تعويض");
    expect(classified.ok).toBe(true);

    const transfers = new LocalTransferService(store, () => NOW);
    const verified = await transfers.createVerifiedExport();
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    const prepared = await transfers.prepareImport(JSON.stringify(verified.value.file));
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const revenueEvents = prepared.value.file.data.financialEvents.filter(
      event => event.type === "deposit_retained_revenue",
    );
    expect(revenueEvents).toHaveLength(1);
    expect(revenueEvents[0]!.revenueDeltaMinor).toBe(5000);
    expect(prepared.value.file.data.orders[0]!.order.retainedMeaning).toBe("revenue");
  });
});
