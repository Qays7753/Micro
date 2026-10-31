/** R10-B2/RC-1 (+ R10B-NF-009 + عائلة غسل إعادة الختم): سجل أدوار عائلات
 * المصفوفات في ملف النقل — المصدر الكنوني الواحد لقواعد بوابة البنية الخام
 * ولعدّ العدادات الصارمة، مشتقًا من شكل اللقطة نفسها.
 *
 * قبل R10-B2 كانت بوابات البنية العلوية تعمل على البيانات *بعد الترحيل*
 * (migrateTransferSnapshot يسوّي كل عائلة غائبة/معطوبة إلى [])، فكان ملف
 * حالٍ «مُعاد ختمه» (بصمة وعدادات معاد حسابهما) يستطيع حذف أي عائلة أو
 * جعلها غير مصفوفة ويمر — فتُمحى مخازن المالك عند الاستبدال ثم يعاد
 * التصدير فيغسل التاريخ (سلسلة R10A-F-009). البوابة هنا تعمل على البيانات
 * *الخام* قبل الترحيل، فتصبح دلالة «الموجود يجب أن يكون مصفوفة» حقيقية
 * على الملفين الحالي والموروث، و«الغائب» يبقى مقبولًا على الموروث فقط
 * (اختياري-عند-الغياب) بينما يُفرض حضور كل العائلات على الحالي (سياسة
 * العصر الموحدة — بطاقة RC-1 + تصحيح بوابة RV5).
 *
 * الاكتمال مفروض وقت الترجمة عبر satisfies على مفاتيح LocalStoreSnapshot
 * ذات النوع المصفوفي (سابقة influentialSnapshotFamilies.ts:22-114): أي
 * عائلة مصفوفية جديدة تُضاف للمخطط تكسر البناء حتى تُسجَّل هنا صراحة
 * بقرارها (بوابةً وعدًّا). أما تطابق مفاتيح LocalExportCounts مع المعدودات
 * فيثبته اختبار الجرد الزمني في transferCounters.migrations.characterization
 * وrc1Gate (تطابق Runtime، لا تأكيد نوعي هنا — تصحيح RV1/B2 للصياغة).
 */
import type { LocalExportCounts, LocalStoreSnapshot } from "@/storage/local/types";

/** كل مفاتيح اللقطة التي قيمتها مصفوفة (اختيارية أو إلزامية). (-? يزيل
 * اختيارية المفتاح من نتيجة الخريطة وإلا تسربت undefined إلى اتحاد
 * المفاتيح فكسرت satisfies — مكتشف بوابة RV1/B2.) */
type ArrayFamilyKey = {
  [K in keyof LocalStoreSnapshot]-?: LocalStoreSnapshot[K] extends readonly unknown[] | undefined ? K : never;
}[keyof LocalStoreSnapshot];

export type TransferArrayFamilyRole = {
  /** هل تدخل العائلة في عدادات التصدير الصارمة (LocalExportCounts)؟ */
  counted: boolean;
  /** الاسم العربي — يظهر في رسائل الرفض والتشخيص. */
  label: string;
  /** تصنيف تاريخي موثق فقط (صارمة/اختيارية في بوابة validateSnapshot القديمة):
   * سياسة العصر تفرضها البوابة أدناه موحدةً لكل العائلات — الحالي: كل
   * العائلات مطلوبة الحضور (التصدير الصادق يحملها كلها)؛ الموروث: الكل
   * اختياري-عند-الغياب (بذرة []). لا تقرأها البوابة. (تصحيح بوابة RV5/B2:
   * كان التمييز قائمًا على current أيضًا فبقي حذف العائلات الاختيارية الثماني
   * أو جعلها null غسلًا ناجحًا على الملف الحالي — أثبت RV5 محو دفتر قروض
   * كاملًا بهذا المسار.) */
  historicalClass: "strict" | "optional";
};

