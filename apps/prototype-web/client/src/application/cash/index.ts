/* باب عام حقيقي (W4 — STR-615/برنامج ما بعد المسح، 2026-10-05): هذا البرميل
 * يصدّر حصرًا الرموز التي تستهلكها الواجهة فعلًا (قياس رسم الاستيراد الحي:
 * CashContinuityService/CashContinuityOverview/CashWalletBalance من
 * cashContinuityService وWalletLedgerService/WalletLedgerOverview من
 * walletLedgerService — 11 موقع استيراد) — لا برميل عام ولا رمز بلا مستهلك.
 * الاستيراد الداخلي للتطبيق من ملفات الوحدة مباشر كما هو (نمط أبواب Wave B/
 * ADR-011)؛ هذا الباب لحدود الوحدة أمام الواجهة (عزل التغيير: إعادة التنظيم
 * الداخلية لا تكسر مستوردات الواجهة). تحديث السطح = تعديل مقصود في نفس الـPR
 * (PC-3 — الخطة §4.2: الباب يكشف الحد الأدنى وتوسيعه تغيير مراجَع).
 *
 * الخطوة ٦ (STR-615 الشاملة — تصحيح PR 316، 2026-10-06): فُصلت إعادة
 * تصدير الأنواع عن القيم (`export type`) — علة كامنة أزاحتها هجرة الاستيراد
 * الديناميكي إلى الباب: الباب الذي يصير مدخل شظية يجب أن تكون جدول
 * تصديره حاضرًا في زمن التشغيل كاملًا، والاسم النوعي ليس رابطته موجودة
 * (ظهر ذلك في PayableDueRow). الفصل لا يغيّر السطح ولا الاستخدام — كل
 * المستوردين الحاليين (ساكنين أو ديناميكيين) يزالون يعملون كما هم.
 */

export { CashContinuityService } from "./cashContinuityService";
export type { CashContinuityOverview, CashWalletBalance } from "./cashContinuityService";

export { WalletLedgerService } from "./walletLedgerService";
export type { WalletLedgerOverview } from "./walletLedgerService";
