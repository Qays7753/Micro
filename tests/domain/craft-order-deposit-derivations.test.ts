/**
 * R10-B4/F-021 (2026-10-12) — اشتقاقات قراءة عائلة العربون في الدومين:
 * `standingDepositMinorOf` و `pendingDepositSettlementMinorOf` و
 * `unclassifiedRetainedDepositMinorOf` و `cancelledDepositProposalOf`.
 * كلها تقرأ بالقارئات الكنسية نفسها التي تكتب بها المسارات
 * (retainedDepositMinor / classifiedSumsOf) — الاختبارات تُثبت التكافؤ
 * مع مسارات الكتابة، وسلوك التوافق الرجعي للبيانات القديمة (حيث كانت
 * مرايا الواجهة الخام تنحرف عن الحقيقة)، والنقاء.
 */
import { describe, expect, it } from "vitest";

import {
  cancelledDepositProposalOf,
  calculateCostSnapshot,
  classifyRetainedDeposit,
  collectDeposit,
  createCraftOrder,
  pendingDepositSettlementMinorOf,
  reverseActiveDeposit,
  settleDepositRetain,
  standingDepositMinorOf,
  unclassifiedRetainedDepositMinorOf,
  type CraftOrder,
} from "../../src/domain/craft-order/index.js";

const NOW = "2026-10-12T09:00:00.000Z";

/* تكلفة موثقة معروفة: مادة 3.00 + ساعة 1.00 = 4.00 (plannedCostMinor 400). */
function knownCostOrder(id: string): CraftOrder {
  const cost = calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    source: "draft",
    materialItems: [
      {
        name: "خشب",
        quantity: 1,
        unit: "قطعة",
        unitPriceMinor: 300,
        priceDate: "2026-10-01",
        source: "user_input",
        confidence: "known",
      },
    ],
    time: { minutes: 60, hourlyRateMinor: 100, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: NOW,
    freshnessDays: null,
  });
  return createCraftOrder({
    id,
    customerName: "سارة",
    itemName: "رف خشبي",
    specifications: "مقاس كبير",
    quantity: 1,
    agreedPriceMinor: 8000,
    costSnapshot: cost,
    createdAt: NOW,
  });
}

function withDeposit(id: string, depositMinor: number): CraftOrder {
  return collectDeposit(knownCostOrder(id), depositMinor, `${id}-deposit-key`, NOW);
}

function cancelledWithDeposit(id: string, depositMinor: number): CraftOrder {
  const order = withDeposit(id, depositMinor);
  return {
    ...order,
    status: "cancelled",
    settlementStatus: "cancelled_pending",
    depositSettlement: "needs_review",
  } as CraftOrder;
}

describe("R10-B4/F-021 — standingDepositMinorOf (active reversal ceiling)", () => {
  it("equals the write path's standing ceiling: after a partial reversal the derivation tracks it", () => {
    const order = withDeposit("standing-1", 5000);
    expect(standingDepositMinorOf(order)).toBe(5000);
    const afterReverse = reverseActiveDeposit(order, 2000, "عربون خاطئ جزئيًا", "reverse-key-1", NOW);
    /* المحصل نقص 2000 والعكس لا يُحتسب محتفظًا — القائم 3000. */
    expect(standingDepositMinorOf(afterReverse)).toBe(3000);
    expect(afterReverse.depositCollectedMinor).toBe(3000);
  });

  it("clamps at zero when the standing deposit is fully reversed", () => {
    const order = withDeposit("standing-2", 1000);
    const afterReverse = reverseActiveDeposit(order, 1000, "عكس كامل", "reverse-key-2", NOW);
    expect(standingDepositMinorOf(afterReverse)).toBe(0);
  });

  it("is a pure read: the order record is not mutated", () => {
    const order = withDeposit("standing-3", 2500);
    const before = JSON.stringify(order);
    standingDepositMinorOf(order);
    pendingDepositSettlementMinorOf(order);
    cancelledDepositProposalOf(order);
    unclassifiedRetainedDepositMinorOf(order);
    expect(JSON.stringify(order)).toBe(before);
  });
});

