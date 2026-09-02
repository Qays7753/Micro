import { describe, expect, it } from "vitest";
/* و٩ — اختبارات توصيف للدوال الست الأعقد قبل أي إعادة هيكلة:
 * calculateContributionMargin (88) · calculateOwnerEntitlement (62) ·
 * createOwnerMovement (39) · calculateShortCash (39) ·
 * normalizeSharedProjectShare (38 — عبر createFinancialEvent) ·
 * calculateAllocationPolicy (38).
 * هذه الشبكة تثبّت السلوك الحالي كما هو: أي إعادة هيكلة تغيّر مخرجًا واحدًا
 * مما يلي فهي خاطئة وتُرجَع — ولا يُعدَّل الاختبار ليطابق الكود الجديد أبدًا. */
import {
  calculateContributionMargin,
  calculateShortCash,
  createShortCashDeclaration,
} from "../../src/domain/g5/index.js";
import { createFinancialEvent } from "../../src/domain/financial-event/index.js";
import type { SharedProjectShare } from "../../src/domain/financial-event/index.js";
import {
  calculateOwnerEntitlement,
  createOwnerEntitlementPolicy,
  createOwnerMovement,
} from "../../src/domain/owner-entitlement/index.js";
import type { CreateOwnerMovementInput } from "../../src/domain/owner-entitlement/index.js";
import {
  calculateAllocationPolicy,
  createAllocationPolicy,
} from "../../src/domain/recurring-margin/index.js";

/* ---------- G5: calculateContributionMargin ---------- */

const g5Order = (overrides: Partial<Parameters<typeof calculateContributionMargin>[2][number]> = {}) => ({
  id: "order-1",
  itemName: "صندوق",
  deliveredOn: "2026-08-10",
  resultStatus: "final" as const,
  quantityMilli: 2000,
  unitKey: "piece",
  unitLabel: "قطعة",
  quantityIssue: null,
  recognizedRevenueMinor: 5000,
  recognizedCostMinor: 1800,
  ...overrides,
});
const g5Expense = (overrides: Partial<Parameters<typeof calculateContributionMargin>[3][number]> = {}) => ({
  id: "expense-1",
  amountMinor: 1000,
  behavior: "fixed" as const,
  relationship: "project" as const,
  knowledge: "known" as const,
  sharedProjectShareBasis: null,
  directlyLinked: false,
  source: "اشتراك معلن",
  ...overrides,
});

describe("characterization: calculateContributionMargin (و٩)", () => {
  it("pins the available reading: totals, per-unit rounding, and next action", () => {
    const result = calculateContributionMargin("2026-08-01", "2026-08-31", [g5Order()], [g5Expense()]);
    expect(result).toMatchObject({
      status: "available",
      from: "2026-08-01",
      to: "2026-08-31",
      totalRevenueMinor: 5000,
      totalVariableCostMinor: 1800,
      contributionMarginMinor: 3200,
      contributionMarginPerUnitMinor: 1600,
      totalQuantityMilli: 2000,
      quantityUnitKey: "piece",
      quantityUnitLabel: "قطعة",
      fixedExpenseMinor: 1000,
      finalOrderCount: 1,
      excludedOrderCount: 0,
      sources: ["طلب مسلّم مسجل: صندوق", "مصروف الفترة: اشتراك معلن"],
      excluded: [],
      assumptions: [],
      reasons: [],
      nextAction: "راجع السعر والتكلفة إذا تغير المزيج أو الافتراض المعلن.",
    });
  });

  it("pins the mix item shape of the available reading", () => {
    const result = calculateContributionMargin("2026-08-01", "2026-08-31", [g5Order()], [g5Expense()]);
    expect(result.mix).toHaveLength(1);
    expect(result.mix[0]).toMatchObject({
      itemName: "صندوق",
      orderCount: 1,
      quantityMilli: 2000,
      unitKey: "piece",
      unitLabel: "قطعة",
      revenueMinor: 5000,
      variableCostMinor: 1800,
      contributionMarginMinor: 3200,
    });
  });

  it("pins mix aggregation across two same-name orders and the descending margin sort", () => {
    const result = calculateContributionMargin(
      "2026-08-01",
      "2026-08-31",
      [
        g5Order({ id: "a", recognizedRevenueMinor: 5000, recognizedCostMinor: 1800 }),
        g5Order({ id: "b", itemName: "رف", recognizedRevenueMinor: 3000, recognizedCostMinor: 1000 }),
      ],
      [g5Expense()],
    );
    expect(result.totalRevenueMinor).toBe(8000);
    expect(result.totalVariableCostMinor).toBe(2800);
    expect(result.contributionMarginMinor).toBe(5200);
    expect(result.mix.map(item => item.itemName)).toEqual(["صندوق", "رف"]);
    expect(result.mix[0]?.contributionMarginMinor).toBe(3200);
  });
});

