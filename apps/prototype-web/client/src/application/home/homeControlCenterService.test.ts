import { describe, expect, it } from "vitest";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { DailyFollowUpService } from "@/application/follow-up/dailyFollowUpService";
import { UnifiedFollowUpService } from "@/application/follow-up/unifiedFollowUpService";
import { activeDeliveryLens } from "@/application/scheduling";
import { CollectionService } from "@/application/collections/collectionService";
import { DueDatesService } from "@/application/finance/dueDatesService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { ProfileService } from "@/application/profile/profileService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import type { StoredCraftOrder } from "@/storage/local/types";
import { HomeControlCenterService } from "./homeControlCenterService";

const NOW = "2026-08-25T09:00:00.000Z";
const now = () => NOW;

function services(store: MemoryLocalStore) {
  const projectFinance = new ProjectFinancialService(store, now);
  const directSales = new DirectSaleService(store, now);
  const fulfillment = new FulfillmentService(store, now);
  const collections = new CollectionService(store, fulfillment, directSales, projectFinance);
  const dueDates = new DueDatesService(store, collections, now);
  const unified = new UnifiedFollowUpService(
    activeDeliveryLens(store),
    store,
    collections,
    dueDates,
    projectFinance,
    store,
    now,
  );
  return new HomeControlCenterService(store, new DailyFollowUpService(store), projectFinance, unified, now);
}

async function saveProfile(store: MemoryLocalStore) {
  const result = await new ProfileService(store, now).create("مشغل اختبار");
  if (!result.ok) throw new Error("profile should save");
}

