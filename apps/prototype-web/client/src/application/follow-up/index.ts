/* باب عام حقيقي (STR-615 الشاملة — الخطوة ٦ من برنامج تصحيح PR 316،
 * 2026-10-06): هذا البرميل يصدّر حصرًا ما تستهلكه مستهلكات الميزة من
 * الواجهة (صفحات/مكونات/عرض/PWA — قياس رسم الاستيراد الحي أدناه)، لا رمزًا
 * بلا مستهلك ولا برميلًا عامًا (PC-3: توسيع السطح تعديل مقصود بنفس الـPR).
 * الاستيراد الداخلي للتطبيق من ملفات الوحدة مباشر كما هو (نمط Wave B/
 * ADR-011). جذر التركيب (PrototypeServicesContext) يستورد التنفيذات
 * مباشرةً باستثناء موثق — طبقة التوصيل المعينة (نمط DI) ولعزل كومة
 * الإقلاع (بروتوكول FIN-001/OPS-003 للميزانية)؛ توثيقه في سجل الملكية.
 * الأنواع أعيد تصديرها `export type` والقيم `export` — شرط أمان الاستيراد
 * الديناميكي للباب (مدخل الشظية يحتاج جدول تصدير حاضرًا في زمن التشغيل).
 */

export type { DailyFollowUp, DailyFollowUpService } from "./dailyFollowUpService";
/* S13 (DOC-022 / UNIT-018+012 — أمر 2158b0fc §6، PC-3 توسيع مقصود بنفس
 * الـPR): المتابعة الموحدة 012/018 — قارئ خالص فوق أصحاب المصادر. */
export type {
  FollowUpFilter,
  FollowUpGroup,
  FollowUpProjection,
  FollowUpSourceKey,
  FollowUpSourceState,
  FollowUpTask,
  FollowUpTaskKind,
  PayablesAgingReader,
  ReceivablesReader,
  SettleablePayablesReader,
  UnifiedFollowUpReading,
  UnifiedFollowUpResult,
} from "./unifiedFollowUpService";
export { projectFollowUp, UnifiedFollowUpService } from "./unifiedFollowUpService";
