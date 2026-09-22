/** EXE-014 (DATA-001 / AUD-NEW-09): سجل العائلات المؤثرة الموحّد.
 *
 * «فراغ النظام» لا يُعرَّف بعدد ثابت ولا بقائمة مكررة داخل بوابة الاستيراد —
 * بل بهذا السجل التعاقدي الواحد المشتق من شكل اللقطة نفسها: كل حقل في
 * LocalStoreSnapshot يجب أن يظهر هنا (الاكتمال مفروض وقت الترجمة عبر
 * satisfies)، فأي عائلة جديدة تُضاف للمخطط تكسر البناء حتى تُسجَّل وتُقرَّر
 * هنا صراحة.
 *
 * الاستثناءات المقصودة (خارج اللقطة أصلًا فلا يمسها الاستبدال): سجل القفل
 * المحلي (local-security) ومغلفات مسودات النماذج (form-drafts) — تُفصح عنها
 * المعاينة ولا تُحوَّل إلى بيانات مالية مستعادة دون قرار مالك.
 */
import type { LocalStoreSnapshot } from "./types";

type SnapshotFamilySpec = {
  /** الاسم العربي للعائلة — يظهر في رسائل الرفض والفحص. */
  label: string;
  /** عدد سجلات العائلة داخل اللقطة (0 = فارغة؛ الملفات المفردة 0 أو 1). */
  count: (snapshot: LocalStoreSnapshot) => number;
};

