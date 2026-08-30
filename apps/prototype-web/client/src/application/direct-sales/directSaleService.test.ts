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
describe("DirectSaleService two-tab conflict guard (و٦, §٥-٩)", () => {
  async function recordedSale() {
    const store = new MemoryLocalStore();
    const service = new DirectSaleService(store, () => "2026-08-29T10:00:00.000Z");
    const recorded = await service.record({
      itemName: "منتج",
      quantity: 1,
      revenueMinor: 500,
      costMinor: null,
      occurredOn: "2026-08-29",
      note: "بيع مباشر",
      idempotencyKey: "sale-conflict-source",
    });
    if (!recorded.ok) throw new Error(recorded.message);
    return { store, service, id: recorded.value.id };
  }

  it("refuses an update whose expected revision count fell behind a newer edit", async () => {
    const { store, service, id } = await recordedSale();
    /* النافذة الأولى صحّحت — المراجعات تقدمت من 0 إلى 1. */
    const first = await service.update(id, {
      itemName: "منتج",
      quantity: 1,
      revenueMinor: 900,
      costMinor: null,
      occurredOn: "2026-08-29",
      note: "تصحيح النافذة الأولى",
      idempotencyKey: "tab-a-1",
    });
    if (!first.ok) throw new Error(first.message);

    /* النافذة الثانية ما تزال ترى 0 مراجعات — رفض لا طمس. */
    await expect(
      service.update(id, {
        itemName: "منتج",
        quantity: 1,
        revenueMinor: 700,
        costMinor: null,
        occurredOn: "2026-08-29",
        note: "تصحيح النافذة الثانية المتأخرة",
        idempotencyKey: "tab-b-1",
        expectedRevisionCount: 0,
      }),
    ).resolves.toMatchObject({ ok: false, code: "conflict" });
    await expect(store.listDirectSales()).resolves.toMatchObject({
      ok: true,
      value: [{ revenueMinor: 900, revisions: [{ idempotencyKey: "tab-a-1" }] }],
    });
  });

  it("accepts an update whose expected revision count matches the stored record", async () => {
    const { service, id } = await recordedSale();
    await expect(
      service.update(id, {
        itemName: "منتج",
        quantity: 1,
        revenueMinor: 800,
        costMinor: null,
        occurredOn: "2026-08-29",
        note: "تصحيح برقم صحيح",
        idempotencyKey: "tab-fresh-1",
        expectedRevisionCount: 0,
      }),
    ).resolves.toMatchObject({ ok: true, value: { revenueMinor: 800 } });
  });

  it("refuses a cancellation from a stale window instead of burying a newer edit", async () => {
    const { store, service, id } = await recordedSale();
    const first = await service.update(id, {
      itemName: "منتج",
      quantity: 1,
      revenueMinor: 900,
      costMinor: null,
      occurredOn: "2026-08-29",
      note: "تصحيح وصل أولًا",
      idempotencyKey: "tab-a-2",
    });
    if (!first.ok) throw new Error(first.message);

    await expect(service.cancel(id, "إلغاء من نافذة متأخرة", "tab-b-2", 0)).resolves.toMatchObject({
      ok: false,
      code: "conflict",
    });
    await expect(store.listDirectSales()).resolves.toMatchObject({
      ok: true,
      value: [{ status: "active", revenueMinor: 900 }],
    });
  });

  it("keeps the guard optional so existing single-window callers behave as before", async () => {
    const { service, id } = await recordedSale();
    await expect(
      service.update(id, {
        itemName: "منتج",
        quantity: 1,
        revenueMinor: 600,
        costMinor: null,
        occurredOn: "2026-08-29",
        note: "بلا رقم مرجعي",
        idempotencyKey: "legacy-1",
      }),
    ).resolves.toMatchObject({ ok: true, value: { revenueMinor: 600 } });
  });
});
describe("DirectSaleService agreed vs collected (X-06, و٤)", () => {
  it("records 10-agreed/8-collected with the owner's debt decision and a generic name when left empty", async () => {
    const store = new MemoryLocalStore();
    const service = new DirectSaleService(store, () => "2026-08-30T09:00:00.000Z");
    const result = await service.record({
      itemName: "   ",
      quantity: 1,
      revenueMinor: 1000,
      collectedMinor: 800,
      collectionStatus: "partial_debt",
      costMinor: null,
      occurredOn: "2026-08-30",
      note: "بيع من المحل",
      idempotencyKey: "x06-debt-1",
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        itemName: "بيع نقدي",
        revenueMinor: 1000,
        collectedMinor: 800,
        collectionStatus: "partial_debt",
      },
    });
  });

  it("applies the price cut at recording time as a documented revision — the sale becomes 8 and the original 10 stays", async () => {
    const store = new MemoryLocalStore();
    const service = new DirectSaleService(store, () => "2026-08-30T09:00:00.000Z");
    const result = await service.record({
      itemName: "قطعة",
      quantity: 1,
      revenueMinor: 1000,
      collectedMinor: 800,
      collectionStatus: undefined,
      costMinor: 300,
      occurredOn: "2026-08-30",
      note: "بيع من المحل",
      idempotencyKey: "x06-cut-1",
      priceCut: true,
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        revenueMinor: 800,
        collectedMinor: 800,
        collectionStatus: "collected_in_full",
        profitMinor: 500,
        revisions: [
          { kind: "price_cut", beforeRevenueMinor: 1000, reason: expect.stringContaining("خفّضتُ السعر") },
        ],
      },
    });
    /* إعادة الإرسال بمفتاح العملية نفسها لا تكرر التخفيض. */
    const replay = await service.record({
      itemName: "قطعة",
      quantity: 1,
      revenueMinor: 1000,
      collectedMinor: 800,
      costMinor: 300,
      occurredOn: "2026-08-30",
      note: "بيع من المحل",
      idempotencyKey: "x06-cut-1",
      priceCut: true,
    });
    expect(replay).toMatchObject({ ok: true, reused: true });
  });

  it("refuses collecting above the agreed price with an honest boundary message", async () => {
    const store = new MemoryLocalStore();
    const service = new DirectSaleService(store, () => "2026-08-30T09:00:00.000Z");
    await expect(
      service.record({
        itemName: "قطعة",
        quantity: 1,
        revenueMinor: 500,
        collectedMinor: 600,
        costMinor: null,
        occurredOn: "2026-08-30",
        note: "بيع",
        idempotencyKey: "x06-over-1",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
  });

  it("keeps the review decision valid: the difference stays flagged, not debt and not zero", async () => {
    const store = new MemoryLocalStore();
    const service = new DirectSaleService(store, () => "2026-08-30T09:00:00.000Z");
    const result = await service.record({
      itemName: "قطعة",
      quantity: 1,
      revenueMinor: 1000,
      collectedMinor: 800,
      collectionStatus: "partial_needs_review",
      costMinor: null,
      occurredOn: "2026-08-30",
      note: "بيع",
      idempotencyKey: "x06-review-1",
    });
    expect(result).toMatchObject({ ok: true, value: { collectionStatus: "partial_needs_review" } });
  });

  it("carries the optional catalog reference through record and update without imposing one", async () => {
    const store = new MemoryLocalStore();
    const service = new DirectSaleService(store, () => "2026-08-30T09:00:00.000Z");
    const recorded = await service.record({
      itemName: "خاتم",
      quantity: 1,
      revenueMinor: 600,
      catalogItemId: "catalog-item-1",
      costMinor: null,
      occurredOn: "2026-08-30",
      note: "بيع",
      idempotencyKey: "x06-ref-1",
    });
    expect(recorded).toMatchObject({ ok: true, value: { catalogItemId: "catalog-item-1" } });
    const updated = await service.update(recorded.value.id, {
      itemName: "خاتم",
      quantity: 1,
      revenueMinor: 600,
      collectedMinor: 600,
      catalogItemId: null,
      costMinor: null,
      occurredOn: "2026-08-30",
      note: "بيع",
      idempotencyKey: "x06-ref-edit-1",
    });
    expect(updated).toMatchObject({ ok: true, value: { catalogItemId: null } });
  });
});
