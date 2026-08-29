import { describe, expect, it } from "vitest";
import { createDirectSale } from "./index.js";

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
});