import { describe, expect, it } from "vitest";
import { getMicroRouteKind, isDeepFlowPath, showsGlobalChrome } from "./routeClassifier";

describe("Micro deep-flow route classifier", () => {
  it("classifies the approved G18 editor routes as deep flows", () => {
    const deepRoutes = [
      "/direct-sales/new",
      "/direct-sales/sale-1",
      "/orders/draft/draft-1/agreement",
      "/orders/draft/draft-1/cost",
      "/finance/new/operating_expense_cash",
      "/finance/g5/declaration",
      "/finance/owner-entitlement",
      "/cash/wallet/new",
      "/cash/transfer",
      "/cash/wallet/wallet-1/adjust",
      "/cash/entry/entry-1/reverse",
      "/inventory/material/new",
      "/inventory/movement/consume",
      "/inventory/movement/movement-1/reverse",
      "/schedule/schedule-1",
      /* المجموعة ٣ (Scope A/B): الحاسبة وصفحة التقدير محررا تفكير عميقة. */
      "/tools/calculator",
      "/tools/estimate/estimate-1",
    ];

    for (const route of deepRoutes) {
      expect(isDeepFlowPath(route), route).toBe(true);
      expect(getMicroRouteKind(route), route).toBe("deep");
      expect(showsGlobalChrome(route), route).toBe(false);
    }
  });

  it("keeps general surfaces and setup outside the deep-flow chrome rule", () => {
    expect(getMicroRouteKind("/")).toBe("surface");
    expect(getMicroRouteKind("/inventory")).toBe("surface");
    expect(getMicroRouteKind("/setup")).toBe("setup");
    /* المجموعة ٣: سطح أدواتي نفسه يبقي التنقل — العمق للمحررين فقط. */
    expect(getMicroRouteKind("/tools")).toBe("surface");
    expect(showsGlobalChrome("/tools")).toBe(true);
    expect(showsGlobalChrome("/setup")).toBe(false);
  });

  it("does not treat the order detail surface as an editor", () => {
    expect(isDeepFlowPath("/orders/order-1")).toBe(false);
    expect(showsGlobalChrome("/orders/order-1")).toBe(true);
  });
});
