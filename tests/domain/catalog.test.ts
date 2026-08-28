import { describe, expect, it } from "vitest";
import { createCatalogItem } from "../../src/domain/catalog/index.js";

describe("catalog domain core", () => {
  it("creates an optional product or service reference without price, stock, or cost semantics", () => {
    const product = createCatalogItem({
      id: "gift-box",
      kind: "product",
      name: " صندوق هدايا ",
      unitLabel: " قطعة ",
      createdAt: "2026-08-23T10:00:00.000Z",
      createdOperationKey: "catalog-gift-box",
    });
    const service = createCatalogItem({
      id: "gift-wrap",
      kind: "service",
      name: "تغليف هدايا",
      unitLabel: null,
      createdAt: "2026-08-23T10:00:00.000Z",
      createdOperationKey: "catalog-gift-wrap",
    });
    expect(product).toEqual({
      id: "gift-box",
      kind: "product",
      name: "صندوق هدايا",
      unitLabel: "قطعة",
      unitId: null,
      active: true,
      createdAt: "2026-08-23T10:00:00.000Z",
      updatedAt: "2026-08-23T10:00:00.000Z",
      createdOperationKey: "catalog-gift-box",
    });
    expect(service).toMatchObject({ kind: "service", unitLabel: null, active: true });
    expect(product).not.toHaveProperty("priceMinor");
    expect(product).not.toHaveProperty("stock");
  });

  it("rejects a catalog reference with blank identity or unsupported type instead of inventing a product", () => {
    expect(() =>
      createCatalogItem({
        id: "",
        kind: "product",
        name: "صندوق",
        unitLabel: null,
        createdAt: "2026-08-23T10:00:00.000Z",
        createdOperationKey: "key",
      }),
    ).toThrow("معرف المرجع");
    expect(() =>
      createCatalogItem({
        id: "bad-kind",
        kind: "other" as never,
        name: "صندوق",
        unitLabel: null,
        createdAt: "2026-08-23T10:00:00.000Z",
        createdOperationKey: "key",
      }),
    ).toThrow("نوع المرجع");
    expect(() =>
      createCatalogItem({
        id: "blank-name",
        kind: "product",
        name: " ",
        unitLabel: null,
        createdAt: "2026-08-23T10:00:00.000Z",
        createdOperationKey: "key",
      }),
    ).toThrow("اسم المرجع");
  });
});
