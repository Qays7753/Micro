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
  orderValueMinor,
  recordDeliveryTerms,
  registerDebt,
  reverseOrderCollection,
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

const sharedTerms = (
  feeChargedMinor: number | null,
  costPaidMinor: number | null,
  key: string,
) => ({
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
    const base = recordDeliveryTerms(
      knownCostOrder(5000, "d15-b"),
      feeTerms(500, 0, "d15-b-terms"),
    );
    expect(orderValueMinor(base)).toBe(5500);
    expect(base.receivableMinor).toBe(5500);
  });

  it("a project contribution alone never enters the customer debt", () => {
    const base = recordDeliveryTerms(
      knownCostOrder(5000, "d15-c"),
      projectPaysTerms(1000, "d15-c-terms"),
    );
    expect(orderValueMinor(base)).toBe(5000);
    expect(base.receivableMinor).toBe(5000);
  });

  it("a customer contribution alone adds its amount to what the customer owes", () => {
    const base = recordDeliveryTerms(
      knownCostOrder(5000, "d15-d"),
      feeTerms(1000, 0, "d15-d-terms"),
    );
    expect(orderValueMinor(base)).toBe(6000);
  });

  it("a shared contribution adds only the customer part to the collectible value", () => {
    const base = recordDeliveryTerms(
      knownCostOrder(5000, "d15-e"),
      sharedTerms(500, 500, "d15-e-terms"),
    );
    expect(orderValueMinor(base)).toBe(5500);
  });

  it("an unrecorded (null) contribution is never invented as zero into the value", () => {
    const base = recordDeliveryTerms(
      knownCostOrder(5000, "d15-f"),
      feeTerms(null, null, "d15-f-terms"),
    );
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
  function feeDebtOrder(): CraftOrder {
    const base = recordDeliveryTerms(
      knownCostOrder(5000, "d15-debt"),
      feeTerms(500, 0, "d15-debt-terms"),
    );
    const delivered = toDelivered(base, "d15-debt");
    return registerDebt(delivered, "d15-debt-register", NOW);
  }

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
      "التحصيل لا يمكن أن يتجاوز قيمة الطلب القابلة للتحصيل.",
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
  function collectedFeeOrder(): CraftOrder {
    const base = recordDeliveryTerms(
      knownCostOrder(5000, "d15-rev"),
      feeTerms(500, 0, "d15-rev-terms"),
    );
    const delivered = toDelivered(base, "d15-rev");
    const settled = collectRemaining(delivered, 5500, "d15-rev-grip", NOW);
    expect(settled.settlementStatus).toBe("paid");
    return settled;
  }

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
    expect(
      partiallyReversed.events.filter(event => event.type === "collection_reversed"),
    ).toHaveLength(1);
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
  function stalePaidRecord(): CraftOrder {
    const base = recordDeliveryTerms(
      knownCostOrder(5000, "d15-hist"),
      feeTerms(500, 0, "d15-hist-terms"),
    );
    const delivered = toDelivered(base, "d15-hist");
    const debt = registerDebt(delivered, "d15-hist-register", NOW);
    /* القبضة التي كتبها المسار القديم قبل إغلاق الدين خطأً عند السعر وحده. */
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

  /* المحاكاة الأهم: دين ما زال مفتوحًا لكن قيمته كُتبت بالأساس القديم —
   * قبض 30 من 55 أعطى متبقيًا مسجلًا 20 (من السعر 50) لا 25 الصحيح. */
  function staleDebtRecord(): CraftOrder {
    const base = recordDeliveryTerms(
      knownCostOrder(5000, "d15-hist4"),
      feeTerms(500, 0, "d15-hist4-terms"),
    );
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

  it("blocks the normal debt-collection path before writing and shows the reconciliation conflict", () => {
    const stale = staleDebtRecord();
    expect(() => collectRegisteredDebt(stale, 100, "d15-hist-collect", NOW)).toThrow(
      "تعارض سجل تاريخي",
    );
    expect(() => collectRegisteredDebt(stale, 100, "d15-hist-collect", NOW)).toThrow(
      "قيمة الطلب القابلة للتحصيل 55",
    );
    expect(() => collectRegisteredDebt(stale, 100, "d15-hist-collect", NOW)).toThrow("الفرق 5");
    /* لا كتابة ولا تحويل تلقائي إلى needs_review ولا مسّ بالأحداث الأصلية. */
    expect(() => collectRegisteredDebt(stale, 100, "d15-hist-collect", NOW)).toThrow(
      "لا تُعاد كتابة الأحداث الأصلية",
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
    expect(() => collectRegisteredDebt(stale, 100, "d15-hist-closed", NOW)).toThrow(
      "يتطلب دينًا مسجلًا",
    );
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

  it("blocks debt registration on a delivered record whose stored remainder mismatches the basis", () => {
    const base = recordDeliveryTerms(
      knownCostOrder(5000, "d15-hist2"),
      feeTerms(500, 0, "d15-hist2-terms"),
    );
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
    expect(() => registerDebt(staleWithRemainder, "d15-hist2-debt", NOW)).toThrow(
      "تعارض سجل تاريخي",
    );
    expect(staleWithRemainder.events).toHaveLength(partial.events.length);
  });

  it("an honest idempotent replay still passes before the conflict guard blocks new writes", () => {
    const base = recordDeliveryTerms(
      knownCostOrder(5000, "d15-hist3"),
      feeTerms(500, 0, "d15-hist3-terms"),
    );
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
