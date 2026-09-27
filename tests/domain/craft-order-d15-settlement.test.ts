/**
 * D-15 (FIN-009) — شريحة سلامة أساس الدين والتحصيل مع مساهمتي التوصيل:
 * سقف التحصيل والمتبقي والعكس كلها من `orderValueMinor` نفسه، والدفع الكامل
 * لا يعلن قبل تحصيل المتبقي الصحيح، والتحصيل الزائد يُرفض بلا كتابة،
 * والتعارض التاريخي يُمنع بلا إعادة كتابة وبلا needs_review تلقائي.
 */
import { describe, expect, it } from "vitest";

import {
  calculateCostSnapshot,
  collectDeposit,
  collectRegisteredDebt,
  collectRemaining,
  createCraftOrder,
  describeSettlementConflict,
  orderResultBreakdown,
  orderValueMinor,
  recordDeliveryTerms,
  registerDebt,
  reverseOrderCollection,
  SETTLEMENT_CONFLICT_MESSAGE,
  transitionOrder,
} from "../../src/domain/craft-order/index.js";
import type { CraftOrder } from "../../src/domain/craft-order/index.js";

const NOW = "2026-09-27T09:00:00.000Z";

/* تكلفة معروفة: مادة 2.00 + ساعة 2.00 = 4.00 — تصغير الضجيج حول السعر. */
function knownCostOrder(priceMinor: number, id: string): CraftOrder {
  const cost = calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    source: "draft",
    materialItems: [
      {
        name: "خشب",
        quantity: 1,
        unit: "قطعة",
        unitPriceMinor: 200,
        priceDate: "2026-09-01",
        source: "user_input",
        confidence: "known",
      },
    ],
    time: { minutes: 60, hourlyRateMinor: 200, confidence: "known" },
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
    agreedPriceMinor: priceMinor,
    costSnapshot: cost,
    createdAt: NOW,
  });
}

const feeTerms = (feeChargedMinor: number | null, costPaidMinor: number | null, key: string) => ({
  responsibility: "customer_pays_project" as const,
  feeIncludedInPrice: false,
  costIncludedInProductCost: false,
  feeChargedMinor,
  costPaidMinor,
  projectShareMinor: null,
  customerShareMinor: null,
  idempotencyKey: key,
  createdAt: NOW,
});

/* مشروع يدفع للناقل: كلفة مسجلة بلا أجرة على الزبون عبر المشروع. */
const projectPaysTerms = (costPaidMinor: number | null, key: string) => ({
  responsibility: "project_pays" as const,
  feeIncludedInPrice: false,
  costIncludedInProductCost: false,
  feeChargedMinor: null,
  costPaidMinor,
  projectShareMinor: null,
  customerShareMinor: null,
  idempotencyKey: key,
  createdAt: NOW,
});

const sharedTerms = (feeChargedMinor: number | null, costPaidMinor: number | null, key: string) => ({
  responsibility: "shared" as const,
  feeIncludedInPrice: false,
  costIncludedInProductCost: false,
  feeChargedMinor,
  costPaidMinor,
  projectShareMinor: null,
  customerShareMinor: null,
  idempotencyKey: key,
  createdAt: NOW,
});

function toDelivered(order: CraftOrder, prefix: string): CraftOrder {
  let current = order;
  const steps: Array<"provisional_agreement" | "confirmed" | "in_progress" | "ready" | "delivered"> = [
    "provisional_agreement",
    "confirmed",
    "in_progress",
    "ready",
    "delivered",
  ];
  for (const [index, step] of steps.entries()) {
    current = transitionOrder(current, {
      to: step,
      idempotencyKey: `${prefix}-step-${index}`,
      createdAt: NOW,
    });
  }
  return current;
}

/* أمر جاهز: سعر 50 + مساهمة عميل 5 = قيمة قابلة للتحصيل 55، مسلّمًا ودينًا مسجلًا. */
function feeDebtOrder(): CraftOrder {
  const base = recordDeliveryTerms(knownCostOrder(5000, "d15-debt"), feeTerms(500, 0, "d15-debt-terms"));
  const delivered = toDelivered(base, "d15-debt");
  return registerDebt(delivered, "d15-debt-register", NOW);
}

