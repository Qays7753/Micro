/**
 * وحدة توافق (Wave 4B-متابعة — 2026-10-03): عنقود «السجلات المالية» انتقل
 * إلى بيته الأساس `application/financial-records/` (سجل الملكية §3 — شريحة
 * متابعة معتمدة بنمط 4B الميكانيكي).
 *
 * هذا الملف يبقي المحدد `@/application/finance/expenseRecordIntent` يحل كما
 * هو لمستهلكي الواجهة المجمدة واختبارات dom، ويُزال بعد ترحيل استيرادات
 * الواجهة في مسار UI مستقل. إعادة تصدير حرفية — لا رمز جديد.
 */
export * from "../financial-records/expenseRecordIntent.js";
