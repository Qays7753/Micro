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

  it("updates allowed fields, recalculates profit, and never creates an order", async () => {
    const store = new MemoryLocalStore();
    const times = ["2026-08-29T10:00:00.000Z", "2026-08-29T11:00:00.000Z"];
    const service = new DirectSaleService(store, () => times.shift()!);
    const recorded = await service.record({
      itemName: "منتج",
      quantity: 1,
      revenueMinor: 500,
      costMinor: null,
      occurredOn: "2026-08-29",
      note: "بيع مباشر",
      idempotencyKey: "sale-update-source",
    });
    if (!recorded.ok) throw new Error(recorded.message);

    const corrected = await service.update(recorded.value.id, {
      itemName: "منتج مصحح",
      quantity: 2,
      revenueMinor: 900,
      costMinor: 300,
      occurredOn: "2026-08-28",
      note: "المبلغ الصحيح",
      idempotencyKey: "sale-update-1",
    });

    expect(corrected).toMatchObject({
      ok: true,
      value: {
        id: recorded.value.id,
        recordedAt: recorded.value.recordedAt,
        collectedMinor: 900,
        profitMinor: 600,
        status: "active",
        revisions: [{ kind: "edit", idempotencyKey: "sale-update-1" }],
      },
    });
    await expect(service.update(recorded.value.id, {
      itemName: "منتج مصحح",
      quantity: 2,
      revenueMinor: 900,
      costMinor: 300,
      occurredOn: "2026-08-28",
      note: "المبلغ الصحيح",
      idempotencyKey: "sale-update-1",
    })).resolves.toMatchObject({ ok: true, reused: true });
    await expect(
      service.update(recorded.value.id, {
        itemName: "منتج مصحح",
        quantity: 2,
        revenueMinor: 900,
        costMinor: 300,
        occurredOn: "2026-08-28",
        note: "المبلغ الصحيح",
        idempotencyKey: "sale-update-source",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
    await expect(store.listOrders()).resolves.toEqual({ ok: true, value: [] });
    await expect(store.listDirectSales()).resolves.toMatchObject({
      ok: true,
      value: [{ revisions: [{ idempotencyKey: "sale-update-1" }] }],
    });
  });

  it("cancels once with a visible reason and rejects a second cancellation", async () => {
    const store = new MemoryLocalStore();
    const times = ["2026-08-29T10:00:00.000Z", "2026-08-29T12:00:00.000Z"];
    const service = new DirectSaleService(store, () => times.shift()!);
    const recorded = await service.record({
      itemName: "منتج",
      quantity: 1,
      revenueMinor: 500,
      costMinor: 200,
      occurredOn: "2026-08-29",
      note: "بيع مباشر",
      idempotencyKey: "sale-cancel-source",
    });
    if (!recorded.ok) throw new Error(recorded.message);

    await expect(
      service.cancel(recorded.value.id, "سُجل البيع بالخطأ", "sale-cancel-1"),
    ).resolves.toMatchObject({
      ok: true,
      value: {
        status: "cancelled",
        cancellationReason: "سُجل البيع بالخطأ",
        revenueMinor: 500,
        profitMinor: 300,
      },
    });
    await expect(
      service.cancel(recorded.value.id, "سُجل البيع بالخطأ", "sale-cancel-1"),
    ).resolves.toMatchObject({ ok: true, reused: true });
    await expect(
      service.cancel(recorded.value.id, "سبب آخر", "sale-cancel-2"),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
    await expect(store.listDirectSales()).resolves.toMatchObject({
      ok: true,
      value: [{ status: "cancelled", revisions: [{ kind: "cancel" }] }],
    });
  });
});