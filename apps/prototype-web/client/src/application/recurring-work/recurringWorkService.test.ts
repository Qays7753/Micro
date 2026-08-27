import { describe, expect, it } from "vitest";
import { createCatalogItem, createMeasurementUnit } from "@micro-domain/catalog/index.js";
import { createActualTimeRecord } from "@micro-domain/actual-time/index.js";
import { calculateCostSnapshot, createCraftOrder, transitionOrder } from "@micro-domain/craft-order/index.js";
import { createInventoryMovement, createMaterial } from "@micro-domain/inventory-material/index.js";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { RecurringWorkService } from "./recurringWorkService";

const now = () => "2026-08-23T09:00:00.000Z";

function finalOrder(
  id: string,
  catalogItemId: string,
  knowledge: "known" | "estimated" = "known",
  quantity = 2,
) {
  const cost = calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    materialItems: [
      {
        name: "خشب",
        quantity: 1,
        unit: "قطعة",
        unitPriceMinor: 1000,
        priceDate: "2026-08-01",
        source: "user_input",
        confidence: knowledge === "known" ? "known" : "estimated",
      },
    ],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: knowledge === "known" ? "known" : "estimated" },
    packagingMinor: 100,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity,
    createdAt: "2026-08-01T09:00:00.000Z",
    freshnessDays: null,
  });
  let order = createCraftOrder({
    id,
    customerName: "عميلة تجريبية",
    itemName: "صندوق",
    specifications: "اختبار G4-B",
    quantity,
    agreedPriceMinor: 5000,
    costSnapshot: cost,
    createdAt: "2026-08-01T09:00:00.000Z",
  });
  for (const [to, stamp] of [
    ["provisional_agreement", "2026-08-01T10:00:00.000Z"],
    ["confirmed", "2026-08-01T11:00:00.000Z"],
    ["in_progress", "2026-08-02T09:00:00.000Z"],
    ["ready", "2026-08-03T09:00:00.000Z"],
    ["delivered", "2026-08-05T09:00:00.000Z"],
  ] as const)
    order = transitionOrder(order, { to, idempotencyKey: `${id}-${to}`, createdAt: stamp });
  return {
    id: order.id,
    order,
    catalogItemId,
    deliveryDate: "2026-08-05",
    agreementSource: "test" as const,
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-05T09:00:00.000Z",
  };
}

async function baseStore() {
  const store = new MemoryLocalStore();
  const item = createCatalogItem({
    id: "catalog-box",
    kind: "product",
    name: "صندوق",
    unitLabel: "قطعة",
    unitId: null,
    createdAt: now(),
    createdOperationKey: "catalog-box-create",
  });
  await store.saveCatalogItem(item);
  const stored = finalOrder("order-box", item.id);
  await store.saveOrder(stored);
  return { store, item, stored };
}

async function perUnitStore(quantities: readonly number[]) {
  const store = new MemoryLocalStore();
  const unit = createMeasurementUnit({
    id: "unit-piece",
    nameAr: "قطعة",
    dimension: "count",
    symbol: null,
    createdAt: now(),
    createdOperationKey: "unit-piece-create",
  });
  const item = createCatalogItem({
    id: "catalog-piece",
    kind: "product",
    name: "قطعة مخصصة",
    unitLabel: "قطعة",
    unitId: unit.id,
    createdAt: now(),
    createdOperationKey: "catalog-piece-create",
  });
  await store.saveMeasurementUnit(unit);
  await store.saveCatalogItem(item);
  const orders = quantities.map((quantity, index) =>
    finalOrder(`order-piece-${index + 1}`, item.id, "known", quantity),
  );
  for (const order of orders) await store.saveOrder(order);
  return { store, item, orders };
}

