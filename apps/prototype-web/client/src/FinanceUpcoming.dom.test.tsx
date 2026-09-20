/** @vitest-environment jsdom */
/* Stage 2 — OPS-005/006 (tracker): سطح «القادم والاستحقاقات» — قراءة موحدة
 * بمعنى ومصدر لكل نوع تاريخ؛ المجهول يبقى «بلا تاريخ استحقاق مخزّن»
 * والمبالغ ظاهرة (غياب التاريخ ليس غياب الدين)، والفتح لا يكتب سجلًا،
 * وفشل أي كتلة يعزل نفسه ببطاقة صادقة وإعادة محاولة والبقية حية. */
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { DueDatesService } from "@/application/finance/dueDatesService";
import { UpcomingService } from "@/application/finance/upcomingService";
import { CollectionService } from "@/application/collections/collectionService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { ScheduleService } from "@/application/scheduling/scheduleService";
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
import FinanceUpcoming from "@/pages/FinanceUpcoming";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({ navigate: vi.fn(), location: "/finance/upcoming" }));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useSearch: () => "",
  useParams: () => ({}),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-16T09:00:00.000Z";

function buildServices(store: MemoryLocalStore) {
  const projectFinance = new ProjectFinancialService(store, () => NOW);
  const fulfillment = new FulfillmentService(store, () => NOW);
  const directSales = new DirectSaleService(store, () => NOW);
  const collections = new CollectionService(store, fulfillment, directSales, projectFinance, () => NOW);
  const schedules = new ScheduleService(store, () => NOW);
  const dueDates = new DueDatesService(store, collections, () => NOW);
  const upcoming = new UpcomingService(dueDates, collections, schedules, projectFinance);
  return {
    upcoming,
    dataVersion: 0,
    notifyDataChanged: () => undefined,
  } as unknown as ReturnType<typeof usePrototypeServices>;
}

function orderFor(id: string, deliveryDate: string) {
  const cost = calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    source: "draft",
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
    order: orderFor(id, deliveryDate),
    catalogItemId: null,
    deliveryDate,
    agreementSource: "walk_in",
    createdAt: "2026-08-20T09:00:00.000Z",
    updatedAt: "2026-09-01T09:00:00.000Z",
  });
  if (!saved.ok) throw new Error("order should save");
}

async function seedPurchase(store: MemoryLocalStore, key: string, name: string, dueOn: string | null) {
  const result = await new SupplierPurchaseService(store, () => NOW).recordPurchase({
    supplierName: name,
    note: "اختبار سطح قادم",
    purchasedOn: "2026-09-01",
    dueOn,
    totalMinor: 20000,
    initialPaidMinor: 0,
    idempotencyKey: key,
  });
  if (!result.ok) throw new Error(result.message);
}

async function seedReceivableDebt(store: MemoryLocalStore) {
  let order = orderFor("order-debt-dom", "2026-08-25");
  order = collectDeposit(order, 2000, "order-debt-dom-deposit", "2026-08-20T10:00:00.000Z");
  for (const [to, stamp] of [
    ["provisional_agreement", "2026-08-20T11:00:00.000Z"],
    ["confirmed", "2026-08-21T09:00:00.000Z"],
    ["in_progress", "2026-08-22T09:00:00.000Z"],
    ["ready", "2026-08-23T09:00:00.000Z"],
    ["delivered", "2026-08-25T09:00:00.000Z"],
  ] as const)
    order = transitionOrder(order, { to, idempotencyKey: `order-debt-dom-${to}`, createdAt: stamp });
  const orderWithDebt = registerDebt(order, "order-debt-dom-register", NOW);
  const saved = await store.saveOrder({
    id: "order-debt-dom",
    order: orderWithDebt,
    catalogItemId: null,
    deliveryDate: "2026-08-25",
    agreementSource: "walk_in",
    createdAt: "2026-08-20T09:00:00.000Z",
    updatedAt: "2026-08-25T09:00:00.000Z",
  });
  if (!saved.ok) throw new Error("order should save");
  await store.saveDirectSale(
    createDirectSale({
      id: "sale-upcoming-dom",
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
      idempotencyKey: "sale-upcoming-dom-key",
    }),
  );
}

async function seedObligation(store: MemoryLocalStore) {
  const result = await new ProjectFinancialService(store, () => NOW).record({
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
    idempotencyKey: "upcoming-dom-obligation",
  });
  if (!result.ok) throw new Error(result.message);
}

class FailingSupplierReads extends MemoryLocalStore {
  async listSupplierPurchases(): Promise<StorageResult<readonly SupplierPurchase[]>> {
    return { ok: false, code: "storage_error", message: "فشل قراءة مفتعل" };
  }
}

let store: MemoryLocalStore;