describe("characterization: calculateContributionMargin — exclusion (و٩)", () => {
  it("pins the incomplete path when only non-final orders exist", () => {
    const result = calculateContributionMargin(
      "2026-08-01",
      "2026-08-31",
      [g5Order({ resultStatus: "estimated", id: "est-1" })],
      [g5Expense()],
    );
    expect(result.status).toBe("incomplete");
    expect(result.finalOrderCount).toBe(0);
    expect(result.excludedOrderCount).toBe(1);
    expect(result.excluded).toContain("الطلب «صندوق» مستبعد لأن نتيجته تقديرية.");
    expect(result.reasons).toContain("توجد طلبات مسلّمة مستبعدة من الهامش بسبب النتيجة غير النهائية.");
    expect(result.reasons).toContain("لا توجد طلبات نهائية موجبة تكفي لحساب الهامش بعد الكلفة المباشرة.");
  });
});

describe("characterization: calculateContributionMargin — guards (و٩)", () => {
  it("pins the out-of-window exclusion and the invalid local period guard", () => {
    const outside = calculateContributionMargin(
      "2026-08-01",
      "2026-08-31",
      [g5Order({ deliveredOn: "2026-07-15" })],
      [g5Expense()],
    );
    expect(outside.status).toBe("invalid");
    expect(outside.finalOrderCount).toBe(0);

    const badPeriod = calculateContributionMargin("2026-13-01", "2026-08-31", [], []);
    expect(badPeriod.status).toBe("invalid");
    expect(badPeriod.reasons).toEqual(["الفترة المحلية غير صالحة."]);
  });

  it("pins the shared-expense classification gap and the unlinked variable gap", () => {
    const sharedGap = calculateContributionMargin(
      "2026-08-01",
      "2026-08-31",
      [g5Order()],
      [
        g5Expense({
          relationship: "shared",
          behavior: "mixed",
          sharedProjectShareBasis: null,
          source: "فاتورة إنترنت",
        }),
      ],
    );
    expect(sharedGap.status).toBe("incomplete");
    expect(sharedGap.reasons).toContain(
      "الحصة المشتركة فاتورة إنترنت بلا أساس معلن؛ لم تدخل كمصروف ثابت معروف.",
    );
    expect(sharedGap.excluded).toContain("المصروف فاتورة إنترنت غير موزّع لغياب مصدر الحصة.");

    const unlinkedVariable = calculateContributionMargin(
      "2026-08-01",
      "2026-08-31",
      [g5Order()],
      [g5Expense({ behavior: "variable", directlyLinked: false, source: "تغليف خارجي" })],
    );
    expect(unlinkedVariable.status).toBe("incomplete");
    expect(unlinkedVariable.reasons).toContain(
      "المصروف المتغير تغليف خارجي غير مرتبط مباشرة بهامش الوحدات؛ لم يوزع تلقائيًا.",
    );
  });
});

describe("characterization: calculateContributionMargin — expenses (و٩)", () => {
  it("pins the estimated fixed expense assumption and the needs_review status", () => {
    const result = calculateContributionMargin(
      "2026-08-01",
      "2026-08-31",
      [g5Order()],
      [g5Expense({ knowledge: "estimated", source: "إيجار تقديري" })],
    );
    expect(result.status).toBe("needs_review");
    expect(result.assumptions).toEqual(["مبلغ ثابت إيجار تقديري تقديري معلن."]);
  });

  it("pins the unit mismatch and the invalid quantity branches", () => {
    const mismatch = calculateContributionMargin(
      "2026-08-01",
      "2026-08-31",
      [
        g5Order({ id: "a", unitKey: "piece", unitLabel: "قطعة" }),
        g5Order({ id: "b", unitKey: "kg", unitLabel: "كغم" }),
      ],
      [g5Expense()],
    );
    expect(mismatch.status).toBe("incomplete");
    expect(mismatch.reasons).toContain(
      "توجد وحدات أو مراجع كمية غير متوافقة؛ لا تجمعها كناتج واحد دون تحويل G4-A صريح داخل البعد نفسه.",
    );
    expect(mismatch.totalQuantityMilli).toBeNull();
    expect(mismatch.contributionMarginPerUnitMinor).toBeNull();

    const invalidQuantity = calculateContributionMargin(
      "2026-08-01",
      "2026-08-31",
      [g5Order({ quantityMilli: null, quantityIssue: "invalid" })],
      [g5Expense()],
    );
    expect(invalidQuantity.status).toBe("invalid");
    expect(invalidQuantity.reasons).toContain("كمية الطلب «صندوق» غير صالحة؛ لا تحوّل إلى صفر.");
  });
});

describe("characterization: calculateContributionMargin — units (و٩)", () => {
  it("pins the legacy recorded-mix fallback when units are absent", () => {
    const result = calculateContributionMargin(
      "2026-08-01",
      "2026-08-31",
      [g5Order({ unitKey: null, unitLabel: null })],
      [g5Expense()],
    );
    expect(result.quantityUnitKey).toBe("legacy:recorded-mix");
    expect(result.quantityUnitLabel).toBe("المزيج المسجل");
    expect(result.contributionMarginPerUnitMinor).toBe(1600);
  });
});

/* ---------- G5: calculateShortCash ---------- */

