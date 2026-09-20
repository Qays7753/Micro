/** Stage 2 — OPS-005/OPS-006 (tracker): اختبارات القارئ الموحّد للقادم والمتأخر.
 * ---------------------------------------------------------------------------
 * • مصدر قراءة واحد لأربع كتل مستقلة، بمعنى ومصدر معلنين لكل نوع تاريخ.
 * • التقادم المبسط من مصدر OPS-001 نفسه؛ المجهول يبقى «بلا تاريخ» والمبالغ
 *   تُقرأ — غياب التاريخ ليس غياب الدين، ولا شرائح 30/60/90.
 * • فشل أي كتلة يعزل نفسه ولا يمس بقية الكتل، والقراءة لا تكتب سجلًا واحدًا.
 */
import { describe, expect, it } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { CollectionService } from "@/application/collections/collectionService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import { DueDatesService } from "@/application/finance/dueDatesService";
import { UpcomingService } from "@/application/finance/upcomingService";
import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import type { StorageResult } from "@/storage/local/types";
import {
  calculateCostSnapshot,
  collectDeposit,
  createCraftOrder,
  registerDebt,
  transitionOrder,
} from "@micro-domain/craft-order/index.js";
import { createDirectSale } from "@micro-domain/direct-sale/index.js";

const NOW = "2026-09-16T09:00:00.000Z";
const now = () => NOW;

function makeServices(store: MemoryLocalStore) {
  const projectFinance = new ProjectFinancialService(store, now);
  const fulfillment = new FulfillmentService(store, now);
  const directSales = new DirectSaleService(store, now);
  const collections = new CollectionService(store, fulfillment, directSales, projectFinance, now);
  const schedules = new ScheduleService(store, now);
  const dueDates = new DueDatesService(store, collections, now);
  const upcoming = new UpcomingService(dueDates, collections, schedules, projectFinance);
  const supplierPurchases = new SupplierPurchaseService(store, now);
  return { projectFinance, upcoming, supplierPurchases };
}

async function seedPurchase(store: MemoryLocalStore, key: string, name: string, dueOn: string | null) {
  const result = await new SupplierPurchaseService(store, now).recordPurchase({
    supplierName: name,
    note: "اختبار قادم",
    purchasedOn: "2026-09-01",
    dueOn,
    totalMinor: 20000,
    initialPaidMinor: 0,
    idempotencyKey: key,
  });
  if (!result.ok) throw new Error(result.message);
}

function draftOrder(id: string, deliveryDate: string) {
  const cost = calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: "2026-08-20T09:00:00.000Z",
    freshnessDays: null,
  });
  return createCraftOrder({
    id,
    customerName: "ريم",
    itemName: "شال مطرز",
    specifications: "اختبار",
    quantity: 1,
    agreedPriceMinor: 9000,
    costSnapshot: cost,
    createdAt: "2026-08-20T09:00:00.000Z",
  });
}

async function seedDraftOrder(store: MemoryLocalStore, id: string, deliveryDate: string) {
  const saved = await store.saveOrder({
    id,
    order: draftOrder(id, deliveryDate),
    catalogItemId: null,
    deliveryDate,
    agreementSource: "walk_in",
    createdAt: "2026-08-20T09:00:00.000Z",
    updatedAt: "2026-09-01T09:00:00.000Z",
  });
  if (!saved.ok) throw new Error("order should save");
}

/** طلب مسلّم بدين مسجل — مصدر ذمة تحصيل حقيقي من مسار النطاق. */
async function deliveredOrderWithDebt(store: MemoryLocalStore, id: string) {
  let order = draftOrder(id, "2026-08-25");
  order = collectDeposit(order, 2000, `${id}-deposit`, "2026-08-20T10:00:00.000Z");
  for (const [to, stamp] of [
    ["provisional_agreement", "2026-08-20T11:00:00.000Z"],
    ["confirmed", "2026-08-21T09:00:00.000Z"],
    ["in_progress", "2026-08-22T09:00:00.000Z"],
    ["ready", "2026-08-23T09:00:00.000Z"],
    ["delivered", "2026-08-25T09:00:00.000Z"],
  ] as const)
    order = transitionOrder(order, { to, idempotencyKey: `${id}-${to}`, createdAt: stamp });
  const orderWithDebt = registerDebt(order, `${id}-register-debt`, NOW);
  const saved = await store.saveOrder({
    id,
    order: orderWithDebt,
    catalogItemId: null,
    deliveryDate: "2026-08-25",
    agreementSource: "walk_in",
    createdAt: "2026-08-20T09:00:00.000Z",
    updatedAt: "2026-08-25T09:00:00.000Z",
  });
  if (!saved.ok) throw new Error("order should save");
}

async function seedSaleDebt(store: MemoryLocalStore) {
  await store.saveDirectSale(
    createDirectSale({
      id: "sale-upcoming-1",
      itemName: "كعكة",
      quantity: 1,
      revenueMinor: 1200,
      collectedMinor: 400,
      collectionStatus: "partial_debt",
      catalogItemId: null,
      customerName: "سما",
      costMinor: 300,
      occurredOn: "2026-09-01",
      recordedAt: NOW,
      note: "بيع آجل",
      idempotencyKey: "sale-upcoming-1-key",
    }),
  );
}

async function seedObligation(projectFinance: ProjectFinancialService) {
  const result = await projectFinance.record({
    type: "operating_expense_payable",
    amountMinor: 15000,
    occurredOn: "2026-09-12",
    note: "كهرباء الورشة",
    counterparty: null,
    relatedEventId: null,
    expenseContext: {
      relationship: "project",
      behavior: "fixed",
      purpose: "project_general",
      knowledge: "known",
      sharedProjectShare: null,
      categoryLabel: "كهرباء",
    },
    idempotencyKey: "upcoming-obligation-1",
  });
  if (!result.ok) throw new Error(result.message);
}

