/**
 * المجموعة ١ (تصنيفي للمصاريف): مقترحات التصنيف — نموذج قراءة مشتق فقط.
 * المصدر: أوسمة مالك مستعملة سابقًا (الأحدث أولًا) + بذور مقترحات شائعة
 * للأردن. لا متجر إدارة ولا فهرس جديد ولا كتابة أبدًا؛ حرة الإدخال يدويًا،
 * والوسم يُجمَّد مع الحدث (المفردات المشتقة تشمل التاريخ تلقائيًا — دمج
 * الأيتام ملازم للاشتقاق كما في تحليل الفجوة).
 */
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";

export const expenseCategorySeedSuggestions: readonly string[] = [
  "بنزين",
  "رواتب",
  "إيجار",
  "كهرباء",
  "مواد",
  "توصيل",
  "تسويق",
  "أدوات عمل",
];

/** أقصى عدد أوسمة مشتقة من الاستعمال السابق قبل ملء البذور. */
const derivedLimit = 6;

export function deriveExpenseCategorySuggestions(
  events: readonly FinancialEvent[],
  limit = 8,
): readonly string[] {
  const seen = new Set<string>();
  const suggestions: string[] = [];
  for (const event of events) {
    if (suggestions.length >= Math.min(derivedLimit, limit)) break;
    if (event.correctionType === "reverse") continue;
    const label = event.expenseContext?.categoryLabel;
    if (!label || seen.has(label)) continue;
    seen.add(label);
    suggestions.push(label);
  }
  for (const seed of expenseCategorySeedSuggestions) {
    if (suggestions.length >= limit) break;
    if (seen.has(seed)) continue;
    seen.add(seed);
    suggestions.push(seed);
  }
  return suggestions;
}

/** تطبيع موحد للعرض والإدخال — نفس قاعدة المجال: قصّ، دمج فراغات، فارغ→null. */
export function normalizeCategoryLabelInput(value: string): string | null {
  const normalized = value.trim().replace(/\s+/gu, " ");
  return normalized || null;
}