/* أمر جاهز: قيمة 55 محصلة كاملة بقبضة واحدة بعد التسليم. */
function collectedFeeOrder(): CraftOrder {
  const base = recordDeliveryTerms(knownCostOrder(5000, "d15-rev"), feeTerms(500, 0, "d15-rev-terms"));
  const delivered = toDelivered(base, "d15-rev");
  const settled = collectRemaining(delivered, 5500, "d15-rev-grip", NOW);
  expect(settled.settlementStatus).toBe("paid");
  return settled;
}

/* محاكاة سجل قديم أغلق دين 55 عند قبض 50 بمتبقى مسجل 0 وحالة paid. */
function stalePaidRecord(): CraftOrder {
  const base = recordDeliveryTerms(knownCostOrder(5000, "d15-hist"), feeTerms(500, 0, "d15-hist-terms"));
  const delivered = toDelivered(base, "d15-hist");
  const debt = registerDebt(delivered, "d15-hist-register", NOW);
  const oldBuggyCollect: CraftOrder = {
    ...debt,
    collectedMinor: 5000,
    receivableMinor: 0,
    settlementStatus: "paid",
    nextAction: "راجع النتيجة والخطوة التالية",
    events: [
      ...debt.events,
      {
        id: "d15-hist:d15-hist-old-grip",
        type: "collection_recorded",
        idempotencyKey: "d15-hist-old-grip",
        createdAt: NOW,
        amountMinor: 5000,
      },
    ],
  };
  return oldBuggyCollect;
}

/* محاكاة دين مفتوح كتب متبقيه بالأساس القديم: قبض 30 من 55 أعطى متبقيًا 20 لا 25. */
function staleDebtRecord(): CraftOrder {
  const base = recordDeliveryTerms(knownCostOrder(5000, "d15-hist4"), feeTerms(500, 0, "d15-hist4-terms"));
  const delivered = toDelivered(base, "d15-hist4");
  const debt = registerDebt(delivered, "d15-hist4-register", NOW);
  const oldBuggyPartial: CraftOrder = {
    ...debt,
    collectedMinor: 3000,
    receivableMinor: 2000,
    settlementStatus: "debt",
  };
  return oldBuggyPartial;
}

describe("D-15 — settlement basis with the two delivery contributions", () => {
  it("keeps the exact legacy behavior when there is no billable customer contribution", () => {
    const delivered = toDelivered(knownCostOrder(5000, "d15-a"), "d15-a");
    expect(orderValueMinor(delivered)).toBe(5000);
    const debt = registerDebt(delivered, "d15-a-debt", NOW);
    expect(debt.events).toContainEqual(
      expect.objectContaining({ type: "debt_registered", amountMinor: 5000 }),
    );
    const paid = collectRegisteredDebt(debt, 5000, "d15-a-collect", NOW);
    expect(paid.settlementStatus).toBe("paid");
    expect(paid.receivableMinor).toBe(0);
  });

  it("adds the customer contribution collected through the project exactly once to the collectible value", () => {
    const base = recordDeliveryTerms(knownCostOrder(5000, "d15-b"), feeTerms(500, 0, "d15-b-terms"));
    expect(orderValueMinor(base)).toBe(5500);
    expect(base.receivableMinor).toBe(5500);
  });

  it("a project contribution alone never enters the customer debt", () => {
    const base = recordDeliveryTerms(knownCostOrder(5000, "d15-c"), projectPaysTerms(1000, "d15-c-terms"));
    expect(orderValueMinor(base)).toBe(5000);
    expect(base.receivableMinor).toBe(5000);
  });

  it("a customer contribution alone adds its amount to what the customer owes", () => {
    const base = recordDeliveryTerms(knownCostOrder(5000, "d15-d"), feeTerms(1000, 0, "d15-d-terms"));
    expect(orderValueMinor(base)).toBe(6000);
  });

  it("a shared contribution adds only the customer part to the collectible value", () => {
    const base = recordDeliveryTerms(knownCostOrder(5000, "d15-e"), sharedTerms(500, 500, "d15-e-terms"));
    expect(orderValueMinor(base)).toBe(5500);
  });
});

