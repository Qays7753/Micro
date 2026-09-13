/**
 * المجموعة ١١ (المرحلة 11-0): رحلات القيمة الدقيقة عبر الأسطح — نفس المعنى
 * الرقمي من الإدخال إلى التخزين إلى القراءة إلى العرض، لسياسة
 * EXACT_VALUES_NO_SILENT_ROUNDING المعتمدة. يشمل: بطارية الحدود الدقيقة
 * لمقترحات المواد (فئة الانحراف التاريخية)، جولة تخزين Memory كاملة
 * لاستلام 2.7 وحدة، ومساواة العرض عبر المعيّنات الكنسية، وتثبيت المخطط
 * والتصدير بلا تغيير (35/27).
 */
import { describe, expect, it } from "vitest";
import { materialSuggestionsFrom } from "@/application/inventory/materialSuggestions";
import type {
  InventoryMaterialOverview,
  InventoryOverview,
} from "@/application/inventory/inventoryMaterialService";
import type { InventoryMovement, Material } from "@micro-domain/inventory-material/index.js";
import { createInventoryMovement } from "@micro-domain/inventory-material/index.js";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { createSupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import { formatMoneyWithUnit, formatQuantityMilli } from "@/presentation/formatters";
import { parseEnglishQuantityText } from "@/application/input/englishNumeric";
import { localExportVersion, localSchemaVersion } from "@/storage/local/types";

function overviewMaterial(id: string, unit: Material["unit"]): InventoryMaterialOverview {
  return {
    id,
    name: `مادة ${id}`,
    unit,
    createdAt: "2026-08-01T09:00:00.000Z",
    createdOperationKey: `${id}-create`,
    quantityMilli: 0,
    valueMinor: 0,
    movementCount: 0,
    quantityKnowledge: "known",
    costKnowledge: "unknown",
    openShortageCount: 0,
    awaitingReceiptPurchaseCount: 0,
    awaitingReceiptRemainingMinor: 0,
  };
}

function receipt(
  id: string,
  materialId: string,
  occurredOn: string,
  quantityDeltaMilli: number,
  valueMinor: number,
): InventoryMovement {
  return createInventoryMovement({
    id,
    materialId,
    type: "purchase_receipt",
    occurredOn,
    recordedAt: "2026-08-02T09:00:00.000Z",
    quantityDeltaMilli,
    valueDeltaMinor: valueMinor,
    note: "استلام",
    operationKey: id,
    purchaseId: `purchase-${id}`,
  });
}

function overview(materials: readonly InventoryMaterialOverview[]): InventoryOverview {
  return { materials, untrackedNames: [] } as InventoryOverview;
}

function byId(suggestions: readonly { materialId: string }[], materialId: string) {
  const found = suggestions.find(suggestion => suggestion.materialId === materialId);
  if (!found) throw new Error(`missing suggestion ${materialId}`);
  return found;
}

describe("material suggestions keep exact unit prices at every documented boundary class", () => {
  it("derives the exact half-up price for the historical FP-divergence class", () => {
    /* فئة الانحراف المجموعة ٩/١٠: قروش فردية على كميات ٢٠٠٠ ملي بالضبط. */
    const movements = [
      receipt("r-half", "mat-half", "2026-08-01", 2_000, 1_001),
      receipt("r-over", "mat-over", "2026-08-01", 2_000, 1_003),
      receipt("r-under", "mat-under", "2026-08-01", 2_000, 999),
    ];
    const suggestions = materialSuggestionsFrom(
      overview([
        overviewMaterial("mat-half", "kilogram"),
        overviewMaterial("mat-over", "kilogram"),
        overviewMaterial("mat-under", "kilogram"),
      ]),
      movements,
    );
    expect(byId(suggestions, "mat-half").unitPriceMinor).toBe(501);
    expect(byId(suggestions, "mat-over").unitPriceMinor).toBe(502);
    expect(byId(suggestions, "mat-under").unitPriceMinor).toBe(500);
  });

  it("keeps the owner's exact examples in derived suggestions", () => {
    const movements = [
      receipt("r-27", "mat-27", "2026-08-01", 1_000, 2_700),
      receipt("r-89", "mat-89", "2026-08-01", 1_000, 8_900),
      receipt("r-63", "mat-63", "2026-08-01", 1_000, 6_300),
      receipt("r-1001", "mat-1001", "2026-08-01", 1_000, 1_001),
      receipt("r-1520", "mat-1520", "2026-08-01", 1_000, 1520_400),
      receipt("r-1783", "mat-1783", "2026-08-01", 1_000, 1783_900),
    ];
    const materials = ["27", "89", "63", "1001", "1520", "1783"].map(
      suffix => overviewMaterial(`mat-${suffix}`, "liter") as InventoryMaterialOverview,
    );
    const suggestions = materialSuggestionsFrom(overview(materials), movements);
    expect(byId(suggestions, "mat-27").unitPriceMinor).toBe(2700);
    expect(byId(suggestions, "mat-89").unitPriceMinor).toBe(8900);
    expect(byId(suggestions, "mat-63").unitPriceMinor).toBe(6300);
    expect(byId(suggestions, "mat-1001").unitPriceMinor).toBe(1001);
    expect(byId(suggestions, "mat-1520").unitPriceMinor).toBe(1520400);
    expect(byId(suggestions, "mat-1783").unitPriceMinor).toBe(1783900);
  });

  it("fails closed when the derived numerator exceeds safe integers", () => {
    const unsafe = receipt("r-unsafe", "mat-unsafe", "2026-08-01", 1, Number.MAX_SAFE_INTEGER);
    const suggestions = materialSuggestionsFrom(overview([overviewMaterial("mat-unsafe", "piece")]), [
      unsafe,
    ]);
    /* لا تقريب صامت: المقترح يبقى بلا سعر (يتحقق المستخدم بنفسه). */
    expect(byId(suggestions, "mat-unsafe").unitPriceMinor).toBeNull();
  });
});

describe("storage round trip keeps the same exact value from receipt to display", () => {
  it("stores 2.7 units / 152040 minor in Memory and reads the identical integers back", async () => {
    const store = new MemoryLocalStore();
    const service = new InventoryMaterialService(store, () => "2026-08-23T09:00:00.000Z");
    const opened = await service.openMaterial({
      name: "طلاء",
      unit: "liter",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 2_700,
        costState: "known",
        valueMinor: 1520_400,
        confirmedOn: "2026-08-01",
        sourceNote: null,
      },
      note: "افتتاح",
      operationKey: "material-paint",
    });
    if (!opened.ok) throw new Error(opened.message);
    const purchase = createSupplierPurchase({
      id: "purchase-paint",
      supplierName: "المورد",
      note: "شحنة طلاء",
      purchasedOn: "2026-08-02",
      dueOn: null,
      totalMinor: 1520_400,
      initialPaidMinor: 0,
      recordedAt: "2026-08-23T09:00:00.000Z",
      idempotencyKey: "purchase-paint",
    });
    await store.saveSupplierPurchase(purchase);
    const received = await service.receivePurchase({
      materialId: opened.value.material.id,
      purchaseId: purchase.id,
      quantityMilli: 2_700,
      valueMinor: 1520_400,
      occurredOn: "2026-08-02",
      note: "استلام 2.7 لتر",
      operationKey: "receive-paint",
    });
    if (!received.ok) throw new Error(received.message);

    const overviewResult = await service.overview();
    if (!overviewResult.ok) throw new Error("overview failed");
    const material = overviewResult.value.materials.find(item => item.name === "طلاء");
    expect(material?.quantityMilli).toBe(5_400);
    expect(material?.valueMinor).toBe(3_040_800);

    /* العرض الكنسي من نفس الأعداد الصحيحة — بلا تغيير رقمي في أي اتجاه. */
    expect(formatQuantityMilli(material!.quantityMilli)).toBe("5.4");
    expect(formatMoneyWithUnit(material!.valueMinor)).toBe("30,408.00 د.أ");
    expect(parseEnglishQuantityText(formatQuantityMilli(material!.quantityMilli))).toBe(5_400);
  });

  it("suggests the exact unit price from the stored receipt through the whole service path", async () => {
    const store = new MemoryLocalStore();
    const service = new InventoryMaterialService(store, () => "2026-08-23T09:00:00.000Z");
    const opened = await service.openMaterial({
      name: "خيط",
      unit: "meter",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 1_000,
        costState: "known",
        valueMinor: 2_000,
        confirmedOn: "2026-08-01",
        sourceNote: null,
      },
      note: "افتتاح",
      operationKey: "material-thread",
    });
    if (!opened.ok) throw new Error(opened.message);
    const purchase = createSupplierPurchase({
      id: "purchase-thread",
      supplierName: "المورد",
      note: "خيط",
      purchasedOn: "2026-08-02",
      dueOn: null,
      totalMinor: 1_001,
      initialPaidMinor: 0,
      recordedAt: "2026-08-23T09:00:00.000Z",
      idempotencyKey: "purchase-thread",
    });
    await store.saveSupplierPurchase(purchase);
    const received = await service.receivePurchase({
      materialId: opened.value.material.id,
      purchaseId: purchase.id,
      quantityMilli: 2_000,
      valueMinor: 1_001,
      occurredOn: "2026-08-02",
      note: "استلام الحد الدقيق",
      operationKey: "receive-thread",
    });
    if (!received.ok) throw new Error(received.message);

    const [overviewResult, movementsResult] = await Promise.all([service.overview(), service.movements()]);
    if (!overviewResult.ok || !movementsResult.ok) throw new Error("read failed");
    const suggestions = materialSuggestionsFrom(overviewResult.value, movementsResult.value);
    const suggestion = suggestions.find(item => item.name === "خيط");
    /* 1001 minor على 2000 ملي = 500.5 → نصف-أعلى دقيق = 501 (لا 500). */
    expect(suggestion?.unitPriceMinor).toBe(501);
    expect(suggestion?.fromReceipt).toBe(true);
  });
});

describe("schema and export versions stay at the approved contracts", () => {
  it("keeps localSchemaVersion 35 and localExportVersion 27 unchanged by the exact-value policy", () => {
    expect(localSchemaVersion).toBe(35);
    expect(localExportVersion).toBe(27);
  });
});
