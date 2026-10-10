/**
 * Wave C (ARCH-004/WS-214 — بطاقة ADR-015 مجموعة 1): منفذ قدرة «المصروف
 * المتكرر» — الاستخراج الأول بعد الطيار، بترتيب ADR-15 المعتمد.
 *
 * العلاقة الحاكمة (نمط RC-7 المجرب في Wave 4C — لا قاعدة جديدة):
 *  - الواجهة `PrototypeLocalStore` في types.ts تبقى **الواجهة التوافقية**
 *    والمصدر السلطوي لتواقيع المنفذ كله — لا توقيع يُنسخ هنا أبدًا؛ هذه
 *    القدرة **عرض مشتق** منها (Pick) فأي انحراف في التواقيع يكسر فحص
 *    الأنواع نفسه ولا يمكن أن يمر صامتًا.
 *  - المحوّلان `IndexedDbLocalStore` و`MemoryLocalStore` يحققان القدرة
 *    نفسها: يفرضه ملف المراسي النوعية (recurringExpenseCapabilityAnchors.ts)
 *    وعقد السلوك (recurringExpenseCapability.contract.test.ts — نفس العقود
 *    للمحوّلين عبر عدسة القدرة الضيقة).
 *  - حدود المعاملات والحتمية وحماية الكتابة القديمة (storage_stale بلا
 *    كتابة) وهوية الأخطاء محفوظة كما هي داخل المحوّلين — لا سلوك يُنقل
 *    ولا يُعاد تعريفه هنا. المفهوم مملوك لـdomain/recurring-expense
 *    (سجل الملكية §2) وحارس الكتابة recurringExpenseCommitGuard داخل حد
 *    الكتابة (STR-306 PRESERVE). عقد ٤١ يحكم سلوك التذكيرات.
 *
 * العضوية (10 طرق — مجموعة «Recurring expense» في سجل الملكية §2):
 * القراءات الخمس وسلاسل الإنشاء والتغيير وتلمس الوقائع وقراراتها وتسجيلها.
 *
 * الاستهلاك: مستهلك الإنتاج الوحيد هو application/recurring/recurringExpenseService
 * (جرد مستهلكين حي 2026-10-03) — يهاجر إلى النوع الضيق في هذه الموجة نفسها.
 * حذف أي طريقة من الواجهة التوافقية لا يجوز إلا بخطوة لاحقة موثقة حين
 * يثبت سجل الملكية خلوّها من المستهلكين (قاعدة RC-7).
 */
import type { PrototypeLocalStore } from "../types";

export const recurringExpenseStoreMethods = [
  "listRecurringExpenseSeries",
  "getRecurringExpenseSeries",
  "listRecurringExpenseRevisions",
  "listRecurringExpenseOccurrences",
  "getRecurringExpenseOccurrence",
  "commitRecurringExpenseDraft",
  "commitRecurringExpenseSeriesChange",
  "commitRecurringExpenseOccurrences",
  "commitRecurringExpenseOccurrenceDecision",
  "commitRecurringExpenseOccurrenceRecord",
] as const;

export type RecurringExpenseStoreMethod = (typeof recurringExpenseStoreMethods)[number];

/**
 * قدرة «المصروف المتكرر»: ما يحتاجه مستهلك هذه القدرة — لا أكثر ولا أقل.
 * مشتقة من الواجهة التوافقية نفسها (Pick) فلا تنحرف عنها بنيويًا أبدًا.
 */
export interface RecurringExpenseStore extends Pick<PrototypeLocalStore, RecurringExpenseStoreMethod> {}