describe("D-15 — null, included-in-price, and courier-direct contributions", () => {
  it("an unrecorded (null) contribution is never invented as zero into the value", () => {
    const base = recordDeliveryTerms(knownCostOrder(5000, "d15-f"), feeTerms(null, null, "d15-f-terms"));
    expect(orderValueMinor(base)).toBe(5000);
  });

  it("a contribution already included in the price is not added a second time", () => {
    const base = recordDeliveryTerms(knownCostOrder(5000, "d15-g"), {
      ...feeTerms(500, 0, "d15-g-terms"),
      feeIncludedInPrice: true,
    });
    expect(orderValueMinor(base)).toBe(5000);
  });

  it("a customer paying the courier directly creates no project receivable for that contribution", () => {
    const base = recordDeliveryTerms(knownCostOrder(5000, "d15-h"), {
      responsibility: "customer_pays_courier",
      feeIncludedInPrice: false,
      costIncludedInProductCost: false,
      feeChargedMinor: null,
      costPaidMinor: null,
      projectShareMinor: null,
      customerShareMinor: null,
      idempotencyKey: "d15-h-terms",
      createdAt: NOW,
    });
    expect(orderValueMinor(base)).toBe(5000);
    expect(base.receivableMinor).toBe(5000);
  });
});

describe("D-15 — registered debt collection on the collectible-value basis", () => {
  it("registers the debt at the full collectible value without touching collected cash", () => {
    const debt = feeDebtOrder();
    expect(debt.status).toBe("settled");
    expect(debt.settlementStatus).toBe("debt");
    expect(debt.collectedMinor).toBe(0);
    expect(debt.receivableMinor).toBe(5500);
    expect(debt.events).toContainEqual(
      expect.objectContaining({ type: "debt_registered", amountMinor: 5500 }),
    );
  });

  it("collecting 50 of the 55 collectible leaves 5 outstanding and not paid", () => {
    const debt = feeDebtOrder();
    const partial = collectRegisteredDebt(debt, 5000, "d15-debt-collect-1", NOW);
    expect(partial.collectedMinor).toBe(5000);
    expect(partial.receivableMinor).toBe(500);
    expect(partial.settlementStatus).toBe("debt");
    expect(partial.nextAction).toBe("تابع تحصيل الدين");
  });
});

describe("D-15 — debt completion, over-collection rejection, and idempotency", () => {
  it("collecting the remaining 5 settles the debt to paid per the existing contract", () => {
    const debt = feeDebtOrder();
    const partial = collectRegisteredDebt(debt, 5000, "d15-debt-collect-2", NOW);
    const settled = collectRegisteredDebt(partial, 500, "d15-debt-collect-3", NOW);
    expect(settled.receivableMinor).toBe(0);
    expect(settled.settlementStatus).toBe("paid");
    expect(settled.nextAction).toBe("راجع النتيجة والخطوة التالية");
  });

  it("rejects over-collection before any write — no partial state, no silent change", () => {
    const debt = feeDebtOrder();
    const partial = collectRegisteredDebt(debt, 5000, "d15-debt-collect-4", NOW);
    expect(() => collectRegisteredDebt(partial, 600, "d15-over", NOW)).toThrow(
      "التحصيل لا يمكن أن يتجاوز قيمة الطلب القابلة للتحصيل",
    );
    /* الرفض وقع قبل الكتابة: لا حدث قبض جديد فوق القبضة الوحيدة المسجلة. */
    expect(partial.events.filter(event => event.type === "collection_recorded")).toHaveLength(1);
    expect(partial.receivableMinor).toBe(500);
    expect(partial.settlementStatus).toBe("debt");
  });

  it("retries the same collection idempotently without doubling the event", () => {
    const debt = feeDebtOrder();
    const once = collectRegisteredDebt(debt, 5500, "d15-idem", NOW);
    const twice = collectRegisteredDebt(once, 5500, "d15-idem", NOW);
    expect(twice).toEqual(once);
    expect(
      once.events.filter(event => event.type === "collection_recorded" && event.amountMinor === 5500),
    ).toHaveLength(1);
  });
});

