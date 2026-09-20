/** Stage 2 — OPS-004 (tracker): اختبارات قراءة التكلفة/الكمية المخططتين للقوالب.
 * ---------------------------------------------------------------------------
 * • مصدر واحد: الكمية من مكوّنات القالب؛ السعر من الدليل الكنوني لمقترحات
 *   المواد (آخر استلام)؛ الرياضيات بمعيّنات الحدّ المشتركة نفسها.
 * • لا كتابة أبدًا: لا حركة مخزون ولا COGS ولا استهلاك ولا حدث نقدي — مطابقة
 *   اللقطة قبل/بعد.
 * • حالات المعرفة الصادقة: تقديري / ناقص / غير متاح — الغياب ليس صفرًا،
 *   والوحدة غير المطابقة لا يُخمّن تحويلها.
 */
import { describe, expect, it } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { TemplatePlannedCostService } from "@/application/catalog/templatePlannedCostService";
import type { CatalogTemplate, MeasurementUnit } from "@micro-domain/catalog/index.js";
import type { InventoryMovement, Material } from "@micro-domain/inventory-material/index.js";
import { createInventoryMovement, createMaterial } from "@micro-domain/inventory-material/index.js";

const NOW = "2026-09-16T09:00:00.000Z";
const now = () => NOW;

function makeServices(store: MemoryLocalStore) {
  const inventory = new InventoryMaterialService(store, now);
  const plannedCost = new TemplatePlannedCostService(store, inventory);
  return { inventory, plannedCost };
}

async function seedMaterialWithReceipt(
  store: MemoryLocalStore,
  input: {
    id: string;
    name: string;
    unit: "meter" | "piece";
    receipt?: { quantityMilli: number; valueMinor: number };
  },
) {
  const material: Material = createMaterial({
    id: input.id,
    name: input.name,
    unit: input.unit,
    createdAt: NOW,
    createdOperationKey: `${input.id}-create`,
  });
  const movements: InventoryMovement[] = input.receipt
    ? [
        createInventoryMovement({
          id: `${input.id}-receipt-1`,
          materialId: input.id,
          type: "purchase_receipt",
          quantityDeltaMilli: input.receipt.quantityMilli,
          valueDeltaMinor: input.receipt.valueMinor,
          occurredOn: "2026-09-01",
          recordedAt: NOW,
          note: "استلام اختبار",
          operationKey: `${input.id}-receipt-key`,
          purchaseId: `${input.id}-purchase-1`,
          orderId: null,
        }),
      ]
    : [];
  const committed = await store.commitInventory(material, movements);
  if (!committed.ok) throw new Error(committed.message);
}

async function seedUnit(
  store: MemoryLocalStore,
  id: string,
  nameAr: string,
  dimension: MeasurementUnit["dimension"],
) {
  const unit: MeasurementUnit = {
    id,
    nameAr,
    dimension,
    symbol: null,
    active: true,
    createdAt: NOW,
    updatedAt: NOW,
    createdOperationKey: `${id}-create`,
  };
  const saved = await store.saveMeasurementUnit(unit);
  if (!saved.ok) throw new Error(saved.message);
}

async function seedTemplate(store: MemoryLocalStore, template: CatalogTemplate) {
  const saved = await store.saveCatalogTemplate(template);
  if (!saved.ok) throw new Error(saved.message);
}

function baseTemplate(overrides: Partial<CatalogTemplate>): CatalogTemplate {
  return {
    id: "template-1",
    catalogItemId: "item-1",
    title: "قالب الشال",
    note: null,
    components: [],
    yield: null,
    yieldReadiness: "not_configured",
    extras: null,
    revision: 1,
    sourceTemplateId: null,
    active: true,
    createdAt: NOW,
    updatedAt: NOW,
    createdOperationKey: "template-1-create",
    ...overrides,
  };
}