class FailingPurchasesStore extends MemoryLocalStore {
  async listSupplierPurchases(): Promise<StorageResult<readonly SupplierPurchase[]>> {
    return { ok: false, code: "storage_error", message: "فشل قراءة مفتعل" };
  }
}

describe("Stage 2 — OPS-005/006: القارئ الموحد للقادم والمتأخر", () => {
  it("يجمع أربع كتل بمصادر وتواريخ معلنة، والتقادم المبسط من مصدر OPS-001", async () => {
    const store = new MemoryLocalStore();
    const { projectFinance, upcoming } = makeServices(store);
    await seedPurchase(store, "up-overdue", "مورد الأقمشة", "2026-09-10");
    await seedPurchase(store, "up-current", "مورد الخيوط", "2026-09-20");
    await seedDraftOrder(store, "order-upcoming", "2026-09-20");
    await deliveredOrderWithDebt(store, "order-debt");
    await seedSaleDebt(store);
    await seedObligation(projectFinance);

    const overview = await upcoming.readOverview();

    /* مدفوعات الموردين: تاريخ الاستحقاق المخزن + حالته. */
    expect(overview.payables.ok).toBe(true);
    if (!overview.payables.ok) return;
    const payableTitles = overview.payables.entries.map(entry => entry.title);
    expect(payableTitles).toContain("مورد الأقمشة");
    expect(payableTitles).toContain("مورد الخيوط");
    for (const entry of overview.payables.entries) {
      expect(entry.kind).toBe("supplier_payable");
      expect(entry.dateKind).toBe("supplier_due");
      expect(entry.amountMinor).toBe(20000);
      expect(entry.sourceHref).toContain("/suppliers/purchase/");
    }

    /* الطلبات: الموعد المجدول فقط — لا مبلغ نقدي على موعد تنفيذ. */
    expect(overview.orders.ok).toBe(true);
    if (!overview.orders.ok) return;
    const upcomingOrder = overview.orders.entries.find(entry => entry.id === "order-upcoming");
    expect(upcomingOrder?.dateKind).toBe("scheduled_date");
    expect(upcomingOrder?.dueOn).toBe("2026-09-20");
    expect(upcomingOrder?.dateState).toBe("upcoming");
    expect(upcomingOrder?.amountMinor).toBeNull();
    /* الطلب المسلّم لا يظهر في جدول القادم (مكتمل/مغلق). */
    expect(overview.orders.entries.find(entry => entry.id === "order-debt")).toBeUndefined();

    /* ذمم التحصيل: بلا تاريخ مخزّن — والمبالغ ظاهرة (غياب التاريخ ليس غياب الدين). */
    expect(overview.receivables.ok).toBe(true);
    if (!overview.receivables.ok) return;
    expect(overview.receivables.entries).toHaveLength(2);
    for (const entry of overview.receivables.entries) {
      expect(entry.dueOn).toBeNull();
      expect(entry.dateState).toBe("none");
      expect(entry.dateKind).toBe("no_stored_date");
      expect(entry.amountMinor).toBeGreaterThan(0);
    }

    /* الالتزامات المستحقة: بلا تاريخ مخزّن والمتبقي يُقرأ. */
    expect(overview.obligations.ok).toBe(true);
    if (!overview.obligations.ok) return;
    expect(overview.obligations.entries).toHaveLength(1);
    expect(overview.obligations.entries[0]?.amountMinor).toBe(15000);
    expect(overview.obligations.entries[0]?.dueOn).toBeNull();

    /* التقادم المبسط: من إجماليات OPS-001 نفسها — بلا شرائح 30/60/90. */
    expect(overview.aging.payables).toEqual({
      overdueMinor: 20000,
      currentMinor: 20000,
      unknownMinor: 0,
      overdueCount: 1,
      currentCount: 1,
      unknownCount: 0,
    });
    expect(overview.aging.receivables).toEqual({ totalMinor: 7800, count: 2 });
    expect(overview.aging.obligations).toEqual({ totalMinor: 15000, count: 1 });
  });

  it("فشل كتلة يعزل نفسه: المدفوعات تتعثر والبقية سليمة والتقادم يعلن غير المتاح لجزأه", async () => {
    const store = new FailingPurchasesStore();
    const { projectFinance, upcoming } = makeServices(store);
    await deliveredOrderWithDebt(store, "order-debt-2");
    await seedObligation(projectFinance);
    await seedSaleDebt(store);

    const overview = await upcoming.readOverview();
    expect(overview.payables.ok).toBe(false);
    if (overview.payables.ok) return;
    expect(overview.payables.code).toBe("storage_error");
    expect(overview.orders.ok).toBe(true);
    expect(overview.receivables.ok).toBe(true);
    expect(overview.obligations.ok).toBe(true);
    expect(overview.aging.payables).toBeNull();
    expect(overview.aging.receivables?.totalMinor).toBe(7800);
    expect(overview.aging.obligations?.totalMinor).toBe(15000);
  });

  it("القراءة الموحدة لا تكتب سجلًا واحدًا — مطابقة اللقطة قبل/بعد", async () => {
    const store = new MemoryLocalStore();
    const { projectFinance, upcoming } = makeServices(store);
    await seedPurchase(store, "up-no-write", "مورد القراءة", "2026-09-10");
    await seedObligation(projectFinance);
    const before = await store.readSnapshot();
    const overview = await upcoming.readOverview();
    expect(overview.payables.ok).toBe(true);
    const after = await store.readSnapshot();
    expect(after.ok && before.ok ? after.value : after).toEqual(before.ok ? before.value : before);
  });
});
