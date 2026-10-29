/* باب عام حقيقي (STR-615 الشاملة — الخطوة ٦ من برنامج تصحيح PR 316،
 * 2026-10-06): هذا البرميل يصدّر حصرًا ما تستهلكه مستهلكات الميزة من
 * الواجهة (صفحات/مكونات/عرض/PWA — قياس رسم الاستيراد الحي أدناه)، لا رمزًا
 * بلا مستهلك ولا برميلًا عامًا (PC-3: توسيع السطح تعديل مقصود بنفس الـPR).
 * الاستيراد الداخلي للتطبيق من ملفات الوحدة مباشرة كما هو (نمط Wave B/
 * ADR-011). جذر التركيب (PrototypeServicesContext) يستورد التنفيذات
 * مباشرةً باستثناء موثق — طبقة التوصيل المعينة (نمط DI) ولعزل كومة
 * الإقلاع (بروتوكول FIN-001/OPS-003/S04 للميزانية)؛ توثيقه في سجل
 * الملكية. الأنواع أعيد تصديرها `export type` والقيم `export` — شرط أمان
 * الاستيراد الديناميكي للباب (مدخل الشظية يحتاج جدول تصدير حاضرًا في زمن
 * التشغيل).
 *
 * S05 (DOC-014 / UNIT-037): السطح صار دليل الأطراف المحفوظة (هوية وحساب
 * مصدري) بعد تقاعد قراءة التجميع بالاسم — تحديث الأساس في نفس الـPR
 * (بروتوكول توسيع/انكماش الباب المقصود).
 */

export type {
  PartyAccountEntry,
  PartyDirectoryOverview,
  PartyDirectoryResult,
  PartyDirectoryService,
  PartyDirectoryServiceStore,
  PartyMovement,
  PartyMovementKind,
  RenamePartyInput,
  SavePartyInput,
  SetPartyArchiveInput,
} from "./partyLedgerService";
export { purchasePartySnapshotOf, salePartySnapshotOf, supplierDisplayLabelOf } from "./partyLedgerService";
