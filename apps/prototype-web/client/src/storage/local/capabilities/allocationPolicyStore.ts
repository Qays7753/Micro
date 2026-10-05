/**
 * Wave C (ARCH-004/WS-214 — بطاقة ADR-015 مجموعة 4): منفذ قدرة «سياسات
 * التوزيع» — الاستخراج الرابع بترتيب ADR-15 المعتمد، بالنمط المثبت.
 *
 * العلاقة الحاكمة (لا قاعدة جديدة):
 *  - الواجهة `PrototypeLocalStore` في types.ts تبقى **الواجهة التوافقية**
 *    والمصدر السلطوي لتواقيع المنفذ كله — لا توقيع يُنسخ هنا أبدًا؛ هذه
 *    القدرة **عرض مشتق** منها (Pick) فأي انحراف في التواقيع يكسر فحص
 *    الأنواع نفسه ولا يمكن أن يمر صامتًا.
 *  - المحوّلان `IndexedDbLocalStore` و`MemoryLocalStore` يحققان القدرة
 *    نفسها: يفرضه ملف المراسي النوعية (allocationPolicyCapabilityAnchors.ts)
 *    وعقد السلوك (allocationPolicyCapability.contract.test.ts — نفس العقود
 *    للمحوّلين عبر عدسة القدرة الضيقة).
 *  - حدود المعاملات وذرية خلافة السياسة (السابقة معطلة + الخلف النافذ
 *    معًا أو لا شيء) وعهدة الحتمية (مفتاح السياسة) وهوية الأخطاء محفوظة
 *    كما هي داخل المحوّلين — لا سلوك يُنقل ولا يُعاد تعريفه هنا.
 *
 * **قفل exe017 محفوظ (الشرط الصريح للبطاقة):** كتابة التوزيع للمالية
 * وحدها — مستهلك الإنتاج الوحيد هو application/finance/recurringWorkService
 * (جرد مستهلك حي 2026-10-04) داخل البيت المالي؛ الاستخراج لا يفتح كاتبًا
 * ثانيًا: القدرة عرض اشتقاقي للمحوّلين نفسهم لا تكتب شيئًا بنفسها،
 * والواجهة التوافقية تبقى باب الكتابة الموحد للمحوّلين. المفهوم مملوك
 * لـdomain/financial-event (توزيع) وحارس الخلافة allocationPolicySuccessor
 * داخل حد الكتابة (STR-306 PRESERVE).
 *
 * العضوية (4 طرق — مجموعة «Allocation policies» في سجل الملكية §2):
 * القراءة (بمرشح الكتالوج) والقراءة الفردية والحفظ وزوج الخلافة الذرّي.
 *
 * حذف أي طريقة من الواجهة التوافقية لا يجوز إلا بخطوة لاحقة موثقة حين
 * يثبت سجل الملكية خلوّها من المستهلكين (قاعدة RC-7).
 */
import type { PrototypeLocalStore } from "../types";

export const allocationPolicyStoreMethods = [
  "listAllocationPolicies",
  "getAllocationPolicy",
  "saveAllocationPolicy",
  "commitAllocationPolicySuccessor",
] as const;

export type AllocationPolicyStoreMethod = (typeof allocationPolicyStoreMethods)[number];

/**
 * قدرة «سياسات التوزيع»: ما يحتاجه مستهلك هذه القدرة — لا أكثر ولا أقل.
 * مشتقة من الواجهة التوافقية نفسها (Pick) فلا تنحرف عنها بنيويًا أبدًا.
 */
export interface AllocationPolicyStore extends Pick<PrototypeLocalStore, AllocationPolicyStoreMethod> {}
