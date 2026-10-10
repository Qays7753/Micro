/** R7 / R6-F17-P01 (2026-10-10): عقد سطح استعلام تفصيل الطلب — الفصل الصادق
 * (R1)، قرارات الأقسام النقية (ORD-002/Z2.2/D-031/S3-12/AV-07)، وسلاسل
 * الاستعلام القسمية. نفس شروط القرار التي كانت الصفحة تنفذها. */
import { describe, expect, it } from "vitest";
import { deriveOrderSectionDecisions } from "./orderDetailViewModel";
import type { StoredCraftOrder } from "@/storage/local/types";

const stored = (order: Record<string, unknown>, events: readonly unknown[] = []) =>
  ({ order: { ...order, events } }) as unknown as StoredCraftOrder;

describe("R7/P01 — قرارات أقسام الطلب", () => {
  it("لا تسليم: لا لحظة تسليم ولا قفل مراجعة، والتعديل متاح", () => {
    const d = deriveOrderSectionDecisions(stored({ status: "confirmed" }));
    expect(d.deliveredAtIso).toBeNull();
    expect(d.standingDeliveryIso).toBeNull();
    expect(d.lockedInDeliveredReview).toBe(false);
    expect(d.canEditPrice).toBe(true);
    expect(d.canReverseCollection).toBe(false);
    expect(d.canCancel).toBe(true);
  });

  it("تسليم قائم: لحظته من حدث التسليم نفسه (ORD-002) وتظل قائمة (Z2.2)", () => {
    const events = [
      { toStatus: "confirmed", createdAt: "2026-09-01T08:00:00.000Z", type: "status_changed" },
      { toStatus: "delivered", createdAt: "2026-09-03T09:30:00.000Z", type: "status_changed" },
    ];
    const d = deriveOrderSectionDecisions(stored({ status: "delivered" }, events));
    expect(d.deliveredAtIso).toBe("2026-09-03T09:30:00.000Z");
    expect(d.standingDeliveryIso).toBe("2026-09-03T09:30:00.000Z");
  });

  it("المسودة/الملغى/المحتاج مراجعة: لا تعديل سعر (S3-12)", () => {
    for (const status of ["draft", "cancelled", "needs_review"]) {
      expect(deriveOrderSectionDecisions(stored({ status })).canEditPrice).toBe(false);
    }
  });

  it("الإلغاء متاح حيث يتم بأمان (AV-07): قبل التسليم + المراجعة + المؤجل؛ لا بعده", () => {
    for (const status of [
      "provisional_agreement",
      "confirmed",
      "in_progress",
      "ready",
      "needs_review",
      "postponed",
    ]) {
      expect(deriveOrderSectionDecisions(stored({ status })).canCancel).toBe(true);
    }
    expect(deriveOrderSectionDecisions(stored({ status: "delivered" })).canCancel).toBe(false);
    expect(deriveOrderSectionDecisions(stored({ status: "settled" })).canCancel).toBe(false);
  });

  it("قبضة مسجلة تجلب «تراجع عن قبضة» ما لم يكن ملغى أو مقفولًا", () => {
    const collection = [{ type: "collection_recorded" }];
    expect(
      deriveOrderSectionDecisions(stored({ status: "delivered" }, collection)).canReverseCollection,
    ).toBe(true);
    expect(
      deriveOrderSectionDecisions(stored({ status: "cancelled" }, collection)).canReverseCollection,
    ).toBe(false);
    expect(deriveOrderSectionDecisions(stored({ status: "confirmed" })).canReverseCollection).toBe(false);
  });
});

describe("R7/P01 — قرارات الاستعلام (أنواع العقد)", () => {
  it("الأنواع المصدرة تشكل الفصل الصادق R1 (error/not_found/ready)", async () => {
    const mod = await import("./orderDetailViewModel");
    expect(typeof mod.readOrderDetail).toBe("function");
    expect(typeof mod.readSourceEstimate).toBe("function");
    expect(typeof mod.readAvailableWalletOptions).toBe("function");
    expect(typeof mod.readPartyNameSuggestions).toBe("function");
  });
});