const shortCashInput = (overrides: Partial<Parameters<typeof calculateShortCash>[0]> = {}) => ({
  from: "2026-08-01",
  to: "2026-08-31",
  recordedCashMinor: 10000,
  receivables: [],
  payables: [],
  declarations: [],
  ...overrides,
});
const makeDeclaration = (overrides: Partial<Parameters<typeof createShortCashDeclaration>[0]> = {}) =>
  createShortCashDeclaration({
    id: "decl-1",
    direction: "collection",
    amountMinor: 8000,
    dueOn: "2026-08-20",
    source: "العميلة — موعد معلن",
    knowledge: "known",
    note: "تحصيل متوقع",
    idempotencyKey: "decl-key",
    createdAt: "2026-08-01T09:00:00.000Z",
    ...overrides,
  });

describe("characterization: calculateShortCash (و٩)", () => {
  const datedBalancesInput = () =>
    shortCashInput({
      receivables: [
        { id: "order-1", direction: "collection", amountMinor: 8000, dueOn: "2026-08-20", source: "دين ريم" },
      ],
      payables: [
        {
          id: "pay-1",
          direction: "commitment",
          amountMinor: 3000,
          dueOn: "2026-08-25",
          source: "التزام مورد",
        },
      ],
    });

  it("pins the available projection from dated balances inside the window", () => {
    expect(calculateShortCash(datedBalancesInput())).toMatchObject({
      status: "available",
      recordedCashMinor: 10000,
      declaredCollectionsMinor: 8000,
      declaredCommitmentsMinor: 3000,
      undatedReceivablesMinor: 0,
      undatedPayablesMinor: 0,
      projectedCashMinor: 15000,
      activeDeclarationCount: 0,
      assumptions: [],
      reasons: [],
      nextAction: "راجع مواعيد التحصيل والالتزامات إذا تغيرت الوقائع؛ هذا توقع معلن وليس كاشًا حاليًا.",
    });
  });

  it("pins the dated-balance source lines of the available projection", () => {
    expect(calculateShortCash(datedBalancesInput()).sources).toEqual([
      "رصيد مؤرخ: دين ريم في 2026-08-20",
      "رصيد مؤرخ: التزام مورد في 2026-08-25",
    ]);
  });
});

describe("characterization: calculateShortCash — guards (و٩)", () => {
  /* صفا دين واحد ومتوقعًا واحدًا بمعاملات معلنة — يقلل تكرار البناء الحرفي
   * في حمايات الاستحقاق الثلاث. */
  const oneDebt = (amountMinor: number, dueOn: string | null, source: string) => [
    { id: "order-1", direction: "collection" as const, amountMinor, dueOn, source },
  ];
  const oneDeclaration = (id: string, amountMinor: number, dueOn: string, key: string) => [
    makeDeclaration({ id, amountMinor, dueOn, relatedOrderId: "order-1", idempotencyKey: key }),
  ];
  it("pins the incomplete path for undated balances: no projection and the honest reason", () => {
    const result = calculateShortCash(shortCashInput({ receivables: oneDebt(8000, null, "دين بلا تاريخ") }));
    expect(result).toMatchObject({
      status: "incomplete",
      declaredCollectionsMinor: 0,
      undatedReceivablesMinor: 8000,
      projectedCashMinor: null,
    });
    expect(result.reasons).toContain("دين بلا تاريخ كافٍ: دين بلا تاريخ.");
    expect(result.nextAction).toBe("حدّث تاريخ التحصيل أو الالتزام المفقود قبل الاعتماد على توقع قصير.");
  });

  it("pins the invalid path when declarations exceed the recorded balance", () => {
    const result = calculateShortCash(
      shortCashInput({
        receivables: oneDebt(2000, null, "دين صغير"),
        declarations: [
          ...oneDeclaration("d1", 1500, "2026-08-10", "k1"),
          ...oneDeclaration("d2", 1000, "2026-08-12", "k2"),
        ],
      }),
    );
    expect(result.status).toBe("invalid");
    expect(result.reasons).toContain("متوقعات دين صغير يتجاوز مجموعها الرصيد المسجل.");
    expect(result.nextAction).toBe(
      "صحح مبلغ السجل المتوقع أو تاريخه أو ربطه قبل الاعتماد على قراءة السيولة.",
    );
  });

  it("pins the duplicate evidence guard: a declaration linked to a dated balance is invalid", () => {
    const result = calculateShortCash(
      shortCashInput({
        receivables: oneDebt(8000, "2026-08-20", "دين مؤرخ"),
        declarations: oneDeclaration("d1", 1000, "2026-08-20", "k1"),
      }),
    );
    expect(result.status).toBe("invalid");
    expect(result.reasons).toContain("السجل المتوقع المرتبط بـدين مؤرخ يكرر رصيدًا له تاريخ مسجل مسبقًا.");
  });
});

describe("characterization: calculateShortCash — assumptions (و٩)", () => {
  it("pins the estimated-declaration assumption and the needs_review status", () => {
    const result = calculateShortCash(
      shortCashInput({
        declarations: [
          makeDeclaration({ knowledge: "estimated", source: "وعد تحصيل", idempotencyKey: "est-1" }),
        ],
      }),
    );
    expect(result.status).toBe("needs_review");
    expect(result.assumptions).toEqual(["وعد تحصيل: تقدير معلن."]);
    expect(result.declaredCollectionsMinor).toBe(8000);
    expect(result.projectedCashMinor).toBe(18000);
    expect(result.sources).toEqual(["قبض متوقع: وعد تحصيل في 2026-08-20"]);
  });
});

