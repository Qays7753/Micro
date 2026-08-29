import { describe, expect, it } from "vitest";
import { actionItems } from "./QuickActionSheet";

describe("quick action contract", () => {
  it("keeps direct-sale recording available without creating an order", () => {
    const sale = actionItems.find(item => item.action === "sale");
    expect(sale?.disabled).not.toBe(true);
    expect(sale?.description).toContain("من دون إنشاء طلب");
  });

  it("keeps the customer-order action available", () => {
    const order = actionItems.find(item => item.action === "order");
    expect(order?.disabled).not.toBe(true);
    expect(order?.description).toContain("مسودة طلب");
  });

  it("keeps the planned-design draft action enabled and truthful", () => {
    const estimate = actionItems.find(item => item.action === "estimate");
    expect(estimate?.disabled).not.toBe(true);
    expect(estimate?.label).toBe("مسودة تصميم");
    expect(estimate?.description).toContain("مسودة تصميم");
  });

  it("explains that collection starts from an existing order", () => {
    const collection = actionItems.find(item => item.action === "collection");
    expect(collection?.disabled).not.toBe(true);
    expect(collection?.description).toContain("طلب محدد");
  });
});
