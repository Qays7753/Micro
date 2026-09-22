import { describe, expect, it, vi } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { PeriodComparisonService } from "./periodComparisonService";
import { ProjectFinancialService } from "./projectFinancialService";
import { calculateCostSnapshot, createCraftOrder, transitionOrder, type CraftOrder } from "@micro-domain/craft-order/index.js";
import { createDirectSale } from "@micro-domain/direct-sale/index.js";
import type { StoredCraftOrder } from "@/storage/local/types";

/* FIN-003 (WS-173): مقارنة فترتين فوق القارئ الكنوني وحده — البذرة حية
 * (MemoryLocalStore + خدمات حقيقية) كما في اختبارات الخدمة المالية، والقراءة
 * لا تكتب سجلًا واحدًا (مطابقة لقطة كاملة قبل/بعد). */

const now = () => "2026-10-05T09:00:00.000Z";

function knownSnapshot(id: string, timeRateMinor: number) {
  return calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: timeRateMinor, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: "2026-08-01T09:00:00.000Z",
    freshnessDays: null,
  });
}

function estimatedSnapshot(id: string) {
  return calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: 300, confidence: "estimated" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: "2026-08-01T09:00:00.000Z",
    freshnessDays: null,
  });
}

async function saveDeliveredOrder(
  store: MemoryLocalStore,
  input: { id: string; priceMinor: number; deliveredOn: string; stamp: string; estimated: boolean; timeRateMinor?: number },
): Promise<void> {
  let order: CraftOrder = createCraftOrder({
    id: input.id,
    customerName: "عميلة",
    itemName: "قطعة",
    specifications: "مقارنة فترتين",
    quantity: 1,
    agreedPriceMinor: input.priceMinor,
    costSnapshot: input.estimated
      ? estimatedSnapshot(input.id)
      : knownSnapshot(input.id, input.timeRateMinor ?? 500),
    createdAt: `${input.deliveredOn}T08:00:00.000Z`,
  });
  for (const [to, stamp] of [
    ["provisional_agreement", `${input.deliveredOn}T08:30:00.000Z`],
    ["confirmed", `${input.deliveredOn}T09:00:00.000Z`],
    ["in_progress", `${input.deliveredOn}T10:00:00.000Z`],
    ["ready", `${input.deliveredOn}T11:00:00.000Z`],
    ["delivered", input.stamp],
  ] as const)
    order = transitionOrder(order, { to, idempotencyKey: `${input.id}-${to}`, createdAt: stamp });
  const stored: StoredCraftOrder = {
    id: order.id,
    order,
    deliveryDate: input.deliveredOn,
    agreementSource: "test",
    createdAt: order.createdAt,
    updatedAt: input.stamp,
  };
  const saved = await store.saveOrder(stored);
  if (!saved.ok) throw new Error("order should save");
}

async function seedTwoMonths(store: MemoryLocalStore): Promise<void> {
  const finance = new ProjectFinancialService(store, now);
  /* آب: طلب نهائي + طلب مسلّم مستبعد (وقت مقدّر) + حصة مشتركة مستحقة. */
  await saveDeliveredOrder(store, {
    id: "aug-final",
    priceMinor: 3000,
    deliveredOn: "2026-08-05",
    stamp: "2026-08-05T09:00:00.000Z",
    estimated: false,
  });
  await saveDeliveredOrder(store, {
    id: "aug-excluded",
    priceMinor: 1200,
    deliveredOn: "2026-08-06",
    stamp: "2026-08-06T09:00:00.000Z",
    estimated: true,
  });
  const sharedPayable = await finance.record({
    type: "operating_expense_payable",
    amountMinor: 1500,
    occurredOn: "2026-08-20",
    note: "كهرباء — حصة مشروع متفق عليها",
    counterparty: " شركة كهرباء",
    relatedEventId: null,
    expenseContext: {
      relationship: "shared",
      behavior: "fixed",
      purpose: "period",
      knowledge: "known",
      sharedProjectShare: { basis: "agreed_fixed_share", note: "حصة ثابتة", allocation: "allocated" },
    },
    idempotencyKey: "cmp-shared-payable",
  });
  if (!sharedPayable.ok) throw new Error("shared payable should save");
  /* أيلول: طلب نهائي + بيع مباشر + مصروف مدفوع + تسديد التزام آب (لا مصروف ثانٍ). */
  await saveDeliveredOrder(store, {
    id: "sep-final",
    priceMinor: 2000,
    deliveredOn: "2026-09-05",
    stamp: "2026-09-05T09:00:00.000Z",
    estimated: false,
    timeRateMinor: 600,
  });
  const sale = createDirectSale({
    id: "sep-sale",
    itemName: "قطعة",
    quantity: 1,
    revenueMinor: 5000,
    collectedMinor: 5000,
    catalogItemId: null,
    customerName: null,
    costMinor: 2000,
    occurredOn: "2026-09-08",
    recordedAt: now(),
    note: "بيع مباشر لمقارنة الفترتين",
    idempotencyKey: "cmp-sale",
  });
  const savedSale = await store.saveDirectSale(sale);
  if (!savedSale.ok) throw new Error("direct sale should save");
  await finance.record({
    type: "operating_expense_cash",
    amountMinor: 300,
    occurredOn: "2026-09-03",
    note: "توصيل",
    counterparty: null,
    relatedEventId: null,
    expenseContext: { relationship: "project", behavior: "variable", purpose: "project_general", knowledge: "known" },
    idempotencyKey: "cmp-expense",
  });
  await finance.record({
    type: "payable_settlement_cash",
    amountMinor: 1500,
    occurredOn: "2026-09-05",
    note: "تسديد كهرباء آب",
    counterparty: "شركة كهرباء",
    relatedEventId: sharedPayable.value.id,
    idempotencyKey: "cmp-settlement",
  });
}

