/**
 * Wave C (ARCH-004/WS-214 — بطاقة ADR-015 مجموعة 6): منفذ قدرة «استحقاق
 * المالك وحركاته» — الاستخراج السادس والأخير بترتيب ADR-15 المعتمد،
 * بالنمط المثبت.
 *
 * العلاقة الحاكمة (لا قاعدة جديدة):
 *  - الواجهة `PrototypeLocalStore` في types.ts تبقى **الواجهة التوافقية**
 *    والمصدر السلطوي لتواقيع المنفذ كله — لا توقيع يُنسخ هنا أبدًا؛ هذه
 *    القدرة **عرض مشتق** منها (Pick) فأي انحراف في التواقيع يكسر فحص
 *    الأنواع نفسه ولا يمكن أن يمر صامتًا.
 *  - المحوّلان `IndexedDbLocalStore` و`MemoryLocalStore` يحققان القدرة
 *    نفسها: يفرضه ملف المراسي النوعية (ownerEntitlementCapabilityAnchors.ts)
 *    وعقد السلوك (ownerEntitlementCapability.contract.test.ts — نفس العقود
 *    للمحوّلين عبر عدسة القدرة الضيقة).
 *  - حدود المعاملات والذرية (حركة المالك وأثر الكاش معًا) وعهدة الحتمية
 *    (مفاتيح السياسات والسجلات والرصيد الافتتاحي والحركات) ووحدانية
 *    التراجع وهوية الأخطاء محفوظة كما هي داخل المحوّلين — لا سلوك يُنقل
 *    ولا يُعاد تعريفه هنا.
 *
 * **مراجعة exe017 (الشرط الصريح للبطاقة — نُفذت):** قفل ملكية Owner Money
 * محفوظ: الكاتب الوحيد لاستحقاق المالك وحركاته هو
 * application/owner-money/ownerEntitlementService (بيته الأساس جاهز)؛
 * الاستخراج اشتقاقي نوعي لا يفتح كاتبًا ثانيًا ولا يغيّر حدود الملكية —
 * القراءة العرضية لحركات المالك عند قراء ماليين مصرحين بعقد ٤٠ تبقى
 * قراءة عبر النوع الضيق نفسه. المفهوم مملوك لـdomain/owner-entitlement
 * (سجل الملكية §1) وحارسا الكتابة ownerEntitlementCommitGuard
 * وownerMovementGuard داخل حد الكتابة (STR-306 PRESERVE).
 *
 * العضوية (14 طريقة — مجموعة «Owner entitlement & movements» في سجل
 * الملكية §2؛ العدد الحي من الواجهة نفسها المصدر السلطوي للعدّ):
 * سياسات الاستحقاق (4)، وسجلات الاستحقاق (4)، والرصيد الافتتاحي (3)،
 * وحركات المالك (3).
 *
 * الاستهلاك (جرد مستهلكين حي 2026-10-04): الكاتب owner-money/
 * ownerEntitlementService (12 طريقة)؛ وقراء listOwnerMovements العرضيون
 * الأربعة (correctionHistoryService، profitToCashBridgeService،
 * statementService، projectFinancialService — القارئ الكنوني الأخير يبقى
 * على الواجهة الكاملة بقرار موثق حتى تقسيمه الداخلي في Wave F).
 * getOwnerEntitlementRecord وgetOwnerMovement بلا مستهلك إنتاج اليوم —
 * تبقيان في الواجهة والقدرة؛ حذف أي طريقة لا يجوز إلا بخطوة لاحقة
 * موثقة بخلوّ المستهلكين (قاعدة RC-7).
 */
import type { PrototypeLocalStore } from "../types";

export const ownerEntitlementStoreMethods = [
  "listOwnerEntitlementPolicies",
  "getOwnerEntitlementPolicy",
  "saveOwnerEntitlementPolicy",
  "commitOwnerEntitlementPolicySuccessor",
  "listOwnerEntitlementRecords",
  "getOwnerEntitlementRecord",
  "saveOwnerEntitlementRecord",
  "commitOwnerEntitlementRecordReversal",
  "listOwnerEntitlementOpeningBalances",
  "saveOwnerEntitlementOpeningBalance",
  "commitOwnerEntitlementOpeningBalanceReversal",
  "listOwnerMovements",
  "getOwnerMovement",
  "commitOwnerMovement",
] as const;

export type OwnerEntitlementStoreMethod = (typeof ownerEntitlementStoreMethods)[number];

/**
 * قدرة «استحقاق المالك وحركاته»: ما تحتاجه مستهلكات هذه القدرة — لا أكثر
 * ولا أقل. مشتقة من الواجهة التوافقية نفسها (Pick) فلا تنحرف عنها بنيويًا
 * أبدًا؛ ومستهلك يكتفي بجزء منها يأخذ Pick منه — الاعتماد المصرح به بدقة
 * عند الحاقن.
 */
export interface OwnerEntitlementStore
  extends Pick<PrototypeLocalStore, OwnerEntitlementStoreMethod> {}
