import { describe, expect, it } from "vitest";
import { CatalogService } from "./catalogService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { calculateCostSnapshot, createCraftOrder, transitionOrder } from "@micro-domain/craft-order/index.js";
import { createInventoryMovement, createMaterial } from "@micro-domain/inventory-material/index.js";

describe("CatalogService", () => {
  it("creates an optional product reference and returns the same item on idempotent retry", async () => {
    const service = new CatalogService(new MemoryLocalStore(), () => "2026-08-23T10:00:00.000Z");
    const created = await service.create({
      kind: "product",
      name: " صندوق هدايا ",
      unitLabel: "قطعة",
      operationKey: "catalog-gift-box",
    });
    const retried = await service.create({
      kind: "product",
      name: "صندوق مختلف",
      unitLabel: null,
      operationKey: "catalog-gift-box",
    });
    expect(created).toMatchObject({
      ok: true,
      item: { kind: "product", name: "صندوق هدايا", unitLabel: "قطعة", active: true },
    });
    expect(retried).toMatchObject({
      ok: true,
      item: { id: created.ok ? created.item.id : "unexpected", name: "صندوق هدايا" },
    });
  });

  it("prevents an ambiguous active duplicate but deactivates instead of deleting the reference", async () => {
    const service = new CatalogService(new MemoryLocalStore(), () => "2026-08-23T10:00:00.000Z");
    const first = await service.create({
      kind: "service",
      name: "تغليف هدايا",
      unitLabel: null,
      operationKey: "catalog-wrap",
    });
    const duplicate = await service.create({
      kind: "service",
      name: "  تغليف   هدايا  ",
      unitLabel: null,
      operationKey: "catalog-wrap-duplicate",
    });
    if (!first.ok) throw new Error("first catalog item should exist");
    const deactivated = await service.deactivate(first.item.id);
    const after = await service.list({ includeInactive: true });
    expect(duplicate).toMatchObject({ ok: false, code: "validation_error" });
    expect(deactivated).toMatchObject({ ok: true, item: { id: first.item.id, active: false } });
    expect(after).toMatchObject({
      ok: true,
      items: [expect.objectContaining({ id: first.item.id, active: false })],
    });
  });

  it("reads only final orders explicitly linked to the reference as a recorded direct margin, not actual COGS", async () => {
    const store = new MemoryLocalStore();
    const service = new CatalogService(store, () => "2026-08-23T10:00:00.000Z");
    const created = await service.create({
      kind: "product",
      name: "صندوق هدية",
      unitLabel: "قطعة",
      operationKey: "catalog-gift",
    });
    if (!created.ok) throw new Error("catalog item should save");
    const cost = calculateCostSnapshot("catalog-cost", {
      currency: "JOD",
      materialItems: [
        {
          name: "خشب",
          quantity: 1,
          unit: "قطعة",
          unitPriceMinor: 800,
          priceDate: "2026-08-01",
          source: "user_input",
          confidence: "known",
        },
      ],
      time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 2,
      createdAt: "2026-08-01T09:00:00.000Z",
      freshnessDays: null,
    });
    let order = createCraftOrder({
      id: "catalog-order",
      customerName: "سارة",
      itemName: "صندوق هدية خاص",
      specifications: "لون مختلف",
      quantity: 2,
      agreedPriceMinor: 3000,
      costSnapshot: cost,
      createdAt: "2026-08-01T09:00:00.000Z",
    });
    for (const [to, stamp] of [
      ["provisional_agreement", "2026-08-01T10:00:00.000Z"],
      ["confirmed", "2026-08-01T11:00:00.000Z"],
      ["in_progress", "2026-08-02T09:00:00.000Z"],
      ["ready", "2026-08-03T09:00:00.000Z"],
      ["delivered", "2026-08-04T09:00:00.000Z"],
    ] as const)
      order = transitionOrder(order, { to, idempotencyKey: `catalog-${to}`, createdAt: stamp });
    await store.saveOrder({
      id: order.id,
      order,
      catalogItemId: created.item.id,
      deliveryDate: "2026-08-04",
      agreementSource: null,
      createdAt: "2026-08-01T09:00:00.000Z",
      updatedAt: "2026-08-04T09:00:00.000Z",
    });
    const material = createMaterial({
      id: "catalog-wood",
      name: "خشب",
      unit: "piece",
      createdAt: "2026-08-01T09:00:00.000Z",
      createdOperationKey: "catalog-wood",
    });
    const opening = createInventoryMovement({
      id: "catalog-opening",
      materialId: material.id,
      type: "opening",
      occurredOn: "2026-08-01",
      recordedAt: "2026-08-01T09:00:00.000Z",
      quantityDeltaMilli: 2000,
      valueDeltaMinor: 1800,
      note: "رصيد",
      operationKey: "catalog-opening",
    });
    const consumption = createInventoryMovement({
      id: "catalog-consumption",
      materialId: material.id,
      type: "consumption",
      occurredOn: "2026-08-04",
      recordedAt: "2026-08-04T09:00:00.000Z",
      quantityDeltaMilli: -1000,
      valueDeltaMinor: -900,
      note: "استهلاك",
      operationKey: "catalog-consumption",
      orderId: order.id,
    });
    await store.commitInventory(material, [opening, consumption]);
    await expect(service.readRecordedMargins()).resolves.toMatchObject({
      ok: true,
      items: [
        {
          catalogItemId: created.item.id,
          finalOrderCount: 1,
          deliveredQuantity: 2,
          recognizedRevenueMinor: 3000,
          recognizedDirectCostMinor: 1300,
          directMarginMinor: 1700,
          materialVariance: {
            recordedOrderCount: 1,
            notRecordedOrderCount: 0,
            plannedMaterialMinor: 800,
            actualMaterialMinor: 900,
            varianceMinor: 100,
          },
        },
      ],
    });
  });
});
