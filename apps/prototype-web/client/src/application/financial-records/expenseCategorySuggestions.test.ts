/** المجموعة ٩ (STR-032): اختبار مباشر لمعينات تصنيف المصروف النقية —
 * الاشتقاق من الاستعمال السابق (الأحدث أولًا، بلا عكسيات، بلا تكرار)
 * مع تعبئة البذور حتى الحد، وتطبيع الوسم لقاعدة المجال نفسها. */
import { describe, expect, it } from "vitest";
import {
  deriveExpenseCategorySuggestions,
  expenseCategorySeedSuggestions,
  normalizeCategoryLabelInput,
} from "./expenseCategorySuggestions";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";

function taggedEvent(
  categoryLabel: string,
  correctionType?: FinancialEvent["correctionType"],
): FinancialEvent {
  return {
    id: `event-${categoryLabel}-${correctionType ?? "plain"}`,
    occurredOn: "2026-09-01",
    recordedAt: "2026-09-01T09:00:00.000Z",
    family: "operating_expense",
    type: "operating_expense_cash",
    deltaMinor: -1_000,
    note: "اختبار",
    idempotencyKey: `key-${categoryLabel}-${correctionType ?? "plain"}`,
    correctionType: correctionType ?? null,
    expenseContext: {
      relationship: "shared",
      behavior: "variable",
      purpose: "project_general",
      knowledge: "known",
      categoryLabel,
    },
  } as unknown as FinancialEvent;
}

describe("deriveExpenseCategorySuggestions (pure helper, STR-032)", () => {
  it("falls back to the seed list in order when there is no history", () => {
    expect(deriveExpenseCategorySuggestions([])).toEqual([...expenseCategorySeedSuggestions]);
  });

  it("derives the owner's used labels newest-first, skipping duplicates and reversals", () => {
    const events = [
      taggedEvent("بنزين"),
      taggedEvent("صيانة فرن"),
      taggedEvent("بنزين"),
      taggedEvent("تراجع ملغى", "reverse"),
      taggedEvent("تغليف"),
    ];
    expect(deriveExpenseCategorySuggestions(events)).toEqual([
      "بنزين",
      "صيانة فرن",
      "تغليف",
      "رواتب",
      "إيجار",
      "كهرباء",
      "مواد",
      "توصيل",
    ]);
  });

  it("caps derived labels at six and fills the remainder from the seeds up to the limit", () => {
    const events = ["أول", "ثانٍ", "ثالث", "رابع", "خامس", "سادس", "سابع"].map(label => taggedEvent(label));
    const suggestions = deriveExpenseCategorySuggestions(events);
    expect(suggestions).toEqual(["أول", "ثانٍ", "ثالث", "رابع", "خامس", "سادس", "بنزين", "رواتب"]);
  });

  it("respects an explicit smaller limit", () => {
    expect(deriveExpenseCategorySuggestions([], 3)).toEqual(["بنزين", "رواتب", "إيجار"]);
  });
});

describe("normalizeCategoryLabelInput (pure helper, STR-032)", () => {
  it("trims, collapses inner whitespace, and returns null for empty input", () => {
    expect(normalizeCategoryLabelInput("  وقود   وشحن  ")).toBe("وقود وشحن");
    expect(normalizeCategoryLabelInput("   ")).toBeNull();
    expect(normalizeCategoryLabelInput("")).toBeNull();
  });
});
