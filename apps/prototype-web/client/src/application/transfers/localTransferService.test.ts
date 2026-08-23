import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { localExportFormat, localExportVersion, localProfileId, localSchemaVersion } from "@/storage/local/types";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";
import { createSupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import { createCashContinuityEntry, createCashWallet } from "@micro-domain/cash-continuity/index.js";
import { createInventoryMovement, createMaterial } from "@micro-domain/inventory-material/index.js";
import { createCatalogItem } from "@micro-domain/catalog/index.js";

const profile = { id: localProfileId, activityName: "مشغل ليان", currency: "JOD" as const, activityType: "custom_craft" as const, createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z" };
const draft = { id: "draft-1", intent: "customer_order" as const, customerName: "سارة", itemName: "صندوق", catalogItemId: null, specifications: "نقش", quantity: 1, costSnapshots: [], activeCostSnapshotId: null, linkedOrderId: null, createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z" };

describe("LocalTransferService", () => {
  it("round-trips a valid local export with a real order and events only after confirmation", async () => {
    const source = new MemoryLocalStore(); await source.saveProfile(profile);
    const cost = calculateCostSnapshot("cost-1", { currency: "JOD", materialItems: [], time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" }, packagingMinor: 0, deliveryMinor: 0, wasteMinor: 0, safetyBufferMinor: 0, quantity: 1, createdAt: "2026-08-22T00:00:00.000Z", freshnessDays: null });
    const order = createCraftOrder({ id: "order-1", customerName: "سارة", itemName: "صندوق", specifications: "نقش", quantity: 1, agreedPriceMinor: 2000, costSnapshot: cost, createdAt: "2026-08-22T00:00:00.000Z" });
    await source.saveOrder({ id: "order-1", order, catalogItemId: null, deliveryDate: "2026-08-30", agreementSource: "conversation", createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z" }); await source.saveDraft({ ...draft, linkedOrderId: "order-1" }); await source.saveFinancialEvent(createFinancialEvent({ id: "investment-1", type: "owner_investment_cash", amountMinor: 5000, occurredOn: "2026-08-22", recordedAt: "2026-08-22T01:00:00.000Z", idempotencyKey: "investment-1", note: "رأس مال", counterparty: null }));
    const exported = await new LocalTransferService(source, () => "2026-08-22T03:00:00.000Z").createExport(); if (!exported.ok) throw new Error("export should succeed");
    const target = new MemoryLocalStore(); await target.saveProfile({ ...profile, activityName: "بيانات قديمة" });
    const transfers = new LocalTransferService(target); const preview = transfers.prepareImport(JSON.stringify(exported.value)); if (!preview.ok) throw new Error("import should validate");
    expect((await target.getProfile())).toMatchObject({ ok: true, value: { activityName: "بيانات قديمة" } });
    await expect(transfers.confirmImport(preview.value)).resolves.toMatchObject({ ok: true, value: { profile: true, preferences: false, drafts: 1, orders: 1, schedules: 0, financialEvents: 1, snapshots: 1, events: 1 } });
    await expect(target.getProfile()).resolves.toMatchObject({ ok: true, value: profile }); await expect(target.getDraft("draft-1")).resolves.toMatchObject({ ok: true, value: { linkedOrderId: "order-1" } }); await expect(target.getOrder("order-1")).resolves.toMatchObject({ ok: true, value: { order: { events: [{ type: "created" }] } } }); await expect(target.listFinancialEvents()).resolves.toMatchObject({ ok: true, value: [{ type: "owner_investment_cash", cashDeltaMinor: 5000 }] });
  });

  it("round-trips classified expenses while accepting legacy financial events without context", async () => {
    const source = new MemoryLocalStore(); await source.saveProfile(profile);
    await source.saveFinancialEvent(createFinancialEvent({ id: "legacy-expense", type: "operating_expense_cash", amountMinor: 200, occurredOn: "2026-08-22", recordedAt: "2026-08-22T01:00:00.000Z", idempotencyKey: "legacy-expense", note: "سجل قديم", counterparty: null }));
    await source.saveFinancialEvent(createFinancialEvent({ id: "classified-expense", type: "operating_expense_cash", amountMinor: 300, occurredOn: "2026-08-22", recordedAt: "2026-08-22T01:01:00.000Z", idempotencyKey: "classified-expense", note: "توصيل", counterparty: null, expenseContext: { relationship: "project", behavior: "variable", purpose: "order", knowledge: "known" } }));
    const exported = await new LocalTransferService(source).createExport(); if (!exported.ok) throw new Error("export should succeed");
    const target = new MemoryLocalStore(); const transfers = new LocalTransferService(target); const preview = transfers.prepareImport(JSON.stringify(exported.value)); if (!preview.ok) throw new Error("import should validate"); await transfers.confirmImport(preview.value);
    await expect(target.listFinancialEvents()).resolves.toMatchObject({ ok: true, value: [{ id: "classified-expense", expenseContext: { relationship: "project", knowledge: "known" } }, { id: "legacy-expense", expenseContext: null }] });
  });

  it("upgrades a v6 export while preserving a legacy shared expense without inventing its source", async () => {
    const source = new MemoryLocalStore(); await source.saveProfile(profile);
    await source.saveFinancialEvent(createFinancialEvent({ id: "legacy-shared", type: "operating_expense_cash", amountMinor: 600, occurredOn: "2026-08-22", recordedAt: "2026-08-22T01:00:00.000Z", idempotencyKey: "legacy-shared", note: "حصة كهرباء قديمة", counterparty: null, expenseContext: { relationship: "shared", behavior: "fixed", purpose: "period", knowledge: "known" } }));
    const exported = await new LocalTransferService(source).createExport(); if (!exported.ok) throw new Error("export should succeed");
    const legacy = structuredClone(exported.value) as { version: number; schemaVersion: number }; legacy.version = 6; legacy.schemaVersion = 14;
    const preview = new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(legacy));
    expect(preview).toMatchObject({ ok: true, value: { file: { version: localExportVersion, schemaVersion: localSchemaVersion, data: { financialEvents: [{ id: "legacy-shared", expenseContext: { relationship: "shared", sharedProjectShare: null } }] } } } });
  });

  it("upgrades a v7 export to v8 without inventing a catalog item or historical link", async () => {
    const source = new MemoryLocalStore(); await source.saveProfile(profile); await source.saveDraft(draft);
    const exported = await new LocalTransferService(source).createExport(); if (!exported.ok) throw new Error("export should succeed");
    const legacy = structuredClone(exported.value) as { version: number; schemaVersion: number; data: { catalogItems?: unknown; drafts: Array<Record<string, unknown>> } };
    legacy.version = 7; legacy.schemaVersion = 15; delete legacy.data.catalogItems; delete legacy.data.drafts[0]!.catalogItemId;
    expect(new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(legacy))).toMatchObject({ ok: true, value: { file: { version: localExportVersion, schemaVersion: localSchemaVersion, data: { catalogItems: [], drafts: [{ catalogItemId: null }] } } } });
  });

  it("round-trips a catalog item and rejects a catalog link that has no referenced item", async () => {
    const source = new MemoryLocalStore(); await source.saveProfile(profile);
    const item = createCatalogItem({ id: "gift-box", kind: "product", name: "صندوق هدايا", unitLabel: "قطعة", createdAt: "2026-08-23T09:00:00.000Z", createdOperationKey: "catalog-gift-box" });
    await source.saveCatalogItem(item); await source.saveDraft({ ...draft, catalogItemId: item.id });
    const exported = await new LocalTransferService(source).createExport(); if (!exported.ok) throw new Error("export should succeed");
    const target = new MemoryLocalStore(); const transfers = new LocalTransferService(target); const preview = transfers.prepareImport(JSON.stringify(exported.value)); if (!preview.ok) throw new Error("catalog export should validate");
    await expect(transfers.confirmImport(preview.value)).resolves.toMatchObject({ ok: true, value: { catalogItems: 1, drafts: 1 } });
    await expect(target.listCatalogItems()).resolves.toMatchObject({ ok: true, value: [{ id: item.id, name: "صندوق هدايا" }] }); await expect(target.getDraft(draft.id)).resolves.toMatchObject({ ok: true, value: { catalogItemId: item.id } });
    const broken = structuredClone(exported.value) as { data: { drafts: Array<{ catalogItemId: string | null }> } }; broken.data.drafts[0]!.catalogItemId = "missing-catalog-item";
    expect(new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(broken))).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("round-trips a material purchase and rejects a purchase whose payment total is inconsistent", async () => {
    const source = new MemoryLocalStore(); await source.saveProfile(profile); await source.saveSupplierPurchase(createSupplierPurchase({ id: "purchase-1", supplierName: "مورد الخشب", note: "مواد", purchasedOn: "2026-08-22", dueOn: null, totalMinor: 1000, initialPaidMinor: 400, recordedAt: "2026-08-22T01:00:00.000Z", idempotencyKey: "purchase-1" }));
    const exported = await new LocalTransferService(source).createExport(); if (!exported.ok) throw new Error("export should succeed"); const target = new MemoryLocalStore(); const transfers = new LocalTransferService(target); const preview = transfers.prepareImport(JSON.stringify(exported.value)); if (!preview.ok) throw new Error("import should validate"); await transfers.confirmImport(preview.value);
    await expect(target.listSupplierPurchases()).resolves.toMatchObject({ ok: true, value: [{ id: "purchase-1", paidMinor: 400, payableMinor: 600 }] });
    const broken = structuredClone(exported.value) as { data: { supplierPurchases: Array<{ paidMinor: number }> } }; broken.data.supplierPurchases[0]!.paidMinor = 999;
    expect(new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(broken))).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("round-trips cash wallets with a balanced transfer and rejects a one-sided transfer", async () => {
    const source = new MemoryLocalStore(); await source.saveProfile(profile);
    const drawer = createCashWallet({ id: "drawer", name: "درج", kind: "cash_drawer", createdAt: "2026-08-23T09:00:00.000Z", createdOperationKey: "wallet-drawer" }); const bank = createCashWallet({ id: "bank", name: "البنك", kind: "bank_account", createdAt: "2026-08-23T09:00:00.000Z", createdOperationKey: "wallet-bank" }); const transferId = "transfer-1";
    const opening = createCashContinuityEntry({ id: "opening", walletId: drawer.id, type: "opening_balance", occurredOn: "2026-08-01", recordedAt: "2026-08-23T09:00:00.000Z", cashDeltaMinor: 10000, note: "بداية", operationKey: "opening-1" }); const out = createCashContinuityEntry({ id: "out", walletId: drawer.id, type: "transfer_out", occurredOn: "2026-08-02", recordedAt: "2026-08-23T09:01:00.000Z", cashDeltaMinor: -3000, note: "إيداع", operationKey: "transfer-1", transferId }); const into = createCashContinuityEntry({ id: "in", walletId: bank.id, type: "transfer_in", occurredOn: "2026-08-02", recordedAt: "2026-08-23T09:01:00.000Z", cashDeltaMinor: 3000, note: "إيداع", operationKey: "transfer-2", transferId });
    await source.commitCashContinuity(drawer, [opening]); await source.commitCashContinuity(bank, [out, into]); const exported = await new LocalTransferService(source).createExport(); if (!exported.ok) throw new Error("export should succeed");
    const target = new MemoryLocalStore(); const transfers = new LocalTransferService(target); const preview = transfers.prepareImport(JSON.stringify(exported.value)); if (!preview.ok) throw new Error("import should validate"); await expect(transfers.confirmImport(preview.value)).resolves.toMatchObject({ ok: true, value: { cashWallets: 2, cashContinuityEntries: 3 } }); await expect(target.listCashContinuityEntries()).resolves.toMatchObject({ ok: true, value: [{ id: "opening" }, { id: "out" }, { id: "in" }] });
    const broken = structuredClone(exported.value) as { data: { cashContinuityEntries: Array<{ id: string }> } }; broken.data.cashContinuityEntries = broken.data.cashContinuityEntries.filter((entry) => entry.id !== "in"); expect(new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(broken))).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("round-trips material movements and rejects an inconsistent inventory reversal", async () => {
    const source = new MemoryLocalStore(); await source.saveProfile(profile); const material = createMaterial({ id: "wood", name: "خشب", unit: "piece", createdAt: "2026-08-23T09:00:00.000Z", createdOperationKey: "material-wood" }); const opening = createInventoryMovement({ id: "opening-wood", materialId: material.id, type: "opening", occurredOn: "2026-08-01", recordedAt: "2026-08-23T09:00:00.000Z", quantityDeltaMilli: 5000, valueDeltaMinor: 2000, note: "افتتاح", operationKey: "opening-wood" }); const waste = createInventoryMovement({ id: "waste-wood", materialId: material.id, type: "waste", occurredOn: "2026-08-02", recordedAt: "2026-08-23T09:01:00.000Z", quantityDeltaMilli: -1000, valueDeltaMinor: -400, note: "كسر", reason: "تلف", operationKey: "waste-wood" }); const reversal = createInventoryMovement({ id: "reverse-wood", materialId: material.id, type: "reversal", occurredOn: "2026-08-03", recordedAt: "2026-08-23T09:02:00.000Z", quantityDeltaMilli: 1000, valueDeltaMinor: 400, note: "عكس كسر", reason: "سجل خاطئ", operationKey: "reverse-wood", reversesMovementId: waste.id }); await source.commitInventory(material, [opening, waste, reversal]);
    const exported = await new LocalTransferService(source).createExport(); if (!exported.ok) throw new Error("export should succeed"); const target = new MemoryLocalStore(); const transfers = new LocalTransferService(target); const preview = transfers.prepareImport(JSON.stringify(exported.value)); if (!preview.ok) throw new Error("import should validate"); await expect(transfers.confirmImport(preview.value)).resolves.toMatchObject({ ok: true, value: { materials: 1, inventoryMovements: 3 } }); await expect(target.listInventoryMovements()).resolves.toMatchObject({ ok: true, value: [{ id: "reverse-wood" }, { id: "waste-wood" }, { id: "opening-wood" }] });
    const broken = structuredClone(exported.value) as { data: { inventoryMovements: Array<{ id: string; valueDeltaMinor: number }> } }; broken.data.inventoryMovements.find((movement) => movement.id === "reverse-wood")!.valueDeltaMinor = 401; expect(new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(broken))).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("rejects corrupt, unsupported, and partial files without touching current local data", async () => {
    const target = new MemoryLocalStore(); await target.saveProfile(profile); const transfers = new LocalTransferService(target);
    expect(transfers.prepareImport("{broken")).toMatchObject({ ok: false, code: "validation_error" });
    expect(transfers.prepareImport(JSON.stringify({ format: localExportFormat, version: 999, schemaVersion: localSchemaVersion, exportedAt: "2026-08-22T00:00:00.000Z", data: {} }))).toMatchObject({ ok: false, code: "validation_error" });
    expect(transfers.prepareImport(JSON.stringify({ format: localExportFormat, version: localExportVersion, schemaVersion: localSchemaVersion, exportedAt: "2026-08-22T00:00:00.000Z", data: { profile: profile, preferences: null, drafts: [{ ...draft, linkedOrderId: "missing" }], orders: [], schedules: [] } }))).toMatchObject({ ok: false, code: "validation_error" });
    expect(transfers.prepareImport(JSON.stringify({ format: localExportFormat, version: localExportVersion, schemaVersion: localSchemaVersion, exportedAt: "2026-08-22T00:00:00.000Z", data: { profile, preferences: null, drafts: [], orders: [{ id: "bad", createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z", deliveryDate: "2026-08-30", agreementSource: null, order: { id: "bad", events: [], costSnapshots: [{}], costSnapshot: {} } }], schedules: [] } }))).toMatchObject({ ok: false, code: "validation_error" });
    expect(transfers.prepareImport(JSON.stringify({ format: localExportFormat, version: localExportVersion, schemaVersion: localSchemaVersion, exportedAt: "2026-08-22T00:00:00.000Z", data: { profile, preferences: null, drafts: [], orders: [], schedules: [], financialEvents: [{ id: "bad-event", type: "owner_investment_cash", currency: "JOD", amountMinor: 100, occurredOn: "2026-08-22", recordedAt: "2026-08-22T00:00:00.000Z", idempotencyKey: "bad-event", note: "استثمار", counterparty: null, relatedEventId: null, cashDeltaMinor: 0, payableDeltaMinor: 0, ownerCapitalDeltaMinor: 100, operatingExpenseDeltaMinor: 0 }] } }))).toMatchObject({ ok: false, code: "validation_error" });
    expect(transfers.prepareImport(JSON.stringify({ format: localExportFormat, version: localExportVersion, schemaVersion: localSchemaVersion, exportedAt: "2026-08-22T00:00:00.000Z", data: { profile, preferences: null, drafts: [], orders: [], schedules: [], financialEvents: [{ id: "bad-context", type: "operating_expense_cash", currency: "JOD", amountMinor: 100, occurredOn: "2026-08-22", recordedAt: "2026-08-22T00:00:00.000Z", idempotencyKey: "bad-context", note: "مصروف", counterparty: null, relatedEventId: null, expenseContext: { relationship: "project", behavior: "bad", purpose: "period", knowledge: "known" }, cashDeltaMinor: -100, payableDeltaMinor: 0, ownerCapitalDeltaMinor: 0, operatingExpenseDeltaMinor: 100 }] } }))).toMatchObject({ ok: false, code: "validation_error" });
    expect(transfers.prepareImport(JSON.stringify({ format: localExportFormat, version: localExportVersion, schemaVersion: localSchemaVersion, exportedAt: "2026-08-22T00:00:00.000Z", data: { profile, preferences: null, drafts: [], orders: [], schedules: [], financialEvents: [{ id: "bad-shared-basis", type: "operating_expense_cash", currency: "JOD", amountMinor: 100, occurredOn: "2026-08-22", recordedAt: "2026-08-22T00:00:00.000Z", idempotencyKey: "bad-shared-basis", note: "مصروف", counterparty: null, relatedEventId: null, expenseContext: { relationship: "shared", behavior: "fixed", purpose: "period", knowledge: "known", sharedProjectShare: { basis: "owner_estimate", note: null } }, cashDeltaMinor: -100, payableDeltaMinor: 0, ownerCapitalDeltaMinor: 0, operatingExpenseDeltaMinor: 100 }] } }))).toMatchObject({ ok: false, code: "validation_error" });
    await expect(target.getProfile()).resolves.toMatchObject({ ok: true, value: profile });
  });
});
