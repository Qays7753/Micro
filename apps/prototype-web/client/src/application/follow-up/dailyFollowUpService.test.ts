import { describe, expect, it } from "vitest";
import { deriveDailyFollowUp, type DailyFollowUp } from "./dailyFollowUpService";

const noDrafts = [] as const;
const order = (overrides: Partial<{ id: string; itemName: string; nextAction: string; receivableMinor: number; settlementStatus: string; status: string }> = {}) => ({
  id: overrides.id ?? "order-1",
  deliveryDate: "2026-08-23",
  order: {
    itemName: overrides.itemName ?? "صندوق مخصص",
    nextAction: overrides.nextAction ?? "سجل التسليم",
    receivableMinor: overrides.receivableMinor ?? 0,
    settlementStatus: overrides.settlementStatus ?? "open",
    status: overrides.status ?? "in_progress",
  },
});

describe("deriveDailyFollowUp", () => {
  it("keeps an active order ahead of later records", () => {
    const result = deriveDailyFollowUp([order(), order({ id: "debt", status: "settled", settlementStatus: "debt", receivableMinor: 2400 })], noDrafts);
    expect(result).toMatchObject<Partial<DailyFollowUp>>({ kind: "active_order", href: "/orders/order-1", actionLabel: "فتح الطلب" });
  });

  it("surfaces recorded debt after all orders are closed without calling it cash", () => {
    const result = deriveDailyFollowUp([order({ status: "settled", settlementStatus: "debt", receivableMinor: 2400 })], noDrafts);
    expect(result).toMatchObject<Partial<DailyFollowUp>>({ kind: "recorded_debt", href: "/orders/order-1", actionLabel: "فتح طلب الدين" });
    expect(result.truth).toContain("ليس كاشًا محصلًا");
  });

  it("distinguishes saved history from an empty project", () => {
    const history = deriveDailyFollowUp([order({ status: "settled" })], noDrafts);
    const empty = deriveDailyFollowUp([], noDrafts);
    expect(history).toMatchObject<Partial<DailyFollowUp>>({ kind: "history", title: "لا توجد طلبات نشطة" });
    expect(empty).toMatchObject<Partial<DailyFollowUp>>({ kind: "empty", title: "لا توجد طلبات بعد" });
  });
});
