import { describe, expect, it } from "vitest";
import { applyPriceCut, cancelDirectSale, createDirectSale, updateDirectSale } from "./index.js";

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

/* معاونو الاختبار: بيع جزفي بمتبقٍ وقرار معلن، وطلب تعديل يحفظ حقول الأصل. */
const partialSale = (overrides: Record<string, unknown> = {}) =>
  createDirectSale({
    ...input,
    costMinor: null,
    collectedMinor: 300,
    collectionStatus: "partial_debt",
    ...overrides,
  });
const editOf = (
  sale: ReturnType<typeof createDirectSale>,
  changes: Record<string, unknown>,
  key: string,
  reason: string,
  at = "2026-08-30T09:00:00.000Z",
) =>
  updateDirectSale(
    sale,
    {
      itemName: sale.itemName,
      quantity: 1,
      revenueMinor: sale.revenueMinor,
      collectedMinor: sale.collectedMinor,
      collectionStatus: sale.collectionStatus,
      costMinor: null,
      occurredOn: sale.occurredOn,
      note: sale.note,
      ...changes,
    },
    { kind: "edit", idempotencyKey: key, createdAt: at, reason },
  );

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
describe("direct sale agreed vs collected (X-06, decision from the owner's text)", () => {
  it("records a partial collection with the owner's explicit decision, never a silent default", () => {
    expect(partialSale()).toMatchObject({
      revenueMinor: 500,
      collectedMinor: 300,
      collectionStatus: "partial_debt",
    });
    expect(partialSale({ collectionStatus: "partial_needs_review" })).toMatchObject({
      collectionStatus: "partial_needs_review",
    });
  });

  it("applies a price cut as a documented revision: the sale becomes what was collected (10 → 8)", () => {
    const sale = partialSale({
      revenueMinor: 1000,
      costMinor: 200,
      collectedMinor: 800,
      collectionStatus: "partial_needs_review",
    });
    const cut = applyPriceCut(sale, {
      idempotencyKey: "cut-op-1",
      createdAt: "2026-08-30T09:00:00.000Z",
      reason: "خفّضتُ السعر",
    });
    expect(cut).toMatchObject({
      revenueMinor: 800,
      collectedMinor: 800,
      collectionStatus: "collected_in_full",
      profitMinor: 600,
    });
  });

  it("keeps the original agreed price inside the price-cut revision — الأصل يبقى في السجل", () => {
    const sale = partialSale({
      revenueMinor: 1000,
      collectedMinor: 800,
      collectionStatus: "partial_needs_review",
    });
    const cut = applyPriceCut(sale, {
      idempotencyKey: "cut-op-1b",
      createdAt: "2026-08-30T09:00:00.000Z",
      reason: "خفّضتُ السعر",
    });
    expect(cut.revisions).toEqual([
      {
        kind: "price_cut",
        idempotencyKey: "cut-op-1b",
        createdAt: "2026-08-30T09:00:00.000Z",
        reason: "خفّضتُ السعر",
        beforeRevenueMinor: 1000,
      },
    ]);
  });
});

it("keeps legacy full-collection records valid without the new fields", () => {
  expect(createDirectSale({ ...input, costMinor: null })).toMatchObject({
    collectedMinor: 500,
    collectionStatus: "collected_in_full",
  });
});

it("refuses collecting more than the agreed price and defaults an undecided difference to review", () => {
  expect(() => createDirectSale({ ...input, costMinor: null, collectedMinor: 501 })).toThrow();
  expect(createDirectSale({ ...input, costMinor: null, collectedMinor: 300 })).toMatchObject({
    collectionStatus: "partial_needs_review",
  });
});

describe("direct sale price cut and edit trail (X-06)", () => {
  it("refuses a price cut on a fully collected sale and keeps idempotency unique", () => {
    const full = createDirectSale({ ...input, costMinor: null });
    expect(() =>
      applyPriceCut(full, {
        idempotencyKey: "cut-op-2",
        createdAt: "2026-08-30T09:00:00.000Z",
        reason: "خفض",
      }),
    ).toThrow();
    const partial = createDirectSale({
      ...input,
      costMinor: null,
      collectedMinor: 300,
      collectionStatus: "partial_debt",
    });
    const cut = applyPriceCut(partial, {
      idempotencyKey: "cut-op-3",
      createdAt: "2026-08-30T09:00:00.000Z",
      reason: "خفّضتُ السعر",
    });
    expect(() =>
      applyPriceCut(cut, {
        idempotencyKey: "cut-op-3",
        createdAt: "2026-08-30T10:00:00.000Z",
        reason: "تكرار",
      }),
    ).toThrow();
  });

  it("captures the original agreed price on any edit that changes it (update path)", () => {
    const sale = partialSale();
    const edited = editOf(sale, { revenueMinor: 400 }, "edit-op-9", "تصحيح السعر");
    expect(edited.revisions?.[0]).toMatchObject({
      kind: "edit",
      beforeRevenueMinor: 500,
    });
    expect(edited.revenueMinor).toBe(400);
  });
});

/* D-001 (انحدار): هوية زبون البيع الآجل حقل مستقل — لا اسم مستخرج من الملاحظة. */
describe("direct sale credit customer as structured data (D-001)", () => {
  it("stores the credit-sale customer as a structured field, trimmed", () => {
    expect(
      createDirectSale({
        ...input,
        costMinor: null,
        collectedMinor: 300,
        collectionStatus: "partial_debt",
        customerName: "  خالد  ",
      }),
    ).toMatchObject({ customerName: "خالد", collectionStatus: "partial_debt" });
    expect(createDirectSale({ ...input, costMinor: null })).toMatchObject({ customerName: null });
  });

  it("keeps the original customer when an edit does not mention it, and clears it on explicit null", () => {
    const original = partialSale({ customerName: "خالد" });
    const editedWithoutCustomer = editOf(original, { collectedMinor: 400 }, "edit-op-c1", "قبض إضافي");
    expect(editedWithoutCustomer.customerName).toBe("خالد");

    const editedWithNull = editOf(
      original,
      { collectedMinor: 500, collectionStatus: "collected_in_full", customerName: null },
      "edit-op-c2",
      "حُدد الزبون لاحقًا",
      "2026-08-30T10:00:00.000Z",
    );
    expect(editedWithNull.customerName).toBeNull();
  });
});
