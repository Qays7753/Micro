import { describe, expect, it } from "vitest";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";
import { AgreementContextService } from "@/application/agreements/agreementContextService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { DailyFollowUpService } from "@/application/follow-up/dailyFollowUpService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { ProfileService } from "@/application/profile/profileService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { HomeControlCenterService } from "./homeControlCenterService";

const now = () => "2026-08-25T09:00:00.000Z";
function services(store: MemoryLocalStore) {
  const finance = new ProjectFinancialService(store, now);
  const suppliers = new SupplierPurchaseService(store, now);
  return new HomeControlCenterService(
    store,
    new DailyFollowUpService(store),
    finance,
    suppliers,
    new InventoryMaterialService(store),
    new AgreementContextService(store, now),
    now,
  );
}
async function saveProfile(store: MemoryLocalStore) {
  const result = await new ProfileService(store, now).save("مشغل اختبار");
  if (!result.ok) throw new Error("profile should save");
}

async function saveOrder(store: MemoryLocalStore, id: string) {
  const cost = calculateCostSnapshot(`cost-${id}`, {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 30, hourlyRateMinor: 300, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: "2026-08-24T09:00:00.000Z",
    freshnessDays: null,
  });
  const order = createCraftOrder({
    id,
    customerName: "عميل",
    itemName: `طلب ${id}`,
    specifications: "اختبار",
    quantity: 1,
    agreedPriceMinor: 1500,
    costSnapshot: cost,
    createdAt: "2026-08-24T09:00:00.000Z",
  });
  await store.saveOrder({
    id,
    order,
    catalogItemId: null,
    deliveryDate: "2026-08-28",
    agreementSource: "test",
    createdAt: order.createdAt,
    updatedAt: order.createdAt,
  });
}

