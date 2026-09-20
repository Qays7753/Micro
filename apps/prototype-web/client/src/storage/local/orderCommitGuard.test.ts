import { describe, expect, it } from "vitest";
import { validateOrderCommit } from "@/storage/local/orderCommitGuard";
import type { StoredCraftOrder } from "@/storage/local/types";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";

/* G-003: الحارس النقي لكتابة الطلب — علاقة «القاعدة مقابل الحي» بحد الكتابة:
 * إعادة الاستخدام بالمفتاح، ومطابقة القاعدة، وامتداد الأحداث حرفيًا. */

function storedOrder(id: string, status: string, extraEvents: StoredCraftOrder["order"]["events"] = []) {
  const cost = calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: "2026-08-22T00:00:00.000Z",
    freshnessDays: null,
  });
  const order = createCraftOrder({
    id,
    customerName: "سارة",
    itemName: `طلب ${id}`,
    specifications: "اختبار",
    quantity: 1,
    agreedPriceMinor: 2000,
    costSnapshot: cost,
    createdAt: "2026-08-22T00:00:00.000Z",
  });
  const stored: StoredCraftOrder = {
    id,
    order: { ...order, status: status as never, events: [...order.events, ...extraEvents] },
    deliveryDate: "2026-09-10",
    agreementSource: null,
    createdAt: "2026-08-22T00:00:00.000Z",
    updatedAt: "2026-08-22T00:00:00.000Z",
  };
  return stored;
}

const readyEvent = (id: string) =>
  ({
    id: `${id}:ready`,
    type: "status_changed",
    idempotencyKey: `${id}:mark-ready`,
    createdAt: "2026-09-08T09:00:00.000Z",
    fromStatus: "in_progress",
    toStatus: "ready",
  }) as const;

describe("orderCommitGuard — validateOrderCommit", () => {
  it("missing live record rejects with the missing message", () => {
    const base = storedOrder("g3-a", "in_progress");
    const result = validateOrderCommit(undefined, base, base, []);
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.message).toContain("لم يعد موجودًا");
  });

  it("an idempotency key already in the live events is an honest reuse", () => {
    const base = storedOrder("g3-b", "in_progress");
    const live = storedOrder("g3-b", "ready", [readyEvent("g3-b")]);
    const next: StoredCraftOrder = {
      ...base,
      order: { ...base.order, events: [...base.order.events, readyEvent("g3-b")] },
      updatedAt: "2026-09-08T09:01:00.000Z",
    };
    const result = validateOrderCommit(live, base, next, [`${"g3-b"}:mark-ready`]);
    expect(result).toEqual({ ok: true, reused: true });
  });

  it("a live record that changed since the base rejects as stale without writing", () => {
    const base = storedOrder("g3-c", "in_progress");
    const live = storedOrder("g3-c", "ready", [readyEvent("g3-c")]);
    const next: StoredCraftOrder = {
      ...base,
      order: { ...base.order, status: "ready" },
      updatedAt: "2026-09-08T09:01:00.000Z",
    };
    const result = validateOrderCommit(live, base, next, ["some-other-key"]);
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.message).toContain("تغيّر من مسار آخر");
  });

  it("a next payload that drops a historical event rejects even when the base matches", () => {
    const base = storedOrder("g3-d", "in_progress");
    const next: StoredCraftOrder = {
      ...base,
      order: { ...base.order, events: [] },
      updatedAt: "2026-09-08T09:01:00.000Z",
    };
    const result = validateOrderCommit(base, base, next, []);
    expect(result).toMatchObject({ ok: false });
  });

  it("a concurrent wrapper-only change (agreement context) is detected as stale", () => {
    const base = storedOrder("g3-e", "in_progress");
    const live: StoredCraftOrder = { ...base, followUpSummary: "متابعة من مسار آخر" };
    const next: StoredCraftOrder = { ...base, updatedAt: "2026-09-08T09:01:00.000Z" };
    const result = validateOrderCommit(live, base, next, []);
    expect(result).toMatchObject({ ok: false });
  });

  it("a matching live record with a well-formed appended event commits", () => {
    const base = storedOrder("g3-f", "in_progress");
    const next: StoredCraftOrder = {
      ...base,
      order: { ...base.order, events: [...base.order.events, readyEvent("g3-f")] },
      updatedAt: "2026-09-08T09:01:00.000Z",
    };
    const result = validateOrderCommit(base, base, next, ["g3-f:mark-ready"]);
    expect(result).toEqual({ ok: true, reused: false });
  });

  it("null and undefined optional fields are equivalent (old-data compatibility)", () => {
    const base = storedOrder("g3-g", "in_progress");
    const baseWithNulls: StoredCraftOrder = { ...base, retainedMeaning: null, orderName: null };
    const liveAbsents = structuredClone(baseWithNulls);
    delete (liveAbsents as Record<string, unknown>).retainedMeaning;
    delete (liveAbsents as Record<string, unknown>).orderName;
    const next: StoredCraftOrder = {
      ...baseWithNulls,
      updatedAt: "2026-09-08T09:01:00.000Z",
    };
    const result = validateOrderCommit(liveAbsents, baseWithNulls, next, []);
    expect(result).toEqual({ ok: true, reused: false });
  });
});