describe("characterization: calculateShortCash — window (و٩)", () => {
  it("pins the no-window-evidence incomplete path and the invalid period guard", () => {
    const empty = calculateShortCash(shortCashInput());
    expect(empty.status).toBe("incomplete");
    expect(empty.reasons).toContain("لا يوجد أساس كافٍ لأفق قصير مؤرخ؛ غياب المتوقع لا يعني أن الأفق آمن.");

    const badPeriod = calculateShortCash(shortCashInput({ from: "2026-08-31", to: "2026-08-01" }));
    expect(badPeriod.status).toBe("invalid");
    expect(badPeriod.reasons).toEqual(["الفترة أو الكاش المسجل غير صالح."]);
  });
});

/* ---------- financial-event: normalizeSharedProjectShare (عبر createFinancialEvent) ---------- */

const eventBase = {
  occurredOn: "2026-08-23",
  recordedAt: "2026-08-23T08:00:00.000Z",
  note: "اختبار توصيف",
  counterparty: null,
};

describe("characterization: normalizeSharedProjectShare via createFinancialEvent (و٩)", () => {
  it("pins the owner-estimate share normalization with a trimmed note", () => {
    const event = createFinancialEvent({
      ...eventBase,
      id: "char-owner-estimate",
      type: "operating_expense_cash",
      amountMinor: 1250,
      idempotencyKey: "char-owner-estimate",
      expenseContext: {
        relationship: "shared",
        behavior: "mixed",
        purpose: "period",
        knowledge: "estimated",
        sharedProjectShare: { basis: "owner_estimate", note: "  نصف فاتورة الإنترنت  " },
      },
    });
    expect(event.expenseContext?.sharedProjectShare).toEqual({
      basis: "owner_estimate",
      note: "نصف فاتورة الإنترنت",
      allocation: "allocated",
      totalAmountMinor: null,
      percentageBps: null,
      calculatedShareMinor: null,
    });
  });
});

describe("characterization: normalizeSharedProjectShare — values (و٩)", () => {
  it("pins the agreed-percentage share with its computed minor value", () => {
    const event = createFinancialEvent({
      ...eventBase,
      id: "char-agreed-percentage",
      type: "operating_expense_cash",
      amountMinor: 617,
      idempotencyKey: "char-agreed-percentage",
      expenseContext: {
        relationship: "shared",
        behavior: "mixed",
        purpose: "period",
        knowledge: "known",
        sharedProjectShare: {
          basis: "agreed_percentage",
          note: "20% للمشروع",
          allocation: "allocated",
          totalAmountMinor: 3083,
          percentageBps: 2000,
          calculatedShareMinor: 617,
        },
      },
    });
    expect(event.amountMinor).toBe(617);
    expect(event.operatingExpenseDeltaMinor).toBe(617);
    expect(event.expenseContext?.sharedProjectShare).toMatchObject({
      basis: "agreed_percentage",
      totalAmountMinor: 3083,
      percentageBps: 2000,
      calculatedShareMinor: 617,
    });
  });
});

describe("characterization: normalizeSharedProjectShare — unallocated (و٩)", () => {
  it("pins the unallocated needs-review shape with a positive total and no share", () => {
    const event = createFinancialEvent({
      ...eventBase,
      id: "char-unallocated",
      type: "operating_expense_cash",
      amountMinor: 5000,
      idempotencyKey: "char-unallocated",
      expenseContext: {
        relationship: "shared",
        behavior: "mixed",
        purpose: "period",
        knowledge: "needs_review",
        sharedProjectShare: {
          basis: "needs_review",
          note: null,
          allocation: "unallocated",
          totalAmountMinor: 5000,
          percentageBps: null,
          calculatedShareMinor: null,
        },
      },
    });
    expect(event.expenseContext?.sharedProjectShare).toMatchObject({
      allocation: "unallocated",
      basis: "needs_review",
      totalAmountMinor: 5000,
      calculatedShareMinor: null,
    });
    expect(event.operatingExpenseDeltaMinor).toBe(0);
  });
});

describe("characterization: normalizeSharedProjectShare — guards (و٩)", () => {
  it("pins the exact rejection messages of the share guards and the bare fixed-share acceptance", () => {
    const share = (overrides: Record<string, unknown>, knowledge: string = "known") => ({
      ...eventBase,
      id: "char-bad",
      type: "operating_expense_cash" as const,
      amountMinor: 100,
      idempotencyKey: "char-bad",
      expenseContext: {
        relationship: "shared" as const,
        behavior: "mixed" as const,
        purpose: "period" as const,
        knowledge: knowledge as "known",
        sharedProjectShare: overrides as SharedProjectShare,
      },
    });
    /* الحصة الثابتة المتفق عليها بلا إجمالي مقبولة: الأساس يوثق والنص يبقى. */
    expect(() =>
      createFinancialEvent(share({ basis: "agreed_fixed_share", note: null, allocation: "allocated" })),
    ).not.toThrow();
    expect(() =>
      createFinancialEvent(
        share({
          basis: "agreed_percentage",
          note: null,
          allocation: "allocated",
          totalAmountMinor: 1000,
          percentageBps: 0,
          calculatedShareMinor: 0,
        }),
      ),
    ).toThrow("أدخل النسبة قيمة بين 1 و10000.");
    expect(() =>
      createFinancialEvent({
        ...share({
          basis: "agreed_percentage",
          note: null,
          allocation: "allocated",
          totalAmountMinor: 1000,
          percentageBps: 2500,
          calculatedShareMinor: 249,
        }),
        amountMinor: 249,
      }),
    ).toThrow("مدخلات النسبة المشتركة لا تطابق الحصة المحسوبة.");
    expect(() =>
      createFinancialEvent(
        share({
          basis: "owner_estimate",
          note: null,
          allocation: "allocated",
        }),
      ),
    ).toThrow("حصة المصروف المشترك لا تطابق درجة المعرفة المعلنة.");
  });
});

