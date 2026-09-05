import { describe, expect, it } from "vitest";
import { IntegrityCheckService } from "@/application/finance/integrityCheckService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { StatementService } from "@/application/finance/statementService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { localExportVersion, localSchemaVersion } from "@/storage/local/types";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { AssetService } from "@/application/assets/assetService";
import { LoanService } from "@/application/loans/loanService";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";

const now = () => "2026-09-03T09:00:00.000Z";

/* المجموعة ١ (فحص سلامة مالي — MIC-1/2/4/7/9): الفحص قراءة فقط — لقطة المخزن
 * قبل وبعد متطابقة حتى مع وجود تلف؛ كل فحص مشتق من قاعدة مجال مختبرة لا من
 * تخمين؛ الحالات المعلنة (تقدير/تأجيل/رصيد محفظة سالب من سحب المالك) تحذير
 * لا خللًا؛ والتلف المزروع يُكتشف بمعرّفه. */

function buildServices(store: MemoryLocalStore) {
  const projectFinance = new ProjectFinancialService(store, now);
  const statement = new StatementService(store, projectFinance);
  const cashContinuity = new CashContinuityService(store, now);
  const integrityCheck = new IntegrityCheckService(store, projectFinance, statement, cashContinuity, now);
  /* المجموعة ٤ (عقد ٢٩): الأصول والقروض فوق المخزن نفسه لفحوص MIC-10/11. */
  const assets = new AssetService(store, now);
  const loans = new LoanService(store, now);
  return { projectFinance, statement, cashContinuity, integrityCheck, assets, loans };
}

async function cleanStore(): Promise<{
  store: MemoryLocalStore;
  services: ReturnType<typeof buildServices>;
}> {
  const store = new MemoryLocalStore();
  const services = buildServices(store);
  await services.projectFinance.record({
    type: "owner_investment_cash",
    amountMinor: 100000,
    occurredOn: "2026-09-01",
    note: "استثمار افتتاحي",
    counterparty: null,
    relatedEventId: null,
    idempotencyKey: "integrity-inv",
  });
  await services.projectFinance.record({
    type: "operating_expense_cash",
    amountMinor: 2500,
    occurredOn: "2026-09-02",
    note: "بنزين",
    counterparty: null,
    relatedEventId: null,
    expenseContext: {
      relationship: "project",
      behavior: "variable",
      purpose: "project_general",
      knowledge: "known",
      sharedProjectShare: null,
      categoryLabel: "بنزين",
    },
    idempotencyKey: "integrity-expense",
  });
  await services.cashContinuity.openWallet({
    name: "الدرج",
    kind: "cash_drawer",
    openingMinor: 0,
    occurredOn: "2026-09-01",
    note: "بداية",
    operationKey: "integrity-drawer",
  });
  return { store, services };
}

async function snapshotOf(store: MemoryLocalStore): Promise<string> {
  const snapshot = await store.readSnapshot();
  if (!snapshot.ok) throw new Error(snapshot.message);
  return JSON.stringify(snapshot.value);
}