export const INFLUENTIAL_SNAPSHOT_FAMILIES = {
  profile: { label: "ملف النشاط", count: snapshot => (snapshot.profile === null ? 0 : 1) },
  ownerProfile: { label: "ملف المالك", count: snapshot => (snapshot.ownerProfile == null ? 0 : 1) },
  preferences: { label: "التفضيلات المحفوظة", count: snapshot => (snapshot.preferences === null ? 0 : 1) },
  drafts: { label: "مسودات الطلبات", count: snapshot => snapshot.drafts.length },
  orders: { label: "الطلبات", count: snapshot => snapshot.orders.length },
  directSales: { label: "المبيعات المباشرة", count: snapshot => snapshot.directSales?.length ?? 0 },
  schedules: { label: "المواعيد", count: snapshot => snapshot.schedules.length },
  recurrences: { label: "التكرارات", count: snapshot => snapshot.recurrences?.length ?? 0 },
  financialEvents: { label: "الأحداث المالية", count: snapshot => snapshot.financialEvents.length },
  supplierPurchases: {
    label: "مشتريات الموردين",
    count: snapshot => snapshot.supplierPurchases?.length ?? 0,
  },
  cashWallets: { label: "محافظ الكاش", count: snapshot => snapshot.cashWallets?.length ?? 0 },
  cashContinuityEntries: {
    label: "قيود استمرارية الكاش",
    count: snapshot => snapshot.cashContinuityEntries?.length ?? 0,
  },
  materials: { label: "المواد", count: snapshot => snapshot.materials?.length ?? 0 },
  inventoryMovements: { label: "حركات المخزون", count: snapshot => snapshot.inventoryMovements?.length ?? 0 },
  inventoryShortages: { label: "سجلات النقص", count: snapshot => snapshot.inventoryShortages?.length ?? 0 },
  inventoryActivation: {
    label: "قرار تفعيل إدارة المخزون",
    count: snapshot => (snapshot.inventoryActivation == null ? 0 : 1),
  },
  catalogItems: { label: "بنود الكتالوج", count: snapshot => snapshot.catalogItems?.length ?? 0 },
  measurementUnits: { label: "وحدات القياس", count: snapshot => snapshot.measurementUnits?.length ?? 0 },
  directConversions: {
    label: "تحويلات الوحدات المباشرة",
    count: snapshot => snapshot.directConversions?.length ?? 0,
  },
  catalogTemplates: { label: "قوالب الكتالوج", count: snapshot => snapshot.catalogTemplates?.length ?? 0 },
  actualTimeRecords: {
    label: "سجلات الوقت الفعلي",
    count: snapshot => snapshot.actualTimeRecords?.length ?? 0,
  },
  shortCashDeclarations: {
    label: "إقرارات العجز النقدي",
    count: snapshot => snapshot.shortCashDeclarations?.length ?? 0,
  },
  ownerEntitlementPolicies: {
    label: "سياسات حقوق المالك",
    count: snapshot => snapshot.ownerEntitlementPolicies?.length ?? 0,
  },
  ownerEntitlementRecords: {
    label: "سجلات حقوق المالك",
    count: snapshot => snapshot.ownerEntitlementRecords?.length ?? 0,
  },
  ownerEntitlementOpeningBalances: {
    label: "أرصدة حقوق المالك الافتتاحية",
    count: snapshot => snapshot.ownerEntitlementOpeningBalances?.length ?? 0,
  },
  ownerMovements: { label: "دفتر حركات المالك", count: snapshot => snapshot.ownerMovements?.length ?? 0 },
  allocationPolicies: {
    label: "سياسات التخصيص",
    count: snapshot => snapshot.allocationPolicies?.length ?? 0,
  },
  costEstimates: { label: "التقديرات المحفوظة", count: snapshot => snapshot.costEstimates?.length ?? 0 },
  assets: { label: "الأصول", count: snapshot => snapshot.assets?.length ?? 0 },
  loans: { label: "القروض", count: snapshot => snapshot.loans?.length ?? 0 },
  /* OPS-003 (عقد ٤١): عائلات المصروف المتكرر الثلاث — بيت التذكير التشغيلي
   * فوق أحداثه المالية؛ الغياب في ملف قديم = صفر بلا اختراع. */
  recurringExpenseSeries: {
    label: "سلاسل المصروف المتكرر",
    count: snapshot => snapshot.recurringExpenseSeries?.length ?? 0,
  },
  recurringExpenseRevisions: {
    label: "مراجعات المصروف المتكرر",
    count: snapshot => snapshot.recurringExpenseRevisions?.length ?? 0,
  },
  recurringExpenseOccurrences: {
    label: "فترات المصروف المتكرر",
    count: snapshot => snapshot.recurringExpenseOccurrences?.length ?? 0,
  },
  /* FIN-002 (عقد ٤٢): عائلة الميزانيات — خطة اختيارية بلا أثر مالي؛ الغياب
   * في ملف قديم = صفر بلا اختراع. */
  expenseBudgets: {
    label: "الميزانيات المختارة",
    count: snapshot => snapshot.expenseBudgets?.length ?? 0,
  },
} satisfies Record<keyof LocalStoreSnapshot, SnapshotFamilySpec>;

export type SnapshotFamilyKey = keyof typeof INFLUENTIAL_SNAPSHOT_FAMILIES;
export type InfluentialFamilyCount = { key: SnapshotFamilyKey; label: string; count: number };

/** عدادات كل عائلة مؤثرة داخل اللقطة — بالترتيب التعاقدي نفسه. */
export function influentialFamilyCounts(snapshot: LocalStoreSnapshot): readonly InfluentialFamilyCount[] {
  return (Object.keys(INFLUENTIAL_SNAPSHOT_FAMILIES) as SnapshotFamilyKey[]).map(key => ({
    key,
    label: INFLUENTIAL_SNAPSHOT_FAMILIES[key].label,
    count: INFLUENTIAL_SNAPSHOT_FAMILIES[key].count(snapshot),
  }));
}

/** «فراغ النظام»: لا سجل واحد في أي عائلة مؤثرة مسجلة. */
export function snapshotSystemIsEmpty(snapshot: LocalStoreSnapshot): boolean {
  return influentialFamilyCounts(snapshot).every(family => family.count === 0);
}

/** أسماء العائلات غير الفارغة — لرسالة رفض تشرح ما الذي يجب تصديره أولًا. */
export function occupiedInfluentialFamilies(snapshot: LocalStoreSnapshot): readonly InfluentialFamilyCount[] {
  return influentialFamilyCounts(snapshot).filter(family => family.count > 0);
}