beforeEach(() => {
  store = new MemoryLocalStore();
  wouterMocks.navigate.mockReset();
  mockedUsePrototypeServices.mockReturnValue(buildServices(store));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Stage 2 — OPS-005/006: سطح القادم والاستحقاقات", () => {
  it("يعرض أربع كتل بمعنى ومصدر لكل موعد — والمجهول مبقى مبالغه ظاهرة", async () => {
    await seedPurchase(store, "dom-up-overdue", "مورد الأقمشة", "2026-09-10");
    await seedPurchase(store, "dom-up-current", "مورد الخيوط", "2026-09-20");
    await seedDraftOrder(store, "order-upcoming-dom", "2026-09-20");
    await seedReceivableDebt(store);
    await seedObligation(store);

    render(<FinanceUpcoming />);

    /* الطلبات: الموعد المجدول وحالته — لا مبلغ نقدي على موعد تنفيذ. */
    const ordersSection = await screen.findByLabelText("طلبات قادمة ومتأخرة");
    expect(within(ordersSection).getByText("شال مطرز")).toBeTruthy();
    const orderRow = within(ordersSection).getByText("شال مطرز").closest("article");
    expect(orderRow?.textContent).toContain("الموعد المجدول");
    expect(orderRow?.textContent).toContain("20/09/2026");
    expect(orderRow?.textContent).toContain("قادم");
    expect(orderRow?.textContent).not.toContain("المتبقي");

    /* مدفوعات الموردين: الاستحقاق المخزن + التصنيف الصادق. */
    const payablesSection = screen.getByLabelText("مدفوعات قادمة للموردين");
    expect(within(payablesSection).getByText("مورد الأقمشة")).toBeTruthy();
    const overdueRow = within(payablesSection).getByText("مورد الأقمشة").closest("article");
    expect(overdueRow?.textContent).toContain("الاستحقاق");
    expect(overdueRow?.textContent).toContain("10/09/2026");
    expect(overdueRow?.textContent).toContain("متأخر");
    expect(overdueRow?.textContent).toContain("200.00");

    /* ذمم التحصيل: بلا تاريخ مخزّن — والمبلغ ظاهر (غياب التاريخ ليس غياب الدين). */
    const receivablesSection = screen.getByLabelText("تحصيلات عند الناس");
    const receivableRow = within(receivablesSection).getByText("سما").closest("article");
    expect(receivableRow?.textContent).toContain("بلا تاريخ استحقاق مخزّن");
    expect(receivableRow?.textContent).toContain("8.00");
    expect(receivableRow?.textContent).not.toContain("16/09/2026");

    /* الالتزامات: التسمية الكنونية + المتبقي. */
    const obligationsSection = screen.getByLabelText("التزامات مصاريف مستحقة");
    const obligationRow = within(obligationsSection).getByText("كهرباء الورشة").closest("article");
    expect(obligationRow?.textContent).toContain("مصروف مستحق");
    expect(obligationRow?.textContent).toContain("150.00");
    expect(obligationRow?.textContent).toContain("بلا تاريخ استحقاق مخزّن");

    /* التقادم المبسط: من إجماليات OPS-001 — بلا شرائح 30/60/90. */
    const agingCard = screen.getByLabelText("تقادم مبسط");
    expect(agingCard.textContent).toContain("ما عليك للموردين");
    expect(agingCard.textContent).toContain("متأخر");
    expect(agingCard.textContent).toContain("لم يحن");
    expect(agingCard.textContent).toContain("بلا شرائح 30/60/90");
  });

  it("فتح السطح لا يكتب أي سجل — مطابقة اللقطة قبل/بعد", async () => {
    await seedPurchase(store, "dom-up-no-write", "مورد القراءة", "2026-09-10");
    await seedObligation(store);
    const before = await store.readSnapshot();
    render(<FinanceUpcoming />);
    await screen.findByText("مورد القراءة");
    const after = await store.readSnapshot();
    expect(after.ok && before.ok ? after.value : after).toEqual(before.ok ? before.value : before);
  });

  it("فشل كتلة المدفوعات يعزل نفسه — بطاقة صادقة وإعادة محاولة والبقية حية", async () => {
    const failing = new FailingSupplierReads();
    await seedDraftOrder(failing, "order-upcoming-fail", "2026-09-20");
    await seedReceivableDebt(failing);
    await seedObligation(failing);
    /* الجدول يجلب مواعيده المشتقة مرة أولى (سلوكه القائم الحتمي — ليست كتابة
     * مالية)؛ بعد ذلك يبقى فتح السطح بلا أي كتابة كما يشهد القياس أدناه. */
    const materialized = await new ScheduleService(failing, () => NOW).overview();
    expect(materialized.ok).toBe(true);
    mockedUsePrototypeServices.mockReturnValue(buildServices(failing));
    const before = await failing.readSnapshot();

    render(<FinanceUpcoming />);

    /* الكتلة المتعثرة: بطاقة خطأ صادقة + إعادة محاولة. */
    expect(await screen.findByText("تعذّرت قراءة مدفوعات الموردين — هذا الجزء وحده.")).toBeTruthy();
    expect(screen.getByText("إعادة المحاولة")).toBeTruthy();
    /* الكتل السليمة تبقى حية. */
    expect(within(screen.getByLabelText("طلبات قادمة ومتأخرة")).getByText("شال مطرز")).toBeTruthy();
    expect(within(screen.getByLabelText("تحصيلات عند الناس")).getByText("سما")).toBeTruthy();
    expect(within(screen.getByLabelText("التزامات مصاريف مستحقة")).getByText("كهرباء الورشة")).toBeTruthy();
    /* تقادم المدفوعات يعلن «غير متاح» لا صفرًا كاذبًا. */
    const agingCard = screen.getByLabelText("تقادم مبسط");
    expect(agingCard.textContent).toContain("غير متاح");
    /* ولا كتابة رغم الفشل. */
    const after = await failing.readSnapshot();
    expect(after.ok && before.ok ? after.value : after).toEqual(before.ok ? before.value : before);
  });
});