describe("characterization: normalizeSharedProjectShare — allocated review (و٩)", () => {
  it("pins the allocated needs-review refusal when a total is declared without a share", () => {
    expect(() =>
      createFinancialEvent({
        ...eventBase,
        id: "char-bad-3",
        type: "operating_expense_cash",
        amountMinor: 1000,
        idempotencyKey: "char-bad-3",
        expenseContext: {
          relationship: "shared",
          behavior: "mixed",
          purpose: "period",
          knowledge: "needs_review",
          sharedProjectShare: {
            basis: "needs_review",
            note: null,
            allocation: "allocated",
            totalAmountMinor: 1000,
            percentageBps: null,
            calculatedShareMinor: null,
          },
        },
      }),
    ).toThrow("الحصة الموزعة التي تحتاج مراجعة لا تعلن إجماليًا دون حصة محسوبة.");
  });
});

/* ---------- owner-entitlement: createOwnerMovement ---------- */

const movementInput = (
  overrides: Partial<Parameters<typeof createOwnerMovement>[0]> = {},
): CreateOwnerMovementInput => ({
  id: "movement-1",
  kind: "draw" as const,
  amountMinor: 5000,
  walletId: "wallet-1",
  occurredOn: "2026-08-15",
  recordedAt: "2026-08-15T08:00:00.000Z",
  reason: "owner_draw",
  note: "سحب شخصي",
  idempotencyKey: "movement-key",
  relatedEntitlementId: null,
  relatedOpeningBalanceId: null,
  relatedMovementId: null,
  ...overrides,
});

describe("characterization: createOwnerMovement (و٩)", () => {
  it("pins the owner draw deltas: cash and capital down, nothing else moves", () => {
    const draw = createOwnerMovement(movementInput());
    expect(draw).toMatchObject({
      id: "movement-1",
      kind: "draw",
      amountMinor: 5000,
      cashDeltaMinor: -5000,
      entitlementDeltaMinor: 0,
      openingBalanceDeltaMinor: 0,
      ownerCapitalDeltaMinor: -5000,
      reversalOfId: null,
      note: "سحب شخصي",
    });
  });
});

describe("characterization: createOwnerMovement — returns (و٩)", () => {
  it("pins the new capital investment return and the entitlement settlement draw", () => {
    const investment = createOwnerMovement(
      movementInput({ kind: "return", reason: "new_capital_investment", note: "زيادة رأس مال" }),
    );
    expect(investment).toMatchObject({
      cashDeltaMinor: 5000,
      ownerCapitalDeltaMinor: 5000,
      entitlementDeltaMinor: 0,
    });

    const settlement = createOwnerMovement(
      movementInput({
        reason: "entitlement_settlement",
        relatedEntitlementId: "ent-1",
        note: "تسوية حق آب",
      }),
    );
    expect(settlement).toMatchObject({
      cashDeltaMinor: -5000,
      entitlementDeltaMinor: -5000,
      ownerCapitalDeltaMinor: 0,
    });
  });

  it("pins the prior-draw settlement return and the opening-balance settlement deltas", () => {
    const priorSettlement = createOwnerMovement(
      movementInput({ kind: "return", reason: "settlement_of_prior_draw", relatedMovementId: "mv-9" }),
    );
    expect(priorSettlement).toMatchObject({
      cashDeltaMinor: 5000,
      entitlementDeltaMinor: 5000,
      ownerCapitalDeltaMinor: 0,
    });

    const openingDraw = createOwnerMovement(
      movementInput({ reason: "opening_balance_settlement", relatedOpeningBalanceId: "ob-1" }),
    );
    expect(openingDraw).toMatchObject({
      cashDeltaMinor: -5000,
      openingBalanceDeltaMinor: -5000,
      entitlementDeltaMinor: 0,
    });

    const openingReturn = createOwnerMovement(
      movementInput({
        kind: "return",
        reason: "opening_balance_settlement",
        relatedOpeningBalanceId: "ob-1",
      }),
    );
    expect(openingReturn.openingBalanceDeltaMinor).toBe(5000);
  });
});

