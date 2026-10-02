/**
 * وحدة توافق (Wave 4B — 2026-10-03): عنقود «مال المالك» انتقل إلى بيته الأساس
 * `application/owner-money/ownerEntitlementService.ts` (قرار المالك — تعليمة
 * برنامج المعالجة؛ عقد 40 يوثق النقل بمذكرة مؤرخة).
 *
 * هذا الملف يبقي المحدد `@/application/finance/ownerEntitlementService` يحل
 * كما هو لمستهلكي الواجهة المجمدة واختبارات dom، ويُزال بعد ترحيل
 * استيرادات الواجهة في مسار UI مستقل. إعادة تصدير حرفية — لا رمز جديد.
 */
export * from "../owner-money/ownerEntitlementService.js";
