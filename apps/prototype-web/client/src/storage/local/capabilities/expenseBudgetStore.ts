/**
 * Wave C (ARCH-004/WS-214 — بطاقة ADR-015 مجموعة 2): منفذ قدرة «الميزانيات» —
 * الاستخراج الثاني بترتيب ADR-15 المعتمد، بالنمط المثبت (RC-7/4C ثم مجموعة 1).
 *
 * العلاقة الحاكمة (لا قاعدة جديدة):
 *  - الواجهة `PrototypeLocalStore` في types.ts تبقى **الواجهة التوافقية**
 *    والمصدر السلطوي لتواقيع المنفذ كله — لا توقيع يُنسخ هنا أبدًا؛ هذه
 *    القدرة **عرض مشتق** منها (Pick) فأي انحراف في التواقيع يكسر فحص
 *    الأنواع نفسه ولا يمكن أن يمر صامتًا.
 *  - المحوّلان `IndexedDbLocalStore` و`MemoryLocalStore` يحققان القدرة
 *    نفسها: يفرضه ملف المراسي النوعية (expenseBudgetCapabilityAnchors.ts)
 *    وعقد السلوك (expenseBudgetCapability.contract.test.ts — نفس العقود
 *    للمحوّلين عبر عدسة القدرة الضيقة).
 *  - حدود المعاملات والحتمية وحماية الكتابة القديمة (storage_stale بلا
 *    كتابة) وذرية زوج المراجعة وهوية الأخطاء محفوظة كما هي داخل المحوّلين —
 *    لا سلوك يُنقل ولا يُعاد تعريفه هنا. المفهوم مملوك لـdomain/budget
 *    (سجل الملكية §2) وحارس الكتابة expenseBudgetCommitGuard داخل حد
 *    الكتابة (STR-306 PRESERVE). عقد ٤٢ يحكم سلوك الميزانيات (FIN-002).
 *
 * العضوية (3 طرق — مجموعة «Expense budgets» في سجل الملكية §2):
 * قراءة السجلات كما كُتبت، والحفظ المحروس لسجل واحد (مع CAS الانتقالات
 * الموثقة عبر expected)، وزوج المراجعة الذرّي (الخلف والسابقة معًا أو لا
 * شيء — عقد ٤٢ §٥).
 *
 * الاستهلاك: مستهلك الإنتاج الوحيد هو application/budgets/expenseBudgetService
 * (جرد مستهلكين حي 2026-10-04 — وحدة التوافق finance/expenseBudgetService
 * إعادة تصدير لا مستهلكًا) — يهاجر إلى النوع الضيق في هذه الموجة نفسها.
 * حذف أي طريقة من الواجهة التوافقية لا يجوز إلا بخطوة لاحقة موثقة حين
 * يثبت سجل الملكية خلوّها من المستهلكين (قاعدة RC-7).
 */
import type { PrototypeLocalStore } from "../types";

export const expenseBudgetStoreMethods = [
  "listExpenseBudgets",
  "saveExpenseBudget",
  "saveExpenseBudgetRevisionPair",
] as const;

export type ExpenseBudgetStoreMethod = (typeof expenseBudgetStoreMethods)[number];

/**
 * قدرة «الميزانيات»: ما يحتاجه مستهلك هذه القدرة — لا أكثر ولا أقل.
 * مشتقة من الواجهة التوافقية نفسها (Pick) فلا تنحرف عنها بنيويًا أبدًا.
 */
export interface ExpenseBudgetStore extends Pick<PrototypeLocalStore, ExpenseBudgetStoreMethod> {}