describe("characterization: createOwnerMovement — guards (و٩)", () => {
  it("pins the exact rejection messages of the movement guards", () => {
    expect(() =>
      createOwnerMovement(movementInput({ kind: "draw", reason: "settlement_of_prior_draw" })),
    ).toThrow("سبب السحب غير صالح.");
    expect(() => createOwnerMovement(movementInput({ kind: "return", reason: "owner_draw" }))).toThrow(
      "سبب الإرجاع غير صالح.",
    );
    expect(() =>
      createOwnerMovement(movementInput({ reason: "entitlement_settlement", relatedEntitlementId: null })),
    ).toThrow("تسوية الحق تتطلب حقًا مسجلًا مرتبطًا.");
    expect(() =>
      createOwnerMovement(movementInput({ reason: "owner_draw", relatedEntitlementId: "ent-1" })),
    ).toThrow("الربط بحق مسجل يخص تسوية الحقوق فقط.");
    expect(() =>
      createOwnerMovement(
        movementInput({ kind: "return", reason: "settlement_of_prior_draw", relatedMovementId: null }),
      ),
    ).toThrow("تسوية السحب تتطلب حركة مرتبطة صريحة.");
    expect(() => createOwnerMovement(movementInput({ amountMinor: 0 }))).toThrow(
      "أدخل المبلغ رقمًا صحيحًا موجبًا.",
    );
  });
});

/* ---------- owner-entitlement: calculateOwnerEntitlement ---------- */

const policyBase = {
  id: "policy-1",
  version: 1,
  family: "time_period" as const,
  kind: "monthly" as const,
  amountMinor: 1500,
  percentageBps: null,
  unitLabel: null,
  startsOn: "2026-08-01",
  endsOn: null,
  source: "اتفاق المالك",
  note: "استحقاق",
  status: "active" as const,
  idempotencyKey: "policy-1",
  createdAt: "2026-08-01T08:00:00.000Z",
};

describe("characterization: calculateOwnerEntitlement (و٩)", () => {
  it("pins the monthly policy on a full calendar month and its partial-month refusal", () => {
    const policy = createOwnerEntitlementPolicy(policyBase);
    expect(
      calculateOwnerEntitlement(policy, { periodFrom: "2026-08-01", periodTo: "2026-08-31" }),
    ).toMatchObject({
      amountMinor: 1500,
      knowledge: "known",
      calculationBasis: "time_period",
      sourceKeys: [],
      nextAction: "راجع الفترة والسياسة المصدر قبل الاعتماد.",
    });
    const partial = calculateOwnerEntitlement(policy, { periodFrom: "2026-08-15", periodTo: "2026-08-31" });
    expect(partial.amountMinor).toBeNull();
    expect(partial.knowledge).toBe("incomplete");
    expect(partial.nextAction).toBe(
      "السياسة الشهرية تحتاج شهرًا تقويميًا كاملًا؛ لا يسجل النظام مبلغ الشهر عن فترة قصيرة أو جزئية.",
    );
  });

  it("pins the weekly seven-day rule and the daily single-day rule", () => {
    const weekly = createOwnerEntitlementPolicy({
      ...policyBase,
      kind: "weekly",
      amountMinor: 400,
      idempotencyKey: "policy-weekly",
    });
    expect(
      calculateOwnerEntitlement(weekly, { periodFrom: "2026-08-03", periodTo: "2026-08-09" }),
    ).toMatchObject({ amountMinor: 400, knowledge: "known" });
    const sixDays = calculateOwnerEntitlement(weekly, { periodFrom: "2026-08-03", periodTo: "2026-08-08" });
    expect(sixDays.amountMinor).toBeNull();
    expect(sixDays.nextAction).toBe(
      "السياسة الأسبوعية تحتاج سبعة أيام متصلة كاملة؛ اختر فترة أسبوع واضحة ولا يسجل النظام أسبوعًا جزئيًا.",
    );

    const daily = createOwnerEntitlementPolicy({
      ...policyBase,
      kind: "daily",
      amountMinor: 100,
      idempotencyKey: "policy-daily",
    });
    expect(
      calculateOwnerEntitlement(daily, { periodFrom: "2026-08-10", periodTo: "2026-08-10" }),
    ).toMatchObject({ amountMinor: 100, knowledge: "known" });
    expect(
      calculateOwnerEntitlement(daily, { periodFrom: "2026-08-10", periodTo: "2026-08-11" }).amountMinor,
    ).toBeNull();
  });
});

describe("characterization: calculateOwnerEntitlement — hourly (و٩)", () => {
  it("pins the hourly rounding to the nearest minor and its missing-evidence refusal", () => {
    const hourly = createOwnerEntitlementPolicy({
      ...policyBase,
      kind: "hourly",
      amountMinor: 250,
      idempotencyKey: "policy-hourly",
    });
    expect(
      calculateOwnerEntitlement(hourly, {
        periodFrom: "2026-08-01",
        periodTo: "2026-08-31",
        timeQuantity: 90,
        timeSourceKeys: ["time:1"],
      }),
    ).toMatchObject({ amountMinor: 375, knowledge: "known", baseMinor: 90, quantity: 90 });
    expect(
      calculateOwnerEntitlement(hourly, {
        periodFrom: "2026-08-01",
        periodTo: "2026-08-31",
        timeQuantity: null,
      }),
    ).toMatchObject({ amountMinor: null, knowledge: "incomplete" });
  });
});

