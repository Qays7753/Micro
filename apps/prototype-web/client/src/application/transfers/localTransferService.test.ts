import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { localExportFormat, localExportVersion, localProfileId, localSchemaVersion } from "@/storage/local/types";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";

const profile = { id: localProfileId, activityName: "مشغل ليان", currency: "JOD" as const, activityType: "custom_craft" as const, createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z" };
const draft = { id: "draft-1", intent: "customer_order" as const, customerName: "سارة", itemName: "صندوق", specifications: "نقش", quantity: 1, costSnapshots: [], activeCostSnapshotId: null, linkedOrderId: null, createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z" };

describe("LocalTransferService", () => {
  it("round-trips a valid local export with a real order and events only after confirmation", async () => {
    const source = new MemoryLocalStore(); await source.saveProfile(profile);
    const cost = calculateCostSnapshot("cost-1", { currency: "JOD", materialItems: [], time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" }, packagingMinor: 0, deliveryMinor: 0, wasteMinor: 0, safetyBufferMinor: 0, quantity: 1, createdAt: "2026-08-22T00:00:00.000Z", freshnessDays: null });
    const order = createCraftOrder({ id: "order-1", customerName: "سارة", itemName: "صندوق", specifications: "نقش", quantity: 1, agreedPriceMinor: 2000, costSnapshot: cost, createdAt: "2026-08-22T00:00:00.000Z" });
    await source.saveOrder({ id: "order-1", order, deliveryDate: "2026-08-30", agreementSource: "conversation", createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z" }); await source.saveDraft({ ...draft, linkedOrderId: "order-1" }); await source.saveFinancialEvent(createFinancialEvent({ id: "investment-1", type: "owner_investment_cash", amountMinor: 5000, occurredOn: "2026-08-22", recordedAt: "2026-08-22T01:00:00.000Z", idempotencyKey: "investment-1", note: "رأس مال", counterparty: null }));
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

  it("rejects corrupt, unsupported, and partial files without touching current local data", async () => {
    const target = new MemoryLocalStore(); await target.saveProfile(profile); const transfers = new LocalTransferService(target);
    expect(transfers.prepareImport("{broken")).toMatchObject({ ok: false, code: "validation_error" });
    expect(transfers.prepareImport(JSON.stringify({ format: localExportFormat, version: 999, schemaVersion: localSchemaVersion, exportedAt: "2026-08-22T00:00:00.000Z", data: {} }))).toMatchObject({ ok: false, code: "validation_error" });
    expect(transfers.prepareImport(JSON.stringify({ format: localExportFormat, version: localExportVersion, schemaVersion: localSchemaVersion, exportedAt: "2026-08-22T00:00:00.000Z", data: { profile: profile, preferences: null, drafts: [{ ...draft, linkedOrderId: "missing" }], orders: [], schedules: [] } }))).toMatchObject({ ok: false, code: "validation_error" });
    expect(transfers.prepareImport(JSON.stringify({ format: localExportFormat, version: localExportVersion, schemaVersion: localSchemaVersion, exportedAt: "2026-08-22T00:00:00.000Z", data: { profile, preferences: null, drafts: [], orders: [{ id: "bad", createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z", deliveryDate: "2026-08-30", agreementSource: null, order: { id: "bad", events: [], costSnapshots: [{}], costSnapshot: {} } }], schedules: [] } }))).toMatchObject({ ok: false, code: "validation_error" });
    expect(transfers.prepareImport(JSON.stringify({ format: localExportFormat, version: localExportVersion, schemaVersion: localSchemaVersion, exportedAt: "2026-08-22T00:00:00.000Z", data: { profile, preferences: null, drafts: [], orders: [], schedules: [], financialEvents: [{ id: "bad-event", type: "owner_investment_cash", currency: "JOD", amountMinor: 100, occurredOn: "2026-08-22", recordedAt: "2026-08-22T00:00:00.000Z", idempotencyKey: "bad-event", note: "استثمار", counterparty: null, relatedEventId: null, cashDeltaMinor: 0, payableDeltaMinor: 0, ownerCapitalDeltaMinor: 100, operatingExpenseDeltaMinor: 0 }] } }))).toMatchObject({ ok: false, code: "validation_error" });
    expect(transfers.prepareImport(JSON.stringify({ format: localExportFormat, version: localExportVersion, schemaVersion: localSchemaVersion, exportedAt: "2026-08-22T00:00:00.000Z", data: { profile, preferences: null, drafts: [], orders: [], schedules: [], financialEvents: [{ id: "bad-context", type: "operating_expense_cash", currency: "JOD", amountMinor: 100, occurredOn: "2026-08-22", recordedAt: "2026-08-22T00:00:00.000Z", idempotencyKey: "bad-context", note: "مصروف", counterparty: null, relatedEventId: null, expenseContext: { relationship: "project", behavior: "bad", purpose: "period", knowledge: "known" }, cashDeltaMinor: -100, payableDeltaMinor: 0, ownerCapitalDeltaMinor: 0, operatingExpenseDeltaMinor: 100 }] } }))).toMatchObject({ ok: false, code: "validation_error" });
    await expect(target.getProfile()).resolves.toMatchObject({ ok: true, value: profile });
  });
});
