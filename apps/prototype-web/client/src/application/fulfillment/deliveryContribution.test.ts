/**
 * D-15 (FIN-009) — نموذج صندوقي مساهمة التوصيل: الاشتقاق والوصف.
 * مساهمة العميل وحدها تدخل قيمة الطلب القابلة للتحصيل (مرة واحدة)،
 * ومساهمة المشروع لا تدخل دين العميل، وnull تبقى null لا صفرًا صامتًا،
 * والوصف البسيط يُستنتج من القيم لا من خيار shared مستقل.
 */
import { describe, expect, it } from "vitest";

import {
  deliveryContributionFromTerms,
  deliveryContributionSpecified,
  deriveDeliveryContributionTerms,
  describeDeliveryContribution,
} from "./deliveryContribution";

const noFlags = { feeIncludedInPrice: false, costIncludedInProductCost: false };

describe("D-15 — deriving delivery terms from the two contribution boxes", () => {
  it("empty boxes with no explicit choice record no delivery terms at all", () => {
    const terms = deriveDeliveryContributionTerms({
      projectMinor: null,
      customerMinor: null,
      customerPaysCourierDirect: false,
      ...noFlags,
    });
    expect(terms).toBeNull();
    expect(
      deliveryContributionSpecified({
        projectMinor: null,
        customerMinor: null,
        customerPaysCourierDirect: false,
        ...noFlags,
      }),
    ).toBe(false);
  });

  it("project contribution 10 with customer 0 keeps the customer debt at the product price only", () => {
    const terms = deriveDeliveryContributionTerms({
      projectMinor: 1000,
      customerMinor: 0,
      customerPaysCourierDirect: false,
      ...noFlags,
    });
    expect(terms?.responsibility).toBe("project_pays");
    expect(terms?.costPaidMinor).toBe(1000);
    expect(terms?.feeChargedMinor).toBeNull();
  });

  it("customer contribution 10 with project 0 adds it to what the customer owes through the project", () => {
    const terms = deriveDeliveryContributionTerms({
      projectMinor: 0,
      customerMinor: 1000,
      customerPaysCourierDirect: false,
      ...noFlags,
    });
    expect(terms?.responsibility).toBe("customer_pays_project");
    expect(terms?.feeChargedMinor).toBe(1000);
    expect(terms?.costPaidMinor).toBe(0);
  });

  it("both positive derives shared without the user ever choosing shared, and keeps legacy shares", () => {
    const terms = deriveDeliveryContributionTerms(
      {
        projectMinor: 500,
        customerMinor: 500,
        customerPaysCourierDirect: false,
        ...noFlags,
      },
      { projectShareMinor: 300, customerShareMinor: 200 },
    );
    expect(terms?.responsibility).toBe("shared");
    expect(terms?.feeChargedMinor).toBe(500);
    expect(terms?.costPaidMinor).toBe(500);
    expect(terms?.projectShareMinor).toBe(300);
    expect(terms?.customerShareMinor).toBe(200);
  });

  it("both explicit zeros mean no delivery contribution — free delivery", () => {
    const terms = deriveDeliveryContributionTerms({
      projectMinor: 0,
      customerMinor: 0,
      customerPaysCourierDirect: false,
      ...noFlags,
    });
    expect(terms?.responsibility).toBe("project_pays");
    expect(terms?.costPaidMinor).toBe(0);
    expect(terms?.feeChargedMinor).toBeNull();
  });

  it("an unrecorded box stays null — never silently converted to zero", () => {
    const terms = deriveDeliveryContributionTerms({
      projectMinor: null,
      customerMinor: 700,
      customerPaysCourierDirect: false,
      ...noFlags,
    });
    expect(terms?.responsibility).toBe("customer_pays_project");
    expect(terms?.feeChargedMinor).toBe(700);
    expect(terms?.costPaidMinor).toBeNull();
  });

  it("the courier-direct explicit choice records no amounts through the project", () => {
    const terms = deriveDeliveryContributionTerms({
      projectMinor: 1000,
      customerMinor: 500,
      customerPaysCourierDirect: true,
      ...noFlags,
    });
    expect(terms?.responsibility).toBe("customer_pays_courier");
    expect(terms?.feeChargedMinor).toBeNull();
    expect(terms?.costPaidMinor).toBeNull();
    expect(terms?.projectShareMinor).toBeNull();
    expect(terms?.customerShareMinor).toBeNull();
  });

  it("the include-in-price flags pass through for the non-courier derivations", () => {
    const terms = deriveDeliveryContributionTerms({
      projectMinor: 300,
      customerMinor: 200,
      customerPaysCourierDirect: false,
      feeIncludedInPrice: true,
      costIncludedInProductCost: true,
    });
    expect(terms?.feeIncludedInPrice).toBe(true);
    expect(terms?.costIncludedInProductCost).toBe(true);
  });
});