describe("characterization: calculateOwnerEntitlement — work and units (و٩)", () => {
  it("pins the per-completed-work counting and its duplicate-keys refusal", () => {
    const perWork = createOwnerEntitlementPolicy({
      ...policyBase,
      family: "completed_work",
      kind: "per_completed_work",
      amountMinor: 200,
      unitLabel: "طلب",
      idempotencyKey: "policy-work",
    });
    expect(
      calculateOwnerEntitlement(perWork, {
        periodFrom: "2026-08-01",
        periodTo: "2026-08-31",
        completedWorkCount: 3,
        completedWorkKeys: ["order:1", "order:2", "order:3"],
      }),
    ).toMatchObject({ amountMinor: 600, knowledge: "known", baseMinor: 200, quantity: 3 });
    expect(
      calculateOwnerEntitlement(perWork, {
        periodFrom: "2026-08-01",
        periodTo: "2026-08-31",
        completedWorkCount: 2,
        completedWorkKeys: ["order:1", "order:1"],
      }).amountMinor,
    ).toBeNull();
  });
});

describe("characterization: calculateOwnerEntitlement — units and profit (و٩)", () => {
  it("pins the per-unit milli rounding and the profit-share percentage rounding", () => {
    const perUnit = createOwnerEntitlementPolicy({
      ...policyBase,
      family: "unit",
      kind: "per_unit",
      amountMinor: 350,
      unitLabel: "قطعة",
      idempotencyKey: "policy-unit",
    });
    expect(
      calculateOwnerEntitlement(perUnit, {
        periodFrom: "2026-08-01",
        periodTo: "2026-08-31",
        unitQuantity: 2.5,
        unitSourceKeys: ["unit:1"],
      }),
    ).toMatchObject({ amountMinor: 875, knowledge: "known", baseMinor: 350, quantity: 2.5 });

    const profitShare = createOwnerEntitlementPolicy({
      ...policyBase,
      family: "profit_share",
      kind: "profit_share",
      amountMinor: null,
      percentageBps: 2500,
      idempotencyKey: "policy-profit",
    });
    expect(
      calculateOwnerEntitlement(profitShare, {
        periodFrom: "2026-08-01",
        periodTo: "2026-08-31",
        recognizedProfitMinor: 3000,
        recognizedProfitStatus: "recorded_only",
        recognizedProfitKeys: ["g3:a"],
      }),
    ).toMatchObject({ amountMinor: 750, knowledge: "known", baseMinor: 3000 });
    expect(
      calculateOwnerEntitlement(profitShare, {
        periodFrom: "2026-08-01",
        periodTo: "2026-08-31",
        recognizedProfitMinor: 3000,
        recognizedProfitStatus: "incomplete",
      }).amountMinor,
    ).toBeNull();
  });
});

describe("characterization: calculateOwnerEntitlement — sale and fixed (و٩)", () => {
  it("pins the sale-percentage basis and the fixed-period exact-range rule", () => {
    const salePercentage = createOwnerEntitlementPolicy({
      ...policyBase,
      family: "completed_sale_percentage",
      kind: "sale_percentage",
      amountMinor: null,
      percentageBps: 1000,
      idempotencyKey: "policy-sale",
    });
    expect(
      calculateOwnerEntitlement(salePercentage, {
        periodFrom: "2026-08-01",
        periodTo: "2026-08-31",
        completedSaleMinor: 10000,
        completedSaleKeys: ["sale:1"],
      }),
    ).toMatchObject({ amountMinor: 1000, knowledge: "known", calculationBasis: "completed_sale_percentage" });

    const fixedPeriod = createOwnerEntitlementPolicy({
      ...policyBase,
      family: "fixed_amount",
      kind: "fixed_period",
      amountMinor: 5000,
      startsOn: "2026-08-01",
      endsOn: "2026-08-31",
      idempotencyKey: "policy-fixed",
    });
    expect(
      calculateOwnerEntitlement(fixedPeriod, { periodFrom: "2026-08-01", periodTo: "2026-08-31" }),
    ).toMatchObject({ amountMinor: 5000, knowledge: "known", calculationBasis: "fixed_amount" });
    expect(
      calculateOwnerEntitlement(fixedPeriod, { periodFrom: "2026-08-01", periodTo: "2026-08-30" })
        .amountMinor,
    ).toBeNull();
  });
});

/* ---------- recurring-margin: calculateAllocationPolicy ---------- */

