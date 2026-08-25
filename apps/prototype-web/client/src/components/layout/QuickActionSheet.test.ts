import { describe, expect, it } from "vitest";
import { actionItems } from "./QuickActionSheet";

describe("quick action contract", () => {
  it("keeps the customer-order action available", () => {
    const order = actionItems.find(item => item.action === "order");
    expect(order?.disabled).not.toBe(true);
    expect(order?.description).toContain("مسودة طلب");
  });

  it("marks unsupported design estimation as unavailable instead of a dead action", () => {
    const estimate = actionItems.find(item => item.action === "estimate");
    expect(estimate?.disabled).toBe(true);
    expect(estimate?.label).toContain("غير متاح");
    expect(estimate?.description).toContain("لا يوجد مسار تقدير مستقل");
  });

  it("explains that collection starts from an existing order", () => {
    const collection = actionItems.find(item => item.action === "collection");
    expect(collection?.disabled).not.toBe(true);
    expect(collection?.description).toContain("طلب محدد");
  });
});