export const TRANSFER_ARRAY_FAMILY_ROLES = {
  /* — العائلات الصارمة (بوابة !Array.isArray التاريخية) — */
  drafts: { historicalClass: "strict", counted: true, label: "مسودات الطلبات" },
  orders: { historicalClass: "strict", counted: true, label: "الطلبات" },
  directSales: { historicalClass: "strict", counted: true, label: "المبيعات المباشرة" },
  schedules: { historicalClass: "strict", counted: true, label: "المواعيد" },
  recurrences: { historicalClass: "strict", counted: false, label: "تكرارات المواعيد" },
  financialEvents: { historicalClass: "strict", counted: true, label: "الأحداث المالية" },
  supplierPurchases: { historicalClass: "strict", counted: true, label: "مشتريات الموردين" },
  cashWallets: { historicalClass: "strict", counted: true, label: "محافظ الكاش" },
  cashContinuityEntries: { historicalClass: "strict", counted: true, label: "قيود استمرارية الكاش" },
  materials: { historicalClass: "strict", counted: true, label: "المواد" },
  inventoryMovements: { historicalClass: "strict", counted: true, label: "حركات المخزون" },
  catalogItems: { historicalClass: "strict", counted: false, label: "بنود منتجاتي وخدماتي" },
  measurementUnits: { historicalClass: "strict", counted: false, label: "وحدات القياس" },
  directConversions: { historicalClass: "strict", counted: false, label: "تحويلات الوحدات المباشرة" },
  catalogTemplates: { historicalClass: "strict", counted: false, label: "قوالب منتجاتي وخدماتي" },
  actualTimeRecords: { historicalClass: "strict", counted: false, label: "سجلات الوقت الفعلي" },
  shortCashDeclarations: { historicalClass: "strict", counted: false, label: "تصريحات النقد الناقص" },
  allocationPolicies: { historicalClass: "strict", counted: false, label: "سياسات التوزيع" },
  costEstimates: { historicalClass: "strict", counted: false, label: "تقديرات التكلفة" },
  /* — الاختيارية التاريخية (اختياري-عند-الغياب؛ الموجود المعطوب يُرفض) — */
  inventoryShortages: { historicalClass: "optional", counted: true, label: "سجلات النقص" },
  assets: { historicalClass: "optional", counted: true, label: "الأصول" },
  loans: { historicalClass: "optional", counted: true, label: "القروض" },
  recurringExpenseSeries: { historicalClass: "optional", counted: true, label: "سلاسل المصروف المتكرر" },
  recurringExpenseRevisions: { historicalClass: "optional", counted: true, label: "مراجعات المصروف المتكرر" },
  recurringExpenseOccurrences: { historicalClass: "optional", counted: true, label: "فترات المصروف المتكرر" },
  expenseBudgets: { historicalClass: "optional", counted: true, label: "الميزانيات" },
  receivedLoans: { historicalClass: "optional", counted: true, label: "القروض المستلمة" },
  /* S04 (DOC-013 / UNIT-025): رصد الأرصدة — اختيارية-عند-الغياب كعائلات D-037؛
   * الموجود المعطوب يُرفض؛ القياس يُنقل كما هو بلا إعادة تسوية. */
  balanceObservations: { historicalClass: "optional", counted: true, label: "رصد أرصدة النقد" },
  /* S05 (DOC-014 / UNIT-037): الأطراف المحفوظة — اختيارية-عند-الغياب كعائلات
   * D-037؛ الموجود المعطوب يُرفض؛ الهوية تُنقل كما هي بلا دمج ولا اختراع. */
  counterparties: { historicalClass: "optional", counted: true, label: "الأطراف المحفوظة" },
  /* — R10-B2/RC-1: عائلات مال المالك الأربع — كانت الفجوة الوحيدة الكاملة
   * (لا عدّ ولا بوابة)؛ صارت معدودة (نطاق OD-8 الأدنى). حضورها على الحالي
   * تفرضه سياسة العصر الموحدة أدناه؛ الموروث يبقى اختياري-عند-الغياب كما
   * ثبت ownerEntitlementTransfer.test.ts (أزواج ١٢/٢١ وأقدم). — */
  ownerEntitlementPolicies: { historicalClass: "strict", counted: true, label: "سياسات استحقاق المالك" },
  ownerEntitlementRecords: { historicalClass: "strict", counted: true, label: "سجلات استحقاق المالك" },
  ownerEntitlementOpeningBalances: {
    historicalClass: "strict",
    counted: true,
    label: "أرصدة استحقاق المالك",
  },
  ownerMovements: { historicalClass: "strict", counted: true, label: "حركات مال المالك" },
} as const satisfies Record<ArrayFamilyKey, TransferArrayFamilyRole>;

