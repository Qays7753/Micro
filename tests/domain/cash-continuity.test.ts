import { describe, expect, it } from "vitest";
import { createCashContinuityEntry, createCashWallet, summarizeCashContinuity } from "../../src/domain/cash-continuity/index.js";

describe("cash continuity domain", () => {
  it("keeps an opening balance separate from transfers and requires explicit correction evidence", () => {
    const wallet = createCashWallet({ id: "drawer", name: "درج", kind: "cash_drawer", createdAt: "2026-08-23T09:00:00.000Z", createdOperationKey: "wallet-1" });
    const opening = createCashContinuityEntry({ id: "opening", walletId: wallet.id, type: "opening_balance", occurredOn: "2026-08-01", recordedAt: "2026-08-23T09:00:00.000Z", cashDeltaMinor: 10000, note: "رصيد البداية", operationKey: "opening-1" });
    const adjustment = createCashContinuityEntry({ id: "adjustment", walletId: wallet.id, type: "cash_adjustment", occurredOn: "2026-08-02", recordedAt: "2026-08-23T09:00:00.000Z", cashDeltaMinor: -500, note: "فرق جرد", reason: "سجلت مبلغًا زائدًا", operationKey: "adjustment-1" });
    expect(summarizeCashContinuity([opening, adjustment])).toBe(9500);
    expect(() => createCashContinuityEntry({ id: "bad", walletId: wallet.id, type: "opening_balance", occurredOn: "2026-08-01", recordedAt: "2026-08-23T09:00:00.000Z", cashDeltaMinor: -1, note: "خطأ", operationKey: "bad-opening" })).toThrow("opening balance cannot be negative");
    expect(() => createCashContinuityEntry({ id: "bad-adjustment", walletId: wallet.id, type: "cash_adjustment", occurredOn: "2026-08-02", recordedAt: "2026-08-23T09:00:00.000Z", cashDeltaMinor: 1, note: "فرق", operationKey: "bad-adjustment" })).toThrow("cash adjustment requires a reason");
  });
});
