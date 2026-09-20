/** Stage 2 — OPS-001 (tracker): اختبارات مواعيد الاستحقاق والتقادم الأساسي.
 * ---------------------------------------------------------------------------
 * • تصنيف التاريخ مقابل اليوم: المفقود ليس اليوم ولا الصفر، وغير الصالح يُعلن.
 * • التقادم الأساسي يميز المتأخر عن الحالي دون اختراع تاريخ، والمسدد خارج القراءة.
 * • ذمم التحصيل: «بلا تاريخ» مصرّح به والمبالغ تُقرأ — غياب التاريخ ليس غياب الدين.
 * • القراءة لا تكتب سجلًا واحدًا (مطابقة اللقطة قبل/بعد)، والفشل التخزيني صادق.
 */
import { describe, expect, it } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { CollectionService } from "@/application/collections/collectionService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { DueDatesService } from "@/application/finance/dueDatesService";
import { classifyDueDate, dueAgingBucket } from "@/application/finance/dueDateAging";
import type { StorageResult } from "@/storage/local/types";
import {
  calculateCostSnapshot,
  collectDeposit,
  createCraftOrder,
  registerDebt,
  transitionOrder,
} from "@micro-domain/craft-order/index.js";
import { createDirectSale } from "@micro-domain/direct-sale/index.js";
import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";

const NOW = "2026-09-16T09:00:00.000Z";
const now = () => NOW;

function makeServices(store: MemoryLocalStore, nowFn: () => string = now) {
  const projectFinance = new ProjectFinancialService(store, nowFn);
  const fulfillment = new FulfillmentService(store, nowFn);
  const directSales = new DirectSaleService(store, nowFn);
  const collections = new CollectionService(store, fulfillment, directSales, projectFinance, nowFn);
  const dueDates = new DueDatesService(store, collections, nowFn);
  const supplierPurchases = new SupplierPurchaseService(store, nowFn);
  return { dueDates, supplierPurchases, collections };
}

