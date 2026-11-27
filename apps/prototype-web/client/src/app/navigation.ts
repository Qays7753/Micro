/**
 * Micro design reminder: navigation stays phone-first, task-oriented, and uses
 * the official semantic design system rather than a generic admin dashboard.
 */
import type { LucideIcon } from "lucide-react";
import { ClipboardList, House, Store, Truck, WalletCards } from "lucide-react";
/* M5.1+ (مانج-في₂ المرحلة 5): كتالوج نصوص مانج (§10/§11) — مصدر تسميات
 * أسطح مانج حصرًا (لا حرفية عربية لسطح مانج في هذا الملف). */
import { t as manageT } from "@/application/manage/strings";

export type NavigationItem = { href: string; label: string; icon: LucideIcon };

/* SH-21 (تنفيذ S16 بالأمر الموحد §4 — NAV-01 V15 §1): الشريط السفلي خمسة
 * مقاعد ثابتة بهذا الترتيب من اليمين إلى اليسار على الهاتف العربي:
 * المالية، الطلبات، الرئيسية، التوصيل، السوق. الرئيسية وجهة الفتح الوسطى.
 * M5.2 (مانج-في₂ المرحلة 5 — قرار ١١/D-12): تسمية مقعد الفتح صارت
 * «مشروعي الآن» (s.now من كتالوج مانج) — التعديل الوحيد المسموح على
 * الشريط؛ المقر والترتيب والأيقونة كما هم. لا مقعد سادس للإعدادات أو
 * الأدوات أو اسأل Micro. */
export const primaryNavigation: readonly NavigationItem[] = [
  { href: "/finance", label: "المالية", icon: WalletCards },
  { href: "/orders", label: "الطلبات", icon: ClipboardList },
  /* M5.2 (قرار ١١/D-12): «الرئيسية» ← «مشروعي الآن» — التعديل الوحيد
   * المسموح على الشريط السفلي؛ التسمية من كتالوج مانج (s.now). */
  { href: "/", label: manageT("s.now"), icon: House },
  { href: "/delivery", label: "التوصيل", icon: Truck },
  { href: "/market", label: "السوق", icon: Store },
];

