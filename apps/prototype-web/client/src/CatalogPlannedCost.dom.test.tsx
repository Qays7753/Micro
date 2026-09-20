/** @vitest-environment jsdom */
/* Stage 2 — OPS-004 (tracker): تكامل صفحة الكتالوج مع قراءة التكلفة/الكمية
 * المخططتين للقالب — التقدير يظهر بمعرفة صادقة (تقديري) من الدليل الكنوني
 * لأسعار الاستلام، وفتح الصفحة لا يكتب سجلًا واحدًا (مطابقة اللقطة)، ولا
 * ينشئ أي حركة مخزون أو COGS أو استهلاك. */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { CatalogService } from "@/application/catalog/catalogService";
import { RecurringWorkService } from "@/application/finance/recurringWorkService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { TemplatePlannedCostService } from "@/application/catalog/templatePlannedCostService";
import type { CatalogItem, CatalogTemplate, MeasurementUnit } from "@micro-domain/catalog/index.js";
import { createInventoryMovement, createMaterial } from "@micro-domain/inventory-material/index.js";
import Catalog from "@/pages/Catalog";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({ navigate: vi.fn(), location: "/catalog" }));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useSearch: () => "",
  useParams: () => ({}),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-16T09:00:00.000Z";

let store: MemoryLocalStore;

function buildServices() {
  const inventory = new InventoryMaterialService(store, () => NOW);
  return {
    catalog: new CatalogService(store, () => NOW),
    recurringWork: new RecurringWorkService(store, () => NOW),
    inventory,
    templatePlannedCost: new TemplatePlannedCostService(store, inventory),
    dataVersion: 0,
    notifyDataChanged: () => undefined,
  } as unknown as ReturnType<typeof usePrototypeServices>;
}

async function seed() {
  const item: CatalogItem = {
    id: "item-1",
    kind: "product",
    name: "شال مطرز",
    unitLabel: null,
    unitId: "unit-piece",
    active: true,
    createdAt: NOW,
    updatedAt: NOW,
    createdOperationKey: "item-1-create",
  };
  const unit: MeasurementUnit = {
    id: "unit-meter",
    nameAr: "متر",
    dimension: "distance",
    symbol: null,
    active: true,
    createdAt: NOW,
    updatedAt: NOW,
    createdOperationKey: "unit-meter-create",
  };
  const template: CatalogTemplate = {
    id: "template-dom-1",
    catalogItemId: "item-1",
    title: "قالب الشال",
    note: null,
    components: [
      {
        id: "comp-dom-1",
        name: "خيط",
        quantityMilli: 3000,
        unitId: "unit-meter",
        note: null,
        materialId: "mat-dom-1",
      },
    ],
    yield: { quantityMilli: 1000, unitId: "unit-meter" },
    yieldReadiness: "ready",
    extras: {
      timeMinutes: 60,
      hourlyRateMinor: 500,
      packagingMinor: 100,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
    },
    revision: 1,
    sourceTemplateId: null,
    active: true,
    createdAt: NOW,
    updatedAt: NOW,
    createdOperationKey: "template-dom-1-create",
  };
  const material = createMaterial({
    id: "mat-dom-1",
    name: "خيط التطريز",
    unit: "meter",
    createdAt: NOW,
    createdOperationKey: "mat-dom-1-create",
  });
  const receipt = createInventoryMovement({
    id: "mat-dom-1-receipt",
    materialId: "mat-dom-1",
    type: "purchase_receipt",
    quantityDeltaMilli: 2000,
    valueDeltaMinor: 3000,
    occurredOn: "2026-09-01",
    recordedAt: NOW,
    note: "استلام اختبار",
    operationKey: "mat-dom-1-receipt-key",
    purchaseId: "mat-dom-1-purchase",
    orderId: null,
  });
  const [savedItem, savedUnit, savedTemplate, savedInventory] = await Promise.all([
    store.saveCatalogItem(item),
    store.saveMeasurementUnit(unit),
    store.saveCatalogTemplate(template),
    store.commitInventory(material, [receipt]),
  ]);
  if (!savedItem.ok || !savedUnit.ok || !savedTemplate.ok || !savedInventory.ok)
    throw new Error("seed failed");
}

beforeEach(() => {
  store = new MemoryLocalStore();
  wouterMocks.navigate.mockReset();
  mockedUsePrototypeServices.mockReturnValue(buildServices());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Stage 2 — OPS-004: الكتالوج يقرأ التكلفة المخططة للقالب بلا أي كتابة", () => {
  it("يعرض الكمية والناتج والتقدير موسومًا «تقديري» بتفصيل المكوّنات — ولا يكتب سجلًا", async () => {
    await seed();
    const before = await store.readSnapshot();
    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <Catalog />
      </UnsavedChangesProvider>,
    );
    const planned = await screen.findByTestId("template-planned-cost-template-dom-1");
    expect(planned.textContent).toContain("الكمية المخططة: 3");
    expect(planned.textContent).toContain("الناتج المسجّل 1");
    expect(planned.textContent).toContain("التكلفة المخططة (تقديري): 51.00");
    expect(planned.textContent).toContain("لا يستهلك ولا يشتري");
    expect(planned.textContent).toContain("45.00 د.أ (السعر من آخر استلام لـ«خيط التطريز»)");
    /* فتح الصفحة لا يكتب سجلًا واحدًا — لا حركة ولا حدث ولا قالب جديد. */
    const after = await store.readSnapshot();
    expect(after.ok && before.ok ? after.value : after).toEqual(before.ok ? before.value : before);
  });
});
