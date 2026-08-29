import { describe, expect, it } from "vitest";
import { cancelDirectSale, createDirectSale, updateDirectSale } from "./index.js";

const input = {
  id: "sale-1",
  itemName: "قطعة جاهزة",
  quantity: 1,
  revenueMinor: 500,
  occurredOn: "2026-08-29",
  recordedAt: "2026-08-29T10:00:00.000Z",
  note: "بيع مباشر",
  idempotencyKey: "sale-op-1",
};

describe("direct sale", () => {
  it("keeps profit unavailable when cost is unknown", () => {
    expect(createDirectSale({ ...input, costMinor: null })).toMatchObject({
      collectedMinor: 500,
      costMinor: null,
      profitMinor: null,
    });
  });

  it("derives profit only from an explicitly recorded cost", () => {
    expect(createDirectSale({ ...input, costMinor: 200 })).toMatchObject({
      revenueMinor: 500,
      costMinor: 200,
      profitMinor: 300,
    });
  });

  it("recalculates collection and profit when an active sale is corrected", () => {
    const original = createDirectSale({ ...input, costMinor: null });
    const corrected = updateDirectSale(
      original,
      {
        itemName: "قطعتان جاهزتان",
        quantity: 2,
        revenueMinor: 900,
        costMinor: 350,
        occurredOn: "2026-08-30",
        note: "تصحيح البيع",
      },
      {
        kind: "edit",
        idempotencyKey: "sale-edit-1",
        createdAt: "2026-08-30T08:00:00.000Z",
        reason: "تصحيح بيانات البيع المباشر",
      },
    );

    expect(corrected).toMatchObject({
      id: "sale-1",
      itemName: "قطعتان جاهزتان",
      collectedMinor: 900,
      costMinor: 350,
      profitMinor: 550,
      status: "active",
      revisions: [{ kind: "edit", idempotencyKey: "sale-edit-1" }],
    });
  });

});

describe("direct sale cancellation", () => {
  it("cancels explicitly without deleting or changing the recorded amounts", () => {
    const original = createDirectSale({ ...input, costMinor: 200 });
    const cancelled = cancelDirectSale(original, {
      kind: "cancel",
      idempotencyKey: "sale-cancel-1",
      createdAt: "2026-08-30T09:00:00.000Z",
      reason: "سُجل البيع بالخطأ",
    });

    expect(cancelled).toMatchObject({
      id: original.id,
      revenueMinor: 500,
      costMinor: 200,
      profitMinor: 300,
      status: "cancelled",
      cancelledAt: "2026-08-30T09:00:00.000Z",
      cancellationReason: "سُجل البيع بالخطأ",
      revisions: [{ kind: "cancel", idempotencyKey: "sale-cancel-1" }],
    });
  });
});