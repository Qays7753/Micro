/* F-058 (REM-004 — W4-F): حوامل العقود المستقلة — عقد ٢ وعقد ٥.
 * القاعدة (ميثاق الموجة ٤، البند 2-هـ): العهدة تُحسب يدويًا ولا تُنسخ من
 * معادلة الإنتاج أبدًا — الأرقام هنا ثوابت مكتوبة من قراءة العقد، وأي انحراف
 * في سلوك الدومين أو القارئ يفشل بالاسم. جزء الوثيقة يثبّت أن جُمل القواعد
 * الملزمة موجودة في العقدين (إزالة صامتة = فشل)؛ وجزء العهدة يثبت أن
 * السلوك يطابقها. عقد ٢ = قواعد دورة حياة الطلب «لا يجوز كسرها» §47؛
 * عقد ٥ §3.2.1 = معادلة نتيجة الفترة المسجلة بتسعة بنود (نص W2-D). */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  cancelOrder,
  collectDeposit,
  collectRegisteredDebt,
  createCraftOrder,
  calculateCostSnapshot,
  recordDeliveryTerms,
  registerDebt,
  orderValueMinor,
  transitionOrder,
  type CraftOrder,
  type CostSnapshot,
} from "@micro-domain/craft-order/index.js";

function readRepoFile(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

const NOW = "2026-09-05T09:00:00.000Z";

function handCostSnapshot(id: string): CostSnapshot {
  /* يدويًا: مادة 2.00 (2×1.00) + وقت 2.00 (60د×2.00) = مخطط 4.00 معروف. */
  return calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    source: "draft",
    materialItems: [
      {
        name: "خشب",
        quantity: 2,
        unit: "قطعة",
        unitPriceMinor: 100,
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
}

function handOrder(id: string, priceMinor: number): CraftOrder {
  return createCraftOrder({
    id,
    customerName: "سارة",
    itemName: "رف خشبي",
    specifications: "مقاس كبير",
    quantity: 1,
    agreedPriceMinor: priceMinor,
    costSnapshot: handCostSnapshot(id),
    createdAt: NOW,
  });
}

function confirm(order: CraftOrder, key: string): CraftOrder {
  let next = transitionOrder(order, {
    to: "provisional_agreement",
    idempotencyKey: `${key}-provisional`,
    createdAt: "2026-09-05T09:04:00.000Z",
  });
  next = transitionOrder(next, {
    to: "confirmed",
    idempotencyKey: key,
    createdAt: "2026-09-05T09:05:00.000Z",
  });
  return transitionOrder(next, {
    to: "in_progress",
    idempotencyKey: `${key}-progress`,
    createdAt: "2026-09-05T09:06:00.000Z",
  });
}

function deliver(order: CraftOrder, key: string): CraftOrder {
  const ready = transitionOrder(order, {
    to: "ready",
    idempotencyKey: `${key}-ready`,
    createdAt: "2026-09-05T23:00:00.000Z",
  });
  return transitionOrder(ready, {
    to: "delivered",
    idempotencyKey: key,
    createdAt: "2026-09-06T09:00:00.000Z",
  });
}

const feeTerms = (feeChargedMinor: number | null, feeIncludedInPrice: boolean) => ({
  responsibility: "customer_pays_project" as const,
  feeIncludedInPrice,
  costIncludedInProductCost: false,
  feeChargedMinor,
  costPaidMinor: 0,
  projectShareMinor: null,
  customerShareMinor: null,
  idempotencyKey: "oracle-terms",
  createdAt: "2026-09-05T09:10:00.000Z",
});

describe("F-058 — عقد ٢ (دورة حياة الطلب): القواعد الملزمة موجودة وسلوك الدومين يطابقها", () => {
  it("the unbreakable-rules section still carries its binding sentences (doc freeze)", () => {
    const contract02 = readRepoFile("../../../../docs/contracts/02-order-lifecycle-contract.md");
    const rules = contract02.slice(contract02.indexOf("## قواعد لا يجوز كسرها"));
    expect(rules).toContain("تأكيد الطلب لا يقبض المال.");
    expect(rules).toContain("تسجيل العربون لا يجعل الطلب مسوى.");
    expect(rules).toContain("التسليم لا يسجل قبضًا تلقائيًا.");
    expect(rules).toContain("الإلغاء لا يحذف الطلب أو أحداثه");
    expect(contract02).toContain("الأجرة المسجلة عبر المشروع تدخل قيمة الطلب القابلة للتحصيل مرة واحدة");
  });

  it("oracle 02-A: تأكيد الطلب لا يقبض المال — collected يبقى صفرًا", () => {
    const confirmed = confirm(handOrder("oracle-confirm", 1450), "oracle-confirm-key");
    expect(confirmed.collectedMinor).toBe(0);
    expect(confirmed.events.some(event => event.type === "collection_recorded")).toBe(false);
  });

  it("oracle 02-B: تسجيل العربون لا يجعل الطلب مسوى — التسوية تبقى غير مسددة", () => {
    const deposited = collectDeposit(
      confirm(handOrder("oracle-deposit", 1450), "oracle-deposit-key"),
      200,
      "oracle-deposit",
      "2026-09-05T09:15:00.000Z",
    );
    expect(deposited.settlementStatus).not.toBe("settled");
    expect(deposited.settlementStatus).not.toBe("paid");
    expect(deposited.receivableMinor).toBe(1250); /* يدويًا: 1450 − 200. */
  });

  it("oracle 02-C: التسليم لا يسجل قبضًا تلقائيًا — المقبوض يبقى العربون فقط", () => {
    const deposited = collectDeposit(
      confirm(handOrder("oracle-deliver", 1450), "oracle-deliver-key"),
      200,
      "oracle-deliver-dep",
      "2026-09-05T09:15:00.000Z",
    );
    const delivered = deliver(deposited, "oracle-deliver-done");
    expect(delivered.collectedMinor).toBe(200);
    expect(delivered.events.filter(event => event.type === "collection_recorded")).toHaveLength(0);
  });

  it("oracle 02-D: أجرة المشروع تدخل القيمة القابلة للتحصيل مرة واحدة — لا تكرار ولا إسقاط", () => {
    /* يدويًا: سعر 14.50 + أجرة مسجلة 3.00 = 17.50 قابلة للتحصيل. */
    const withFee = recordDeliveryTerms(handOrder("oracle-fee", 1450), feeTerms(300, false));
    expect(orderValueMinor(withFee)).toBe(1750);
    /* المرة الواحدة: الأجرة المحتواة أصلًا في السعر لا تُضاف ثانية — القيمة
     * تبقى 14.50 لا 17.50 (إضافتها كانت ستكون الاحتساب المزدوج المحظور). */
    const included = recordDeliveryTerms(handOrder("oracle-fee-incl", 1450), feeTerms(300, true));
    expect(orderValueMinor(included)).toBe(1450);
    /* وبلا أجرة مسجلة أصلًا: القيمة هي السعر وحده. */
    expect(orderValueMinor(handOrder("oracle-fee-none", 1450))).toBe(1450);
  });

  it("oracle 02-E: سقف القبض من القيمة القابلة للتحصيل شاملًا الأجرة — لا تجاوز صامت", () => {
    const base = registerDebt(
      deliver(
        confirm(recordDeliveryTerms(handOrder("oracle-cap", 1450), feeTerms(300, false)), "oracle-cap-key"),
        "oracle-cap-delivered",
      ),
      "oracle-cap-debt",
      "2026-09-06T09:30:00.000Z",
    );
    /* يدويًا: القيمة 17.50 — الدين المسجل عليها يُقبض كاملًا بنجاح، وقرشٌ فوقها يُرفض. */
    const collected = collectRegisteredDebt(base, 1750, "oracle-cap-collect", "2026-09-07T09:00:00.000Z");
    expect(collected.collectedMinor).toBe(1750);
    expect(collected.settlementStatus).toBe("paid");
    expect(() => collectRegisteredDebt(base, 1751, "oracle-cap-over", "2026-09-07T09:05:00.000Z")).toThrow();
  });

  it("oracle 02-F: الدفع كاملًا قبل التسليم — التسليم يسجل التسوية بحدثين واضحين", () => {
    const paid = collectDeposit(
      confirm(handOrder("oracle-settled", 4000), "oracle-settled-key"),
      4000,
      "oracle-settled-dep",
      "2026-09-05T09:20:00.000Z",
    );
    const delivered = deliver(paid, "oracle-settled-done");
    expect(delivered.status).toBe("settled");
    const statusEvents = delivered.events.filter(event => event.type === "status_changed");
    /* حدثان واضحان كما يوثق العقد: التسليم (ready ← delivered) والتسوية
     * المرافقة (delivered ← settled) — الترتيب داخل المصفوفة تفصيل تنفيذ
     * (التسوية تُلحق قبل حدث التسليم الأساسي)، والوجود والوضوح هما الملزمان. */
    const deliveryEvent = statusEvents.find(event => event.toStatus === "delivered");
    const settlementEvent = statusEvents.find(
      event => event.fromStatus === "delivered" && event.toStatus === "settled",
    );
    expect(deliveryEvent).toBeDefined();
    expect(deliveryEvent?.fromStatus).toBe("ready");
    expect(settlementEvent).toBeDefined();
  });

  it("oracle 02-G: الإلغاء لا يحذف الطلب ولا أحداثه — ينشئ أثرًا لا محوًا", () => {
    const deposited = collectDeposit(
      confirm(handOrder("oracle-cancel", 1450), "oracle-cancel-key"),
      200,
      "oracle-cancel-dep",
      "2026-09-05T09:25:00.000Z",
    );
    const eventsBefore = deposited.events.length;
    const cancelled = cancelOrder(deposited, "العميلة ألغت", "oracle-cancel-op", "2026-09-05T09:30:00.000Z");
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.events.length).toBeGreaterThan(eventsBefore); /* الأثر يُضاف، لا يُحذف. */
    expect(cancelled.depositSettlement).toBe("needs_review"); /* عربون بلا تسوية صريحة. */
  });
});

describe("F-058 — عقد ٥ §3.2.1 (نتيجة الفترة المسجلة): التسعة بنود موجودة والمعادلة تُجمع بالعلامات الصحيحة", () => {
  it("the nine-term equation and its exclusion rule still carry their sentences (doc freeze)", () => {
    const contract05 = readRepoFile("../../../../docs/contracts/05-financial-p0-policies.md");
    const equation = contract05.slice(
      contract05.indexOf("### 3.2.1"),
      contract05.indexOf("تاريخ إدخال الطلب في الفترة"),
    );
    for (const term of [
      "recognizedRevenueMinor",
      "directSaleRevenueMinor",
      "effectiveDirectCostMinor",
      "directSaleCostKnownMinor",
      "recordedOperatingExpenseMinor",
      "nonCashLossMinor",
      "assetDepreciationMinor",
      "assetWriteOffLossMinor",
      "assetDisposalResultMinor",
      "retainedDepositRevenueMinor",
    ]) {
      expect(equation).toContain(term);
    }
    expect(contract05).toContain("لا تدخل الاستثمارات أو السحوبات الشخصية أو الكاش أو الذمم");
  });

  it("oracle 05-A: تسعة بنود محسوبة يدويًا تُجمع بالقيم والعلامات الموثقة", async () => {
    /* المشهد (كل الأرقام مكتوبة يدويًا من العقد — لا تُشتق من كود الإنتاج):
     * طلب نهائي مسلّم: سعر 14.50 + أجرة مسجلة عبر المشروع 3.00 = إيراد معترف 17.50،
     * تكلفة مباشرة (لقطة معروفة) 6.00. بيع مباشر نشط: إيراد 3.00 بتكلفة معروفة 1.20.
     * مصروف تشغيلي مدفوع 0.50. خسارة غير نقدية 0.05. إهلاك مسجل 0.08 (أصل 0.96
     * على ١٢ شهرًا، شهر واحد). شطب أصل 0.03. تخلص: مقابل 1.00 عن دفتري 0.88
     * (0.96 − 0.08) = ربح 0.12. عربون محتفظ مصنف إيرادًا 0.20.
     * المعادلة: 17.50 + 3.00 − 6.00 − 1.20 − 0.50 − 0.05 − 0.08 − 0.03 + 0.12 + 0.20 = 12.96 */
    const { MemoryLocalStore } = await import("@/storage/local/MemoryLocalStore");
    const { ProjectFinancialService } = await import("@/application/finance/projectFinancialService");
    const { DirectSaleService } = await import("@/application/direct-sales/directSaleService");
    const { AssetService } = await import("@/application/assets/assetService");
    const { RetainedDepositService } = await import("@/application/finance/retainedDepositService");
    const { settleDepositRetain } = await import("@micro-domain/craft-order/index.js");

    const now = () => "2026-09-20T09:00:00.000Z";
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const directSales = new DirectSaleService(store, now);
    const assets = new AssetService(store, now);
    const retainedDeposits = new RetainedDepositService(store, now);

    /* ١ — الطلب النهائي: سعر 14.50 + أجرة 3.00، تكلفة معروفة 6.00
     * (مادة 2.00 = 2×1.00 + وقت 4.00 = ساعتان×2.00 — يدويًا). */
    const orderCost = calculateCostSnapshot("oracle05-cost", {
      currency: "JOD",
      source: "draft",
      materialItems: [
        {
          name: "خشب",
          quantity: 2,
          unit: "قطعة",
          unitPriceMinor: 100,
          priceDate: "2026-09-01",
          source: "user_input",
          confidence: "known",
        },
      ],
      time: { minutes: 120, hourlyRateMinor: 200, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-09-02T09:00:00.000Z",
      freshnessDays: null,
    });
    let order = createCraftOrder({
      id: "oracle05-order",
      customerName: "سارة",
      itemName: "خزانة",
      specifications: "معادلة التسعة بنود",
      quantity: 1,
      agreedPriceMinor: 1450,
      costSnapshot: orderCost,
      createdAt: "2026-09-02T09:05:00.000Z",
    });
    order = recordDeliveryTerms(order, {
      responsibility: "customer_pays_project",
      feeIncludedInPrice: false,
      costIncludedInProductCost: false,
      feeChargedMinor: 300,
      costPaidMinor: 0,
      projectShareMinor: null,
      customerShareMinor: null,
      idempotencyKey: "oracle05-terms",
      createdAt: "2026-09-02T09:10:00.000Z",
    });
    for (const [to, stamp] of [
      ["provisional_agreement", "2026-09-02T09:15:00.000Z"],
      ["confirmed", "2026-09-02T09:20:00.000Z"],
      ["in_progress", "2026-09-03T09:00:00.000Z"],
      ["ready", "2026-09-04T09:00:00.000Z"],
      ["delivered", "2026-09-05T09:00:00.000Z"],
    ] as const)
      order = transitionOrder(order, { to, idempotencyKey: `oracle05-${to}`, createdAt: stamp });
    const stored = await store.saveOrder({
      id: order.id,
      order,
      deliveryDate: "2026-09-05",
      agreementSource: "test",
      createdAt: order.createdAt,
      updatedAt: now(),
    });
    if (!stored.ok) throw new Error(stored.message);

    /* ٢ — بيع مباشر نشط: 3.00 بتكلفة معروفة 1.20، بتاريخ البيع داخل الفترة. */
    const sale = await directSales.record({
      itemName: "قطعة صغيرة",
      quantity: 1,
      revenueMinor: 300,
      collectedMinor: 300,
      costMinor: 120,
      occurredOn: "2026-09-10",
      note: "بيع نقدي موثق",
      idempotencyKey: "oracle05-sale",
    });
    if (!sale.ok) throw new Error(sale.message);

    /* ٣ — مصروف تشغيلي مدفوع 0.50 وخسارة غير نقدية 0.05. */
    const expense = await finance.record({
      type: "operating_expense_cash",
      amountMinor: 50,
      occurredOn: "2026-09-11",
      note: "تغليف",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "variable",
        purpose: "project_general",
        knowledge: "known",
      },
      idempotencyKey: "oracle05-expense",
    });
    if (!expense.ok) throw new Error(expense.message);
    const loss = await finance.record({
      type: "loss_non_cash",
      amountMinor: 5,
      occurredOn: "2026-09-12",
      note: "تالف بلا نقدي",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "oracle05-loss",
    });
    if (!loss.ok) throw new Error(loss.message);

    /* ٤ — أصل الإهلاك/التخلص: اقتناء 0.96 (نقدي)، عمر ١٢ شهرًا، بداية الاستخدام
     * 2026-08-01 → إهلاك شهر واحد حتى 2026-09-30 = 0.08؛ الدفتري بعده 0.88. */
    const assetA = await assets.create({
      name: "مثقاب",
      categoryLabel: null,
      acquisitionAmountMinor: 96,
      acquisitionKind: "cash",
      purchaseDate: "2026-08-01",
      lifeMonths: 12,
      depreciationStartOn: "2026-08-01",
      residualValueMinor: null,
      note: null,
    });
    if (!assetA.ok) throw new Error(assetA.message);
    const depreciation = await assets.recordDepreciation(assetA.value.asset.id, {
      asOf: "2026-09-30",
    });
    if (!depreciation.ok) throw new Error(depreciation.message);
    const disposal = await assets.dispose(assetA.value.asset.id, {
      proceedsMinor: 100,
      on: "2026-09-28",
      reason: "بيع المثقاب",
    });
    if (!disposal.ok) throw new Error(disposal.message ?? "asset disposal failed");

    /* ٥ — أصل الشطب: اقتناء 0.03، يُشطب بكامل دفتريه (لا إهلاك مسجل). */
    const assetB = await assets.create({
      name: "قالب صغير",
      categoryLabel: null,
      acquisitionAmountMinor: 3,
      acquisitionKind: "cash",
      purchaseDate: "2026-09-01",
      lifeMonths: 12,
      depreciationStartOn: "2026-09-01",
      residualValueMinor: null,
      note: null,
    });
    if (!assetB.ok) throw new Error(assetB.message);
    const writeOff = await assets.writeOff(assetB.value.asset.id, {
      on: "2026-09-15",
      reason: "مفقود",
    });
    if (!writeOff.ok) throw new Error(writeOff.message);

    /* ٦ — عربون محتفظ 0.20: طلب ملغى بعربون، تنازل ثم تصنيف إيرادًا. */
    let retained = createCraftOrder({
      id: "oracle05-retained",
      customerName: "ليلى",
      itemName: "شحنة",
      specifications: "عربون محتفظ",
      quantity: 1,
      agreedPriceMinor: 400,
      costSnapshot: orderCost,
      createdAt: "2026-09-06T09:00:00.000Z",
    });
    retained = collectDeposit(retained, 20, "oracle05-retained-dep", "2026-09-06T09:10:00.000Z");
    retained = cancelOrder(retained, "ألغت", "oracle05-retained-cancel", "2026-09-07T09:00:00.000Z");
    retained = settleDepositRetain(
      retained,
      20,
      "تنازل",
      "oracle05-retained-keep",
      "2026-09-08T09:00:00.000Z",
    );
    const savedRetained = await store.saveOrder({
      id: retained.id,
      order: retained,
      deliveryDate: null,
      agreementSource: "test",
      createdAt: retained.createdAt,
      updatedAt: now(),
    });
    if (!savedRetained.ok) throw new Error(savedRetained.message);
    const classified = await retainedDeposits.classify(retained.id, "revenue", "إيراد عربون محتفظ");
    if (!classified.ok) throw new Error(classified.message);

    /* العهدة اليدوية: كل بند بالقيمة والعلامة الموثقة في عقد ٥ §3.2.1. */
    const period = await finance.readRecordedPeriodResult("2026-09-01", "2026-09-30");
    if (!period.ok) throw new Error(period.message);
    const result = period.value;
    expect(result.recognizedRevenueMinor).toBe(1750);
    expect(result.directSaleRevenueMinor).toBe(300);
    expect(result.effectiveDirectCostMinor).toBe(600);
    expect(result.directSaleCostKnownMinor).toBe(120);
    expect(result.recordedOperatingExpenseMinor).toBe(50);
    expect(result.nonCashLossMinor).toBe(5);
    expect(result.assetDepreciationMinor).toBe(8);
    expect(result.assetWriteOffLossMinor).toBe(3);
    expect(result.assetDisposalResultMinor).toBe(12);
    expect(result.retainedDepositRevenueMinor).toBe(20);
    /* 17.50 + 3.00 − 6.00 − 1.20 − 0.50 − 0.05 − 0.08 − 0.03 + 0.12 + 0.20 = 12.96 */
    expect(result.resultMinor).toBe(1296);
  });
});