describe("Stage 2 — OPS-004: قراءة التكلفة/الكمية المخططتين للقالب", () => {
  it("تقدير كامل المعرفة: سعر الدليل الكنوني + بنود القالب — بمعيّن الحدّ المشترك نفسه", async () => {
    const store = new MemoryLocalStore();
    const { plannedCost } = makeServices(store);
    /* استلام 2000 ملي بمتر بقيمة 3000 قرش → سعر الوحدة 1.500 د.أ (roundHalfUp(3000×1000،2000)). */
    await seedMaterialWithReceipt(store, {
      id: "mat-1",
      name: "خيط التطريز",
      unit: "meter",
      receipt: { quantityMilli: 2000, valueMinor: 3000 },
    });
    await seedUnit(store, "unit-meter", "متر", "distance");
    await seedTemplate(
      store,
      baseTemplate({
        components: [
          {
            id: "comp-1",
            name: "خيط",
            quantityMilli: 3000,
            unitId: "unit-meter",
            note: null,
            materialId: "mat-1",
          },
        ],
        extras: {
          timeMinutes: 60,
          hourlyRateMinor: 500,
          packagingMinor: 100,
          deliveryMinor: 0,
          wasteMinor: 0,
          safetyBufferMinor: 50,
        },
        yield: { quantityMilli: 1000, unitId: "unit-meter" },
        yieldReadiness: "ready",
      }),
    );

    const result = await plannedCost.readForTemplate("template-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cost = result.value;
    /* الكمية المخططة من المكوّنات والناتج كما سُجّلا. */
    expect(cost.plannedQuantityMilli).toBe(3000);
    expect(cost.yieldQuantityMilli).toBe(1000);
    expect(cost.componentCount).toBe(1);
    /* المكوّن: مُسعّر من آخر استلام — roundHalfUp(3000×1500،1000) = 4500. */
    expect(cost.components[0]?.state).toBe("priced");
    expect(cost.components[0]?.unitPriceMinor).toBe(1500);
    expect(cost.components[0]?.componentMinor).toBe(4500);
    expect(cost.materialMinor).toBe(4500);
    /* الوقت: roundHalfUp(60×500،60) = 500. */
    expect(cost.timeMinor).toBe(500);
    /* التقدير الكامل: 4500 + 500 + 100 = 5100 — معرفة «تقديري». */
    expect(cost.plannedCostMinor).toBe(5100);
    expect(cost.knowledge).toBe("estimated");
    expect(cost.unpricedComponentCount).toBe(0);
  });

  it("بلا استلام للمادة: «بلا سعر معروف» — لا صفر ولا مجموع مضلل، والوقت يبقى ظاهرًا", async () => {
    const store = new MemoryLocalStore();
    const { plannedCost } = makeServices(store);
    await seedMaterialWithReceipt(store, { id: "mat-2", name: "قماش", unit: "meter" });
    await seedUnit(store, "unit-meter", "متر", "distance");
    await seedTemplate(
      store,
      baseTemplate({
        id: "template-2",
        components: [
          {
            id: "comp-2",
            name: "قماش القطعة",
            quantityMilli: 1000,
            unitId: "unit-meter",
            note: null,
            materialId: "mat-2",
          },
        ],
        extras: {
          timeMinutes: 30,
          hourlyRateMinor: 400,
          packagingMinor: 0,
          deliveryMinor: 0,
          wasteMinor: 0,
          safetyBufferMinor: 0,
        },
      }),
    );

    const result = await plannedCost.readForTemplate("template-2");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cost = result.value;
    expect(cost.components[0]?.state).toBe("no_linked_price");
    expect(cost.components[0]?.unitPriceMinor).toBeNull();
    expect(cost.materialMinor).toBeNull();
    expect(cost.timeMinor).toBe(200);
    expect(cost.plannedCostMinor).toBeNull();
    expect(cost.knowledge).toBe("incomplete");
  });

  it("وحدة المكوّن غير وحدة المادة: يُعلن ولا يُخمّن تحويل ولا يُقرّب", async () => {
    const store = new MemoryLocalStore();
    const { plannedCost } = makeServices(store);
    await seedMaterialWithReceipt(store, {
      id: "mat-3",
      name: "خرز",
      unit: "piece",
      receipt: { quantityMilli: 1000, valueMinor: 2000 },
    });
    await seedUnit(store, "unit-gram", "غرام", "mass");
    await seedTemplate(
      store,
      baseTemplate({
        id: "template-3",
        components: [
          {
            id: "comp-3",
            name: "خرز بالغرام",
            quantityMilli: 500,
            unitId: "unit-gram",
            note: null,
            materialId: "mat-3",
          },
        ],
      }),
    );

    const result = await plannedCost.readForTemplate("template-3");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.components[0]?.state).toBe("unit_mismatch");
    expect(result.value.components[0]?.componentMinor).toBeNull();
    /* لا شيء نقدي معروف إطلاقًا (لا مكوّن مُسعّر ولا وقت ولا بنود) → غير متاح. */
    expect(result.value.knowledge).toBe("unavailable");
  });

  it("مكوّن حر بلا مادة: حالة صادقة، وقالب بلا بنود ولا مكوّنات = غير متاح", async () => {
    const store = new MemoryLocalStore();
    const { plannedCost } = makeServices(store);
    await seedUnit(store, "unit-meter", "متر", "distance");
    await seedTemplate(
      store,
      baseTemplate({
        id: "template-4",
        components: [
          { id: "comp-4", name: "إبداع حر", quantityMilli: 100, unitId: "unit-meter", note: null },
        ],
      }),
    );
    await seedTemplate(store, baseTemplate({ id: "template-5" }));

    const free = await plannedCost.readForTemplate("template-4");
    expect(free.ok && free.value.components[0]?.state).toBe("free_component");
    expect(free.ok && free.value.knowledge).toBe("unavailable");

    const empty = await plannedCost.readForTemplate("template-5");
    expect(empty.ok && empty.value.knowledge).toBe("unavailable");
    expect(empty.ok && empty.value.plannedCostMinor).toBeNull();
    expect(empty.ok && empty.value.plannedQuantityMilli).toBe(0);
  });

  it("القراءة لا تكتب سجلًا واحدًا — مطابقة اللقطة قبل/بعد", async () => {
    const store = new MemoryLocalStore();
    const { plannedCost } = makeServices(store);
    await seedMaterialWithReceipt(store, {
      id: "mat-5",
      name: "خيط",
      unit: "meter",
      receipt: { quantityMilli: 1000, valueMinor: 1000 },
    });
    await seedUnit(store, "unit-meter", "متر", "distance");
    await seedTemplate(
      store,
      baseTemplate({
        id: "template-6",
        components: [
          {
            id: "comp-6",
            name: "خيط",
            quantityMilli: 1000,
            unitId: "unit-meter",
            note: null,
            materialId: "mat-5",
          },
        ],
      }),
    );
    const before = await store.readSnapshot();
    const result = await plannedCost.readAll();
    expect(result.ok).toBe(true);
    const after = await store.readSnapshot();
    expect(after.ok && before.ok ? after.value : after).toEqual(before.ok ? before.value : before);
  });

  it("فشل قراءة القوالب يعيد فشلًا صادقًا", async () => {
    const store = new MemoryLocalStore();
    class FailingTemplatesStore extends MemoryLocalStore {
      async listCatalogTemplates() {
        return { ok: false, code: "storage_error" as const, message: "فشل قراءة مفتعل" };
      }
    }
    const failing = new FailingTemplatesStore();
    const { plannedCost } = makeServices(failing);
    const result = await plannedCost.readAll();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("storage_error");
  });
});
