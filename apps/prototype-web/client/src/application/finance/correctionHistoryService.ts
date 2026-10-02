/**
 * وحدة توافق (Wave 4B-متابعة — 2026-10-03): عنقود «السجلات المالية» انتقل
 * إلى بيته الأساس `application/financial-records/` (سجل الملكية §3).
 *
 * هذا الملف يبقي المحدد `@/application/finance/correctionHistoryService`
 * يحل كما هو لمستهلكي الواجهة المجمدة واختبارات dom، ويُزال بعد ترحيل
 * استيرادات الواجهة في مسار UI مستقل. إعادة تصدير حرفية — لا رمز جديد.
 */
export * from "../financial-records/correctionHistoryService.js";