describe("HomeControlCenterService", () => {
  it("keeps an uninitialized project honest instead of presenting financial zeros", async () => {
    const store = new MemoryLocalStore();
    await saveProfile(store);
    const result = await services(store).read();
    if (!result.ok) throw new Error(result.message);
    expect(result.value.heading).toMatchObject({ activityName: "مشغل اختبار", todayLocal: "2026-08-25" });
    expect(result.value.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "cash", state: "not_initialized", valueMinor: null }),
        expect.objectContaining({ id: "receivables", state: "not_initialized", valueMinor: null }),
        expect.objectContaining({ id: "payables", state: "not_initialized", valueMinor: null }),
        expect.objectContaining({ id: "owner_capital", state: "not_initialized", valueMinor: null }),
      ]),
    );
    /* دمج بند ١٠: مشروع فارغ — «اليوم» صادقة فارغة لا تدفع نحو الطلبات (رحلة ١). */
    expect(result.value.todaySection.items).toHaveLength(0);
    /* قرار المالك على بند ١٢: لا بطاقات مشروطة للمخزون والموردين — القسم القديم فارغ
     * لمشروع بلا مواعيد ولا نتيجة، والكتلتان الدائمتان هما الطريق. */
    expect(result.value.optionalModules).toHaveLength(0);
    expect(result.value.financeUnit).toMatchObject({ action: { id: "finance", href: "/finance" } });
    /* قرار المالك على بند ١١: «منتجاتي وخدماتي» كتلة دائمة مستقلة. */
    expect(result.value.catalogUnit).toMatchObject({ action: { id: "catalog", href: "/catalog" } });
    expect(result.value.todaySection).toMatchObject({
      items: [],
      upcomingCount: 0,
      nextUpcomingDate: null,
    });
    // §2.7: كل حقيقة غير مسجلة تعرض طريق تسجيلها — «غير مسجل — سجّله» لا «غير مهيأ».
    const cashFact = result.value.facts.find(fact => fact.id === "cash");
    expect(cashFact?.road).toMatchObject({ href: "/cash/wallet/new", label: "سجّله" });
    const ownerFact = result.value.facts.find(fact => fact.id === "owner_capital");
    expect(ownerFact?.road).toMatchObject({ href: "/finance/new/owner_investment_cash" });
    expect(result.value.recentChanges).toHaveLength(0);
  });

  it("reveals F-078 in the Today section: due follow-ups, today's appointment, and recorded debt from one screen (journey 2)", async () => {
    const store = new MemoryLocalStore();
    await saveProfile(store);
    const cost = calculateCostSnapshot("cost-today", {
      currency: "JOD",
      materialItems: [],
      time: { minutes: 30, hourlyRateMinor: 300, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-08-20T09:00:00.000Z",
      freshnessDays: null,
    });
    const baseOrder = createCraftOrder({
      id: "today-order",
      customerName: "ريم",
      itemName: "خاتم أمينة",
      specifications: "اختبار",
      quantity: 1,
      agreedPriceMinor: 5000,
      costSnapshot: cost,
      createdAt: "2026-08-20T09:00:00.000Z",
    });
    const order = {
      ...baseOrder,
      status: "settled" as const,
      settlementStatus: "debt" as const,
      receivableMinor: 3500,
      nextAction: "تابع تحصيل الدين",
    };
    await store.saveOrder({
      id: "today-order",
      order,
      catalogItemId: null,
      deliveryDate: "2026-08-26",
      agreementSource: "whatsapp",
      followUpDate: "2026-08-24",
      followUpSummary: "اتصال أحمد اليوم",
      followUpReason: "تأكيد القياس",
      createdAt: order.createdAt,
      updatedAt: order.createdAt,
    });
    await store.saveSchedule({
      id: "schedule-today",
      orderId: "today-order",
      kind: "delivery",
      scheduledFor: "2026-08-25",
      scheduledTime: "16:00",
      durationMinutes: 60,
      status: "scheduled",
      postponeReason: null,
      events: [],
      createdAt: "2026-08-20T09:00:00.000Z",
      updatedAt: "2026-08-20T09:00:00.000Z",
    });
    const result = await services(store).read();
    if (!result.ok) throw new Error(result.message);
    const kinds = result.value.todaySection.items.map(item => item.kind);
    expect(kinds).toContain("follow_up_due");
    expect(kinds).toContain("appointment_today");
    expect(kinds).toContain("due_amount");
    const dueAmount = result.value.todaySection.items.find(item => item.kind === "due_amount");
    expect(dueAmount).toMatchObject({ href: "/orders/today-order" });
    expect(dueAmount?.detail).toContain("دين مسجل");
    expect(dueAmount?.detail).toContain("لا كاش محصل");
    /* دمج بند ١٠: المتابعة المستحقة والدين بندان لا أكثر — لا تكرار بين قسمين. */
    const ids = result.value.todaySection.items.map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps /finance reachable for a brand-new owner while period_result stays conditional on its own unit (decisions 11–14)", async () => {
    const store = new MemoryLocalStore();
    await saveProfile(store);
    const result = await services(store).read();
    if (!result.ok) throw new Error(result.message);
    // The permanent unit opens the finance surface with no delivered order and no financial event.
    expect(result.value.financeUnit.action).toMatchObject({ id: "finance", href: "/finance" });
    // period_result keeps its own honest condition: no result yet, so its module stays hidden.
    expect(result.value.optionalModules.map(module => module.id)).not.toContain("period_result");
  });

  it("uses existing finance facts with source semantics and keeps Home reads free of financial writes", async () => {
    const store = new MemoryLocalStore();
    await saveProfile(store);
    const finance = new ProjectFinancialService(store, now);
    await finance.record({
      type: "owner_investment_cash",
      amountMinor: 5000,
      occurredOn: "2026-08-25",
      note: "استثمار",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "home-investment",
    });
    const before = await store.listFinancialEvents();
    if (!before.ok) throw new Error("events should read");
    const result = await services(store).read();
    if (!result.ok) throw new Error(result.message);
    expect(result.value.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "cash",
          state: "known",
          valueMinor: 5000,
          source: expect.stringContaining("السجل المحلي"),
        }),
        expect.objectContaining({ id: "owner_capital", state: "known", valueMinor: 5000 }),
        expect.objectContaining({ id: "receivables", state: "not_initialized", valueMinor: null }),
        expect.objectContaining({ id: "payables", state: "not_initialized", valueMinor: null }),
      ]),
    );
    const after = await store.listFinancialEvents();
    if (!after.ok) throw new Error("events should read");
    expect(after.value).toHaveLength(before.value.length);
    expect(result.value.truthLine).toContain("لا تحول الرقم إلى ربح");
  });

  it("absorbs the attention content into Today for an active owner with no duplication and no removal", async () => {
    const store = new MemoryLocalStore();
    await saveProfile(store);
    for (let index = 1; index <= 4; index += 1) await saveOrder(store, `home-order-${index}`);
    const result = await services(store).read();
    if (!result.ok) throw new Error(result.message);
    /* دمج بند ١٠: كل طلب مفتوح بند واحد في «اليوم» — لا قسم انتباه منفصل ولا سقف إلغاء. */
    const openOrders = result.value.todaySection.items.filter(item => item.kind === "open_order");
    expect(openOrders).toHaveLength(4);
    expect(openOrders.every(item => item.href.startsWith("/orders/"))).toBe(true);
    const ids = result.value.todaySection.items.map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    /* الترتيب بالأولوية: أول بند في القائمة هو الأولوية — لا بطاقة أولوية منفصلة. */
    const priorities = result.value.todaySection.items.map(item => item.priority);
    expect([...priorities].sort((left, right) => left - right)).toEqual(priorities);
    expect(result.value.financeUnit.action).toMatchObject({ id: "finance", href: "/finance" });
    expect(result.value.catalogUnit.action).toMatchObject({ id: "catalog", href: "/catalog" });
    expect(result.value.optionalModules.map(module => module.id)).toContain("schedule");
    expect(result.value.optionalModules.map(module => module.id)).not.toContain("period_result");
    expect(result.value.optionalModules.map(module => module.id)).not.toContain("inventory");
    expect(result.value.optionalModules.map(module => module.id)).not.toContain("supplier_commitments");
    expect(result.value.optionalModules.map(module => module.id)).not.toContain("catalog");
    expect(result.value.recentChanges.length).toBeLessThanOrEqual(5);
  });

  it("keeps a closed incomplete result in Today as one review item above the open-order items", async () => {
    const store = new MemoryLocalStore();
    await saveProfile(store);
    const id = "home-incomplete-settled";
    const cost = calculateCostSnapshot(`cost-${id}`, {
      currency: "JOD",
      materialItems: [],
      time: null,
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-08-24T09:00:00.000Z",
      freshnessDays: null,
    });
    const baseOrder = createCraftOrder({
      id,
      customerName: "عميل مراجعة",
      itemName: "طلب يحتاج مراجعة",
      specifications: "تكلفة غير مكتملة",
      quantity: 1,
      agreedPriceMinor: 8000,
      costSnapshot: cost,
      createdAt: "2026-08-24T09:00:00.000Z",
    });
    const order = {
      ...baseOrder,
      status: "settled" as const,
      settlementStatus: "paid" as const,
      resultStatus: "incomplete" as const,
      nextAction: "راجع نتيجة الطلب",
    };
    await store.saveOrder({
      id,
      order,
      catalogItemId: null,
      deliveryDate: "2026-08-28",
      agreementSource: "test",
      createdAt: order.createdAt,
      updatedAt: order.createdAt,
    });

    const result = await services(store).read();
    if (!result.ok) throw new Error(result.message);
    const review = result.value.todaySection.items.find(item => item.kind === "result_review");
    expect(review).toMatchObject({
      title: "راجع نتيجة طلب يحتاج مراجعة",
      href: `/orders/${id}`,
      actionLabel: "مراجعة النتيجة",
    });
  });

  it("keeps open drafts inside Today with their resume action (absorbed, not cancelled)", async () => {
    const store = new MemoryLocalStore();
    await saveProfile(store);
    await store.saveDraft({
      id: "draft-1",
      intent: "customer_order",
      itemName: "مسودة ليلية",
      customerName: "",
      quantity: 1,
      specifications: "",
      catalogItemId: null,
      costSnapshots: [],
      activeCostSnapshotId: null,
      linkedOrderId: null,
      createdAt: "2026-08-24T20:00:00.000Z",
      updatedAt: "2026-08-24T20:00:00.000Z",
    });
    const result = await services(store).read();
    if (!result.ok) throw new Error(result.message);
    const draft = result.value.todaySection.items.find(item => item.kind === "draft");
    expect(draft).toMatchObject({
      title: "مسودة ليلية",
      href: "/orders/draft/draft-1",
      actionLabel: "استئناف المسودة",
    });
  });
});
