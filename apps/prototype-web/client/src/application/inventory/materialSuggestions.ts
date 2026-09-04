/**
 * المجموعة ٣ (عقد D5): مقترحات المواد من المخزون — الدليل المشترك الواحد
 * لمحرر تكلفة المسودة وحاسبة التكلفة (نفس السلوك حرفيًا: آخر استلام غير معكوس
 * مصدر السعر «معروفة»، وبلا استلام الاسم والوحدة فقط «تقديرية»، وأقصى ٦ بندًا
 * ذا سعر أولًا). قراءة فقط: لا حركة مخزون ولا حدث نقدي يُنشأ أبدًا من التقدير.
 */
import type { MaterialSuggestion } from "@/components/cost/MaterialSheet";
import type {
  InventoryMaterialService,
  InventoryOverview,
} from "@/application/inventory/inventoryMaterialService";
import type { InventoryMovement } from "@micro-domain/inventory-material/index.js";

export async function readMaterialSuggestions(
  inventory: Pick<InventoryMaterialService, "overview" | "movements">,
): Promise<readonly MaterialSuggestion[] | null> {
  const [overviewResult, movementsResult] = await Promise.all([inventory.overview(), inventory.movements()]);
  if (!overviewResult.ok || !movementsResult.ok) return null;
  return materialSuggestionsFrom(overviewResult.value, movementsResult.value);
}

export function materialSuggestionsFrom(
  overview: InventoryOverview,
  movements: readonly InventoryMovement[],
): readonly MaterialSuggestion[] {
  const reversedIds = new Set(
    movements
      .filter(movement => movement.type === "reversal" && movement.reversesMovementId)
      .map(movement => movement.reversesMovementId as string),
  );
  const suggestions: MaterialSuggestion[] = overview.materials.map(material => {
    const receipts = movements
      .filter(
        movement =>
          movement.type === "purchase_receipt" &&
          movement.materialId === material.id &&
          !reversedIds.has(movement.id) &&
          movement.quantityDeltaMilli > 0,
      )
      .sort((left, right) => right.occurredOn.localeCompare(left.occurredOn));
    const lastReceipt = receipts[0];
    const unitPriceMinor = lastReceipt
      ? Math.round((lastReceipt.valueDeltaMinor / lastReceipt.quantityDeltaMilli) * 1000)
      : null;
    return {
      materialId: material.id,
      name: material.name,
      unit:
        material.unit === "piece"
          ? "قطعة"
          : material.unit === "meter"
            ? "متر"
            : material.unit === "kilogram"
              ? "كيلوغرام"
              : material.unit === "liter"
                ? "لتر"
                : "وحدة أخرى",
      unitPriceMinor,
      fromReceipt: Boolean(lastReceipt),
    };
  });
  /* ذو سعر من استلام أولًا ثم الباقي — أقصى ٦ كما في الورقة. */
  return suggestions
    .sort((left, right) => Number(right.unitPriceMinor !== null) - Number(left.unitPriceMinor !== null))
    .slice(0, 6);
}