describe("D-15 — collection reversal on the collectible-value basis", () => {
  it("reversing 5 of the original 55 grip restores 5 outstanding without staying paid", () => {
    const settled = collectedFeeOrder();
    const reversed = reverseOrderCollection(settled, {
      collectionEventId: "d15-rev:d15-rev-grip",
      amountMinor: 500,
      reason: "عُدّلت القبضة مع الزبون",
      idempotencyKey: "d15-rev-1",
      createdAt: NOW,
    });
    expect(reversed.collectedMinor).toBe(5000);
    expect(reversed.receivableMinor).toBe(500);
    expect(reversed.settlementStatus).toBe("debt");
    expect(reversed.nextAction).toBe("تابع تحصيل المتبقي");
  });

  it("caps the reversal at the un-reversed portion of the original grip", () => {
    const settled = collectedFeeOrder();
    const partiallyReversed = reverseOrderCollection(settled, {
      collectionEventId: "d15-rev:d15-rev-grip",
      amountMinor: 500,
      reason: "عُدّلت القبضة مع الزبون",
      idempotencyKey: "d15-rev-2",
      createdAt: NOW,
    });
    /* القبضة الأصلية 55 عُكس منها 5 — سقف أي عكس لاحق هو 50 لا قيمة الطلب. */
    expect(() =>
      reverseOrderCollection(partiallyReversed, {
        collectionEventId: "d15-rev:d15-rev-grip",
        amountMinor: 5100,
        reason: "محاولة تجاوز",
        idempotencyKey: "d15-rev-3",
        createdAt: NOW,
      }),
    ).toThrow("التراجع التراكمي لا يمكن أن يتجاوز مبلغ القبضة المسجلة.");
    expect(partiallyReversed.events.filter(event => event.type === "collection_reversed")).toHaveLength(1);
  });

  it("retries the same reversal idempotently", () => {
    const settled = collectedFeeOrder();
    const once = reverseOrderCollection(settled, {
      collectionEventId: "d15-rev:d15-rev-grip",
      amountMinor: 500,
      reason: "عُدّلت القبضة مع الزبون",
      idempotencyKey: "d15-rev-idem",
      createdAt: NOW,
    });
    const twice = reverseOrderCollection(once, {
      collectionEventId: "d15-rev:d15-rev-grip",
      amountMinor: 500,
      reason: "عُدّلت القبضة مع الزبون",
      idempotencyKey: "d15-rev-idem",
      createdAt: NOW,
    });
    expect(twice).toEqual(once);
  });
});

describe("D-15 — historically conflicting records are blocked, never rewritten", () => {
  /* محاكاة سجل كتبه المسار الخاطئ القديم: سقف التحصيل كان agreedPriceMinor،
   * فأغلق دين 55 عند قبض 50 بمتبقى مسجل 0 وحالة paid — سجل مستقر ظاهريًا
   * ومتناقض مع أساس قيمة الطلب القابلة للتحصيل. */
  /* المحاكاة الأهم: دين ما زال مفتوحًا لكن قيمته كُتبت بالأساس القديم —
   * قبض 30 من 55 أعطى متبقيًا مسجلًا 20 (من السعر 50) لا 25 الصحيح. */
  it("blocks the normal debt-collection path before writing and shows the reconciliation conflict", () => {
    const stale = staleDebtRecord();
    /* حارس الدومين موجز — رسالة المطابقة التفصيلية (الأساس/القبض/الفرق)
     * تعرضها خدمات التطبيق قبل الوصول هنا؛ اختبارها في طبقة التطبيق. */
    expect(() => collectRegisteredDebt(stale, 100, "d15-hist-collect", NOW)).toThrow(
      "تعارض تاريخي — التحصيل موقوف حتى تصحيح موثق.",
    );
    expect(stale.status).toBe("settled");
    expect(stale.settlementStatus).toBe("debt");
    expect(
      stale.events.some(event => event.type === "status_changed" && event.toStatus === "needs_review"),
    ).toBe(false);
    expect(stale.events.filter(event => event.type === "collection_recorded")).toHaveLength(0);
    expect(stale.receivableMinor).toBe(2000);
  });

  it("a prematurely-closed stale paid record is unreachable from the normal collection path — no silent rewrite", () => {
    const stale = stalePaidRecord();
    /* السجل الذي أغلقه المسار القديم خطأً لا يظهر دينًا مسجلًا فلا يُحصّل
     * من المسار العادي؛ مخرجه الموثق عكس القبضة (يعيد الحساب من الأساس
     * الصحيح) أو قرار المالك — لا إعادة كتابة صامتة ولا needs_review تلقائي. */
    expect(() => collectRegisteredDebt(stale, 100, "d15-hist-closed", NOW)).toThrow("يتطلب دينًا مسجلًا");
    expect(stale.settlementStatus).toBe("paid");
    expect(
      stale.events.some(event => event.type === "status_changed" && event.toStatus === "needs_review"),
    ).toBe(false);
    /* عكس القبضة القائمة يعيد المتبقي من الأساس الصحيح — الباب الموثق. */
    const reversed = reverseOrderCollection(stale, {
      collectionEventId: "d15-hist:d15-hist-old-grip",
      amountMinor: 5000,
      reason: "إعادة مطابقة السجل مع قيمة الطلب",
      idempotencyKey: "d15-hist-reverse",
      createdAt: NOW,
    });
    expect(reversed.receivableMinor).toBe(5500);
    expect(reversed.settlementStatus).toBe("debt");
    expect(reversed.events.some(event => event.type === "collection_reversed")).toBe(true);
  });
});

