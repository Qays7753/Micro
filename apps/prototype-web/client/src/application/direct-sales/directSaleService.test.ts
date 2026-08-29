import { describe, expect, it } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { DirectSaleService } from "./directSaleService";

describe("DirectSaleService", () => {
  it("saves a direct sale independently while preserving unknown cost", async () => {
    const store = new MemoryLocalStore();
    const service = new DirectSaleService(store, () => "2026-08-29T10:00:00.000Z");
    const result = await service.record({
      itemName: "منتج جاهز",
      quantity: 1,
      revenueMinor: 750,
      costMinor: null,
      occurredOn: "2026-08-29",
      note: "بيع من المحل",
      idempotencyKey: "sale-record-1",
    });

    expect(result).toMatchObject({ ok: true, value: { profitMinor: null, collectedMinor: 750 } });
    await expect(store.listOrders()).resolves.toEqual({ ok: true, value: [] });
    await expect(store.listDirectSales()).resolves.toMatchObject({
      ok: true,
      value: [{ revenueMinor: 750, costMinor: null, profitMinor: null }],
    });
  });

  it("reuses an idempotency key without duplicating revenue", async () => {
    const store = new MemoryLocalStore();
    const service = new DirectSaleService(store, () => "2026-08-29T10:00:00.000Z");
    const input = {
      itemName: "منتج",
      quantity: 1,
      revenueMinor: 500,
      costMinor: 200,
      occurredOn: "2026-08-29",
      note: "بيع مباشر",
      idempotencyKey: "same-sale",
    };
    await service.record(input);
    expect(await service.record(input)).toMatchObject({ ok: true, reused: true });
    await expect(service.list()).resolves.toMatchObject({ ok: true, value: [{ profitMinor: 300 }] });
  });
});