describe("integrity check service (فحص سلامة مالي)", () => {
  it("clean store: all checks PASS and the run writes nothing (snapshot identical)", async () => {
    const { store, services } = await cleanStore();
    const before = await snapshotOf(store);
    const report = await services.integrityCheck.run();
    const after = await snapshotOf(store);
    expect(after).toBe(before);
    expect(report.overall).toBe("PASS");
    /* المجموعة ٢ (عقد ٢٨): MIC-8 (سلامة المخزون والمواد) ينضم للفحوص القراءة فقط. */
    expect(report.checks.map(check => check.id)).toEqual([
      "MIC-1",
      "MIC-2",
      "MIC-4",
      "MIC-7",
      "MIC-8",
      "MIC-9",
      "MIC-10",
      "MIC-11",
      "MIC-12",
      "MIC-13",
      /* المجموعة ٥ (عقد ٣٥): فحوص الاستمرارية الثلاثة تنضم للفحوص القراءة فقط. */
      "MIC-14",
      "MIC-15",
      "MIC-16",
    ]);
    for (const check of report.checks) expect(check.status).toBe("PASS");
  });

  it("tampered event deltas: MIC-4 FAIL with the offender id — still zero writes", async () => {
    const { store, services } = await cleanStore();
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    const expense = events.value.find(event => event.type === "operating_expense_cash");
    if (!expense) throw new Error("expense missing");
    const tampered: FinancialEvent = {
      ...expense,
      cashDeltaMinor: expense.cashDeltaMinor + 500,
      operatingExpenseDeltaMinor: expense.operatingExpenseDeltaMinor,
    };
    await store.saveFinancialEvent(tampered);
    const before = await snapshotOf(store);
    const report = await services.integrityCheck.run();
    const after = await snapshotOf(store);
    expect(after).toBe(before);
    const mic4 = report.checks.find(check => check.id === "MIC-4");
    expect(mic4?.status).toBe("FAIL");
    expect(mic4?.offenderCount).toBe(1);
    expect(mic4?.offenderSampleIds).toContain(expense.id);
    expect(report.overall).toBe("FAIL");
  });

  it("tampered share percentage: re-derivation catches the drift (MIC-4 FAIL)", async () => {
    const store = new MemoryLocalStore();
    const services = buildServices(store);
    const recorded = await services.projectFinance.record({
      type: "operating_expense_cash",
      amountMinor: 6000,
      occurredOn: "2026-09-02",
      note: "حصة معلنة",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "shared",
        behavior: "variable",
        purpose: "project_general",
        knowledge: "known",
        sharedProjectShare: {
          basis: "agreed_percentage",
          note: null,
          allocation: "allocated",
          totalAmountMinor: 10000,
          percentageBps: 6000,
          calculatedShareMinor: 6000,
        },
      },
      sharedExpense: { mode: "percentage", sharedTotalAmountMinor: 10000, sharedPercentageBps: 6000 },
      idempotencyKey: "integrity-share",
    });
    if (!recorded.ok) throw new Error(recorded.message);
    const tamperedContext = {
      ...recorded.value.expenseContext!,
      sharedProjectShare: {
        ...recorded.value.expenseContext!.sharedProjectShare!,
        percentageBps: 7000,
      },
    };
    await store.saveFinancialEvent({ ...recorded.value, expenseContext: tamperedContext });
    const report = await services.integrityCheck.run();
    const mic4 = report.checks.find(check => check.id === "MIC-4");
    expect(mic4?.status).toBe("FAIL");
  });

  it("negative amanah via direct store write: MIC-7 FAIL (import-bypass detector)", async () => {
    const store = new MemoryLocalStore();
    const services = buildServices(store);
    /* كتابة خام تتجاوز حراسة المسار الحي: تسليم بلا قبض — يستحيل بالتطبيق،
     * ممكن فقط بالاستيراد/التلف، وهذا بالضبط ما يفحصه MIC-7. */
    const amanahReleased: FinancialEvent = {
      id: "raw-amanah-release",
      type: "amanah_released_cash",
      currency: "JOD",
      amountMinor: 5000,
      occurredOn: "2026-09-02",
      recordedAt: "2026-09-02T09:00:00.000Z",
      idempotencyKey: "raw-amanah-release",
      note: "تسليم بلا قبض",
      counterparty: null,
      relatedEventId: null,
      expenseContext: null,
      correctionType: null,
      correctionOfEventId: null,
      correctionReason: null,
      cashDeltaMinor: -5000,
      payableDeltaMinor: 0,
      ownerCapitalDeltaMinor: 0,
      operatingExpenseDeltaMinor: 0,
      amanahDeltaMinor: -5000,
    };
    const saved = await store.saveFinancialEvent(amanahReleased);
    if (!saved.ok) throw new Error(saved.message);
    const report = await services.integrityCheck.run();
    const mic7 = report.checks.find(check => check.id === "MIC-7");
    expect(mic7?.status).toBe("FAIL");
  });

  it("injected statement drift: MIC-1 FAIL carrying both numbers", async () => {
    const { store, services } = await cleanStore();
    const driftedStatement = {
      read: async () => {
        const reader = await services.projectFinance.readRecordedPeriodResult("2026-09-01", "2026-09-30");
        if (!reader.ok) throw new Error(reader.message);
        return {
          ok: true as const,
          value: {
            result: { ...reader.value, resultMinor: 12345 },
            blocks: null,
            position: null,
            cashNetMinor: 0,
            recognizedRevenueTotalMinor: 0,
            expenseCategories: [],
            truthLines: [],
          },
        };
      },
    } as unknown as StatementService;
    const integrityWithDrift = new IntegrityCheckService(
      store,
      services.projectFinance,
      driftedStatement,
      services.cashContinuity,
      now,
    );
    const report = await integrityWithDrift.run();
    const mic1 = report.checks.find(check => check.id === "MIC-1");
    expect(mic1?.status).toBe("FAIL");
    expect(mic1?.detailAr).toContain("12345");
  });

  it("pending states are warnings, not failures: deferred share and negative wallet balance", async () => {
    const store = new MemoryLocalStore();
    const services = buildServices(store);
    await services.projectFinance.record({
      type: "operating_expense_cash",
      amountMinor: 10000,
      occurredOn: "2026-09-02",
      note: "فاتورة بيت مؤجلة",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "shared",
        behavior: "variable",
        purpose: "project_general",
        knowledge: "needs_review",
        sharedProjectShare: {
          basis: "needs_review",
          note: null,
          allocation: "unallocated",
          totalAmountMinor: 10000,
          percentageBps: null,
          calculatedShareMinor: null,
        },
      },
      sharedExpense: { mode: "defer", sharedTotalAmountMinor: 10000 },
      idempotencyKey: "integrity-defer",
    });
    const opened = await services.cashContinuity.openWallet({
      name: "المصرف",
      kind: "bank_account",
      openingMinor: 500,
      occurredOn: "2026-09-01",
      note: "بداية",
      operationKey: "integrity-bank",
    });
    if (!opened.ok) throw new Error(opened.message);
    /* سحب مالك بضبط سالب شرعي (لا حراسة رصيد على ضبط المالك) — تحذير لا خلل. */
    await services.cashContinuity.adjust({
      walletId: opened.value.wallet.id,
      deltaMinor: -1000,
      occurredOn: "2026-09-02",
      note: "سحب مالك عبر الضبط",
      reason: "سحب مالك",
      operationKey: "integrity-overdraft",
    });
    const report = await services.integrityCheck.run();
    const mic2 = report.checks.find(check => check.id === "MIC-2");
    const mic9 = report.checks.find(check => check.id === "MIC-9");
    expect(mic2?.status).toBe("WARN");
    expect(mic9?.status).toBe("WARN");
    expect(report.overall).toBe("WARN");
    expect(mic9?.detailAr).toContain("قرار معلق");
  });
});