describe("D-15 — the plain-language delivery description", () => {
  const describeBoxes = (projectMinor: number | null, customerMinor: number | null) =>
    describeDeliveryContribution({ projectMinor, customerMinor, customerPaysCourierDirect: false });

  it("empty boxes say nothing is recorded yet", () => {
    expect(describeBoxes(null, null)).toContain("لم تُسجَّل مساهمة توصيل بعد");
  });

  it("project positive with customer zero says delivery is on the project", () => {
    expect(describeBoxes(1000, 0)).toBe("التوصيل على المشروع.");
    expect(describeBoxes(1000, null)).toBe("التوصيل على المشروع.");
  });

  it("customer positive with project zero says delivery is on the customer", () => {
    expect(describeBoxes(0, 1000)).toBe("التوصيل على العميل.");
    expect(describeBoxes(null, 1000)).toBe("التوصيل على العميل.");
  });

  it("both positive say shared", () => {
    expect(describeBoxes(500, 500)).toBe("التوصيل مشترك بين المشروع والعميل.");
  });

  it("both explicit zeros say free delivery", () => {
    expect(describeBoxes(0, 0)).toBe("لا توجد مساهمة توصيل — التوصيل مجاني.");
  });

  it("an explicit zero with an unrecorded box stays honestly unspecified", () => {
    expect(describeBoxes(0, null)).toBe("مساهمة التوصيل غير محددة بالكامل بعد.");
    expect(describeBoxes(null, 0)).toBe("مساهمة التوصيل غير محددة بالكامل بعد.");
  });

  it("courier-direct describes the contextual-info-only meaning", () => {
    expect(
      describeDeliveryContribution({
        projectMinor: null,
        customerMinor: null,
        customerPaysCourierDirect: true,
      }),
    ).toContain("الزبون يدفع لشركة التوصيل مباشرة");
  });
});

describe("D-15 — rebuilding the boxes from stored terms", () => {
  it("courier-direct terms rebuild into the courier mode", () => {
    const boxes = deliveryContributionFromTerms({
      responsibility: "customer_pays_courier",
      feeChargedMinor: null,
      costPaidMinor: null,
    });
    expect(boxes).toEqual({ projectMinor: null, customerMinor: null, customerPaysCourierDirect: true });
  });

  it("project_pays terms rebuild the customer box as the structural zero of the responsibility", () => {
    const boxes = deliveryContributionFromTerms({
      responsibility: "project_pays",
      feeChargedMinor: null,
      costPaidMinor: 1000,
    });
    expect(boxes).toEqual({ projectMinor: 1000, customerMinor: 0, customerPaysCourierDirect: false });
  });

  it("customer_pays_project and shared terms keep the recorded amounts as typed", () => {
    const customer = deliveryContributionFromTerms({
      responsibility: "customer_pays_project",
      feeChargedMinor: 700,
      costPaidMinor: null,
    });
    expect(customer).toEqual({ projectMinor: null, customerMinor: 700, customerPaysCourierDirect: false });
    const shared = deliveryContributionFromTerms({
      responsibility: "shared",
      feeChargedMinor: 200,
      costPaidMinor: 100,
    });
    expect(shared).toEqual({ projectMinor: 100, customerMinor: 200, customerPaysCourierDirect: false });
  });

  it("round-tripping stored terms through the boxes reproduces the same responsibility", () => {
    const stored = {
      responsibility: "shared" as const,
      feeChargedMinor: 200,
      costPaidMinor: 100,
    };
    const boxes = deliveryContributionFromTerms(stored);
    const derived = deriveDeliveryContributionTerms({
      ...boxes,
      feeIncludedInPrice: false,
      costIncludedInProductCost: false,
    });
    expect(derived?.responsibility).toBe("shared");
    expect(derived?.feeChargedMinor).toBe(200);
    expect(derived?.costPaidMinor).toBe(100);
  });
});