describe("RecurringWorkService G4-B", () => {
  it("keeps direct margin as the baseline and derives actual-time allocation and explicit waste separately", async () => {
    const { store, item, stored } = await baseStore();
    const material = createMaterial({
      id: "material-box",
      name: "خشب",
      unit: "piece",
      createdAt: now(),
      createdOperationKey: "material-box-create",
    });
    const opening = createInventoryMovement({
      id: "opening-box",
      materialId: material.id,
      type: "opening",
      occurredOn: "2026-08-01",
      recordedAt: now(),
      quantityDeltaMilli: 10_000,
      valueDeltaMinor: 10_000,
      note: "افتتاح",
      operationKey: "opening-box",
    });
    const waste = createInventoryMovement({
      id: "waste-box",
      materialId: material.id,
      type: "waste",
      occurredOn: "2026-08-05",
      recordedAt: now(),
      quantityDeltaMilli: -1_000,
      valueDeltaMinor: -1_000,
      note: "هدر اختبار",
      reason: "تلف أثناء القص",
      operationKey: "waste-box",
      wasteContext: { kind: "catalog_item", catalogItemId: item.id },
    });
    await store.commitInventory(material, [opening, waste]);
    await store.saveActualTimeRecord(
      createActualTimeRecord({
        id: "time-box",
        orderId: stored.id,
        minutesDelta: 60,
        recordedOn: "2026-08-05",
        createdAt: now(),
        note: "وقت فعلي",
        operationKey: "time-box",
      }),
    );
    const service = new RecurringWorkService(store, now);
    const policy = await service.createPolicy({
      catalogItemId: item.id,
      kind: "actual_time",
      amountMinor: null,
      rateMinor: 100,
      percentageBps: null,
      unitId: null,
      periodFrom: "2026-08-01",
      periodTo: "2026-08-31",
      startsOn: "2026-08-01",
      endsOn: "2026-08-31",
      source: "سجل الوقت",
      reason: "توزيع تكلفة التنفيذ",
      note: "سياسة اختبار مؤرخة",
      idempotencyKey: "policy-time",
    });
    expect(policy).toMatchObject({ ok: true, value: { kind: "actual_time", status: "active" } });
    const reading = await service.readRecurringWork("2026-08-01", "2026-08-31");
    expect(reading).toMatchObject({
      ok: true,
      value: {
        items: [
          {
            finalOrderCount: 1,
            recognizedRevenueMinor: 5000,
            directMarginMinor: 3400,
            time: { actualMinutes: 60, varianceMinutes: 0 },
            waste: { catalogItemWasteMinor: 1000, generalProjectWasteMinor: 0, unallocatedWasteMinor: 0 },
            allocation: { status: "known", amountMinor: 6000, resultMinor: -2600 },
          },
        ],
      },
    });
    const events = await store.listFinancialEvents();
    expect(events).toMatchObject({ ok: true, value: [] });
    const unchanged = await store.getOrder(stored.id);
    expect(unchanged).toMatchObject({
      ok: true,
      value: { order: { recognizedCostMinor: 1600, costSnapshot: { materialCostMinor: 1000 } } },
    });
  });

  it("calculates per-output-unit allocation from final quantityMilli once per period without mutating financial facts", async () => {
    const { store, item, orders } = await perUnitStore([0.333, 0.333, 0.334]);
    const service = new RecurringWorkService(store, now);
    await expect(
      service.createPolicy({
        catalogItemId: item.id,
        kind: "per_output_unit",
        amountMinor: null,
        rateMinor: null,
        rateMinorPerWholeUnit: 50,
        percentageBps: null,
        unitId: "unit-piece",
        periodFrom: "2026-08-01",
        periodTo: "2026-08-31",
        startsOn: "2026-08-01",
        endsOn: "2026-08-31",
        source: "سجل الإنتاج",
        reason: "توزيع لكل قطعة",
        note: "المعدل لكل وحدة كاملة",
        idempotencyKey: "policy-per-piece",
      }),
    ).resolves.toMatchObject({ ok: true });
    const before = await store.getOrder(orders[0]!.id);
    const reading = await service.readRecurringWork("2026-08-01", "2026-08-31");
    expect(reading).toMatchObject({
      ok: true,
      value: {
        items: [
          {
            outputQuantityMilli: 1_000,
            allocation: {
              status: "known",
              amountMinor: 50,
              resultMinor: 10_150,
              calculationNote: expect.stringContaining("مرة واحدة"),
            },
          },
        ],
      },
    });
    expect(await store.listFinancialEvents()).toMatchObject({ ok: true, value: [] });
    expect(await store.getOrder(orders[0]!.id)).toEqual(before);
  });

  it("shows 12.000 units at 0.50 JOD per whole unit as 6.00 JOD", async () => {
    const { store, item } = await perUnitStore([12]);
    const service = new RecurringWorkService(store, now);
    await expect(
      service.createPolicy({
        catalogItemId: item.id,
        kind: "per_output_unit",
        amountMinor: null,
        rateMinor: null,
        rateMinorPerWholeUnit: 50,
        percentageBps: null,
        unitId: "unit-piece",
        periodFrom: "2026-08-01",
        periodTo: "2026-08-31",
        startsOn: "2026-08-01",
        endsOn: "2026-08-31",
        source: "سجل الإنتاج",
        reason: "توزيع لكل قطعة",
        note: "المعدل لكل وحدة كاملة",
        idempotencyKey: "policy-per-piece-12",
      }),
    ).resolves.toMatchObject({ ok: true });
    await expect(service.readRecurringWork("2026-08-01", "2026-08-31")).resolves.toMatchObject({
      ok: true,
      value: { items: [{ outputQuantityMilli: 12_000, allocation: { status: "known", amountMinor: 600 } }] },
    });
  });

  it("returns incomplete instead of zero when actual time evidence is missing", async () => {
    const { store, item } = await baseStore();
    const service = new RecurringWorkService(store, now);
    await expect(
      service.createPolicy({
        catalogItemId: item.id,
        kind: "actual_time",
        amountMinor: null,
        rateMinor: 100,
        percentageBps: null,
        unitId: null,
        periodFrom: "2026-08-01",
        periodTo: "2026-08-31",
        startsOn: "2026-08-01",
        endsOn: "2026-08-31",
        source: "قرار المالك",
        reason: "قياس وقت التنفيذ",
        note: "تحتاج سجل وقت",
        idempotencyKey: "policy-missing-time",
      }),
    ).resolves.toMatchObject({ ok: true });
    await expect(service.readRecurringWork("2026-08-01", "2026-08-31")).resolves.toMatchObject({
      ok: true,
      value: {
        items: [
          {
            allocation: { status: "incomplete", amountMinor: null, resultMinor: null },
            time: { actualMinutes: null, notRecordedOrderCount: 1 },
            reasons: expect.arrayContaining(["لم تسجل وقتًا فعليًا لبعض الطلبات؛ هذا لا يعني صفر وقت."]),
          },
        ],
      },
    });
  });

  it("prevents overlapping active policies, reuses idempotent creation, and keeps revisions dated", async () => {
    const { store, item } = await baseStore();
    const service = new RecurringWorkService(store, now);
    const input = {
      catalogItemId: item.id,
      kind: "manual_amount" as const,
      amountMinor: 2500,
      rateMinor: null,
      percentageBps: null,
      unitId: null,
      periodFrom: "2026-08-01",
      periodTo: "2026-08-31",
      startsOn: "2026-08-01",
      endsOn: "2026-08-31",
      source: "فاتورة",
      reason: "توزيع واضح",
      note: "نسخة أولى",
      idempotencyKey: "policy-manual",
    };
    const first = await service.createPolicy(input);
    await expect(service.createPolicy(input)).resolves.toMatchObject({
      ok: true,
      reused: true,
      value: { id: first.ok ? first.value.id : "" },
    });
    await expect(service.createPolicy({ ...input, idempotencyKey: "policy-overlap" })).resolves.toMatchObject(
      { ok: false, code: "validation_error" },
    );
    if (!first.ok) throw new Error("policy should save");
    const successor = await service.createPolicySuccessor(first.value.id, {
      kind: "manual_amount",
      amountMinor: 3000,
      rateMinor: null,
      percentageBps: null,
      unitId: null,
      periodFrom: "2026-09-01",
      periodTo: "2026-09-30",
      startsOn: "2026-09-01",
      endsOn: "2026-09-30",
      source: "فاتورة جديدة",
      reason: "تغيرت التكلفة",
      note: "نسخة ثانية مؤرخة",
      idempotencyKey: "policy-successor",
    });
    expect(successor).toMatchObject({ ok: true, value: { version: 2, successorOfPolicyId: first.value.id } });
    const previous = await store.getAllocationPolicy(first.value.id);
    expect(previous).toMatchObject({ ok: true, value: { status: "inactive", endsOn: "2026-08-31" } });
  });
});