/* SA-5 (1) — انحدار: سداد التزام ثم تعديله موثقًا مسار قائم؛ المرجع القديم
 * للتسديد مراجعة (تحذير صادق) لا خللًا — الأثر الإجمالي سليم. */
describe("MIC-4 stale settlement reference after a documented edit", () => {
  it("settled payable then edited payable yields WARN not FAIL", async () => {
    const store = new MemoryLocalStore();
    const services = buildServices(store);
    const payable = await services.projectFinance.record({
      type: "operating_expense_payable",
      amountMinor: 10000,
      occurredOn: "2026-09-01",
      note: "فاتورة مورد",
      counterparty: "المورد",
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "fixed",
        purpose: "project_general",
        knowledge: "known",
        sharedProjectShare: null,
        categoryLabel: "مواد",
      },
      idempotencyKey: "stale-payable",
    });
    if (!payable.ok) throw new Error(payable.message);
    await services.projectFinance.record({
      type: "payable_settlement_cash",
      amountMinor: 4000,
      occurredOn: "2026-09-02",
      note: "دفع جزئي",
      counterparty: "المورد",
      relatedEventId: payable.value.id,
      idempotencyKey: "stale-settlement",
    });
    const edited = await services.projectFinance.editEvent({
      sourceEventId: payable.value.id,
      amountMinor: 12000,
      occurredOn: "2026-09-01",
      note: "فاتورة مورد مصححة",
      counterparty: "المورد",
      reason: "المبلغ الصحيح ١٢٠",
      idempotencyKey: "stale-edit",
    });
    if (!edited.ok) throw new Error(edited.message);
    const report = await services.integrityCheck.run();
    const mic4 = report.checks.find(check => check.id === "MIC-4");
    expect(mic4?.status).toBe("WARN");
    expect(mic4?.detailAr).toContain("جرى تعديله أو حذفه");
  });
});