export function getNavigationLabel(pathname: string) {
  if (pathname.startsWith("/schedule")) return "المواعيد";
  if (pathname.startsWith("/finance")) return "المالية";
  if (pathname.startsWith("/cash")) return "محافظ النقد";
  if (pathname.startsWith("/inventory")) return "المواد والمخزون";
  if (pathname.startsWith("/suppliers")) return "الموردون والمشتريات";
  if (pathname.startsWith("/parties")) return "العملاء والموردون";
  /* S17 (DOC-026 / UNIT-033): تسمية «سلامة الحسابات» المستقلة تقاعدت مع
   * سطحها — المسار القديم يوجه إلى الإعدادات وبيتها قسم «فحص البيانات». */
  if (pathname.startsWith("/tools")) return "أدواتي";
  if (pathname.startsWith("/settings")) return "الإعدادات";
  /* المجموعة ١: ملف المالك — تسمية سياقية للترويسة بلا مقعد تنقل جديد. */
  if (pathname.startsWith("/profile")) return "ملف المالك";
  /* المجموعة ٣ (عقد D5): مراجعة التسليم — سياق واضح فوق محرر عميق. */
  if (/^\/orders\/[^/]+\/deliver$/.test(pathname)) return "مراجعة التسليم";
  /* المجموعة ٤ (عقد ٢٩): الأصول والقروض — تسميات سياقية بلا مقاعد جديدة. */
  if (pathname === "/assets" || pathname.startsWith("/assets/")) return "الأصول";
  if (pathname === "/loans" || pathname.startsWith("/loans/")) return "القروض";
  /* عقد الإغلاق العميق (MR-04): تسميات سياقية للمسارات العميقة غير المغطاة —
   * علامة الموقع لا تتكرر «مايكرو مايكرو» فوق أسطح المال. */
  if (pathname === "/collect" || pathname.startsWith("/collect")) return "ورقة التحصيل";
  if (pathname.startsWith("/direct-sales")) return "بيع مباشر";
  /* N-06 (Wave 4.2 — F-09/قرار المالك): الاسم الموحد للسطح «منتجاتي وخدماتي»
   * في كل المواضع الظاهرة — «الكتالوج» مصطلح نظام لا اسم ملكية. */
  if (pathname.startsWith("/catalog")) return "منتجاتي وخدماتي";
  /* Stage C (S13/R5-8): مسار المشاركة أزيل بقرار UNIT-040 — لا تسمية
   * حية لمسار ملغى؛ رابطه القديم يسقط إلى 404 الصادقة بتسميتها. */
  if (pathname.startsWith("/foundation")) return "صفحة الأساس";
  /* EX-D21 (Phase B): مدخل Ask Micro الشامل — سطح عمق واحد بلا شريط سفلي،
   * يُدخل من القائمة (سياق المالك) أو من ترويسة بوابة السائق (سياق السائق). */
  if (pathname === "/ask" || pathname.startsWith("/ask/")) return "اسأل Micro";
  /* EX-D18 (عقد 26 §8): تسميات سياقية لمسارات السوق فوق مقعد الشريط نفسه. */
  if (pathname === "/market/vendor" || pathname.startsWith("/market/vendor/")) return "مساحة المورد";
  if (pathname.startsWith("/market/listing/")) return "تفاصيل الإعلان";
  if (pathname.startsWith("/market/review")) return "مراجعة السوق";
  if (pathname === "/market" || pathname.startsWith("/market")) return "السوق";
  /* EX-D18 (عقد 26 §8): تسميات التوصيل وبوابة السائق المستقلة (OD01). */
  if (pathname.startsWith("/delivery/booking/")) return "تفاصيل الحجز";
  if (pathname.startsWith("/delivery/drivers")) return "سائقوني";
  if (pathname.startsWith("/delivery/review")) return "مراجعة التوصيل";
  if (pathname.startsWith("/delivery")) return "التوصيل";
  if (pathname.startsWith("/driver")) return "Micro — السائق";
  /* M5.1+ (مانج-في₂ المرحلة 5): أسطح مانج الجديدة — تسميات سياقية من
   * كتالوج مانج (§10) عبر بابه المعلن: لا حرفية نص هنا لسطح مانج. */
  if (pathname.startsWith("/manage/start")) return manageT("t.project_name");
  if (pathname.startsWith("/manage/op/sale-delivery")) return manageT("f.sale_delivery");
  if (pathname.startsWith("/manage/op/prepayment")) return manageT("a.prepayment");
  if (pathname.startsWith("/manage/op/collect")) return manageT("op.collect_pay");
  if (pathname.startsWith("/manage/op/expense")) return manageT("op.expense");
  if (pathname.startsWith("/manage/op/owner")) return manageT("op.owner");
  if (pathname.startsWith("/manage/op/transfer")) return manageT("op.transfer");
  if (pathname.startsWith("/manage/op/")) return manageT("op.sale");
  if (pathname.startsWith("/manage/reconcile")) return manageT("op.reconcile");
  if (pathname.startsWith("/manage/settings")) return manageT("t.settings");
  if (pathname.startsWith("/manage/products") || pathname.startsWith("/manage/product"))
    return manageT("s.products");
  if (pathname.startsWith("/manage/sale/")) return manageT("op.sale");
  if (pathname.startsWith("/manage/return/orders")) return manageT("s.overdue_orders");
  if (pathname.startsWith("/manage/return/")) return manageT("s.balances");
  if (pathname.startsWith("/manage/boxes")) return manageT("s.boxes");
  if (pathname.startsWith("/manage/activity")) return manageT("s.activity");
  if (pathname.startsWith("/manage/balances")) return manageT("s.balances");
  if (pathname.startsWith("/manage/finance/income")) return manageT("rep.income");
  if (pathname.startsWith("/manage/finance/position")) return manageT("rep.position");
  if (pathname.startsWith("/manage/finance/sources")) return manageT("rep.sources");
  if (pathname.startsWith("/manage/finance")) return manageT("tab.finance");
  if (pathname.startsWith("/manage")) return manageT("s.now");
  /* Post-Group 6 continuous completion (G02 — Q129): لوحة المشرف — مسار
   * وتخطيط خاصان لوحدة منفصلة. */
  if (pathname.startsWith("/admin")) return "لوحة الإشراف";
  return (
    primaryNavigation.find(
      item => item.href === pathname || (item.href !== "/" && pathname.startsWith(item.href)),
    )?.label ?? "مايكرو"
  );
}
