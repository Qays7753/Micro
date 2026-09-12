/** المجموعة ٩ (STR-032): اختبار مباشر لمعين مقترحات المواد النقي — قراءة
 * مشتقة فقط: آخر استلام غير معكوس مصدر السعر، وبلا استلام الاسم والوحدة
 * فقط، وأقصى ٦ بندًا ذا سعر أولًا. يشمل تثبيت سلوك اشتقاق سعر الوحدة
 * الحالي (تقريب الفاصلة العائمة) كما وثّقته المجموعة ٩ في استثناء Math. */
import { describe, expect, it } from "vitest";
import { materialSuggestionsFrom, type MaterialSuggestion } from "./materialSuggestions";
import type {
  InventoryMaterialOverview,
  InventoryOverview,
} from "@/application/inventory/inventoryMaterialService";
import {
  createInventoryMovement,
  type InventoryMovement,
  type Material,
} from "@micro-domain/inventory-material/index.js";

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

function reversal(id: string, reversesMovementId: string): InventoryMovement {
  return createInventoryMovement({
    id,
    materialId: "any",
    type: "reversal",
    occurredOn: "2026-08-05",
    recordedAt: "2026-08-05T09:00:00.000Z",
    quantityDeltaMilli: -100,
    valueDeltaMinor: -50,
    note: "تراجع",
    reason: "خطأ إدخال",
    operationKey: id,
    reversesMovementId,
  });
}

const overview = (materials: readonly InventoryMaterialOverview[]): InventoryOverview => ({
  materials,
  movementCount: materials.length,
});

const byId = (suggestions: readonly MaterialSuggestion[], id: string) =>
  suggestions.find(suggestion => suggestion.materialId === id);

describe("materialSuggestionsFrom (pure helper, STR-032)", () => {
  it("suggests name and unit only, with no price, when the material has no unreversed receipt", () => {
    const suggestions = materialSuggestionsFrom(overview([overviewMaterial("mat-plain", "kilogram")]), []);
    expect(suggestions).toEqual([
      {
        materialId: "mat-plain",
        name: "مادة mat-plain",
        unit: "كيلوغرام",
        unitPriceMinor: null,
        fromReceipt: false,
      },
    ]);
  });

  it("derives the unit price from the latest unreversed receipt", () => {
    const movements = [
      receipt("receipt-old", "mat-priced", "2026-08-01", 2_000, 3_000),
      receipt("receipt-new", "mat-priced", "2026-08-10", 2_500, 8_750),
    ];
    const suggestions = materialSuggestionsFrom(
      overview([overviewMaterial("mat-priced", "piece")]),
      movements,
    );
    expect(byId(suggestions, "mat-priced")).toEqual({
      materialId: "mat-priced",
      name: "مادة mat-priced",
      unit: "قطعة",
      unitPriceMinor: 3_500,
      fromReceipt: true,
    });
  });

  it("excludes a receipt that a reversal movement explicitly reverses", () => {
    const movements = [
      receipt("receipt-a", "mat-reversed", "2026-08-01", 2_000, 3_000),
      receipt("receipt-b", "mat-reversed", "2026-08-10", 4_000, 5_000),
      reversal("reverse-b", "receipt-b"),
    ];
    const suggestions = materialSuggestionsFrom(
      overview([overviewMaterial("mat-reversed", "liter")]),
      movements,
    );
    expect(byId(suggestions, "mat-reversed")).toMatchObject({ unitPriceMinor: 1_500, fromReceipt: true });
  });

  it("ignores zero-quantity receipts (no price knowledge from an empty receipt)", () => {
    /* المنشئ يرفض الحركة الصفرية أصلًا؛ هذا الفرع الدفاعي يحرس بيانات مستوردة
     * أو مصنوعة خارج المنشئ — يُختبر بحرفية مباشرة على المعين النقي. */
    const movements: readonly InventoryMovement[] = [
      {
        ...receipt("receipt-zero", "mat-zero", "2026-08-01", 100, 200),
        quantityDeltaMilli: 0,
      },
    ];
    const suggestions = materialSuggestionsFrom(overview([overviewMaterial("mat-zero", "meter")]), movements);
    expect(byId(suggestions, "mat-zero")).toMatchObject({ unitPriceMinor: null, fromReceipt: false });
  });

  it("returns at most six suggestions, priced ones first", () => {
    const materials = Array.from({ length: 8 }, (_, index) => overviewMaterial(`mat-${index + 1}`, "other"));
    const movements = materials
      .filter((_, index) => index % 2 === 1)
      .map((material, index) =>
        receipt(`receipt-${material.id}`, material.id, "2026-08-01", 1_000, 2_000 + index),
      );
    const suggestions = materialSuggestionsFrom(overview(materials), movements);
    expect(suggestions).toHaveLength(6);
    expect(suggestions.slice(0, 4).every(suggestion => suggestion.fromReceipt)).toBe(true);
    expect(suggestions.slice(4).every(suggestion => !suggestion.fromReceipt)).toBe(true);
  });

  it("derives the unit price exactly at the half boundary under the approved exact-values policy", () => {
    /* المجموعة ١١ (11-0 — سياسة EXACT_VALUES_NO_SILENT_ROUNDING المعتمدة من
     * المالك): استلام 10.01 د.أ لكل 2.000 وحدة = 500.5 قرش/وحدة بالضبط —
     * الاشتقاق الصحيح الدقيق roundHalfUp(1001×1000، 2000) يعطي 501؛
     * تعبير الفاصلة العائمة القديم كان يعطي 500 (−1 قرش في 0.030% من
     * الأزواج الواقعية) فأُزيل. عرض تعبئة يؤكده المستخدم — لا قيمة محفوظة. */
    const movements = [receipt("receipt-half", "mat-half", "2026-08-01", 2_000, 1_001)];
    const suggestions = materialSuggestionsFrom(
      overview([overviewMaterial("mat-half", "kilogram")]),
      movements,
    );
    expect(byId(suggestions, "mat-half")).toMatchObject({ unitPriceMinor: 501, fromReceipt: true });
  });
});