/* ── المجموعة ٢ (عقد ٢٨): MIC-8 — سلامة المخزون والمواد ── */
describe("integrity check MIC-8 (سلامة المخزون والمواد)", () => {
  it("WARNs on an open shortage record with the material name and date — zero writes", async () => {
    const { store, services } = await cleanStore();
    const inventory = new InventoryMaterialService(store, now);
    const opened = await inventory.openMaterial({
      name: "سكر",
      unit: "kilogram",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 6000,
        costState: "known",
        valueMinor: 2400,
        confirmedOn: "2026-09-01",
        sourceNote: "جرد",
      },
      note: "رصيد",
      operationKey: "mic8-material",
    });
    if (!opened.ok) throw new Error(opened.message);
    const shortage = await inventory.recordShortage({
      materialId: opened.value.material.id,
      requestedQuantityMilli: 10000,
      orderId: null,
      occurredOn: "2026-09-05",
      note: "نقص",
      operationKey: "mic8-shortage",
    });
    if (!shortage.ok) throw new Error(shortage.message);
    const before = await snapshotOf(store);
    const report = await services.integrityCheck.run();
    const after = await snapshotOf(store);
    expect(after).toBe(before);
    const mic8 = report.checks.find(check => check.id === "MIC-8");
    expect(mic8?.status).toBe("WARN");
    expect(mic8?.detailAr).toContain("سكر");
    expect(mic8?.offenderCount).toBe(1);
  });
  it("WARNs only for explicitly unconfirmed openings — legacy materials stay quiet", async () => {
    const { store, services } = await cleanStore();
    const inventory = new InventoryMaterialService(store, now);
    const unconfirmed = await inventory.openMaterial({
      name: "دقيق",
      unit: "kilogram",
      tracking: "tracked",
      opening: {
        quantityState: "unconfirmed",
        quantityMilli: null,
        costState: "unknown",
        valueMinor: null,
        confirmedOn: null,
        sourceNote: null,
      },
      note: "بلا رصيد",
      operationKey: "mic8-unconfirmed",
    });
    if (!unconfirmed.ok) throw new Error(unconfirmed.message);
    /* مادة إرث بلا حقول المتابعة — لا إنذار كاذب. */
    const legacy = await inventory.openMaterial({
      name: "خشب قديم",
      unit: "piece",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 3000,
        costState: "known",
        valueMinor: 1200,
        confirmedOn: "2026-08-01",
        sourceNote: null,
      },
      note: "إرث",
      operationKey: "mic8-legacy",
    });
    if (!legacy.ok) throw new Error(legacy.message);
    const report = await services.integrityCheck.run();
    const mic8 = report.checks.find(check => check.id === "MIC-8");
    expect(mic8?.status).toBe("WARN");
    expect(mic8?.offenderCount).toBe(1);
    expect(mic8?.detailAr).toContain("غير مؤكد");
  });
  it("FAILs on a movement referencing a missing material — zero writes", async () => {
    const { store, services } = await cleanStore();
    const inventory = new InventoryMaterialService(store, now);
    const opened = await inventory.openMaterial({
      name: "خيط",
      unit: "meter",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 1000,
        costState: "known",
        valueMinor: 400,
        confirmedOn: "2026-09-01",
        sourceNote: null,
      },
      note: "رصيد",
      operationKey: "mic8-thread",
    });
    if (!opened.ok) throw new Error(opened.message);
    /* كسر بنيوي مزروع: حركة إلى مادة غير موجودة. */
    const broken = await store.commitInventory(null, [
      {
        ...opened.value.opening!,
        id: "mic8-broken",
        materialId: "ghost-material",
        operationKey: "mic8-broken",
      },
    ]);
    if (!broken.ok) throw new Error(broken.message);
    const before = await snapshotOf(store);
    const report = await services.integrityCheck.run();
    const after = await snapshotOf(store);
    expect(after).toBe(before);
    const mic8 = report.checks.find(check => check.id === "MIC-8");
    expect(mic8?.status).toBe("FAIL");
    expect(mic8?.offenderCount).toBeGreaterThanOrEqual(1);
    expect(mic8?.deepLink).toBe("/inventory");
  });
});

/* المجموعة ٤ (عقد ٢٩): فحوص الأصول والقروض والعربون وربط التسليم — PASS/WARN/FAIL
 * بأدلة، والفحص قراءة فقط لا يصلح شيئًا أبدًا. */