describe("PeriodComparisonService — two complete months over the canonical reader", () => {
  it("compares every canonical line side-by-side with signed deltas and safe percentages", async () => {
    const store = new MemoryLocalStore();
    await seedTwoMonths(store);
    const comparison = new PeriodComparisonService(store, now);
    const reading = await comparison.readPeriodComparison(
      { from: "2026-08-01", to: "2026-08-31" },
      { from: "2026-09-01", to: "2026-09-30" },
    );
    if (!reading.ok) throw new Error("comparison should read");
    const value = reading.value;
    const line = (id: string) => value.lines.find(item => item.id === id);
    /* الإيراد والتكلفة والمصاريف: قيم الطرفين من القارئ الكنوني كما هي. */
    expect(line("recognizedRevenue")).toMatchObject({ a: 3000, b: 2000, delta: -1000 });
    expect(line("recognizedDirectCost")).toMatchObject({ a: 500, b: 600, delta: 100 });
    /* الحصة المشتركة دخلت آب مرة واحدة بتاريخ occurredOn؛ التسديد في أيلول
     * لا يضيف مصروفًا ثانيًا (عقد 05 §3.2.1). */
    expect(line("sharedProjectExpense")).toMatchObject({ a: 1500, b: 0, delta: -1500 });
    expect(line("recordedOperatingExpense")).toMatchObject({ a: 1500, b: 300, delta: -1200 });
    expect(line("projectOperatingExpense")).toMatchObject({ a: 0, b: 300, delta: 300 });
    /* البيع المباشر في أيلول فقط؛ أساس صفر في آب يعني تغيّرًا غير قابل للنسبة (null). */
    expect(line("directSaleRevenue")).toMatchObject({ a: 0, b: 5000, delta: 5000, changeBps: null });
    expect(line("directSaleCostKnown")).toMatchObject({ a: 0, b: 2000, delta: 2000 });
    /* الطلب المستبعد مرئي في آب فقط — عدّاد صادق لا اختفاء. */
    expect(line("excludedOrderCount")).toMatchObject({ a: 1, b: 0, delta: -1 });
    expect(line("finalOrderCount")).toMatchObject({ a: 1, b: 1, delta: 0 });
    /* النتيجة: آب = 3000 − 500 − 1500 = 1000؛ أيلول = 2000 + 5000 − 600 − 2000 − 300 = 4100. */
    expect(value.sides.a.resultMinor).toBe(1000);
    expect(value.sides.b.resultMinor).toBe(4100);
    expect(value.deltaResultMinor).toBe(3100);
    expect(value.changeResultBps).toBe(31000);
    expect(line("resultMinor")).toMatchObject({ a: 1000, b: 4100, delta: 3100, changeBps: 31000 });
    /* أسوأ الحالتين: آب ناقصة (طلب مستبعد) وأيلول مسجلة فقط → المقارنة ناقصة. */
    expect(value.sides.a.status).toBe("incomplete");
    expect(value.sides.b.status).toBe("recorded_only");
    expect(value.sides.a.reasons).toContain("طلبات مستبعدة");
    expect(value.status).toBe("incomplete");
    /* فترتان مكتملتان (اليوم بعد أيلول) ولا تداخل. */
    expect(value.partial).toBe(false);
    expect(value.partialNote).toBeNull();
    expect(value.overlapping).toBe(false);
    expect(value.overlappingNote).toBeNull();
    expect(value.sides.a.hasNoData).toBe(false);
    expect(value.sides.b.hasNoData).toBe(false);
    /* كل سطر يحمل مصدره المعلن. */
    for (const item of value.lines) expect(item.source.trim().length).toBeGreaterThan(0);
  });

  it("routes both sides through the canonical reader twice — one code path, no parallel math", async () => {
    const store = new MemoryLocalStore();
    await seedTwoMonths(store);
    const spy = vi.spyOn(ProjectFinancialService.prototype, "readRecordedPeriodResult");
    const comparison = new PeriodComparisonService(store, now);
    await comparison.readPeriodComparison(
      { from: "2026-08-01", to: "2026-08-31" },
      { from: "2026-09-01", to: "2026-09-30" },
    );
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it("keeps an empty period as honest zeros with hasNoData (no invented narrative)", async () => {
    const store = new MemoryLocalStore();
    await seedTwoMonths(store);
    const comparison = new PeriodComparisonService(store, now);
    const reading = await comparison.readPeriodComparison(
      { from: "2026-08-01", to: "2026-08-31" },
      { from: "2026-10-01", to: "2026-10-31" },
    );
    if (!reading.ok) throw new Error("comparison should read");
    const value = reading.value;
    expect(value.sides.b.hasNoData).toBe(true);
    expect(value.sides.a.hasNoData).toBe(false);
    expect(value.sides.b.resultMinor).toBe(0);
    expect(value.sides.b.status).toBe("recorded_only");
    const resultLine = value.lines.find(item => item.id === "resultMinor");
    expect(resultLine).toMatchObject({ a: 1000, b: 0, delta: -1000 });
    /* فرق سالب على أساس موجب: نسبة صحيحة سالبة (−100%)، لا null ولا انفجار. */
    expect(resultLine?.changeBps).toBe(-10000);
    const revenueLine = value.lines.find(item => item.id === "recognizedRevenue");
    expect(revenueLine).toMatchObject({ a: 3000, b: 0, delta: -3000 });
    expect(revenueLine?.changeBps).toBe(-10000);
  });

  it("propagates an invalid side as an invalid comparison with a null result on that side", async () => {
    const store = new MemoryLocalStore();
    await seedTwoMonths(store);
    const comparison = new PeriodComparisonService(store, now);
    const reading = await comparison.readPeriodComparison(
      { from: "2026-08-01", to: "2026-08-31" },
      { from: "2026-09-20", to: "2026-09-01" },
    );
    if (!reading.ok) throw new Error("comparison should read");
    const value = reading.value;
    expect(value.sides.b.status).toBe("invalid");
    expect(value.sides.b.resultMinor).toBeNull();
    expect(value.sides.b.reasons).toContain("فترة غير صالحة");
    expect(value.status).toBe("invalid");
    expect(value.deltaResultMinor).toBeNull();
    expect(value.changeResultBps).toBeNull();
    const resultLine = value.lines.find(item => item.id === "resultMinor");
    expect(resultLine?.b).toBeNull();
    expect(resultLine?.delta).toBeNull();
    expect(resultLine?.changeBps).toBeNull();
  });

  it("flags a current period as partial with an explicit Arabic note — never silently complete", async () => {
    const store = new MemoryLocalStore();
    await seedTwoMonths(store);
    /* ساعة داخل أيلول: الفترة الجارية تحتوي اليوم → وسم صادق. */
    const inPeriodClock = () => "2026-09-12T10:00:00.000Z";
    const comparison = new PeriodComparisonService(store, inPeriodClock);
    const reading = await comparison.readPeriodComparison(
      { from: "2026-08-01", to: "2026-08-31" },
      { from: "2026-09-01", to: "2026-09-30" },
    );
    if (!reading.ok) throw new Error("comparison should read");
    expect(reading.value.partial).toBe(true);
    expect(reading.value.partialNote).toContain("فترة جارية");
    /* نفس القراءة بساعة بعد نهاية أيلول: بلا وسم. */
    const comparisonAfter = new PeriodComparisonService(store, now);
    const readingAfter = await comparisonAfter.readPeriodComparison(
      { from: "2026-08-01", to: "2026-08-31" },
      { from: "2026-09-01", to: "2026-09-30" },
    );
    if (!readingAfter.ok) throw new Error("comparison should read");
    expect(readingAfter.value.partial).toBe(false);
    expect(readingAfter.value.partialNote).toBeNull();
  });

  it("allows overlapping periods but flags them visibly", async () => {
    const store = new MemoryLocalStore();
    await seedTwoMonths(store);
    const comparison = new PeriodComparisonService(store, now);
    const reading = await comparison.readPeriodComparison(
      { from: "2026-08-01", to: "2026-09-15" },
      { from: "2026-09-01", to: "2026-09-30" },
    );
    if (!reading.ok) throw new Error("comparison should read");
    expect(reading.value.overlapping).toBe(true);
    expect(reading.value.overlappingNote).toContain("متداخلتان");
  });

  it("opens the comparison without writing a single record — full store deep-equality", async () => {
    const store = new MemoryLocalStore();
    await seedTwoMonths(store);
    const comparison = new PeriodComparisonService(store, now);
    const before = await store.readSnapshot();
    const reading = await comparison.readPeriodComparison(
      { from: "2026-08-01", to: "2026-08-31" },
      { from: "2026-09-01", to: "2026-09-30" },
    );
    expect(reading.ok).toBe(true);
    const after = await store.readSnapshot();
    expect(after.ok && before.ok ? after.value : after).toEqual(before.ok ? before.value : before);
  });
});
