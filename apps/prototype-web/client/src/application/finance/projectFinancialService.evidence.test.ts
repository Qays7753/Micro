import { describe, expect, it } from "vitest";
import { ProjectFinancialService } from "./projectFinancialService";
import { HomeControlCenterService } from "@/application/home/homeControlCenterService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

/* FIN-001 (قرار المالك المعتمد ٢٠٢٦-٠٩-١٦): القيم غير المسجلة لا تُعرض صفرًا
 * مؤكدًا — حالة الدليل تُحسب مع القيمة في readPosition نفسها، والرئيسية
 * ومالي تقرآنها من المصدر الواحد. الصفر الموثق (محسوب فوق سجلات) يبقى 0.00. */

const now = () => "2026-09-16T09:00:00.000Z";

async function seedProfile(store: MemoryLocalStore) {
  const result = await new (await import("@/application/profile/profileService")).ProfileService(store, () =>
    now(),
  ).save("مشغل اختبار FIN-001");
  if (!result.ok) throw new Error(result.message);
}

describe("ProjectFinancialService evidence states (FIN-001)", () => {
  it("marks every metric not_recorded for a brand-new empty project — no invented 0.00", async () => {
    const store = new MemoryLocalStore();
    await seedProfile(store);
    const finance = new ProjectFinancialService(store, () => now());
    const result = await finance.readPosition();
    if (!result.ok) throw new Error(result.message);
    expect(result.value.evidence).toEqual({
      cash: "not_recorded",
      customerReceivables: "not_recorded",
      supplierPayables: "not_recorded",
      ownerCapital: "not_recorded",
      walletCash: "not_recorded",
      unallocatedCash: "not_recorded",
      operatingExpenses: "not_recorded",
    });
    /* القيم العددية تبقى أعدادًا صحيحة الحساب — العرض وحده يتبع الدليل. */
    expect(result.value.recordedCashMinor).toBe(0);
    expect(result.value.customerReceivablesMinor).toBe(0);
  });

  it("treats a declared wallet as recorded cash and wallet evidence", async () => {
    const store = new MemoryLocalStore();
    await seedProfile(store);
    const cash = new CashContinuityService(store, () => now());
    const opened = await cash.openWallet({
      name: "درج",
      kind: "cash_drawer",
      openingMinor: 10000,
      occurredOn: "2026-09-16",
      note: "رصيد بداية",
      operationKey: "fin001-open-drawer",
    });
    if (!opened.ok) throw new Error(opened.message);
    const finance = new ProjectFinancialService(store, () => now());
    const result = await finance.readPosition();
    if (!result.ok) throw new Error(result.message);
    expect(result.value.evidence.cash).toBe("recorded");
    expect(result.value.evidence.walletCash).toBe("recorded");
    /* محفظة بلا أي حركة غير موزعة: «غير الموزع» يبقى غير مسجل لا صفرًا. */
    expect(result.value.evidence.unallocatedCash).toBe("not_recorded");
    expect(result.value.recordedCashMinor).toBe(10000);
  });

  it("keeps a calculated zero over real records as recorded cash (0.00, not غير مسجل)", async () => {
    const store = new MemoryLocalStore();
    await seedProfile(store);
    const finance = new ProjectFinancialService(store, () => now());
    const invested = await finance.record({
      type: "owner_investment_cash",
      amountMinor: 5000,
      occurredOn: "2026-09-16",
      note: "استثمار",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "fin001-invest",
    });
    if (!invested.ok) throw new Error(invested.message);
    const spent = await finance.record({
      type: "operating_expense_cash",
      amountMinor: 5000,
      occurredOn: "2026-09-16",
      note: "مصروف كامل الاستثمار",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "unknown",
        purpose: "project_general",
        knowledge: "known",
        sharedProjectShare: null,
        categoryLabel: null,
      },
      idempotencyKey: "fin001-spend",
    });
    if (!spent.ok) throw new Error(spent.message);
    const result = await finance.readPosition();
    if (!result.ok) throw new Error(result.message);
    /* صفر محسوب فوق سجلين حقيقيين = صفر موثق 0.00 لا «غير مسجل». */
    expect(result.value.recordedCashMinor).toBe(0);
    expect(result.value.evidence.cash).toBe("recorded");
    expect(result.value.evidence.unallocatedCash).toBe("recorded");
    expect(result.value.evidence.operatingExpenses).toBe("recorded");
    expect(result.value.evidence.ownerCapital).toBe("recorded");
  });

  it("counts a collected direct sale as cash evidence — receipt and Home agree", async () => {
    const store = new MemoryLocalStore();
    await seedProfile(store);
    const { createDirectSale } = await import("@micro-domain/direct-sale/index.js");
    const saved = await store.saveDirectSale(
      createDirectSale({
        id: "fin001-sale",
        itemName: "قطعة",
        quantity: 1,
        revenueMinor: 1500,
        collectedMinor: 500,
        collectionStatus: "partial_debt",
        catalogItemId: null,
        customerName: "عميل-FIN001",
        costMinor: null,
        occurredOn: "2026-09-16",
        recordedAt: now(),
        note: "بيع آجل لاختبار دليل الكاش",
        idempotencyKey: "fin001-sale-key",
      }),
    );
    if (!saved.ok) throw new Error("direct sale should save");
    const finance = new ProjectFinancialService(store, () => now());
    const result = await finance.readPosition();
    if (!result.ok) throw new Error(result.message);
    /* القبض المحصل من البيع المباشر دليل كاش — الوصل الذي يقول «الكاش المسجل
     * الآن 5.00» لا يكذب على الرئيسية بعد الآن. */
    expect(result.value.evidence.cash).toBe("recorded");
    expect(result.value.recordedCashMinor).toBe(500);
    expect(result.value.evidence.customerReceivables).toBe("recorded");
    expect(result.value.customerReceivablesMinor).toBe(1000);
  });

  it("keeps Home and Finance on the same meaning for missing and recorded values", async () => {
    const store = new MemoryLocalStore();
    await seedProfile(store);
    const finance = new ProjectFinancialService(store, () => now());
    const dailyFollowUp = new (
      await import("@/application/follow-up/dailyFollowUpService")
    ).DailyFollowUpService(store);
    const supplierPurchases = new (
      await import("@/application/suppliers/supplierPurchaseService")
    ).SupplierPurchaseService(store, () => now());
    const inventory = new (
      await import("@/application/inventory/inventoryMaterialService")
    ).InventoryMaterialService(store, () => now());
    const agreementContext = new (
      await import("@/application/agreements/agreementContextService")
    ).AgreementContextService(store);
    const activity = new (await import("@/application/activity/activityService")).ActivityService(store);
    const home = new HomeControlCenterService(
      store,
      dailyFollowUp,
      finance,
      supplierPurchases,
      inventory,
      agreementContext,
      activity,
      () => now(),
    );

    const emptyPosition = await finance.readPosition();
    if (!emptyPosition.ok) throw new Error(emptyPosition.message);
    const emptyHome = await home.read();
    if (!emptyHome.ok) throw new Error(emptyHome.message);
    const emptyStates = Object.fromEntries(emptyHome.value.facts.map(fact => [fact.id, fact.state]));
    expect(emptyStates.cash).toBe(
      emptyPosition.value.evidence.cash === "recorded" ? "known" : "not_initialized",
    );
    expect(emptyStates.cash).toBe("not_initialized");
    expect(emptyStates.receivables).toBe("not_initialized");
    expect(emptyStates.payables).toBe("not_initialized");
    expect(emptyStates.owner_capital).toBe("not_initialized");

    const invested = await finance.record({
      type: "owner_investment_cash",
      amountMinor: 7000,
      occurredOn: "2026-09-16",
      note: "استثمار",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "fin001-home-invest",
    });
    if (!invested.ok) throw new Error(invested.message);
    const position = await finance.readPosition();
    const homeResult = await home.read();
    if (!position.ok || !homeResult.ok) throw new Error("reads should succeed");
    const states = Object.fromEntries(homeResult.value.facts.map(fact => [fact.id, fact.state]));
    /* نفس الدليل، نفس المعنى: مسجل في الشاشتين معًا. */
    expect(position.value.evidence.cash).toBe("recorded");
    expect(states.cash).toBe("known");
    expect(position.value.evidence.ownerCapital).toBe("recorded");
    expect(states.owner_capital).toBe("known");
    expect(position.value.evidence.customerReceivables).toBe("not_recorded");
    expect(states.receivables).toBe("not_initialized");
  });
});
