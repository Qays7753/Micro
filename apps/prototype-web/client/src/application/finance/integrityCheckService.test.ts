import { describe, expect, it } from "vitest";
import { IntegrityCheckService } from "@/application/finance/integrityCheckService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { StatementService } from "@/application/finance/statementService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
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
  return { projectFinance, statement, cashContinuity, integrityCheck };
}

async function cleanStore(): Promise<{ store: MemoryLocalStore; services: ReturnType<typeof buildServices> }> {
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
        return { ok: true as const, value: { result: { ...reader.value, resultMinor: 12345 }, blocks: null, position: null, cashNetMinor: 0, recognizedRevenueTotalMinor: 0, expenseCategories: [], truthLines: [] } };
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
