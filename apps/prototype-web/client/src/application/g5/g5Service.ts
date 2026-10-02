/**
 * وحدة توافق (Wave 4A — 2026-10-03): الاسم الأساس الحالي للخدمة هو
 * `FinancialAnalysisService` في `application/financial-analysis/financialAnalysisService.ts`
 * (قرار المالك — تعليمة برنامج المعالجة 2026-10-03؛ الاسم التاريخي g5).
 *
 * هذا الملف يبقي المحدد `@/application/g5/g5Service` يحل كما هو لمستهلكي
 * الواجهة المجمدة (Finance.tsx وG5DecisionPanel.tsx وG5DeclarationEditor.tsx
 * واختبارات dom المرافقة)، ويُزال بعد ترحيل استيرادات الواجهة في مسار UI
 * مستقل بقرار مالك. إعادة تصدير حرفية — لا رمز جديد ولا محجوب.
 */
export * from "../financial-analysis/financialAnalysisService.js";
