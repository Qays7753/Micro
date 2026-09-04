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
    expect(verified.value.file.version).toBe(27);
    expect(verified.value.file.schemaVersion).toBe(35);
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
    expect(prepared.value.file.version).toBe(27);
    expect(prepared.value.file.schemaVersion).toBe(35);
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

/* المجموعة ٤ (تصحيح مراجعة 4-c — تعزيز مدقق الاستيراد): الأعمدة الجديدة لا
 * تُهرَّب داخل أنواع قديمة، ورابط عربون التصنيف يشير لطلب موجود، وتراجع
 * المجموعة ٤ ينفي أعمدته — الملف المكسور يُرفض والبيانات المحلية لا تُمس. */
describe("schema 34 import validator hardening (تصحيح 4-c)", () => {
  function baseFile(): Record<string, unknown> {
    return {
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
        assets: [],
        loans: [],
      },
    };
  }

  it("rejects a legacy-type event smuggling a non-zero asset delta column", async () => {
    const store = new MemoryLocalStore();
    const transfers = new LocalTransferService(store, () => NOW);
    const file = baseFile();
    (file.data as Record<string, unknown>).financialEvents = [
      {
        id: "ev-smuggle",
        type: "owner_investment_cash",
        currency: "JOD",
        amountMinor: 5000,
        occurredOn: "2026-08-01",
        recordedAt: NOW,
        idempotencyKey: "ev-smuggle-key",
        note: "مال مالك",
        counterparty: null,
        relatedEventId: null,
        correctionType: null,
        correctionOfEventId: null,
        correctionReason: null,
        cashDeltaMinor: 5000,
        payableDeltaMinor: 0,
        ownerCapitalDeltaMinor: 5000,
        operatingExpenseDeltaMinor: 0,
        amanahDeltaMinor: 0,
        assetDeltaMinor: 5000,
        loanDeltaMinor: 0,
        revenueDeltaMinor: 0,
      },
    ];
    const prepared = await transfers.prepareImport(JSON.stringify(file));
    expect(prepared.ok).toBe(false);
    if (prepared.ok) return;
    expect(prepared.message).toContain("بقيت بيانات هذا الجهاز دون تغيير");
  });

  it("rejects a deposit classification event whose order does not exist in the file", async () => {
    const store = new MemoryLocalStore();
    const transfers = new LocalTransferService(store, () => NOW);
    const file = baseFile();
    (file.data as Record<string, unknown>).financialEvents = [
      {
        id: "ev-dep-orphan",
        type: "deposit_retained_revenue",
        currency: "JOD",
        amountMinor: 3000,
        occurredOn: "2026-08-02",
        recordedAt: NOW,
        idempotencyKey: "ev-dep-orphan-key",
        note: "عربون احتُفظ به",
        counterparty: null,
        relatedEventId: null,
        correctionType: null,
        correctionOfEventId: null,
        correctionReason: null,
        cashDeltaMinor: 0,
        payableDeltaMinor: 0,
        ownerCapitalDeltaMinor: 0,
        operatingExpenseDeltaMinor: 0,
        amanahDeltaMinor: 0,
        assetDeltaMinor: 0,
        loanDeltaMinor: 0,
        revenueDeltaMinor: 3000,
        depositContext: { orderId: "order-ghost" },
      },
    ];
    const prepared = await transfers.prepareImport(JSON.stringify(file));
    expect(prepared.ok).toBe(false);
  });

  it("rejects a loan reversal whose loan delta is not the negation of its source", async () => {
    const store = new MemoryLocalStore();
    const transfers = new LocalTransferService(store, () => NOW);
    const file = baseFile();
    (file.data as Record<string, unknown>).financialEvents = [
      {
        id: "ev-loan-src",
        type: "loan_outgoing_cash",
        currency: "JOD",
        amountMinor: 15000,
        occurredOn: "2026-08-01",
        recordedAt: NOW,
        idempotencyKey: "ev-loan-src-key",
        note: "قرض لأحمد",
        counterparty: null,
        relatedEventId: null,
        correctionType: null,
        correctionOfEventId: null,
        correctionReason: null,
        cashDeltaMinor: -15000,
        payableDeltaMinor: 0,
        ownerCapitalDeltaMinor: 0,
        operatingExpenseDeltaMinor: 0,
        amanahDeltaMinor: 0,
        assetDeltaMinor: 0,
        loanDeltaMinor: 15000,
        revenueDeltaMinor: 0,
        loanContext: { loanId: "loan-x", borrower: "أحمد" },
      },
      {
        id: "ev-loan-rev",
        type: "loan_outgoing_cash",
        currency: "JOD",
        amountMinor: 15000,
        occurredOn: "2026-08-03",
        recordedAt: NOW,
        idempotencyKey: "ev-loan-rev-key",
        note: "تراجع: قرض لأحمد",
        counterparty: null,
        relatedEventId: null,
        correctionType: "reverse",
        correctionOfEventId: "ev-loan-src",
        correctionReason: "سُجّل بالخطأ",
        cashDeltaMinor: 15000,
        payableDeltaMinor: 0,
        ownerCapitalDeltaMinor: 0,
        operatingExpenseDeltaMinor: 0,
        amanahDeltaMinor: 0,
        assetDeltaMinor: 0,
        loanDeltaMinor: 15000,
        revenueDeltaMinor: 0,
        loanContext: { loanId: "loan-x", borrower: "أحمد" },
      },
    ];
    const prepared = await transfers.prepareImport(JSON.stringify(file));
    expect(prepared.ok).toBe(false);
  });

  it("rejects an aggregate that over-depreciates assets below zero book value", async () => {
    const store = new MemoryLocalStore();
    const transfers = new LocalTransferService(store, () => NOW);
    const file = baseFile();
    (file.data as Record<string, unknown>).financialEvents = [
      {
        id: "ev-wo-alone",
        type: "asset_writeoff",
        currency: "JOD",
        amountMinor: 9000,
        occurredOn: "2026-08-05",
        recordedAt: NOW,
        idempotencyKey: "ev-wo-alone-key",
        note: "شطب بلا أصل",
        counterparty: null,
        relatedEventId: null,
        correctionType: null,
        correctionOfEventId: null,
        correctionReason: null,
        cashDeltaMinor: 0,
        payableDeltaMinor: 0,
        ownerCapitalDeltaMinor: 0,
        operatingExpenseDeltaMinor: 0,
        amanahDeltaMinor: 0,
        assetDeltaMinor: -9000,
        loanDeltaMinor: 0,
        revenueDeltaMinor: 0,
        assetContext: { assetId: "asset-ghost", name: "أصل وهمي" },
      },
    ];
    const prepared = await transfers.prepareImport(JSON.stringify(file));
    expect(prepared.ok).toBe(false);
  });
});
