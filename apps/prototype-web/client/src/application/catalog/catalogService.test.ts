import { describe, expect, it } from "vitest";
import { CatalogService } from "./catalogService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { calculateCostSnapshot, createCraftOrder, transitionOrder } from "@micro-domain/craft-order/index.js";
import { createDirectSale } from "@micro-domain/direct-sale/index.js";
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

  /* P-002 (الخيار أ): مرجع باقتراحات اختيارية — والبيع يحفظ نسخته المستقلة. */
  describe("P-002 optional suggested defaults on the reference", () => {
    it("creates a reference carrying optional suggested price and cost, and rejects invalid suggestions", async () => {
      const service = new CatalogService(new MemoryLocalStore(), () => "2026-08-23T10:00:00.000Z");
      const created = await service.create({
        kind: "product",
        name: "كوب جاهز",
        unitLabel: "قطعة",
        defaultPriceMinor: 250,
        defaultUnitCostMinor: 120,
        operationKey: "p002-cup",
      });
      expect(created).toMatchObject({
        ok: true,
        item: { name: "كوب جاهز", defaultPriceMinor: 250, defaultUnitCostMinor: 120 },
      });
      await expect(
        service.create({
          kind: "product",
          name: "مرجع سيئ",
          unitLabel: null,
          defaultPriceMinor: 0,
          operationKey: "p002-invalid",
        }),
      ).resolves.toMatchObject({ ok: false, code: "validation_error" });
    });

    it("keeps references without suggestions honest — absent means no suggestion, never zero", async () => {
      const service = new CatalogService(new MemoryLocalStore(), () => "2026-08-23T10:00:00.000Z");
      const created = await service.create({
        kind: "service",
        name: "تغليف",
        unitLabel: null,
        operationKey: "p002-legacy",
      });
      expect(created).toMatchObject({
        ok: true,
        item: { defaultPriceMinor: null, defaultUnitCostMinor: null },
      });
    });

    it("updates suggestions later without touching the name, activation, or any recorded sale", async () => {
      const store = new MemoryLocalStore();
      const service = new CatalogService(store, () => "2026-08-23T10:00:00.000Z");
      const created = await service.create({
        kind: "product",
        name: "كوب جاهز",
        unitLabel: "قطعة",
        defaultPriceMinor: 250,
        defaultUnitCostMinor: 120,
        operationKey: "p002-update",
      });
      if (!created.ok) throw new Error("reference should save");
      /* البيع يحفظ نسخته من قيم المرجع وقت البيع — لا يعود ليسأل المرجع لاحقًا. */
      const sale = createDirectSale({
        id: "p002-sale",
        itemName: created.item.name,
        quantity: 1,
        revenueMinor: 250,
        collectedMinor: 250,
        catalogItemId: created.item.id,
        customerName: null,
        costMinor: 120,
        occurredOn: "2026-08-20",
        recordedAt: "2026-08-20T10:00:00.000Z",
        note: "بيع من المرجع",
        idempotencyKey: "p002-sale-key",
      });
      const savedSale = await store.saveDirectSale(sale);
      if (!savedSale.ok) throw new Error("sale should save");
      const updated = await service.updateDefaults(created.item.id, {
        defaultPriceMinor: 300,
        defaultUnitCostMinor: null,
      });
      expect(updated).toMatchObject({
        ok: true,
        item: {
          name: "كوب جاهز",
          active: true,
          defaultPriceMinor: 300,
          defaultUnitCostMinor: null,
        },
      });
      /* ثبات تاريخي: تغيير اقتراحات المرجع لا يغيّر البيع المسجّل. */
      const reread = await store.listDirectSales();
      if (!reread.ok) throw new Error("sales should list");
      expect(reread.value[0]).toMatchObject({
        revenueMinor: 250,
        costMinor: 120,
        catalogItemId: created.item.id,
      });
    });

    it("clears both suggestions back to no-suggestion on demand", async () => {
      const service = new CatalogService(new MemoryLocalStore(), () => "2026-08-23T10:00:00.000Z");
      const created = await service.create({
        kind: "product",
        name: "صندوق",
        unitLabel: null,
        defaultPriceMinor: 500,
        defaultUnitCostMinor: 200,
        operationKey: "p002-clear",
      });
      if (!created.ok) throw new Error("reference should save");
      const cleared = await service.updateDefaults(created.item.id, {
        defaultPriceMinor: null,
        defaultUnitCostMinor: null,
      });
      expect(cleared).toMatchObject({
        ok: true,
        item: { defaultPriceMinor: null, defaultUnitCostMinor: null, name: "صندوق" },
      });
    });
  });
});
