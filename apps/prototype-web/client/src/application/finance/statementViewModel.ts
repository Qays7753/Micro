/**
 * R7 / R6-F17-P11 (WS-216 — 2026-10-10): سطح استعلام ونموذج عرض صفحة
 * البيان — قراءة الكشف ومقارنة الفترتين (FIN-007/FIN-003) وحدود الأسبوع،
 * خلف سطح تطبيقي مالك في البيت المالي (بيت خدمة البيان الكنسية). كان هذا
 * المنطق داخل pages/Statement.tsx؛ الصفحة تبقي ربط React وتنزيل/مشاركة
 * التقرير ونسخ الواجهة.
 *
 * عقد هذه الوحدة:
 *  - قراءات فقط عبر الخدمتين الكنسيتين (statementService/
 *    periodComparisonService)؛ لا تخزين مباشر ولا React.
 *  - منسّق الماركداون يُحقن معاملًا صريحًا (تعديل المراجعة 6): الصفحة
 *    تبقي استنساخها المحلي (:167 — خدمة عديمة الحالة للقراءة فقط) وتمرره
 *    هنا؛ تسوية جذر التركيب تبقى ملاحظة F-022 على مسار T.
 *  - لا تغيير نص أو عرض أبدًا: نفس القراءات ونفس الحالات ونصوص رسائلها.
 */

import type { StatementReading, StatementService } from "./statementService";
import type { PeriodComparisonReading, PeriodComparisonService } from "./periodComparisonService";
import { previousEqualPeriod } from "./periodPresets";
import { localDatePlusDays, localDateWeekdayIndex } from "@micro-domain/shared/index.js";

/** حالة كشف الفترة المعروض — نفس فصل الصفحة الحرفي. */
export type StatementState =
  { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; reading: StatementReading };

/** FIN-007 (WS-173 — Wave 1): حالة مقارنة الفترتين — قراءة فقط فوق القارئ
 *  الكنوني نفسه؛ الوضع الافتراضي مطوي/مغلق فلا كلفة ولا نص في السكون. */
export type ComparisonState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; reading: PeriodComparisonReading };

/** قراءة كشف الفترة المعروض. */
export async function readStatementBlock(
  deps: { statement: StatementService },
  from: string,
  to: string,
): Promise<StatementState> {
  const result = await deps.statement.read(from, to);
  return result.ok ? { phase: "ready", reading: result.value } : { phase: "error", message: result.message };
}

/** الطرف الثاني من المقارنة — السابقة المكافئة بنفس الطول أو نطاق المستخدم. */
export type ComparisonSideB = { from: string; to: string };

export function resolveComparisonSideB(
  compareMode: "previous" | "custom",
  displayed: { from: string; to: string },
  custom: { from: string; to: string },
): ComparisonSideB {
  return compareMode === "previous"
    ? previousEqualPeriod({ from: displayed.from, to: displayed.to })
    : { from: custom.from, to: custom.to };
}

/** قراءة المقارنة — فشلها بطاقة إعادة محاولة لا يهدم الكشف. */
export async function readPeriodComparisonBlock(
  deps: { periodComparison: PeriodComparisonService },
  displayed: { from: string; to: string },
  sideB: ComparisonSideB,
): Promise<ComparisonState> {
  const result = await deps.periodComparison.readPeriodComparison(
    { from: displayed.from, to: displayed.to },
    sideB,
  );
  return result.ok ? { phase: "ready", reading: result.value } : { phase: "error", message: result.message };
}

/** إزاحة تاريخ محلي بأيام — من النواة الكنسية. */
export const shiftDate = (localDate: string, days: number): string =>
  localDatePlusDays(localDate, days) ?? localDate;

/** حدود الأسبوع المحلي — الأحد أول أيام السقف المعروض. */
export function weekBounds(today: string): { from: string; to: string } {
  const weekday = localDateWeekdayIndex(today) ?? 0;
  const from = shiftDate(today, -weekday);
  return { from, to: shiftDate(from, 6) };
}