describe("integrity checks MIC-10..13 (المجموعة ٤ — عقد ٢٩)", () => {
  it("MIC-10 fails on an asset whose acquisition event is missing", async () => {
    const { store, services } = await cleanStore();
    await services.assets.create({
      name: "ثلاجة",
      acquisitionAmountMinor: 60000,
      acquisitionKind: "cash",
      purchaseDate: "2026-06-01",
      lifeMonths: 24,
      depreciationStartOn: "2026-06-01",
    });
    /* فك الربط: حقن سجل أصل بلا حدثه — محاكاة ملف مكسور عبر الكتابة المباشرة. */
    const snapshot = await store.readSnapshot();
    if (!snapshot.ok) throw new Error(snapshot.message);
    const broken = snapshot.value.assets?.[0]!;
    await store.replaceSnapshot({
      ...snapshot.value,
      financialEvents: snapshot.value.financialEvents.filter(event => event.id !== broken.acquisitionEventId),
    });
    const report = await services.integrityCheck.run();
    const mic10 = report.checks.find(check => check.id === "MIC-10");
    expect(mic10?.status).toBe("FAIL");
    expect(mic10?.detailAr).toContain("سلامة الأصول مكسورة");
  });

  it("MIC-10 warns on an active asset with unknown life — honest, not a failure", async () => {
    const { store, services } = await cleanStore();
    await services.assets.create({
      name: "جهاز مجهول العمر",
      acquisitionAmountMinor: 20000,
      acquisitionKind: "cash",
      purchaseDate: "2026-06-01",
      lifeMonths: null,
      depreciationStartOn: null,
    });
    const report = await services.integrityCheck.run();
    const mic10 = report.checks.find(check => check.id === "MIC-10");
    expect(mic10?.status).toBe("WARN");
    expect(mic10?.detailAr).toContain("عمر نافع مجهول");
  });

  /* جولة الاستئناف (F-2b): عكس الاقتناء من السجل العام ثم استرجاعه — الفحص
   * يقرأ الأثر الفعلي: بعد الاسترجاع يعود الاقتناء قائمًا (حدث جديد بنفس
   * القيم والسياق) فلا يبقى الأصل مُعلَّمًا اقتناء-معكوسًا إلى الأبد. */
  it("MIC-10 returns to honest state after reverse-then-restore of the acquisition", async () => {
    const { store, services } = await cleanStore();
    const asset = await services.assets.create({
      name: "ماكينة استرجاع",
      acquisitionAmountMinor: 30000,
      acquisitionKind: "cash",
      purchaseDate: "2026-06-01",
      lifeMonths: 24,
      depreciationStartOn: "2026-06-01",
    });
    if (!asset.ok) throw new Error(asset.message);
    const acquisitionId = asset.value.asset.acquisitionEventId;
    const reversed = await services.projectFinance.reverse({
      sourceEventId: acquisitionId,
      occurredOn: "2026-09-03",
      reason: "عكس تجريبي",
      idempotencyKey: "f2b-reverse",
    });
    if (!reversed.ok) throw new Error(reversed.message);
    const afterReverse = await services.integrityCheck.run();
    const mic10Reversed = afterReverse.checks.find(check => check.id === "MIC-10");
    expect(mic10Reversed?.status).toBe("FAIL");
    expect(mic10Reversed?.detailAr).toContain("سلامة الأصول مكسورة");
    const restored = await services.projectFinance.restoreEvent({
      sourceEventId: acquisitionId,
      idempotencyKey: `restore:${acquisitionId}`,
    });
    if (!restored.ok) throw new Error(restored.message);
    const afterRestore = await services.integrityCheck.run();
    const mic10Restored = afterRestore.checks.find(check => check.id === "MIC-10");
    expect(mic10Restored?.status).toBe("PASS");
  });

  it("MIC-11 fails when a repayment event disagrees with the loan record", async () => {
    const { store, services } = await cleanStore();
    const created = await services.loans.create({
      borrowerName: "أحمد",
      principalMinor: 15000,
      loanDate: "2026-07-01",
    });
    if (!created.ok) throw new Error(created.message);
    await services.loans.recordRepayment(created.value.loan.id, { amountMinor: 5000, date: "2026-08-01" });
    const snapshot = await store.readSnapshot();
    if (!snapshot.ok) throw new Error(snapshot.message);
    /* عبث بالمبلغ المخزن في الدفعة — الفحص يلتقط عدم التطابق. */
    const tamperedLoans = (snapshot.value.loans ?? []).map(loan =>
      loan.id === created.value.loan.id
        ? { ...loan, repayments: [{ ...loan.repayments[0]!, amountMinor: 4000 }] }
        : loan,
    );
    await store.replaceSnapshot({ ...snapshot.value, loans: tamperedLoans });
    const report = await services.integrityCheck.run();
    const mic11 = report.checks.find(check => check.id === "MIC-11");
    expect(mic11?.status).toBe("FAIL");
    expect(mic11?.detailAr).toContain("سلامة القروض مكسورة");
  });

  it("MIC-12 warns on pending retained deposits — the safe default stays visible", async () => {
    const { store, services } = await cleanStore();
    const { calculateCostSnapshot, collectDeposit, createCraftOrder, cancelOrder, settleDepositRetain } =
      await import("@micro-domain/craft-order/index.js");
    const snapshotCost = calculateCostSnapshot("cost-mic12", {
      currency: "JOD",
      materialItems: [
        {
          name: "خيط",
          quantity: 1,
          unit: "meter",
          unitPriceMinor: 300,
          priceDate: "2026-09-01",
          source: "user_input",
          confidence: "known",
        },
      ],
      time: null,
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-09-01T08:00:00Z",
      source: "price_approval",
    });
    let order = createCraftOrder({
      id: "order-mic12",
      customerName: "ليلى",
      itemName: "فستان",
      specifications: "قياس مخصص",
      quantity: 1,
      agreedPriceMinor: 10000,
      costSnapshot: snapshotCost,
      createdAt: "2026-09-01T08:00:00Z",
    });
    order = collectDeposit(order, 5000, "order-mic12:dep", "2026-09-01T08:01:00Z");
    order = cancelOrder(order, "إلغاء", "order-mic12:cancel", "2026-09-02T08:00:00Z");
    order = settleDepositRetain(order, 5000, "احتفاظ", "order-mic12:retain", "2026-09-03T08:00:00Z");
    await store.saveOrder({
      id: "order-mic12",
      order,
      catalogItemId: null,
      deliveryDate: "2026-09-10",
      agreementSource: "whatsapp",
      createdAt: "2026-09-01T08:00:00Z",
      updatedAt: "2026-09-03T08:00:00Z",
    });
    const report = await services.integrityCheck.run();
    const mic12 = report.checks.find(check => check.id === "MIC-12");
    expect(mic12?.status).toBe("WARN");
    expect(mic12?.detailAr).toContain("عربونات محتفظة بانتظار قرارك");
  });

  it("MIC-10..13 pass on a clean store with a healthy asset, loan, and settled decision", async () => {
    const { store, services } = await cleanStore();
    const asset = await services.assets.create({
      name: "ثلاجة",
      acquisitionAmountMinor: 60000,
      acquisitionKind: "cash",
      purchaseDate: "2026-06-01",
      lifeMonths: 24,
      depreciationStartOn: "2026-06-01",
    });
    if (asset.ok) {
      await services.assets.recordDepreciation(asset.value.asset.id, { asOf: "2026-09-01" });
    }
    const loan = await services.loans.create({
      borrowerName: "أحمد",
      principalMinor: 15000,
      loanDate: "2026-07-01",
    });
    if (loan.ok) {
      await services.loans.recordRepayment(loan.value.loan.id, { amountMinor: 15000, date: "2026-08-01" });
    }
    const report = await services.integrityCheck.run();
    const mic10 = report.checks.find(check => check.id === "MIC-10");
    const mic11 = report.checks.find(check => check.id === "MIC-11");
    const mic13 = report.checks.find(check => check.id === "MIC-13");
    expect(mic10?.status).toBe("PASS");
    expect(mic11?.status).toBe("PASS");
    expect(mic13?.status).toBe("PASS");
  });
});