describe("D-15 — stale records never register new wrong-basis money", () => {
  it("blocks debt registration on a delivered record whose stored remainder mismatches the basis", () => {
    const base = recordDeliveryTerms(knownCostOrder(5000, "d15-hist2"), feeTerms(500, 0, "d15-hist2-terms"));
    const delivered = toDelivered(base, "d15-hist2");
    const partial = collectRemaining(delivered, 5000, "d15-hist2-grip", NOW);
    /* محاكاة عكس قديم خاطئ أعاد المتبقي من السعر وحده. */
    const staleDelivered: CraftOrder = {
      ...partial,
      receivableMinor: 0,
      settlementStatus: "paid",
      status: "delivered",
    };
    expect(() => registerDebt(staleDelivered, "d15-hist2-debt", NOW)).toThrow(
      "لا يمكن تسجيل دين بلا مبلغ متبقٍ.",
    );
    const staleWithRemainder: CraftOrder = {
      ...partial,
      receivableMinor: 300,
      settlementStatus: "partially_paid",
      status: "delivered",
    };
    expect(() => registerDebt(staleWithRemainder, "d15-hist2-debt", NOW)).toThrow("تعارض تاريخي");
    expect(staleWithRemainder.events).toHaveLength(partial.events.length);
  });

  it("an honest idempotent replay still passes before the conflict guard blocks new writes", () => {
    const base = recordDeliveryTerms(knownCostOrder(5000, "d15-hist3"), feeTerms(500, 0, "d15-hist3-terms"));
    const delivered = toDelivered(base, "d15-hist3");
    const collected = collectRemaining(delivered, 5500, "d15-hist3-grip", NOW);
    /* إعادة المحاولة الصادقة بنفس المفتاح تُعاد كما هي حتى لو اعتُبرت
     * الحالة لاحقًا متعارضة — الحارس يقف بعد فحص الحتمية لا قبله. */
    const staleButReplayable: CraftOrder = {
      ...collected,
      receivableMinor: 300,
    };
    const replay = collectRemaining(staleButReplayable, 5500, "d15-hist3-grip", NOW);
    expect(replay).toBe(staleButReplayable);
  });
});

describe("D-15 — every money write keeps the one shared settlement source", () => {
  it("deposit, remaining, debt, and reversal all recompute the remainder from orderValueMinor", () => {
    const base = recordDeliveryTerms(
      knownCostOrder(5000, "d15-equiv"),
      feeTerms(500, 300, "d15-equiv-terms"),
    );
    const withDeposit = collectDeposit(base, 1000, "d15-equiv-dep", NOW);
    expect(withDeposit.receivableMinor).toBe(orderValueMinor(withDeposit) - 1000);
    const delivered = toDelivered(withDeposit, "d15-equiv");
    const remaining = collectRemaining(delivered, 2000, "d15-equiv-rem", NOW);
    expect(remaining.receivableMinor).toBe(orderValueMinor(remaining) - 3000);
    const debt = registerDebt(remaining, "d15-equiv-debt", NOW);
    expect(debt.receivableMinor).toBe(orderValueMinor(debt) - 3000);
    const more = collectRegisteredDebt(debt, 2000, "d15-equiv-more", NOW);
    expect(more.receivableMinor).toBe(orderValueMinor(more) - 5000);
    const reversed = reverseOrderCollection(more, {
      collectionEventId: "d15-equiv:d15-equiv-more",
      amountMinor: 500,
      reason: "تسوية مع الزبون",
      idempotencyKey: "d15-equiv-rev",
      createdAt: NOW,
    });
    expect(reversed.receivableMinor).toBe(orderValueMinor(reversed) - 4500);
    expect(reversed.receivableMinor).toBe(1000);
  });
});

