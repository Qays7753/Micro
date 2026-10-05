/* باب عام حقيقي (Wave B — STR-615/ADR عبر الخطة §7-J، 2026-10-03): هذا
 * البرميل يصدّر حصرًا الرموز التي تستهلكها الواجهة فعلًا (قياس رسم
 * الاستيراد الحي) من بيوتها الكنسية — لا برميل عام ولا رمز بلا مستهلك.
 * الاستيراد الداخلي للتطبيق من ملفات الوحدة مباشر كما هو؛ هذا الباب
 * لحدود الوحدة أمام الواجهة (عزل التغيير: إعادة التنظيم الداخلية لا
 * تكسر مستوردات الواجهة). تحديث السطح = تعديل مقصود في نفس الـPR.
 *
 * الخطوة ٦ (STR-615 الشاملة — تصحيح PR #316، 2026-10-06): وُسّع السطح
 * بمستهلك حي واحد = RetainedDepositService (جذر التركيب — الهجرة من
 * الاستيراد العميق إلى الباب في نفس الـPR؛ قاعدة PC-3).
 *
 * الخطوة ٦ (STR-615 الشاملة — تصحيح PR #316، 2026-10-06): فُصلت إعادة
 * تصدير الأنواع عن القيم (`export type`) — علة كامنة أزاحتها هجرة الاستيراد
 * الديناميكي إلى الباب: الباب الذي يصير مدخل شظية يجب أن تكون جدول
 * تصديره حاضرًا في زمن التشغيل كاملًا، والاسم النوعي ليس رابطته موجودة
 * (ظهر ذلك في PayableDueRow). الفصل لا يغيّر السطح ولا الاستخدام — كل
 * المستوردين الحاليين (ساكنين أو ديناميكيين) يزالون يعملون كما هم.
 */

export { CorrectionHistoryService } from "./correctionHistoryService";
export type {
  CorrectionDigest,
  CorrectionHistoryEntry,
  CorrectionHistoryGroup,
  CorrectionHistoryKind,
} from "./correctionHistoryService";

export { deriveExpenseCategorySuggestions, normalizeCategoryLabelInput } from "./expenseCategorySuggestions";

export { expandExpenseRecordIntent } from "./expenseRecordIntent";
export type { SharedExpenseRecordInput } from "./expenseRecordIntent";

export { RetainedDepositService } from "./retainedDepositService";
export type { RetainedDepositRow } from "./retainedDepositService";
