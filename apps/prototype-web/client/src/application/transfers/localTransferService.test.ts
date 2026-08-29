import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import {
  localExportFormat,
  localExportVersion,
  localProfileId,
  localSchemaVersion,
} from "@/storage/local/types";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";
import { createFinancialEvent, createFinancialReversal } from "@micro-domain/financial-event/index.js";
import { createSupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import { createCashContinuityEntry, createCashWallet } from "@micro-domain/cash-continuity/index.js";
import { createInventoryMovement, createMaterial } from "@micro-domain/inventory-material/index.js";
import { createCatalogItem, createMeasurementUnit } from "@micro-domain/catalog/index.js";
import { createAllocationPolicy } from "@micro-domain/recurring-margin/index.js";
import { createActualTimeRecord, reverseActualTimeRecord } from "@micro-domain/actual-time/index.js";

const profile = {
  id: localProfileId,
  activityName: "مشغل ليان",
  currency: "JOD" as const,
  activityType: "custom_craft" as const,
  createdAt: "2026-08-22T00:00:00.000Z",
  updatedAt: "2026-08-22T00:00:00.000Z",
};
const draft = {
  id: "draft-1",
  intent: "customer_order" as const,
  customerName: "سارة",
  itemName: "صندوق",
  catalogItemId: null,
  specifications: "نقش",
  quantity: 1,
  costSnapshots: [],
  activeCostSnapshotId: null,
  linkedOrderId: null,
  createdAt: "2026-08-22T00:00:00.000Z",
  updatedAt: "2026-08-22T00:00:00.000Z",
};

describe("LocalTransferService", () => {
  it("round-trips a valid local export with a real order and events only after confirmation", async () => {
    const source = new MemoryLocalStore();
    await source.saveProfile(profile);
    const cost = calculateCostSnapshot("cost-1", {
      currency: "JOD",
      materialItems: [],
      time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-08-22T00:00:00.000Z",
      freshnessDays: null,
    });
    const order = createCraftOrder({
      id: "order-1",
      customerName: "سارة",
      itemName: "صندوق",
      specifications: "نقش",
      quantity: 1,
      agreedPriceMinor: 2000,
      costSnapshot: cost,
      createdAt: "2026-08-22T00:00:00.000Z",
    });
    await source.saveOrder({
      id: "order-1",
      order,
      catalogItemId: null,
      deliveryDate: "2026-08-30",
      agreementSource: "conversation",
      createdAt: "2026-08-22T00:00:00.000Z",
      updatedAt: "2026-08-22T00:00:00.000Z",
    });
    await source.saveDraft({ ...draft, linkedOrderId: "order-1" });
    await source.saveFinancialEvent(
      createFinancialEvent({
        id: "investment-1",
        type: "owner_investment_cash",
        amountMinor: 5000,
        occurredOn: "2026-08-22",
        recordedAt: "2026-08-22T01:00:00.000Z",
        idempotencyKey: "investment-1",
        note: "رأس مال",
        counterparty: null,
      }),
    );
    const exported = await new LocalTransferService(source, () => "2026-08-22T03:00:00.000Z").createExport();
    if (!exported.ok) throw new Error("export should succeed");
    const target = new MemoryLocalStore();
    await target.saveProfile({ ...profile, activityName: "بيانات قديمة" });
    const transfers = new LocalTransferService(target);
    const preview = transfers.prepareImport(JSON.stringify(exported.value));
    if (!preview.ok) throw new Error(`import should validate: ${preview.message}`);
    expect(await target.getProfile()).toMatchObject({ ok: true, value: { activityName: "بيانات قديمة" } });
    await expect(transfers.confirmImport(preview.value)).resolves.toMatchObject({
      ok: true,
      value: {
        profile: true,
        preferences: false,
        drafts: 1,
        orders: 1,
        schedules: 0,
        financialEvents: 1,
        snapshots: 1,
        events: 1,
      },
    });
    await expect(target.getProfile()).resolves.toMatchObject({ ok: true, value: profile });
    await expect(target.getDraft("draft-1")).resolves.toMatchObject({
      ok: true,
      value: { linkedOrderId: "order-1" },
    });
    await expect(target.getOrder("order-1")).resolves.toMatchObject({
      ok: true,
      value: { order: { events: [{ type: "created" }] } },
    });
    await expect(target.listFinancialEvents()).resolves.toMatchObject({
      ok: true,
      value: [{ type: "owner_investment_cash", cashDeltaMinor: 5000 }],
    });
  });

  it("round-trips classified expenses while accepting legacy financial events without context", async () => {
    const source = new MemoryLocalStore();
    await source.saveProfile(profile);
    await source.saveFinancialEvent(
      createFinancialEvent({
        id: "legacy-expense",
        type: "operating_expense_cash",
        amountMinor: 200,
        occurredOn: "2026-08-22",
        recordedAt: "2026-08-22T01:00:00.000Z",
        idempotencyKey: "legacy-expense",
        note: "سجل قديم",
        counterparty: null,
      }),
    );
    await source.saveFinancialEvent(
      createFinancialEvent({
        id: "classified-expense",
        type: "operating_expense_cash",
        amountMinor: 300,
        occurredOn: "2026-08-22",
        recordedAt: "2026-08-22T01:01:00.000Z",
        idempotencyKey: "classified-expense",
        note: "توصيل",
        counterparty: null,
        expenseContext: {
          relationship: "project",
          behavior: "variable",
          purpose: "order",
          knowledge: "known",
        },
      }),
    );
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("export should succeed");
    const target = new MemoryLocalStore();
    const transfers = new LocalTransferService(target);
    const preview = transfers.prepareImport(JSON.stringify(exported.value));
    if (!preview.ok) throw new Error(`import should validate: ${preview.message}`);
    await transfers.confirmImport(preview.value);
    await expect(target.listFinancialEvents()).resolves.toMatchObject({
      ok: true,
      value: [
        { id: "classified-expense", expenseContext: { relationship: "project", knowledge: "known" } },
        { id: "legacy-expense", expenseContext: null },
      ],
    });
  });

  it("round-trips a general financial reversal chain, preserves legacy fields, and rejects broken links", async () => {
    const source = new MemoryLocalStore();
    const original = createFinancialEvent({
      id: "transfer-source",
      type: "owner_investment_cash",
      amountMinor: 1200,
      occurredOn: "2026-08-10",
      recordedAt: "2026-08-10T01:00:00.000Z",
      idempotencyKey: "transfer-source",
      note: "استثمار",
      counterparty: null,
    });
    const reversal = createFinancialReversal({
      id: "transfer-reversal",
      sourceEvent: original,
      occurredOn: "2026-08-20",
      recordedAt: "2026-08-20T01:00:00.000Z",
      idempotencyKey: "transfer-reversal",
      reason: "تصحيح موثق",
    });
    await source.saveFinancialEvent(original);
    await source.saveFinancialEvent(reversal);
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("reversal export should succeed");
    const target = new MemoryLocalStore();
    const transfers = new LocalTransferService(target);
    const preview = transfers.prepareImport(JSON.stringify(exported.value));
    if (!preview.ok) throw new Error(`reversal import should validate: ${preview.message}`);
    await expect(transfers.confirmImport(preview.value)).resolves.toMatchObject({
      ok: true,
      value: { financialEvents: 2 },
    });
    await expect(target.listFinancialEvents()).resolves.toMatchObject({
      ok: true,
      value: [
        {
          id: "transfer-reversal",
          correctionType: "reverse",
          correctionOfEventId: "transfer-source",
          correctionReason: "تصحيح موثق",
          cashDeltaMinor: -1200,
        },
        {
          id: "transfer-source",
          correctionType: null,
          correctionOfEventId: null,
          correctionReason: null,
          cashDeltaMinor: 1200,
        },
      ],
    });
    const legacy = structuredClone(exported.value) as {
      data: { financialEvents: Array<Record<string, unknown>> };
    };
    legacy.data.financialEvents.forEach(event => {
      delete event.correctionType;
      delete event.correctionOfEventId;
      delete event.correctionReason;
    });
    legacy.data.financialEvents = legacy.data.financialEvents.filter(event => event.id === "transfer-source");
    expect(
      new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(legacy)),
    ).toMatchObject({
      ok: true,
      value: { file: { data: { financialEvents: [{ id: "transfer-source" }] } } },
    });
    const broken = structuredClone(exported.value) as {
      data: { financialEvents: Array<{ id: string; cashDeltaMinor: number }> };
    };
    broken.data.financialEvents.find(event => event.id === "transfer-reversal")!.cashDeltaMinor = -1199;
    expect(
      new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(broken)),
    ).toMatchObject({ ok: false, code: "validation_error" });
    const missingSource = structuredClone(exported.value) as {
      data: { financialEvents: Array<{ id: string }> };
    };
    missingSource.data.financialEvents = missingSource.data.financialEvents.filter(
      event => event.id !== "transfer-source",
    );
    expect(
      new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(missingSource)),
    ).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("upgrades a v6 export while preserving a legacy shared expense without inventing its source", async () => {
    const source = new MemoryLocalStore();
    await source.saveProfile(profile);
    await source.saveFinancialEvent(
      createFinancialEvent({
        id: "legacy-shared",
        type: "operating_expense_cash",
        amountMinor: 600,
        occurredOn: "2026-08-22",
        recordedAt: "2026-08-22T01:00:00.000Z",
        idempotencyKey: "legacy-shared",
        note: "حصة كهرباء قديمة",
        counterparty: null,
        expenseContext: { relationship: "shared", behavior: "fixed", purpose: "period", knowledge: "known" },
      }),
    );
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("export should succeed");
    const legacy = structuredClone(exported.value) as { version: number; schemaVersion: number };
    legacy.version = 6;
    legacy.schemaVersion = 14;
    const preview = new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(legacy));
    expect(preview).toMatchObject({
      ok: true,
      value: {
        file: {
          version: localExportVersion,
          schemaVersion: localSchemaVersion,
          data: {
            financialEvents: [
              { id: "legacy-shared", expenseContext: { relationship: "shared", sharedProjectShare: null } },
            ],
          },
        },
      },
    });
  });

  it("round-trips G3 percentage and deferred shared-expense fields and accepts the previous schema pair", async () => {
    const source = new MemoryLocalStore();
    const percentage = createFinancialEvent({
      id: "percentage-event",
      type: "operating_expense_cash",
      amountMinor: 617,
      occurredOn: "2026-08-22",
      recordedAt: "2026-08-22T01:00:00.000Z",
      idempotencyKey: "percentage-event",
      note: "كهرباء بنسبة",
      counterparty: null,
      expenseContext: {
        relationship: "shared",
        behavior: "mixed",
        purpose: "period",
        knowledge: "known",
        sharedProjectShare: {
          basis: "agreed_percentage",
          note: "20%",
          allocation: "allocated",
          totalAmountMinor: 3083,
          percentageBps: 2000,
          calculatedShareMinor: 617,
        },
      },
    });
    const deferred = createFinancialEvent({
      id: "deferred-event",
      type: "operating_expense_cash",
      amountMinor: 5000,
      occurredOn: "2026-08-22",
      recordedAt: "2026-08-22T01:01:00.000Z",
      idempotencyKey: "deferred-event",
      note: "كهرباء مؤجلة",
      counterparty: null,
      expenseContext: {
        relationship: "shared",
        behavior: "mixed",
        purpose: "period",
        knowledge: "needs_review",
        sharedProjectShare: {
          basis: "needs_review",
          note: "لاحقًا",
          allocation: "unallocated",
          totalAmountMinor: 5000,
          percentageBps: null,
          calculatedShareMinor: null,
        },
      },
    });
    await source.saveFinancialEvent(percentage);
    await source.saveFinancialEvent(deferred);
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("G3 export should succeed");
    const transfers = new LocalTransferService(new MemoryLocalStore());
    const preview = transfers.prepareImport(JSON.stringify(exported.value));
    if (!preview.ok) throw new Error(`G3 import should validate: ${preview.message}`);
    expect(preview.value.file.data.financialEvents).toMatchObject([
      {
        id: "percentage-event",
        expenseContext: {
          sharedProjectShare: {
            allocation: "allocated",
            basis: "agreed_percentage",
            percentageBps: 2000,
            calculatedShareMinor: 617,
          },
        },
      },
      {
        id: "deferred-event",
        operatingExpenseDeltaMinor: 0,
        expenseContext: { sharedProjectShare: { allocation: "unallocated", totalAmountMinor: 5000 } },
      },
    ]);
    const previous = structuredClone(exported.value) as { version: number; schemaVersion: number };
    previous.version = 11;
    previous.schemaVersion = 20;
    expect(
      new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(previous)),
    ).toMatchObject({
      ok: true,
      value: { file: { version: localExportVersion, schemaVersion: localSchemaVersion } },
    });
  });

  it("upgrades a v7 export to v8 without inventing a catalog item or historical link", async () => {
    const source = new MemoryLocalStore();
    await source.saveProfile(profile);
    await source.saveDraft(draft);
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("export should succeed");
    const legacy = structuredClone(exported.value) as {
      version: number;
      schemaVersion: number;
      data: { catalogItems?: unknown; drafts: Array<Record<string, unknown>> };
    };
    legacy.version = 7;
    legacy.schemaVersion = 15;
    delete legacy.data.catalogItems;
    delete legacy.data.drafts[0]!.catalogItemId;
    expect(
      new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(legacy)),
    ).toMatchObject({
      ok: true,
      value: {
        file: {
          version: localExportVersion,
          schemaVersion: localSchemaVersion,
          data: { catalogItems: [], drafts: [{ catalogItemId: null }] },
        },
      },
    });
  });

  it("round-trips a catalog item and rejects a catalog link that has no referenced item", async () => {
    const source = new MemoryLocalStore();
    await source.saveProfile(profile);
    const item = createCatalogItem({
      id: "gift-box",
      kind: "product",
      name: "صندوق هدايا",
      unitLabel: "قطعة",
      createdAt: "2026-08-23T09:00:00.000Z",
      createdOperationKey: "catalog-gift-box",
    });
    await source.saveCatalogItem(item);
    await source.saveDraft({ ...draft, catalogItemId: item.id });
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("export should succeed");
    const target = new MemoryLocalStore();
    const transfers = new LocalTransferService(target);
    const preview = transfers.prepareImport(JSON.stringify(exported.value));
    if (!preview.ok) throw new Error("catalog export should validate");
    await expect(transfers.confirmImport(preview.value)).resolves.toMatchObject({
      ok: true,
      value: { catalogItems: 1, drafts: 1 },
    });
    await expect(target.listCatalogItems()).resolves.toMatchObject({
      ok: true,
      value: [{ id: item.id, name: "صندوق هدايا" }],
    });
    await expect(target.getDraft(draft.id)).resolves.toMatchObject({
      ok: true,
      value: { catalogItemId: item.id },
    });
    const broken = structuredClone(exported.value) as {
      data: { drafts: Array<{ catalogItemId: string | null }> };
    };
    broken.data.drafts[0]!.catalogItemId = "missing-catalog-item";
    expect(
      new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(broken)),
    ).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("round-trips a material purchase and rejects a purchase whose payment total is inconsistent", async () => {
    const source = new MemoryLocalStore();
    await source.saveProfile(profile);
    await source.saveSupplierPurchase(
      createSupplierPurchase({
        id: "purchase-1",
        supplierName: "مورد الخشب",
        note: "مواد",
        purchasedOn: "2026-08-22",
        dueOn: null,
        totalMinor: 1000,
        initialPaidMinor: 400,
        recordedAt: "2026-08-22T01:00:00.000Z",
        idempotencyKey: "purchase-1",
      }),
    );
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("export should succeed");
    const target = new MemoryLocalStore();
    const transfers = new LocalTransferService(target);
    const preview = transfers.prepareImport(JSON.stringify(exported.value));
    if (!preview.ok) throw new Error(`import should validate: ${preview.message}`);
    await transfers.confirmImport(preview.value);
    await expect(target.listSupplierPurchases()).resolves.toMatchObject({
      ok: true,
      value: [{ id: "purchase-1", paidMinor: 400, payableMinor: 600 }],
    });
    const broken = structuredClone(exported.value) as {
      data: { supplierPurchases: Array<{ paidMinor: number }> };
    };
    broken.data.supplierPurchases[0]!.paidMinor = 999;
    expect(
      new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(broken)),
    ).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("round-trips cash wallets with a balanced transfer and rejects a one-sided transfer", async () => {
    const source = new MemoryLocalStore();
    await source.saveProfile(profile);
    const drawer = createCashWallet({
      id: "drawer",
      name: "درج",
      kind: "cash_drawer",
      createdAt: "2026-08-23T09:00:00.000Z",
      createdOperationKey: "wallet-drawer",
    });
    const bank = createCashWallet({
      id: "bank",
      name: "البنك",
      kind: "bank_account",
      createdAt: "2026-08-23T09:00:00.000Z",
      createdOperationKey: "wallet-bank",
    });
    const transferId = "transfer-1";
    const opening = createCashContinuityEntry({
      id: "opening",
      walletId: drawer.id,
      type: "opening_balance",
      occurredOn: "2026-08-01",
      recordedAt: "2026-08-23T09:00:00.000Z",
      cashDeltaMinor: 10000,
      note: "بداية",
      operationKey: "opening-1",
    });
    const out = createCashContinuityEntry({
      id: "out",
      walletId: drawer.id,
      type: "transfer_out",
      occurredOn: "2026-08-02",
      recordedAt: "2026-08-23T09:01:00.000Z",
      cashDeltaMinor: -3000,
      note: "إيداع",
      operationKey: "transfer-1",
      transferId,
    });
    const into = createCashContinuityEntry({
      id: "in",
      walletId: bank.id,
      type: "transfer_in",
      occurredOn: "2026-08-02",
      recordedAt: "2026-08-23T09:01:00.000Z",
      cashDeltaMinor: 3000,
      note: "إيداع",
      operationKey: "transfer-2",
      transferId,
    });
    await source.commitCashContinuity(drawer, [opening]);
    await source.commitCashContinuity(bank, [out, into]);
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("export should succeed");
    const target = new MemoryLocalStore();
    const transfers = new LocalTransferService(target);
    const preview = transfers.prepareImport(JSON.stringify(exported.value));
    if (!preview.ok) throw new Error(`import should validate: ${preview.message}`);
    await expect(transfers.confirmImport(preview.value)).resolves.toMatchObject({
      ok: true,
      value: { cashWallets: 2, cashContinuityEntries: 3 },
    });
    await expect(target.listCashContinuityEntries()).resolves.toMatchObject({
      ok: true,
      value: [{ id: "opening" }, { id: "out" }, { id: "in" }],
    });
    const broken = structuredClone(exported.value) as {
      data: { cashContinuityEntries: Array<{ id: string }> };
    };
    broken.data.cashContinuityEntries = broken.data.cashContinuityEntries.filter(entry => entry.id !== "in");
    expect(
      new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(broken)),
    ).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("rejects an imported transfer pair whose signs reverse the transfer direction", async () => {
    const source = new MemoryLocalStore();
    await source.saveProfile(profile);
    const drawer = createCashWallet({
      id: "drawer",
      name: "درج",
      kind: "cash_drawer",
      createdAt: "2026-08-23T09:00:00.000Z",
      createdOperationKey: "wallet-drawer",
    });
    const bank = createCashWallet({
      id: "bank",
      name: "البنك",
      kind: "bank_account",
      createdAt: "2026-08-23T09:00:00.000Z",
      createdOperationKey: "wallet-bank",
    });
    const transferId = "transfer-1";
    const opening = createCashContinuityEntry({
      id: "opening",
      walletId: drawer.id,
      type: "opening_balance",
      occurredOn: "2026-08-01",
      recordedAt: "2026-08-23T09:00:00.000Z",
      cashDeltaMinor: 10000,
      note: "بداية",
      operationKey: "opening-1",
    });
    const out = createCashContinuityEntry({
      id: "out",
      walletId: drawer.id,
      type: "transfer_out",
      occurredOn: "2026-08-02",
      recordedAt: "2026-08-23T09:01:00.000Z",
      cashDeltaMinor: -3000,
      note: "إيداع",
      operationKey: "transfer-1",
      transferId,
    });
    const into = createCashContinuityEntry({
      id: "in",
      walletId: bank.id,
      type: "transfer_in",
      occurredOn: "2026-08-02",
      recordedAt: "2026-08-23T09:01:00.000Z",
      cashDeltaMinor: 3000,
      note: "إيداع",
      operationKey: "transfer-2",
      transferId,
    });
    await source.commitCashContinuity(drawer, [opening]);
    await source.commitCashContinuity(bank, [out, into]);
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("export should succeed");
    const reversed = structuredClone(exported.value) as {
      data: { cashContinuityEntries: Array<{ id: string; cashDeltaMinor: number }> };
    };
    for (const entry of reversed.data.cashContinuityEntries) {
      if (entry.id === "out" || entry.id === "in") entry.cashDeltaMinor = -entry.cashDeltaMinor;
    }
    expect(
      new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(reversed)),
    ).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("round-trips material movements and rejects an inconsistent inventory reversal", async () => {
    const source = new MemoryLocalStore();
    await source.saveProfile(profile);
    const material = createMaterial({
      id: "wood",
      name: "خشب",
      unit: "piece",
      createdAt: "2026-08-23T09:00:00.000Z",
      createdOperationKey: "material-wood",
    });
    const opening = createInventoryMovement({
      id: "opening-wood",
      materialId: material.id,
      type: "opening",
      occurredOn: "2026-08-01",
      recordedAt: "2026-08-23T09:00:00.000Z",
      quantityDeltaMilli: 5000,
      valueDeltaMinor: 2000,
      note: "افتتاح",
      operationKey: "opening-wood",
    });
    const waste = createInventoryMovement({
      id: "waste-wood",
      materialId: material.id,
      type: "waste",
      occurredOn: "2026-08-02",
      recordedAt: "2026-08-23T09:01:00.000Z",
      quantityDeltaMilli: -1000,
      valueDeltaMinor: -400,
      note: "كسر",
      reason: "تلف",
      operationKey: "waste-wood",
    });
    const reversal = createInventoryMovement({
      id: "reverse-wood",
      materialId: material.id,
      type: "reversal",
      occurredOn: "2026-08-03",
      recordedAt: "2026-08-23T09:02:00.000Z",
      quantityDeltaMilli: 1000,
      valueDeltaMinor: 400,
      note: "عكس كسر",
      reason: "سجل خاطئ",
      operationKey: "reverse-wood",
      reversesMovementId: waste.id,
    });
    await source.commitInventory(material, [opening, waste, reversal]);
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("export should succeed");
    const target = new MemoryLocalStore();
    const transfers = new LocalTransferService(target);
    const preview = transfers.prepareImport(JSON.stringify(exported.value));
    if (!preview.ok) throw new Error(`import should validate: ${preview.message}`);
    await expect(transfers.confirmImport(preview.value)).resolves.toMatchObject({
      ok: true,
      value: { materials: 1, inventoryMovements: 3 },
    });
    await expect(target.listInventoryMovements()).resolves.toMatchObject({
      ok: true,
      value: [{ id: "reverse-wood" }, { id: "waste-wood" }, { id: "opening-wood" }],
    });
    const broken = structuredClone(exported.value) as {
      data: { inventoryMovements: Array<{ id: string; valueDeltaMinor: number }> };
    };
    broken.data.inventoryMovements.find(movement => movement.id === "reverse-wood")!.valueDeltaMinor = 401;
    expect(
      new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(broken)),
    ).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("rejects corrupt, unsupported, and partial files without touching current local data", async () => {
    const target = new MemoryLocalStore();
    await target.saveProfile(profile);
    const transfers = new LocalTransferService(target);
    expect(transfers.prepareImport("{broken")).toMatchObject({ ok: false, code: "validation_error" });
    expect(
      transfers.prepareImport(
        JSON.stringify({
          format: localExportFormat,
          version: 999,
          schemaVersion: localSchemaVersion,
          exportedAt: "2026-08-22T00:00:00.000Z",
          data: {},
        }),
      ),
    ).toMatchObject({ ok: false, code: "validation_error" });
    expect(
      transfers.prepareImport(
        JSON.stringify({
          format: localExportFormat,
          version: localExportVersion,
          schemaVersion: localSchemaVersion,
          exportedAt: "2026-08-22T00:00:00.000Z",
          data: {
            profile: profile,
            preferences: null,
            drafts: [{ ...draft, linkedOrderId: "missing" }],
            orders: [],
            schedules: [],
          },
        }),
      ),
    ).toMatchObject({ ok: false, code: "validation_error" });
    expect(
      transfers.prepareImport(
        JSON.stringify({
          format: localExportFormat,
          version: localExportVersion,
          schemaVersion: localSchemaVersion,
          exportedAt: "2026-08-22T00:00:00.000Z",
          data: {
            profile,
            preferences: null,
            drafts: [],
            orders: [
              {
                id: "bad",
                createdAt: "2026-08-22T00:00:00.000Z",
                updatedAt: "2026-08-22T00:00:00.000Z",
                deliveryDate: "2026-08-30",
                agreementSource: null,
                order: { id: "bad", events: [], costSnapshots: [{}], costSnapshot: {} },
              },
            ],
            schedules: [],
          },
        }),
      ),
    ).toMatchObject({ ok: false, code: "validation_error" });
    expect(
      transfers.prepareImport(
        JSON.stringify({
          format: localExportFormat,
          version: localExportVersion,
          schemaVersion: localSchemaVersion,
          exportedAt: "2026-08-22T00:00:00.000Z",
          data: {
            profile,
            preferences: null,
            drafts: [],
            orders: [],
            schedules: [],
            financialEvents: [
              {
                id: "bad-event",
                type: "owner_investment_cash",
                currency: "JOD",
                amountMinor: 100,
                occurredOn: "2026-08-22",
                recordedAt: "2026-08-22T00:00:00.000Z",
                idempotencyKey: "bad-event",
                note: "استثمار",
                counterparty: null,
                relatedEventId: null,
                cashDeltaMinor: 0,
                payableDeltaMinor: 0,
                ownerCapitalDeltaMinor: 100,
                operatingExpenseDeltaMinor: 0,
              },
            ],
          },
        }),
      ),
    ).toMatchObject({ ok: false, code: "validation_error" });
    expect(
      transfers.prepareImport(
        JSON.stringify({
          format: localExportFormat,
          version: localExportVersion,
          schemaVersion: localSchemaVersion,
          exportedAt: "2026-08-22T00:00:00.000Z",
          data: {
            profile,
            preferences: null,
            drafts: [],
            orders: [],
            schedules: [],
            financialEvents: [
              {
                id: "bad-context",
                type: "operating_expense_cash",
                currency: "JOD",
                amountMinor: 100,
                occurredOn: "2026-08-22",
                recordedAt: "2026-08-22T00:00:00.000Z",
                idempotencyKey: "bad-context",
                note: "مصروف",
                counterparty: null,
                relatedEventId: null,
                expenseContext: {
                  relationship: "project",
                  behavior: "bad",
                  purpose: "period",
                  knowledge: "known",
                },
                cashDeltaMinor: -100,
                payableDeltaMinor: 0,
                ownerCapitalDeltaMinor: 0,
                operatingExpenseDeltaMinor: 100,
              },
            ],
          },
        }),
      ),
    ).toMatchObject({ ok: false, code: "validation_error" });
    expect(
      transfers.prepareImport(
        JSON.stringify({
          format: localExportFormat,
          version: localExportVersion,
          schemaVersion: localSchemaVersion,
          exportedAt: "2026-08-22T00:00:00.000Z",
          data: {
            profile,
            preferences: null,
            drafts: [],
            orders: [],
            schedules: [],
            financialEvents: [
              {
                id: "bad-shared-basis",
                type: "operating_expense_cash",
                currency: "JOD",
                amountMinor: 100,
                occurredOn: "2026-08-22",
                recordedAt: "2026-08-22T00:00:00.000Z",
                idempotencyKey: "bad-shared-basis",
                note: "مصروف",
                counterparty: null,
                relatedEventId: null,
                expenseContext: {
                  relationship: "shared",
                  behavior: "fixed",
                  purpose: "period",
                  knowledge: "known",
                  sharedProjectShare: { basis: "owner_estimate", note: null },
                },
                cashDeltaMinor: -100,
                payableDeltaMinor: 0,
                ownerCapitalDeltaMinor: 0,
                operatingExpenseDeltaMinor: 100,
              },
            ],
          },
        }),
      ),
    ).toMatchObject({ ok: false, code: "validation_error" });
    await expect(target.getProfile()).resolves.toMatchObject({ ok: true, value: profile });
  });

  it("round-trips G5 declarations and migrates the previous v9/schema18 export without inventing one", async () => {
    const source = new MemoryLocalStore();
    const declaration = {
      id: "short-1",
      kind: "declaration" as const,
      direction: "collection" as const,
      amountMinor: 8000,
      dueOn: "2026-08-25",
      source: "عميلة",
      knowledge: "known" as const,
      note: "موعد معلن",
      relatedOrderId: null,
      relatedEventId: null,
      idempotencyKey: "short-1",
      reversalOfId: null,
      createdAt: "2026-08-22T01:00:00.000Z",
    };
    await source.saveShortCashDeclaration(declaration);
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("export should succeed");
    const target = new MemoryLocalStore();
    const transfers = new LocalTransferService(target);
    const preview = transfers.prepareImport(JSON.stringify(exported.value));
    if (!preview.ok) throw new Error("G5 import should validate");
    await expect(transfers.confirmImport(preview.value)).resolves.toMatchObject({
      ok: true,
      value: { shortCashDeclarations: 1 },
    });
    await expect(target.listShortCashDeclarations()).resolves.toMatchObject({
      ok: true,
      value: [{ id: "short-1", kind: "declaration" }],
    });
    const previous = structuredClone(exported.value) as {
      version: number;
      schemaVersion: number;
      data: { shortCashDeclarations?: unknown };
    };
    previous.version = 9;
    previous.schemaVersion = 18;
    delete previous.data.shortCashDeclarations;
    expect(
      new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(previous)),
    ).toMatchObject({
      ok: true,
      value: {
        file: {
          version: localExportVersion,
          schemaVersion: localSchemaVersion,
          data: { shortCashDeclarations: [] },
        },
      },
    });
  });

  it("round-trips explicit waste context and allocation policy evidence, but rejects missing references", async () => {
    const source = new MemoryLocalStore();
    await source.saveProfile(profile);
    const unit = createMeasurementUnit({
      id: "unit-waste",
      nameAr: "قطعة",
      dimension: "count",
      symbol: null,
      createdAt: "2026-08-22T00:00:00.000Z",
      createdOperationKey: "unit-waste",
    });
    const item = createCatalogItem({
      id: "catalog-waste",
      kind: "product",
      name: "صندوق هدر",
      unitLabel: "قطعة",
      unitId: unit.id,
      createdAt: "2026-08-22T00:00:00.000Z",
      createdOperationKey: "catalog-waste",
    });
    await source.saveMeasurementUnit(unit);
    await source.saveCatalogItem(item);
    const material = createMaterial({
      id: "material-waste",
      name: "خشب",
      unit: "piece",
      createdAt: "2026-08-22T00:00:00.000Z",
      createdOperationKey: "material-waste",
    });
    const movement = createInventoryMovement({
      id: "waste-context",
      materialId: material.id,
      type: "waste",
      occurredOn: "2026-08-22",
      recordedAt: "2026-08-22T01:00:00.000Z",
      quantityDeltaMilli: -1000,
      valueDeltaMinor: -400,
      note: "هدر مرتبط",
      reason: "قص",
      operationKey: "waste-context",
      wasteContext: { kind: "catalog_item", catalogItemId: item.id },
    });
    await source.commitInventory(material, [movement]);
    await source.saveAllocationPolicy(
      createAllocationPolicy({
        id: "allocation-transfer",
        seriesId: "allocation-series-transfer",
        successorOfPolicyId: null,
        version: 1,
        catalogItemId: item.id,
        kind: "per_output_unit",
        amountMinor: null,
        rateMinor: null,
        rateMinorPerWholeUnit: 50,
        percentageBps: null,
        unitId: unit.id,
        periodFrom: "2026-08-01",
        periodTo: "2026-08-31",
        startsOn: "2026-08-01",
        endsOn: "2026-08-31",
        source: "سجل الإنتاج",
        reason: "توزيع لكل قطعة",
        note: "المعدل لكل وحدة كاملة",
        status: "active",
        idempotencyKey: "allocation-transfer",
        createdAt: "2026-08-22T01:00:00.000Z",
        updatedAt: "2026-08-22T01:00:00.000Z",
      }),
    );
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("G4-B export should succeed");
    const target = new MemoryLocalStore();
    const transfers = new LocalTransferService(target);
    const preview = transfers.prepareImport(JSON.stringify(exported.value));
    if (!preview.ok) throw new Error(`G4-B import should validate: ${preview.message}`);
    expect(preview.value.summary).toMatchObject({ allocationPolicies: 1, inventoryMovements: 1 });
    await transfers.confirmImport(preview.value);
    await expect(target.listAllocationPolicies()).resolves.toMatchObject({
      ok: true,
      value: [
        { id: "allocation-transfer", kind: "per_output_unit", rateMinorPerWholeUnit: 50, rateMinor: null },
      ],
    });
    await expect(target.listInventoryMovements()).resolves.toMatchObject({
      ok: true,
      value: [{ wasteContext: { kind: "catalog_item", catalogItemId: item.id } }],
    });
    const legacy = structuredClone(exported.value) as {
      version: number;
      schemaVersion: number;
      data: { allocationPolicies: Array<Record<string, unknown>> };
    };
    legacy.version = 16;
    legacy.schemaVersion = 25;
    legacy.data.allocationPolicies = legacy.data.allocationPolicies.map(policy => {
      const { rateMinorPerWholeUnit, ...oldPolicy } = policy;
      return { ...oldPolicy, rateMinor: rateMinorPerWholeUnit };
    });
    const migrated = new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(legacy));
    expect(migrated).toMatchObject({
      ok: true,
      value: {
        file: {
          version: localExportVersion,
          schemaVersion: localSchemaVersion,
          data: { allocationPolicies: [{ rateMinorPerWholeUnit: 50, rateMinor: null }] },
        },
      },
    });
    const broken = structuredClone(exported.value);
    broken.data.inventoryMovements = broken.data.inventoryMovements?.map(movement =>
      movement.id === "waste-context"
        ? { ...movement, wasteContext: { kind: "catalog_item", catalogItemId: "missing-catalog" } }
        : movement,
    );
    expect(
      new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(broken)),
    ).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("rejects a reversal that does not match its original declaration", async () => {
    const source = new MemoryLocalStore();
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("export should succeed");
    const broken = structuredClone(exported.value) as { data: { shortCashDeclarations: unknown[] } };
    broken.data.shortCashDeclarations = [
      {
        id: "original",
        kind: "declaration",
        direction: "collection",
        amountMinor: 100,
        dueOn: "2026-08-25",
        source: "عميلة",
        knowledge: "known",
        note: "موعد",
        relatedOrderId: null,
        relatedEventId: null,
        idempotencyKey: "original",
        reversalOfId: null,
        createdAt: "2026-08-22T01:00:00.000Z",
      },
      {
        id: "reverse",
        kind: "reversal",
        direction: "collection",
        amountMinor: 99,
        dueOn: "2026-08-25",
        source: "عميلة",
        knowledge: "known",
        note: "عكس",
        relatedOrderId: null,
        relatedEventId: null,
        idempotencyKey: "reverse",
        reversalOfId: "original",
        createdAt: "2026-08-22T02:00:00.000Z",
      },
    ];
    expect(
      new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(broken)),
    ).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("round-trips actual-time origin and reversal, summarizes the count, and initializes absent legacy arrays", async () => {
    const source = new MemoryLocalStore();
    await source.saveProfile(profile);
    const cost = calculateCostSnapshot("actual-time-cost", {
      currency: "JOD",
      materialItems: [],
      time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-08-22T00:00:00.000Z",
      freshnessDays: null,
    });
    const order = createCraftOrder({
      id: "actual-time-order",
      customerName: "سارة",
      itemName: "صندوق وقت",
      specifications: "اختبار",
      quantity: 1,
      agreedPriceMinor: 2000,
      costSnapshot: cost,
      createdAt: "2026-08-22T00:00:00.000Z",
    });
    await source.saveOrder({
      id: order.id,
      order,
      catalogItemId: null,
      deliveryDate: "2026-08-30",
      agreementSource: "conversation",
      createdAt: "2026-08-22T00:00:00.000Z",
      updatedAt: "2026-08-22T00:00:00.000Z",
    });
    const original = createActualTimeRecord({
      id: "actual-time-origin",
      orderId: order.id,
      minutesDelta: 60,
      recordedOn: "2026-08-22",
      createdAt: "2026-08-22T01:00:00.000Z",
      note: "وقت فعلي",
      operationKey: "actual-time-origin",
    });
    const reversal = reverseActualTimeRecord(
      {
        id: "actual-time-reversal",
        target: original,
        recordedOn: "2026-08-23",
        createdAt: "2026-08-23T01:00:00.000Z",
        reason: "تصحيح موثق",
        operationKey: "actual-time-reversal",
      },
      [original],
    );
    await source.saveActualTimeRecord(original);
    await source.saveActualTimeRecord(reversal);
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("actual-time export should succeed");
    const target = new MemoryLocalStore();
    const transfers = new LocalTransferService(target);
    const preview = transfers.prepareImport(JSON.stringify(exported.value));
    if (!preview.ok) throw new Error(`actual-time import should validate: ${preview.message}`);
    expect(preview.value.summary).toMatchObject({ actualTimeRecords: 2 });
    await expect(transfers.confirmImport(preview.value)).resolves.toMatchObject({
      ok: true,
      value: { actualTimeRecords: 2 },
    });
    await expect(target.listActualTimeRecords()).resolves.toMatchObject({
      ok: true,
      value: [
        {
          id: "actual-time-reversal",
          orderId: order.id,
          minutesDelta: -60,
          reversalOfId: original.id,
          reversalReason: "تصحيح موثق",
        },
        { id: original.id, orderId: order.id, minutesDelta: 60, reversalOfId: null, reversalReason: null },
      ],
    });
    const legacy = structuredClone(exported.value) as {
      version: number;
      schemaVersion: number;
      data: { actualTimeRecords?: unknown };
    };
    legacy.version = 7;
    legacy.schemaVersion = 15;
    delete legacy.data.actualTimeRecords;
    expect(
      new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(legacy)),
    ).toMatchObject({
      ok: true,
      value: {
        file: {
          version: localExportVersion,
          schemaVersion: localSchemaVersion,
          data: { actualTimeRecords: [] },
        },
      },
    });
  });

  it("rejects corrupt actual-time records before replacement and preserves the current Store", async () => {
    const source = new MemoryLocalStore();
    await source.saveProfile(profile);
    const cost = calculateCostSnapshot("actual-time-invalid-cost", {
      currency: "JOD",
      materialItems: [],
      time: { minutes: 30, hourlyRateMinor: 500, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-08-22T00:00:00.000Z",
      freshnessDays: null,
    });
    const order = createCraftOrder({
      id: "actual-time-invalid-order",
      customerName: "سارة",
      itemName: "صندوق",
      specifications: "اختبار",
      quantity: 1,
      agreedPriceMinor: 2000,
      costSnapshot: cost,
      createdAt: "2026-08-22T00:00:00.000Z",
    });
    await source.saveOrder({
      id: order.id,
      order,
      catalogItemId: null,
      deliveryDate: "2026-08-30",
      agreementSource: "conversation",
      createdAt: "2026-08-22T00:00:00.000Z",
      updatedAt: "2026-08-22T00:00:00.000Z",
    });
    const original = createActualTimeRecord({
      id: "invalid-time-origin",
      orderId: order.id,
      minutesDelta: 60,
      recordedOn: "2026-08-22",
      createdAt: "2026-08-22T01:00:00.000Z",
      note: null,
      operationKey: "invalid-time-origin",
    });
    const reversal = reverseActualTimeRecord(
      {
        id: "invalid-time-reversal",
        target: original,
        recordedOn: "2026-08-23",
        createdAt: "2026-08-23T01:00:00.000Z",
        reason: "تصحيح",
        operationKey: "invalid-time-reversal",
      },
      [original],
    );
    await source.saveActualTimeRecord(original);
    await source.saveActualTimeRecord(reversal);
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("actual-time export should succeed");
    const cases: Array<(records: Array<Record<string, unknown>>) => void> = [
      records => {
        records[0]!.orderId = "missing-order";
      },
      records => {
        records[0]!.minutesDelta = 0;
      },
      records => {
        records[0]!.minutesDelta = -60;
      },
      records => {
        records[1]!.reversalReason = null;
      },
      records => {
        records[1]!.minutesDelta = -59;
      },
      records => {
        records.push({ ...records[1], id: "second-reversal", operationKey: "second-reversal" });
      },
      records => {
        records[1]!.operationKey = records[0]!.operationKey;
      },
    ];
    for (const mutate of cases) {
      const broken = structuredClone(exported.value) as unknown as {
        data: { actualTimeRecords: Array<Record<string, unknown>> };
      };
      mutate(broken.data.actualTimeRecords);
      const target = new MemoryLocalStore();
      await target.saveProfile({ ...profile, activityName: "بيانات قائمة" });
      const before = await target.readSnapshot();
      expect(new LocalTransferService(target).prepareImport(JSON.stringify(broken))).toMatchObject({
        ok: false,
        code: "validation_error",
      });
      await expect(target.readSnapshot()).resolves.toEqual(before);
    }
  });
});

describe("LocalTransferService G6-B recurrence migration", () => {
  it("round-trips a recurrence template and independent appearances while accepting a pre-G6-B export", async () => {
    const source = new MemoryLocalStore();
    await source.saveProfile(profile);
    const cost = calculateCostSnapshot("recurrence-cost", {
      currency: "JOD",
      materialItems: [],
      time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-08-22T00:00:00.000Z",
      freshnessDays: null,
    });
    const order = createCraftOrder({
      id: "recurrence-order",
      customerName: "سارة",
      itemName: "صندوق متكرر",
      specifications: "اختبار",
      quantity: 1,
      agreedPriceMinor: 2000,
      costSnapshot: cost,
      createdAt: "2026-08-22T00:00:00.000Z",
    });
    await source.saveOrder({
      id: order.id,
      order,
      catalogItemId: null,
      deliveryDate: "2026-08-10",
      agreementSource: null,
      followUpSummary: null,
      followUpDate: null,
      followUpReason: null,
      followUpEvents: [],
      createdAt: "2026-08-22T00:00:00.000Z",
      updatedAt: "2026-08-22T00:00:00.000Z",
    });
    const sourceSchedule = {
      id: "schedule-recurrence-order",
      orderId: order.id,
      kind: "delivery" as const,
      scheduledFor: "2026-08-10",
      scheduledTime: null,
      durationMinutes: null,
      status: "scheduled" as const,
      postponeReason: null,
      events: [
        {
          id: "source-event",
          type: "created" as const,
          idempotencyKey: "source-event",
          createdAt: "2026-08-22T00:00:00.000Z",
          previousScheduledFor: null,
          scheduledFor: "2026-08-10",
          previousScheduledTime: null,
          scheduledTime: null,
          previousDurationMinutes: null,
          durationMinutes: null,
          reason: null,
        },
      ],
      recurrenceId: null,
      recurrenceIndex: null,
      createdAt: "2026-08-22T00:00:00.000Z",
      updatedAt: "2026-08-22T00:00:00.000Z",
    };
    const recurrence = {
      id: "recurrence-schedule-recurrence-order-weekly-2",
      sourceScheduleId: sourceSchedule.id,
      orderId: order.id,
      frequency: "weekly" as const,
      occurrenceCount: 2,
      status: "cancelled" as const,
      idempotencyKey: "recurrence-schedule-recurrence-order-weekly-2",
      cancelledAt: "2026-08-22T02:00:00.000Z",
      cancellationReason: "اختبار الإيقاف",
      createdAt: "2026-08-22T01:00:00.000Z",
      updatedAt: "2026-08-22T02:00:00.000Z",
    };
    const appearance = {
      ...sourceSchedule,
      id: `${recurrence.id}:1`,
      scheduledFor: "2026-08-17",
      recurrenceId: recurrence.id,
      recurrenceIndex: 1,
      createdAt: "2026-08-22T01:00:00.000Z",
      updatedAt: "2026-08-22T01:00:00.000Z",
      events: [
        {
          ...sourceSchedule.events[0],
          id: `${recurrence.id}:1:created`,
          idempotencyKey: `${recurrence.id}:1:2026-08-17`,
          createdAt: "2026-08-22T01:00:00.000Z",
          scheduledFor: "2026-08-17",
          reason: "موعد قادم من قالب تكرار محلي",
        },
      ],
    };
    await source.saveSchedule(sourceSchedule);
    await source.saveSchedule(appearance);
    await source.saveRecurrence(recurrence);
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("recurrence export should succeed");
    const target = new MemoryLocalStore();
    const transfers = new LocalTransferService(target);
    const preview = transfers.prepareImport(JSON.stringify(exported.value));
    if (!preview.ok) throw new Error(`recurrence import should validate: ${preview.message}`);
    expect(preview.value.summary).toMatchObject({ recurrences: 1, schedules: 2 });
    await expect(transfers.confirmImport(preview.value)).resolves.toMatchObject({
      ok: true,
      value: { recurrences: 1, schedules: 2 },
    });
    await expect(target.listRecurrences()).resolves.toMatchObject({
      ok: true,
      value: [{ id: recurrence.id, status: "cancelled", cancellationReason: "اختبار الإيقاف" }],
    });
    await expect(target.listSchedules()).resolves.toMatchObject({
      ok: true,
      value: [
        { id: sourceSchedule.id },
        { id: appearance.id, recurrenceId: recurrence.id, recurrenceIndex: 1 },
      ],
    });
    const legacy = structuredClone(exported.value) as {
      version: number;
      schemaVersion: number;
      data: { recurrences?: unknown; schedules: unknown[] };
    };
    legacy.version = 10;
    legacy.schemaVersion = 19;
    legacy.data.schedules = [sourceSchedule];
    delete legacy.data.recurrences;
    expect(
      new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(legacy)),
    ).toMatchObject({
      ok: true,
      value: {
        file: { version: localExportVersion, schemaVersion: localSchemaVersion, data: { recurrences: [] } },
      },
    });
  });
});

describe("LocalTransferService G7-A agreement context", () => {
  it("round-trips agreement source and follow-up context without a schedule or financial effect", async () => {
    const source = new MemoryLocalStore();
    await source.saveProfile(profile);
    const cost = calculateCostSnapshot("context-cost", {
      currency: "JOD",
      materialItems: [],
      time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-08-22T00:00:00.000Z",
      freshnessDays: null,
    });
    const order = createCraftOrder({
      id: "context-order",
      customerName: "سارة",
      itemName: "صندوق متابعة",
      specifications: "اختبار",
      quantity: 1,
      agreedPriceMinor: 2400,
      costSnapshot: cost,
      createdAt: "2026-08-22T00:00:00.000Z",
    });
    await source.saveOrder({
      id: order.id,
      order,
      catalogItemId: null,
      deliveryDate: "2026-08-30",
      agreementSource: "whatsapp",
      followUpSummary: "تأكيد اللون",
      followUpDate: "2026-08-25",
      followUpReason: "مراجعة العينة",
      followUpEvents: [
        {
          id: "context-event",
          type: "created",
          idempotencyKey: "context-event",
          createdAt: "2026-08-22T01:00:00.000Z",
          previousDate: null,
          followUpDate: "2026-08-25",
          reason: "مراجعة العينة",
        },
      ],
      createdAt: "2026-08-22T00:00:00.000Z",
      updatedAt: "2026-08-22T01:00:00.000Z",
    });
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("context export should succeed");
    const target = new MemoryLocalStore();
    const transfers = new LocalTransferService(target);
    const preview = transfers.prepareImport(JSON.stringify(exported.value));
    if (!preview.ok) throw new Error(`context import should validate: ${preview.message}`);
    expect(preview.value.summary).toMatchObject({ orders: 1, recurrences: 0, schedules: 0 });
    await expect(transfers.confirmImport(preview.value)).resolves.toMatchObject({
      ok: true,
      value: { orders: 1, recurrences: 0 },
    });
    await expect(target.getOrder("context-order")).resolves.toMatchObject({
      ok: true,
      value: {
        agreementSource: "whatsapp",
        followUpSummary: "تأكيد اللون",
        followUpDate: "2026-08-25",
        followUpReason: "مراجعة العينة",
        followUpEvents: [{ type: "created" }],
        order: { agreedPriceMinor: 2400, collectedMinor: 0 },
      },
    });
    const invalidSource = structuredClone(exported.value) as {
      data: { orders: Array<{ agreementSource: string | null }> };
    };
    invalidSource.data.orders[0]!.agreementSource = "telegram";
    expect(
      new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(invalidSource)),
    ).toMatchObject({ ok: false, code: "validation_error" });
    const invalidDate = structuredClone(exported.value) as {
      data: { orders: Array<{ followUpDate: string | null }> };
    };
    invalidDate.data.orders[0]!.followUpDate = "2026-02-30";
    expect(
      new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(invalidDate)),
    ).toMatchObject({ ok: false, code: "validation_error" });
  });
});