/* المجموعة ٤ (تصحيح مراجعة 4-c): MIC-13 يتحقق فعليًا الآن — الاستخراج القديم
 * كان يعيد معرف الطلب فلم يمسك رابطًا مكسورًا قط. هنا حركة استهلاك مفتاحها
 * يشير لحدث تسليم غير موجود والفحص يمسكها بمعرّفها. */
describe("MIC-13 — ربط استهلاك التسليم يُمسك التلف المزروع", () => {
  it("يفشل حين يشير مفتاح حركة إلى حدث تسليم غير موجود", async () => {
    const store = new MemoryLocalStore();
    const services = buildServices(store);
    const { calculateCostSnapshot, createCraftOrder, transitionOrder } =
      await import("@micro-domain/craft-order/index.js");
    const { createMaterial } = await import("@micro-domain/inventory-material/index.js");
    const snapshot = calculateCostSnapshot("cost-mic13", {
      currency: "JOD",
      materialItems: [
        {
          name: "خيط",
          quantity: 1,
          unit: "meter",
          unitPriceMinor: 300,
          priceDate: "2026-08-01",
          source: "user_input",
          confidence: "known",
        },
      ],
      time: null,
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: now(),
      source: "price_approval",
    });
    let order = createCraftOrder({
      id: "order-mic13",
      customerName: "ليلى",
      itemName: "فستان",
      specifications: "قياس",
      quantity: 1,
      agreedPriceMinor: 10000,
      costSnapshot: snapshot,
      createdAt: now(),
    });
    for (const [to, key] of [
      ["provisional_agreement", "order-mic13:t1"],
      ["confirmed", "order-mic13:t2"],
      ["in_progress", "order-mic13:t3"],
      ["ready", "order-mic13:t4"],
      ["delivered", "order-mic13:deliver"],
    ] as const) {
      order = transitionOrder(order, { to, idempotencyKey: key, createdAt: now() });
    }
    await store.saveOrder({
      id: "order-mic13",
      order,
      catalogItemId: null,
      deliveryDate: "2026-09-01",
      agreementSource: "whatsapp",
      createdAt: now(),
      updatedAt: now(),
    });
    const material = createMaterial({
      id: "mat-mic13",
      name: "خيط",
      unit: "meter",
      createdAt: now(),
      createdOperationKey: "mat-mic13:create",
    });
    const { createInventoryMovement } = await import("@micro-domain/inventory-material/index.js");
    const broken = createInventoryMovement({
      id: "mv-mic13-broken",
      materialId: "mat-mic13",
      type: "consumption",
      occurredOn: "2026-09-02",
      recordedAt: now(),
      quantityDeltaMilli: -1000,
      valueDeltaMinor: -300,
      note: "استهلاك تسليم وهمي",
      operationKey: "order-mic13:deliver:order-mic13:status:status:order-mic13:deliver-ghost:mat-mic13",
      orderId: "order-mic13",
    });
    const committed = await store.commitInventory(material, [broken]);
    if (!committed.ok) throw new Error(committed.message);

    const report = await services.integrityCheck.run();
    const mic13 = report.checks.find(check => check.id === "MIC-13");
    expect(mic13?.status).toBe("FAIL");
    expect(mic13?.offenderSampleIds?.some(id => id.includes("mv-mic13-broken"))).toBe(true);
    /* الفحص قراءة فقط: الحركة المزروعة ما زالت كما هي. */
    const movements = await store.listInventoryMovements();
    if (!movements.ok) throw new Error(movements.message);
    expect(movements.value.some(movement => movement.id === "mv-mic13-broken")).toBe(true);
  });

  it("يفشل حين يكون التسليم معكوسًا وحركته بلا مرآة عكس", async () => {
    const store = new MemoryLocalStore();
    const services = buildServices(store);
    const { calculateCostSnapshot, createCraftOrder, transitionOrder, reverseDelivery } =
      await import("@micro-domain/craft-order/index.js");
    const { createMaterial, createInventoryMovement } =
      await import("@micro-domain/inventory-material/index.js");
    const snapshot = calculateCostSnapshot("cost-mic13b", {
      currency: "JOD",
      materialItems: [
        {
          name: "خيط",
          quantity: 1,
          unit: "meter",
          unitPriceMinor: 300,
          priceDate: "2026-08-01",
          source: "user_input",
          confidence: "known",
        },
      ],
      time: null,
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: now(),
      source: "price_approval",
    });
    let order = createCraftOrder({
      id: "order-mic13b",
      customerName: "سارة",
      itemName: "عباية",
      specifications: "قياس",
      quantity: 1,
      agreedPriceMinor: 12000,
      costSnapshot: snapshot,
      createdAt: now(),
    });
    for (const [to, key] of [
      ["provisional_agreement", "order-mic13b:t1"],
      ["confirmed", "order-mic13b:t2"],
      ["in_progress", "order-mic13b:t3"],
      ["ready", "order-mic13b:t4"],
      ["delivered", "order-mic13b:deliver"],
    ] as const) {
      order = transitionOrder(order, { to, idempotencyKey: key, createdAt: now() });
    }
    order = reverseDelivery(order, {
      reason: "عكس تجريبي",
      idempotencyKey: "order-mic13b:rev",
      createdAt: now(),
    });
    await store.saveOrder({
      id: "order-mic13b",
      order,
      catalogItemId: null,
      deliveryDate: "2026-09-01",
      agreementSource: "whatsapp",
      createdAt: now(),
      updatedAt: now(),
    });
    const material = createMaterial({
      id: "mat-mic13b",
      name: "خيط",
      unit: "meter",
      createdAt: now(),
      createdOperationKey: "mat-mic13b:create",
    });
    /* حركة استهلاك مرتبطة بتسليم معكوس لكن بلا مرآة عكس — عكس ناقص. */
    const deliveryEvent = [...order.events]
      .reverse()
      .find(event => event.type === "status_changed" && event.toStatus === "delivered");
    if (!deliveryEvent) throw new Error("delivery event missing");
    const orphan = createInventoryMovement({
      id: "mv-mic13b-orphan",
      materialId: "mat-mic13b",
      type: "consumption",
      occurredOn: "2026-09-02",
      recordedAt: now(),
      quantityDeltaMilli: -1000,
      valueDeltaMinor: -300,
      note: "استهلاك تسليم بلا عكس",
      operationKey: `order-mic13b:deliver:${deliveryEvent.id}:mat-mic13b`,
      orderId: "order-mic13b",
    });
    const committed = await store.commitInventory(material, [orphan]);
    if (!committed.ok) throw new Error(committed.message);

    const report = await services.integrityCheck.run();
    const mic13 = report.checks.find(check => check.id === "MIC-13");
    expect(mic13?.status).toBe("FAIL");
    expect(mic13?.offenderSampleIds?.some(id => id.includes("mv-mic13b-orphan"))).toBe(true);
  });

  /* ─── المجموعة ٥ (عقد ٣٥): فحوص الاستمرارية MIC-14/15/16 ─── */

  it("MIC-14: negative unallocated cash is a WARN with the amount; zero/positive stays PASS", async () => {
    const { store, services } = await cleanStore();
    const report = await services.integrityCheck.run();
    let mic14 = report.checks.find(check => check.id === "MIC-14");
    expect(mic14?.status).toBe("PASS");

    /* محاكاة إنفاق فوق المصادر المسجلة: حدث كاش خارج بلا مصدر يعادل مصدرًا
     * مكشوفًا — عبر كتابة مباشرة تُحاكي عبور الاستيراد/العد الخارجي. */
    const overspend = createFinancialEvent({
      id: "mic14-overspend",
      type: "payable_settlement_cash",
      amountMinor: 900000,
      occurredOn: "2026-09-02",
      recordedAt: now(),
      idempotencyKey: "mic14-overspend",
      note: "تسديد ضخم",
      counterparty: null,
      relatedEventId: "legacy-mic14-payable",
    });
    const saved = await store.saveFinancialEvent(overspend);
    if (!saved.ok) throw new Error(saved.message);
    const after = await services.integrityCheck.run();
    mic14 = after.checks.find(check => check.id === "MIC-14");
    expect(mic14?.status).toBe("WARN");
    expect(mic14?.driftMinor ?? 0).toBeGreaterThan(0);
    expect(mic14?.deepLink).toBe("/cash");
  });

  it("MIC-15: a duplicated idempotency key with a fresh id fails — import-grade check on the live store", async () => {
    const { store, services } = await cleanStore();
    const original = createFinancialEvent({
      id: "mic15-original",
      type: "operating_expense_cash",
      amountMinor: 1200,
      occurredOn: "2026-09-01",
      recordedAt: now(),
      idempotencyKey: "mic15-key",
      note: "أصل",
      counterparty: null,
    });
    const savedOriginal = await store.saveFinancialEvent(original);
    if (!savedOriginal.ok) throw new Error(savedOriginal.message);
    const forged = createFinancialEvent({
      id: "mic15-forged",
      type: "operating_expense_cash",
      amountMinor: 1200,
      occurredOn: "2026-09-02",
      recordedAt: now(),
      idempotencyKey: "mic15-key",
      note: "نسخة معدّة يدويًا بمعرّف جديد",
      counterparty: null,
    });
    const savedForged = await store.saveFinancialEvent(forged);
    if (!savedForged.ok) throw new Error(savedForged.message);
    const report = await services.integrityCheck.run();
    const mic15 = report.checks.find(check => check.id === "MIC-15");
    expect(mic15?.status).toBe("FAIL");
    expect(mic15?.offenderSampleIds).toContain("mic15-forged");
  });

  it("MIC-16: owner-capital delta on a non-owner type fails the separation check", async () => {
    const store = new MemoryLocalStore();
    const services = buildServices(store);
    const tampered = {
      ...createFinancialEvent({
        id: "mic16-leak",
        type: "operating_expense_cash",
        amountMinor: 1000,
        occurredOn: "2026-09-01",
        recordedAt: now(),
        idempotencyKey: "mic16-leak",
        note: "مصروف يحمل دلتا مالك",
        counterparty: null,
      }),
      ownerCapitalDeltaMinor: 1000,
    };
    const saved = await store.saveFinancialEvent(tampered);
    if (!saved.ok) throw new Error(saved.message);
    const report = await services.integrityCheck.run();
    const mic16 = report.checks.find(check => check.id === "MIC-16");
    expect(mic16?.status).toBe("FAIL");
    expect(mic16?.offenderSampleIds?.some(id => id.includes("mic16-leak"))).toBe(true);
  });

  it("the report carries schema and export version stamps (المجموعة ٥)", async () => {
    const { services } = await cleanStore();
    const report = await services.integrityCheck.run();
    expect(report.schemaVersion).toBe(localSchemaVersion);
    expect(report.exportVersion).toBe(localExportVersion);
  });

  /* المجموعة ٥ (إصلاح MIC-4): أحداث الأصول/القروض/تصنيف العربون كانت تُوسم
   * «خللًا» كذبًا لأن إعادة الاشتقاق لم تمرّر سياقها المرتبط الذي يوجبه عقد
   * المجال — المُنشئ يرمي فيقع السجل السليم في فرع الخلل. الآن السياق يُمرّر
   * ويُقارن، والسليم يبقى سليمًا والمُلاعَب يُكشف. */
  it("asset/loan/deposit-context events: MIC-4 PASS on healthy linked events (false-positive regression)", async () => {
    const { store, services } = await cleanStore();
    await services.assets.create({
      name: "مكينة خياطة",
      acquisitionAmountMinor: 45000,
      acquisitionKind: "cash",
      purchaseDate: "2026-09-05",
      lifeMonths: 60,
      depreciationStartOn: "2026-09-05",
    });
    await services.loans.create({
      borrowerName: "أحمد",
      principalMinor: 30000,
      loanDate: "2026-09-05",
      sourceWalletId: null,
      purposeNote: "قرض اختبار",
    });
    const report = await services.integrityCheck.run();
    const mic4 = report.checks.find(check => check.id === "MIC-4");
    expect(mic4?.status).toBe("PASS");
  });

  it("tampered asset context: MIC-4 FAIL — context comparison catches it", async () => {
    const { store, services } = await cleanStore();
    await services.assets.create({
      name: "ثلاجة عرض",
      acquisitionAmountMinor: 60000,
      acquisitionKind: "cash",
      purchaseDate: "2026-09-05",
      lifeMonths: 24,
      depreciationStartOn: "2026-09-05",
    });
    const snapshot = await store.readSnapshot();
    if (!snapshot.ok) throw new Error(snapshot.message);
    const assetEvent = snapshot.value.financialEvents.find(event => event.type === "asset_purchase_cash")!;
    /* سياق يكسر عقد المجال (بلا اسم) — إعادة الاشتقاق ترفضه فيُوسم الحدث. */
    const tampered = {
      ...assetEvent,
      assetContext: { assetId: assetEvent.assetContext!.assetId, name: "" },
    };
    await store.replaceSnapshot({
      ...snapshot.value,
      financialEvents: snapshot.value.financialEvents.map(event =>
        event.id === tampered.id ? tampered : event,
      ),
    });
    const report = await services.integrityCheck.run();
    const mic4 = report.checks.find(check => check.id === "MIC-4");
    expect(mic4?.status).toBe("FAIL");
    expect(mic4?.offenderSampleIds?.some(id => id === tampered.id)).toBe(true);
  });
});