function storedOrder(
  id: string,
  options: { followUpDate?: string | null; receivableMinor?: number } = {},
): StoredCraftOrder {
  const cost = calculateCostSnapshot(`cost-${id}`, {
    source: "draft",
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
  const receivableMinor = options.receivableMinor ?? 0;
  return {
    id,
    order: {
      ...order,
      status: "in_progress" as never,
      settlementStatus: (receivableMinor > 0 ? "debt" : order.settlementStatus) as never,
      receivableMinor: receivableMinor as never,
    },
    catalogItemId: null,
    deliveryDate: "2026-08-28",
    agreementSource: "test",
    followUpSummary: options.followUpDate ? "اتصال بعد التسليم" : null,
    followUpDate: options.followUpDate ?? null,
    followUpReason: options.followUpDate ? "اتفاق مع العميل" : null,
    followUpEvents: [],
    createdAt: "2026-08-24T09:00:00.000Z",
    updatedAt: "2026-08-24T09:00:00.000Z",
  } as never;
}

describe("HomeControlCenterService — S16 (UNIT-003 HOME-B1/A4)", () => {
  it("keeps an uninitialized project honest instead of presenting financial zeros", async () => {
    const store = new MemoryLocalStore();
    await saveProfile(store);
    const result = await services(store).read();
    if (!result.ok) throw new Error(result.message);
    /* النقد غير المسجل: حالة معلنة لا رقم مختلق. */
    expect(result.value.glimpse.cashNow.state).toBe("not_initialized");
    expect(result.value.glimpse.cashNow.valueMinor).toBeNull();
    /* المبيعات المسجلة صفر مسجل من القراءة الرسمية للفترة — ليست رقمًا مختلقًا.
     * نتيجة الفراغ: صفر معلوم من المصدر نفسه (لا تكلفة ناقصة هنا) — لا رقمًا
     * مؤكدًا بلا دليل ولا صفرًا مضللًا لمجهول. */
    expect(result.value.glimpse.today.sales.valueMinor).toBe(0);
    expect(result.value.glimpse.month.result.state).toBe("known");
    expect(result.value.glimpse.month.result.valueMinor).toBe(0);
    /* قراءة مكتملة بلا مهام: الحالة الصادقة. */
    expect(result.value.followUp.complete).toBe(true);
    expect(result.value.followUp.empty).toBe(true);
    /* لا نسخة متحققة بعد، ولا تذكير بلا بيانات. */
    expect(result.value.backup.lastVerifiedExportAt).toBeNull();
    expect(result.value.truthLine).toBeNull();
  });

  it("carries the exact applied range to 016 for both periods — the number opens its explanation", async () => {
    const store = new MemoryLocalStore();
    await saveProfile(store);
    const result = await services(store).read();
    if (!result.ok) throw new Error(result.message);
    expect(result.value.glimpse.today.sales.sourceHref).toBe(
      "/finance/statement?since=2026-08-25&until=2026-08-25",
    );
    expect(result.value.glimpse.month.sales.sourceHref).toBe(
      "/finance/statement?since=2026-08-01&until=2026-08-25",
    );
    expect(result.value.glimpse.cashNow.sourceHref).toBe("/cash");
  });

  it("splits today/month sales from the official period read alone — no interface math", async () => {
    const store = new MemoryLocalStore();
    await saveProfile(store);
    const finance = new ProjectFinancialService(store, now);
    await finance.record({
      type: "owner_investment_cash",
      amountMinor: 7000,
      occurredOn: "2026-08-01",
      note: "استثمار",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "home-invest",
    });
    /* بيع مباشر يوم 10 من الشهر نفسه: اليوم لا يشمله والشهر يشمله — من
     * القراءة الرسمية وحدها. */
    const directSales = new DirectSaleService(store, now);
    const sale = await directSales.record({
      itemName: "خاتم أمانة",
      quantity: 1,
      revenueMinor: 1500,
      collectedMinor: 1500,
      collectionStatus: "collected_in_full",
      catalogItemId: null,
      customerName: null,
      customerPartyId: null,
      costMinor: null,
      occurredOn: "2026-08-10",
      note: "بيع اختبار",
      idempotencyKey: "home-sale",
    });
    if (!sale.ok) throw new Error(sale.message);
    const result = await services(store).read();
    if (!result.ok) throw new Error(result.message);
    expect(result.value.glimpse.today.sales.valueMinor).toBe(0);
    expect(result.value.glimpse.month.sales.valueMinor).toBe(1500);
    /* النقد المسجل الآن واحد منفصل — لا يتغير بتغيير الفترة: الاستثمار 7000
     * + القبض الكامل للبيع 1500 = 8500 من قراءة الوضع نفسها. */
    expect(result.value.glimpse.cashNow.state).toBe("known");
    expect(result.value.glimpse.cashNow.valueMinor).toBe(8500);
  });

  it("qualifies recorded cash with held amanah — real cash that is not the owner's money or profit", async () => {
    const store = new MemoryLocalStore();
    await saveProfile(store);
    const finance = new ProjectFinancialService(store, now);
    await finance.record({
      type: "amanah_held_cash",
      amountMinor: 2000,
      occurredOn: "2026-08-25",
      note: "أمانة لدى المالك",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "home-amanah-held",
    });
    const result = await services(store).read();
    if (!result.ok) throw new Error(result.message);
    expect(result.value.glimpse.cashNow.state).toBe("known");
    expect(result.value.glimpse.cashNow.qualifier).toContain("أمانات");
  });

  it("the brief comes from the unified reader: an overdue customer follow-up surfaces first with its action", async () => {
    const store = new MemoryLocalStore();
    await saveProfile(store);
    await store.saveOrder(storedOrder("order-followup", { followUpDate: "2026-08-24" }));
    const result = await services(store).read();
    if (!result.ok) throw new Error(result.message);
    expect(result.value.followUp.rows.length).toBeGreaterThan(0);
    const first = result.value.followUp.rows[0]!;
    expect(first.upcoming).toBe(false);
    expect(first.actionLabel).toBe("متابعة العميل");
    expect(first.href).toContain("/orders/");
    expect(result.value.followUp.empty).toBe(false);
  });

  it("a saved draft fills as an explicit completion task opening its own draft", async () => {
    const store = new MemoryLocalStore();
    await saveProfile(store);
    await store.saveDraft({
      id: "draft-1",
      itemName: "خاتم أمانة",
      linkedOrderId: null,
    } as never);
    const result = await services(store).read();
    if (!result.ok) throw new Error(result.message);
    expect(result.value.followUp.rows).toHaveLength(1);
    expect(result.value.followUp.rows[0]!.title).toContain("خاتم أمانة");
    expect(result.value.followUp.rows[0]!.href).toBe("/orders/draft/draft-1");
    expect(result.value.followUp.rows[0]!.actionLabel).toBe("إكمال الطلب");
  });

  it("the quiet backup reminder appears only when due: stale verified export with data", async () => {
    const store = new MemoryLocalStore();
    await saveProfile(store);
    const finance = new ProjectFinancialService(store, now);
    await finance.record({
      type: "owner_investment_cash",
      amountMinor: 5000,
      occurredOn: "2026-08-01",
      note: "استثمار",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "home-reminder-invest",
    });
    await store.savePreferences({
      id: "local-preferences",
      theme: "light",
      dailyScheduleCapacityMinutes: null,
      workMode: null,
      actualTimeTrackingEnabled: false,
      installBannerDismissedAt: null,
      lastVerifiedExportAt: "2026-08-10T09:00:00.000Z",
      backupReminderEnabled: true,
    } as never);
    const due = await services(store).read();
    if (!due.ok) throw new Error(due.message);
    expect(due.value.backup.daysSinceExport).toBe(15);
    expect(due.value.truthLine).toContain("نسخة احتياطية");
    /* إطفاء التذكير من الإعدادات يخفي السطر فقط — لا يمس عمر النسخة. */
    await store.savePreferences({
      id: "local-preferences",
      theme: "light",
      dailyScheduleCapacityMinutes: null,
      workMode: null,
      actualTimeTrackingEnabled: false,
      installBannerDismissedAt: null,
      lastVerifiedExportAt: "2026-08-10T09:00:00.000Z",
      backupReminderEnabled: false,
    } as never);
    const quiet = await services(store).read();
    if (!quiet.ok) throw new Error(quiet.message);
    expect(quiet.value.backup.daysSinceExport).toBe(15);
    expect(quiet.value.backup.reminderEnabled).toBe(false);
    expect(quiet.value.truthLine).toBeNull();
  });
});
