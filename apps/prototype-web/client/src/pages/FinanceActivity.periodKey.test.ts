import { describe, expect, it } from "vitest";

import type { PeriodRange } from "@/application/finance/periodPresets";
import { PERIOD_PRESET_IDS } from "@/application/finance/periodPresets";
import type { FinanceActivityPeriodKey } from "./FinanceActivity";

/**
 * S-1 (R11 W1b / D-06 — R10B-NF-004): فك تصادم الاسم `PeriodRange`.
 *
 * كان اسمان مختلفا الشكل يحملان الاسم نفسه: نوع محلي في هذه الصفحة
 * (اتحاد مفاتيح اختيار الفترة السريعة) ونوع مالي/date-owned مصدَّر في
 * `application/finance/periodPresets.ts` (زوج تواريخ `{ from, to }`).
 * قرار المالك (S-1): يبقى الاسم `PeriodRange` على المعنى المالي، ويُعاد
 * تسمية المعنى المحلي للصفحة إلى `FinanceActivityPeriodKey` بعد إحصاء
 * المتصلين. الاختبار يثبت على مستوى النوع أن التصادم انتهى: العائلتان
 * غير قابلتين للإسناد المتبادل، واتحاد مفاتيح الصفحة مثبت عضويًا، وهو
 * ليس عائلة مفاتيح الـpresets المالية.
 */

/* الاتحاد مثبت عضويًا في الاتجاهين: Record يرفض المفتاح الناقص والزائد. */
const keyOf: Record<FinanceActivityPeriodKey, true> = {
  this_week: true,
  last_week: true,
  this_month: true,
  all: true,
  custom: true,
};

const quickKeys = [
  "this_week",
  "last_week",
  "this_month",
  "all",
  "custom",
] as const satisfies readonly FinanceActivityPeriodKey[];

/* العقبة ١: مفتاح الصفحة ليس نطاق تواريخ ماليًا (والعكس بالعقبة ٢). */
// @ts-expect-error — مفتاح اختيار الصفحة لا يُسند إلى PeriodRange المالي
const asRange: PeriodRange = quickKeys[0];
// @ts-expect-error — نطاق التواريخ المالي لا يُسند إلى مفتاح الصفحة
const asKey: FinanceActivityPeriodKey = { from: "2026-01-01", to: "2026-01-31" };

/* الشاهد الإيجابي: شكل PeriodRange المالي كما هو — زوج تواريخ محلية. */
const positiveRange: PeriodRange = { from: "2026-01-01", to: "2026-01-31" };

describe("S-1 FinanceActivityPeriodKey — فك تصادم PeriodRange على مستوى النوع", () => {
  it("اتحاد مفاتيح الصفحة مثبت عضويًا: المفاتيح الخمسة بلا نقص وزيادة (compile-pinned)", () => {
    expect(Object.keys(keyOf).sort()).toEqual(["all", "custom", "last_week", "this_month", "this_week"]);
    expect(quickKeys).toHaveLength(5);
  });

  it("العائلتان غير قابلتين للإسناد المتبادل (التصادم محلول لا منقول)", () => {
    expect(typeof asRange).toBe("string");
    expect(typeof asKey).toBe("object");
  });

  it("الشاهد الإيجابي: PeriodRange المالي يظل زوج تواريخ { from, to }", () => {
    expect(positiveRange).toEqual({ from: "2026-01-01", to: "2026-01-31" });
  });

  it("مفاتيح الصفحة ليست مفاتيح الـpresets المالية: «all» للصفحة فقط", () => {
    expect(quickKeys).toContain("all");
    expect(PERIOD_PRESET_IDS).not.toContain("all");
    expect(PERIOD_PRESET_IDS).toContain("last_quarter");
    expect(quickKeys).not.toContain("last_quarter" as FinanceActivityPeriodKey);
  });
});