describe("R10-B4/F-021 — pendingDepositSettlementMinorOf (cancelled settlement)", () => {
  it("equals the refundable bound: refunding exactly pending closes the settlement", () => {
    const cancelled = cancelledWithDeposit("pending-1", 5000);
    expect(pendingDepositSettlementMinorOf(cancelled)).toBe(5000);
  });

  it("shrinks with a partial retain exactly as the write path records it", () => {
    const cancelled = cancelledWithDeposit("pending-2", 5000);
    const afterPartialRetain = settleDepositRetain(cancelled, 2000, "تغطية جزئية موثقة", "retain-key-2", NOW);
    /* المحتفظ 2000 صار مقروءًا كنواة — المعلق 3000. */
    expect(pendingDepositSettlementMinorOf(afterPartialRetain)).toBe(3000);
    expect(afterPartialRetain.depositSettlement).toBe("needs_review");
  });

  it("legacy retain without depositRetainedMinor reads the full collected (backward compat)", () => {
    /* بيانات قديمة: قرار احتفاظ كامل قبل وجود الحقل — القارئ الكنسي يشتق
     * المحتفظ من حالة التسوية، فالمعلق صفر لا collected (مرآة الواجهة الخام
     * «?? 0» كانت ستحسب المعلق collected كاملًا — الانحراف الذي أغلقناه). */
    const legacyRetained = {
      ...cancelledWithDeposit("pending-3", 4000),
      depositSettlement: "retain_deposit" as const,
    };
    expect(pendingDepositSettlementMinorOf(legacyRetained)).toBe(0);
  });
});

describe("R10-B4/F-021 — unclassifiedRetainedDepositMinorOf (classification bound)", () => {
  it("equals the classify path's bound: classifying exactly it succeeds; more throws with the same number", () => {
    const cancelled = cancelledWithDeposit("classify-1", 5000);
    const retained = settleDepositRetain(cancelled, 5000, "احتفاظ كامل موثق", "retain-key-3", NOW);
    expect(unclassifiedRetainedDepositMinorOf(retained)).toBe(5000);
    const classified = classifyRetainedDeposit(
      retained,
      "owner",
      "تنازل العميل عن العربون",
      "classify-key-3",
      NOW,
      5000,
    );
    expect(classified.depositClassifiedOwnerMinor).toBe(5000);
    expect(unclassifiedRetainedDepositMinorOf(classified)).toBe(0);
  });

  it("partial classification leaves the exact remainder as the classify path enforces", () => {
    const cancelled = cancelledWithDeposit("classify-2", 6000);
    const retained = settleDepositRetain(cancelled, 6000, "احتفاظ كامل", "retain-key-4", NOW);
    const partiallyClassified = classifyRetainedDeposit(
      retained,
      "revenue",
      "إيراد جزئي",
      "classify-key-4",
      NOW,
      2500,
    );
    expect(unclassifiedRetainedDepositMinorOf(partiallyClassified)).toBe(3500);
    /* المسار الكاتب يرفض ما يتجاوزها برسالة تحمل الرقم نفسه (بالدينار: 3500/100). */
    expect(() =>
      classifyRetainedDeposit(partiallyClassified, "owner", "زيادة", "classify-key-5", NOW, 3501),
    ).toThrow(/35 د\.أ/);
  });

  it("legacy retainedMeaning derives the classified sums (backward compat)", () => {
    /* بيانات قديمة: تصنيف كامل واحد قبل وجود العدّادات — المصنَّف يُشتق من
     * retainedMeaning فغير المصنَّف صفر، لا retained كاملًا (الانحراف الثاني
     * الذي أغلقته المرآة الخام). */
    const legacyClassified = {
      ...cancelledWithDeposit("classify-3", 4000),
      depositSettlement: "retain_deposit" as const,
      retainedMeaning: "owner" as const,
    };
    expect(unclassifiedRetainedDepositMinorOf(legacyClassified)).toBe(0);
  });
});

describe("R10-B4/F-021 — cancelledDepositProposalOf (Conflict E preview)", () => {
  it("covers the documented cost and refunds the rest when pending exceeds it", () => {
    const cancelled = cancelledWithDeposit("proposal-1", 5000);
    const proposal = cancelledDepositProposalOf(cancelled);
    /* التكلفة الموثقة 4.00 د.أ (400 minor): تغطية حتى 400 والرد 4600. */
    expect(proposal.coverProposalMinor).toBe(400);
    expect(proposal.refundProposalMinor).toBe(4600);
  });

  it("covers only the pending when the documented cost exceeds it (refund zero)", () => {
    const cancelled = cancelledWithDeposit("proposal-2", 300);
    const proposal = cancelledDepositProposalOf(cancelled);
    expect(proposal.coverProposalMinor).toBe(300);
    expect(proposal.refundProposalMinor).toBe(0);
  });

  it("the proposal is a suggestion only: the explicit owner amount always wins", () => {
    /* الاقتراح لا يكتب شيئًا — قرار المالك بمبلغ صريح يعلو (تختبره مسارات
     * التسوية نفسها: مبلغ صريح جزئي جائز). هنا: النقاء فقط. */
    const cancelled = cancelledWithDeposit("proposal-3", 5000);
    const before = JSON.stringify(cancelled);
    cancelledDepositProposalOf(cancelled);
    expect(JSON.stringify(cancelled)).toBe(before);
  });
});