async function seedPurchase(
  store: MemoryLocalStore,
  input: { key: string; name: string; dueOn: string | null; total: number; paid: number },
) {
  const result = await new SupplierPurchaseService(store, now).recordPurchase({
    supplierName: input.name,
    note: "اختبار تقادم",
    purchasedOn: "2026-09-01",
    dueOn: input.dueOn,
    totalMinor: input.total,
    initialPaidMinor: input.paid,
    idempotencyKey: input.key,
  });
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

/** طلب مسلّم بدين مسجل — مصدر ذمة تحصيل حقيقي من مسار النطاق. */
async function deliveredOrderWithDebt(store: MemoryLocalStore, id: string, price = 10000) {
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
  let order = createCraftOrder({
    id,
    customerName: "خالد",
    itemName: "طقم مطرز",
    specifications: "اختبار",
    quantity: 1,
    agreedPriceMinor: price,
    costSnapshot: cost,
    createdAt: "2026-08-20T09:00:00.000Z",
  });
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

class FailingPurchasesStore extends MemoryLocalStore {
  async listSupplierPurchases(): Promise<StorageResult<readonly SupplierPurchase[]>> {
    return { ok: false, code: "storage_error", message: "فشل قراءة مفتعل" };
  }
}

class FailingOrdersStore extends MemoryLocalStore {
  async listOrders() {
    return { ok: false, code: "storage_error", message: "فشل قراءة مفتعل" } as const;
  }
}

describe("Stage 2 — OPS-001: تصنيف تاريخ الاستحقاق", () => {
  const today = "2026-09-16";

  it("المفقود ليس اليوم ولا الصفر؛ وغير الصالح يُعلن ولا يُعوّض", () => {
    expect(classifyDueDate(null, today)).toBe("none");
    expect(classifyDueDate("2026-02-30", today)).toBe("invalid");
    expect(classifyDueDate("2026-09-10", today)).toBe("overdue");
    expect(classifyDueDate(today, today)).toBe("today");
    expect(classifyDueDate("2026-09-20", today)).toBe("upcoming");
  });

  it("التقادم الأساسي: متأخر / حالي / مجهول — دون اختراع تاريخ", () => {
    expect(dueAgingBucket("overdue")).toBe("overdue");
    expect(dueAgingBucket("today")).toBe("current");
    expect(dueAgingBucket("upcoming")).toBe("current");
    expect(dueAgingBucket("none")).toBe("unknown");
    expect(dueAgingBucket("invalid")).toBe("unknown");
  });
});

describe("Stage 2 — OPS-001: تقادم الذمم الدائنة (readPayablesAging)", () => {
  it("يميز المتأخر عن الحالي عن المجهول بالمبالغ، والمسدّد خارج القراءة", async () => {
    const store = new MemoryLocalStore();
    const { dueDates } = makeServices(store);
    await seedPurchase(store, {
      key: "aging-overdue",
      name: "مورد الأقمشة",
      dueOn: "2026-09-10",
      total: 20000,
      paid: 0,
    });
    await seedPurchase(store, {
      key: "aging-current",
      name: "مورد الخيوط",
      dueOn: "2026-09-20",
      total: 15000,
      paid: 0,
    });
    await seedPurchase(store, {
      key: "aging-today",
      name: "مورد الأصباغ",
      dueOn: "2026-09-16",
      total: 5000,
      paid: 0,
    });
    await seedPurchase(store, { key: "aging-unset", name: "مورد الحروف", dueOn: null, total: 8000, paid: 0 });
    await seedPurchase(store, {
      key: "aging-paid",
      name: "مورد مسدد",
      dueOn: "2026-09-01",
      total: 3000,
      paid: 3000,
    });

    const result = await dueDates.readPayablesAging();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byKey = new Map(result.value.rows.map(row => [row.supplierName, row]));
    expect(byKey.get("مورد الأقمشة")?.dueState).toBe("overdue");
    expect(byKey.get("مورد الأقمشة")?.agingBucket).toBe("overdue");
    expect(byKey.get("مورد الخيوط")?.agingBucket).toBe("current");
    expect(byKey.get("مورد الأصباغ")?.dueState).toBe("today");
    expect(byKey.get("مورد الأصباغ")?.agingBucket).toBe("current");
    expect(byKey.get("مورد الحروف")?.dueState).toBe("none");
    expect(byKey.get("مورد الحروف")?.agingBucket).toBe("unknown");
    expect(byKey.has("مورد مسدد")).toBe(false);
    expect(result.value.totals).toEqual({
      overdueMinor: 20000,
      currentMinor: 20000,
      unknownMinor: 8000,
      overdueCount: 1,
      currentCount: 2,
      unknownCount: 1,
    });
  });

  it("حد اليوم المحلي (عمّان) يتبع الساعة القابلة للحقن لا تاريخ UTC", async () => {
    const store = new MemoryLocalStore();
    await seedPurchase(store, {
      key: "boundary-purchase",
      name: "مورد الحدود",
      dueOn: "2026-09-16",
      total: 9000,
      paid: 0,
    });
    /* 09:00Z = 12:00 عمّان → اليوم 2026-09-16 → الاستحقاق اليوم (حالي). */
    const morning = new DueDatesService(
      store,
      new CollectionService(store),
      () => "2026-09-16T09:00:00.000Z",
    );
    const morningResult = await morning.readPayablesAging();
    expect(morningResult.ok && morningResult.value.rows[0]?.dueState).toBe("today");
    /* 21:30Z = 00:30 عمّان اليوم التالي → اليوم 2026-09-17 → الاستحقاق متأخر. */
    const night = new DueDatesService(store, new CollectionService(store), () => "2026-09-16T21:30:00.000Z");
    const nightResult = await night.readPayablesAging();
    expect(nightResult.ok && nightResult.value.rows[0]?.dueState).toBe("overdue");
  });

  it("فتح القراءة لا يكتب سجلًا واحدًا — مطابقة اللقطة قبل/بعد", async () => {
    const store = new MemoryLocalStore();
    const { dueDates } = makeServices(store);
    await seedPurchase(store, {
      key: "no-write",
      name: "مورد القراءة",
      dueOn: "2026-09-10",
      total: 4000,
      paid: 0,
    });
    const before = await store.readSnapshot();
    const result = await dueDates.readPayablesAging();
    expect(result.ok).toBe(true);
    const after = await store.readSnapshot();
    expect(after.ok && before.ok ? after.value : after).toEqual(before.ok ? before.value : before);
  });

  it("فشل قراءة المشتريات يعيد فشلًا صادقًا لا تقادمًا جزئيًا", async () => {
    const store = new FailingPurchasesStore();
    const { dueDates } = makeServices(store);
    const result = await dueDates.readPayablesAging();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("storage_error");
    expect(result.message).toBeTruthy();
  });
});

describe("Stage 2 — OPS-001: ذمم التحصيل «بلا تاريخ» (readReceivablesDueState)", () => {
  it("يقرأ الذمم بمبالغها مع تصريح صريح بغياب تاريخ الاستحقاق — غياب التاريخ ليس غياب الدين", async () => {
    const store = new MemoryLocalStore();
    const { dueDates } = makeServices(store);
    await deliveredOrderWithDebt(store, "order-due-1");
    await store.saveDirectSale(
      createDirectSale({
        id: "sale-due-1",
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
        idempotencyKey: "sale-due-1-key",
      }),
    );
    const result = await dueDates.readReceivablesDueState();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    for (const row of result.value) {
      expect(row.dueOn).toBeNull();
      expect(row.dueState).toBe("none");
      expect(row.outstandingMinor).toBeGreaterThan(0);
    }
    const orderRow = result.value.find(row => row.sourceKind === "order");
    const saleRow = result.value.find(row => row.sourceKind === "direct_sale");
    expect(orderRow?.outstandingMinor).toBe(8000);
    expect(saleRow?.outstandingMinor).toBe(800);
  });

  it("فشل قراءة الذمم يظهر فشلًا صادقًا", async () => {
    const store = new FailingOrdersStore();
    const { dueDates } = makeServices(store);
    const result = await dueDates.readReceivablesDueState();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("storage_error");
  });
});