/** مفاتيح العائلات المعدودة (تُشتق من السجل — لا تُعدّ يدويًا). */
export type CountedArrayFamilyKey = {
  [
    K in keyof typeof TRANSFER_ARRAY_FAMILY_ROLES
  ]: (typeof TRANSFER_ARRAY_FAMILY_ROLES)[K]["counted"] extends true ? K : never;
}[keyof typeof TRANSFER_ARRAY_FAMILY_ROLES];

/* (NF-013/OD-8: العائلات المطلوبة-غير-المعدودة التسع تبقى بلا عدّ عمدًا
 * حتى قرار المالك بالنطاق الموحد؛ السجل يثبت القرار لكل عائلة ولا يخفيه —
 * وتطابق مفاتيح LocalExportCounts مع المعدودات هنا يثبته اختبار التوصيف
 * transferCounters.migrations.characterization.test.ts وليس هذا الملف.) */

/** مفاتيح العائلات المعدودة بترتيب السجل — لاختبار التطابق الكنوني
 * (الحارس النوعي مرسل الترميز أدناه يفرض الاتحاد). */
export function countedArrayFamilyKeys(): readonly CountedArrayFamilyKey[] {
  return (Object.keys(TRANSFER_ARRAY_FAMILY_ROLES) as Array<keyof typeof TRANSFER_ARRAY_FAMILY_ROLES>).filter(
    (key): key is CountedArrayFamilyKey => TRANSFER_ARRAY_FAMILY_ROLES[key].counted,
  );
}

/** بوابة البنية الخام قبل الترحيل (R10-B2/RC-1).
 *
 * تُستدعى على data الخام داخل prepareImport بعد فحص تكامل المظروف وقبل
 * migrateTransferSnapshot: الموجود من كل عائلة مصفوفية يجب أن يكون مصفوفة
 * (حاليًا كان وموروثًا)، والغائب مقبول فقط وفق قاعدة العائلة على الملف
 * الحالي (required = رفض) وعلى الموروث (اختياري-عند-الغياب دوما).
 * تُعيد رسالة الرفض أو null عند القبول. */
export function verifyTransferArrayFamilies(
  data: Record<string, unknown>,
  isCurrent: boolean,
): string | null {
  for (const key of Object.keys(TRANSFER_ARRAY_FAMILY_ROLES) as Array<
    keyof typeof TRANSFER_ARRAY_FAMILY_ROLES
  >) {
    const role: TransferArrayFamilyRole = TRANSFER_ARRAY_FAMILY_ROLES[key];
    const value = data[key];
    if (value === undefined || value === null) {
      if (isCurrent)
        return `بنية الملف الحالي ناقصة — عائلة «${role.label}» غائبة وهذا لا يصدر عن تصدير Micro؛ يبدو أن الملف فُتح وحُذفت منه بيانات ثم أُعيد ختمه؛ لا يعتمد عليه. بقيت بيانات هذا الجهاز دون تغيير.`;
      continue;
    }
    if (!Array.isArray(value))
      return `بنية الملف غير سليمة — قيمة عائلة «${role.label}» ليست مصفوفة كما تقتضي بنية Micro؛ لا يعتمد عليه. بقيت بيانات هذا الجهاز دون تغيير.`;
  }
  return null;
}
