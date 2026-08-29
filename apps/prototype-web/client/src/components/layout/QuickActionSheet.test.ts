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

describe("quick action contract — expense joins the moment's actions (F-036, decision 23-b)", () => {
  it("keeps the expense action directly after the direct sale at the top of the sheet", () => {
    const ids = actionItems.map(item => item.action);
    expect(ids[0]).toBe("sale");
    expect(ids[1]).toBe("expense");
  });

  it("describes the expense as a moment's action, not a buried destination", () => {
    const expense = actionItems.find(item => item.action === "expense");
    expect(expense?.disabled).not.toBe(true);
    expect(expense?.label).toBe("تسجيل مصروف");
    expect(expense?.description).toContain("من أي مكان");
  });

  it("keeps material-with-opening-balance out of the quick sheet by decision 23-b", () => {
    expect(actionItems.some(item => item.action === "material")).toBe(false);
  });
});
