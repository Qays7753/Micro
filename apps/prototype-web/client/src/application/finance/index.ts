/* باب عام حقيقي (Wave B — STR-615/ADR عبر الخطة §7-J، 2026-10-03): هذا
 * البرميل يصدّر حصرًا الرموز التي تستهلكها الواجهة فعلًا (قياس رسم
 * الاستيراد الحي) من بيوتها الكنسية — لا برميل عام ولا رمز بلا مستهلك.
 * الاستيراد الداخلي للتطبيق من ملفات الوحدة مباشر كما هو؛ هذا الباب
 * لحدود الوحدة أمام الواجهة (عزل التغيير: إعادة التنظيم الداخلية لا
 * تكسر مستوردات الواجهة). تحديث السطح = تعديل مقصود في نفس الـPR.
 *
 * الخطوة ٦ (STR-615 الشاملة — تصحيح PR 316، 2026-10-06): فُصلت إعادة
 * تصدير الأنواع عن القيم (`export type`) — علة كامنة أزاحتها هجرة الاستيراد
 * الديناميكي إلى الباب: الباب الذي يصير مدخل شظية يجب أن تكون جدول
 * تصديره حاضرًا في زمن التشغيل كاملًا، والاسم النوعي ليس رابطته موجودة
 * (ظهر ذلك في PayableDueRow). الفصل لا يغيّر السطح ولا الاستخدام — كل
 * المستوردين الحاليين (ساكنين أو ديناميكيين) يزالون يعملون كما هم.
 */

export { DueDatesService } from "./dueDatesService";
export type { PayableDueRow, PayablesAgingOverview } from "./dueDatesService";

export { IntegrityCheckService } from "./integrityCheckService";
export type {
  IntegrityCheckReport,
  IntegrityCheckResult,
  IntegrityCheckStatus,
  IntegrityOffenderSummary,
} from "./integrityCheckService";

export { PeriodComparisonService } from "./periodComparisonService";
export type { PeriodComparisonReading } from "./periodComparisonService";

export { isPeriodActive, previousEqualPeriod, resolvePeriodPreset } from "./periodPresets";

export { ProfitToCashBridgeService } from "./profitToCashBridgeService";
export type { ProfitToCashBridgeReading } from "./profitToCashBridgeService";

export { ProjectFinancialService } from "./projectFinancialService";
export type {
  FinancialInsights,
  FinancialMetricEvidence,
  ProjectFinancialPosition,
  RecordedPeriodResult,
  SettleablePayable,
} from "./projectFinancialService";

export { RecurringExpenseService } from "./recurringExpenseService";
export type {
  RecurringExpenseDetailReading,
  RecurringExpenseSeriesCardReading,
} from "./recurringExpenseService";

export { RecurringWorkService } from "./recurringWorkService";
export type {
  RecurringWorkPolicyInput,
  RecurringWorkReading,
  RecurringWorkReadings,
} from "./recurringWorkService";

export {
  DEFAULT_SHORT_CASH_HORIZON_DAYS,
  SHORT_CASH_HORIZON_DAYS,
  SHORT_CASH_HORIZON_LABELS_AR,
} from "./shortCashHorizon";
export type { ShortCashHorizonDays } from "./shortCashHorizon";

export { StatementMarkdownService } from "./statementMarkdownService";

export { StatementService } from "./statementService";
export type { StatementExpenseCategoryGroup, StatementLine, StatementReading } from "./statementService";

export { UpcomingService } from "./upcomingService";
export type { UpcomingBlockResult, UpcomingEntry, UpcomingOverview } from "./upcomingService";