describe("D-15 — the internal projection never records or implies collection", () => {
  it("saving delivery terms moves no money: no collection events, no cash, no settlement change", () => {
    /* بطاقة D-15 §2.1 والشرط الصريح للشريحة: حفظ شروط التوصيل ينتج تمثيلًا
     * داخليًا (قيمة قابلة للتحصيل + مفردات الوصف) ولا يسجل قبضًا ولا أي حدث
     * مالي — الإيراد والكاش لا يتغيران إلا بأحداث التحصيل الموثقة. الشروط
     * تُسجَّل قبل التسليم (عقد 02)؛ يكفي المسودة نفسها لاختبار عدم القبض. */
    const before = knownCostOrder(5000, "d15-terms-save");
    const after = recordDeliveryTerms(before, feeTerms(500, 300, "d15-terms-save-key"));
    expect(after.collectedMinor).toBe(0);
    expect(after.depositCollectedMinor).toBe(0);
    expect(after.receivableMinor).toBe(5500);
    expect(after.settlementStatus).toBe("unpaid");
    expect(
      after.events.filter(
        event =>
          event.type === "collection_recorded" ||
          event.type === "deposit_collected" ||
          event.type === "collection_reversed",
      ),
    ).toHaveLength(0);
    expect(after.events).toContainEqual(expect.objectContaining({ type: "delivery_terms_recorded" }));
  });

  it("the internal result breakdown keeps the fee a claim to collect — not collected cash", () => {
    /* الفحص الرجعي: orderResultBreakdown (الـProjection الداخلي القائم) يبين
     * سعر المنتج ومساهمتي التوصيل والمبلغ المطلوب دون أي دلالة قبض. */
    const base = recordDeliveryTerms(
      knownCostOrder(5000, "d15-breakdown"),
      feeTerms(500, 300, "d15-breakdown-terms"),
    );
    const breakdown = orderResultBreakdown(base);
    expect(breakdown.priceMinor).toBe(5000);
    expect(breakdown.billableDeliveryFeeMinor).toBe(500);
    expect(breakdown.projectDeliveryCostMinor).toBe(300);
    expect(breakdown.revenueMinor).toBe(5500);
    expect(base.collectedMinor).toBe(0);
  });
});

describe("D-15 — the detailed reconciliation message for historically conflicting records", () => {
  it("carries the recorded remainder, the basis, the collected amount, and the difference", () => {
    /* بطاقة D-15 §4.4: عند منع التحصيل تُعرض المطابقة كاملة — الأساس والقبض
     * المسجل والفرق مع توجيه إلى مسار التصحيح المعتمد، بلا إعادة كتابة
     * وبلا تحويل تلقائي إلى مراجعة. المفردات التفصيلية تُختبر هنا على مستوى
     * الدومين (استهلاكها في أسطح العرض مؤجل كـ DEFERRED_UI). */
    const stale = staleDebtRecord();
    const message = describeSettlementConflict(stale);
    /* المتبقي المسجل 20.00، الأساس 55.00 بعد المقبوض 30.00، الفرق 5.00. */
    expect(message).toContain("المتبقي المسجل 20 د.أ");
    expect(message).toContain("أساس قيمة الطلب القابلة للتحصيل 55 د.أ");
    expect(message).toContain("بعد المقبوض 30 د.أ");
    expect(message).toContain("الفرق 5 د.أ");
    expect(message).toContain("حتى تصحيح موثق");
    expect(message).toContain("الأحداث الأصلية محفوظة");
    expect(message).toContain("لا يُحوّل السجل تلقائيًا إلى مراجعة");
    /* الحارس المثبت نفسه يظل بصمة قابلة للمقارنة لأسطح العرض. */
    expect(SETTLEMENT_CONFLICT_MESSAGE).toBe("تعارض تاريخي — التحصيل موقوف حتى تصحيح موثق.");
  });
});
