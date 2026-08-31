import { describe, expect, it } from "vitest";
import {
  createFinancialEvent,
  createFinancialReversal,
  summarizeFinancialEvents,
} from "../../src/domain/financial-event/index.js";

/* المبدأ الثالث عشر: المال الذي بحوزتك ليس بالضرورة مالك — الأمانات مال عابر
 * يدخل الكاش ولا يدخل الإيراد ولا المصروف ولا رأس مال المالك. والخسارة غير
 * النقدية تخفض الربح من دون حركة كاش. */
describe("amanah financial events", () => {
  const base = {
    id: "event-1",
    amountMinor: 30000,
    occurredOn: "2026-08-31",
    recordedAt: "2026-08-31T10:00:00.000Z",
    idempotencyKey: "key-1",
    note: "أمانة مندوب توصيل",
    counterparty: "ليث",
  };
  it("holds amanah as cash without revenue, expense, or owner capital effect", () => {
    const held = createFinancialEvent({ ...base, type: "amanah_held_cash" });
    expect(held.cashDeltaMinor).toBe(30000);
    expect(held.amanahDeltaMinor).toBe(30000);
    expect(held.operatingExpenseDeltaMinor).toBe(0);
    expect(held.ownerCapitalDeltaMinor).toBe(0);
    expect(held.payableDeltaMinor).toBe(0);
  });
  it("releases amanah as cash out without touching profit", () => {
    const released = createFinancialEvent({
      ...base,
      id: "event-2",
      type: "amanah_released_cash",
      idempotencyKey: "key-2",
    });
    expect(released.cashDeltaMinor).toBe(-30000);
    expect(released.amanahDeltaMinor).toBe(-30000);
    expect(released.operatingExpenseDeltaMinor).toBe(0);
  });
  it("nets amanah to zero after a full hold-and-release cycle", () => {
    const held = createFinancialEvent({ ...base, type: "amanah_held_cash" });
    const released = createFinancialEvent({
      ...base,
      id: "event-2",
      type: "amanah_released_cash",
      idempotencyKey: "key-2",
    });
    const totals = summarizeFinancialEvents([held, released]);
    expect(totals.amanahMinor).toBe(0);
    expect(totals.cashMinor).toBe(0);
    expect(totals.operatingExpenseMinor).toBe(0);
  });
  it("reverses amanah with a mirrored amanah delta", () => {
    const held = createFinancialEvent({ ...base, type: "amanah_held_cash" });
    const reversal = createFinancialReversal({
      id: "event-rev",
      sourceEvent: held,
      occurredOn: "2026-08-31",
      recordedAt: "2026-08-31T11:00:00.000Z",
      idempotencyKey: "key-rev",
      reason: "أُدخلت بالخطأ",
    });
    expect(reversal.cashDeltaMinor).toBe(-30000);
    expect(reversal.amanahDeltaMinor).toBe(-30000);
  });
});

describe("non-cash loss financial events", () => {
  const base = {
    id: "event-1",
    amountMinor: 30000,
    occurredOn: "2026-08-31",
    recordedAt: "2026-08-31T10:00:00.000Z",
    idempotencyKey: "key-1",
    note: "أمانة مندوب توصيل",
    counterparty: "ليث",
  };
  it("records a non-cash loss as profit reduction without any cash movement", () => {
    const loss = createFinancialEvent({
      ...base,
      type: "loss_non_cash",
      note: "تلف بضاعة غير مسجلة في المخزون",
    });
    expect(loss.cashDeltaMinor).toBe(0);
    expect(loss.amanahDeltaMinor).toBe(0);
    expect(loss.operatingExpenseDeltaMinor).toBe(30000);
    expect(loss.ownerCapitalDeltaMinor).toBe(0);
  });
  it("rejects expense context and settlement links on amanah and loss events", () => {
    expect(() =>
      createFinancialEvent({
        ...base,
        type: "amanah_held_cash",
        expenseContext: {
          relationship: "project",
          behavior: "unknown",
          purpose: "project_general",
          knowledge: "known",
          sharedProjectShare: null,
        },
      }),
    ).toThrowError("سياق المصروف يخص المصروفات التشغيلية فقط.");
    expect(() =>
      createFinancialEvent({ ...base, type: "loss_non_cash", relatedEventId: "payable-1" }),
    ).toThrowError("الربط بحدث قائم يخص تسديد الالتزامات فقط.");
  });
});