const allocationEvidence = {
  catalogItemId: "catalog-1",
  periodFrom: "2026-08-01",
  periodTo: "2026-08-31",
  finalOrderIds: ["order-1", "order-2"],
  excludedOrderIds: [],
  outputQuantityMilli: 5_000,
  outputUnitId: "unit-piece",
  actualTimeMinutes: 10,
  missingTimeOrderIds: [],
  recognizedRevenueMinor: 10_000,
  missingRevenueOrderIds: [],
  directMarginMinor: 4_000,
};
const allocationBase = {
  id: "policy",
  seriesId: "series",
  successorOfPolicyId: null,
  version: 1,
  catalogItemId: "catalog-1",
  periodFrom: "2026-08-01",
  periodTo: "2026-08-31",
  startsOn: "2026-08-01",
  endsOn: "2026-08-31",
  source: "اختبار",
  reason: "سبب",
  note: "ملاحظة",
  status: "active" as const,
  idempotencyKey: "policy-key",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("characterization: calculateAllocationPolicy (و٩)", () => {
  it("pins the manual amount reading and its post-allocation result", () => {
    const result = calculateAllocationPolicy(
      createAllocationPolicy({
        ...allocationBase,
        kind: "manual_amount",
        amountMinor: 250,
        rateMinor: null,
        percentageBps: null,
        unitId: null,
      }),
      allocationEvidence,
    );
    expect(result).toMatchObject({
      status: "known",
      amountMinor: 250,
      directMarginMinor: 4000,
      resultMinor: 3750,
      excluded: [],
      reasons: [],
      calculationNote: "مبلغ يدوي معلن للفترة.",
      nextAction:
        "راجع السياسة والمصادر الداخلة قبل اتخاذ قرار جديد؛ هذا الرقم ليس صافي ربح نهائيًا أو توصية سعر.",
      truth: "هذا الربح بعد التوزيع حسب سياستك، وليس صافي ربح نهائيًا أو توصية سعر.",
    });
  });

  it("pins the per-output-unit calculation note with the announced rounding", () => {
    const result = calculateAllocationPolicy(
      createAllocationPolicy({
        ...allocationBase,
        kind: "per_output_unit",
        amountMinor: null,
        rateMinorPerWholeUnit: 100,
        rateMinor: null,
        percentageBps: null,
        unitId: "unit-piece",
      }),
      allocationEvidence,
    );
    expect(result.status).toBe("known");
    expect(result.amountMinor).toBe(500);
    expect(result.resultMinor).toBe(3500);
    expect(result.calculationNote).toBe(
      "إجمالي الناتج 5.000 وحدة كاملة؛ المعدل 1.00 د.أ لكل 1.000 وحدة؛ قُرّب مجموع الفترة مرة واحدة إلى أقرب قرش.",
    );
  });
});

describe("characterization: calculateAllocationPolicy — time and revenue (و٩)", () => {
  it("pins the actual-time and completed-revenue-percentage readings", () => {
    const time = calculateAllocationPolicy(
      createAllocationPolicy({
        ...allocationBase,
        kind: "actual_time",
        amountMinor: null,
        rateMinor: 50,
        rateMinorPerWholeUnit: null,
        percentageBps: null,
        unitId: null,
      }),
      allocationEvidence,
    );
    expect(time).toMatchObject({ status: "known", amountMinor: 500, resultMinor: 3500 });
    expect(time.calculationNote).toBe("المعدل 0.50 د.أ لكل دقيقة فعلية.");

    const revenue = calculateAllocationPolicy(
      createAllocationPolicy({
        ...allocationBase,
        kind: "completed_revenue_percentage",
        amountMinor: null,
        rateMinor: null,
        rateMinorPerWholeUnit: null,
        percentageBps: 1500,
        unitId: null,
      }),
      allocationEvidence,
    );
    expect(revenue).toMatchObject({ status: "known", amountMinor: 1500, resultMinor: 2500 });
    expect(revenue.calculationNote).toBe("النسبة 15.00% من الإيراد المكتمل والمحتسب عند التسليم.");
  });
});

describe("characterization: calculateAllocationPolicy — guards (و٩)", () => {
  it("pins the range-coverage refusal and the no-final-orders refusal", () => {
    const policy = createAllocationPolicy({
      ...allocationBase,
      kind: "manual_amount",
      amountMinor: 250,
      rateMinor: null,
      percentageBps: null,
      unitId: null,
    });
    const outside = calculateAllocationPolicy(policy, {
      ...allocationEvidence,
      catalogItemId: "catalog-other",
    });
    expect(outside).toMatchObject({
      status: "incomplete",
      amountMinor: null,
      resultMinor: null,
      reasons: ["نطاق السياسة لا يغطي الفترة أو مرجع العمل المطلوب."],
      nextAction: "أنشئ أو راجع سياسة مؤرخة تغطي مرجع العمل والفترة كاملة.",
    });

    const noOrders = calculateAllocationPolicy(policy, {
      ...allocationEvidence,
      finalOrderIds: [],
    });
    expect(noOrders.reasons).toEqual(["لا توجد طلبات نهائية مرتبطة صراحة بهذا المرجع في الفترة."]);
  });

  it("pins the unit-mismatch refusal for per-output-unit without a matching unit", () => {
    const result = calculateAllocationPolicy(
      createAllocationPolicy({
        ...allocationBase,
        kind: "per_output_unit",
        amountMinor: null,
        rateMinorPerWholeUnit: 100,
        rateMinor: null,
        percentageBps: null,
        unitId: "unit-other",
      }),
      allocationEvidence,
    );
    expect(result.status).toBe("incomplete");
    expect(result.reasons).toContain(
      "أكمل كمية الناتج بوحدة منظمة متوافقة مع سياسة التوزيع لكل وحدة؛ لا نحول أو نخمن الناتج.",
    );
  });
});
