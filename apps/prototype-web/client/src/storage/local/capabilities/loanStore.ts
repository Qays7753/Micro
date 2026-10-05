/**
 * Wave C (ARCH-004/WS-214 — بطاقة ADR-015 مجموعة 3): منفذ قدرة «القروض
 * والقروض المستلمة والعقود المصنفة للعربون» — الاستخراج الثالث بترتيب
 * ADR-15 المعتمد، بالنمط المثبت (RC-7/4C ثم المجموعتين 1-2).
 *
 * العلاقة الحاكمة (لا قاعدة جديدة):
 *  - الواجهة `PrototypeLocalStore` في types.ts تبقى **الواجهة التوافقية**
 *    والمصدر السلطوي لتواقيع المنفذ كله — لا توقيع يُنسخ هنا أبدًا؛ هذه
 *    القدرة **عرض مشتق** منها (Pick) فأي انحراف في التواقيع يكسر فحص
 *    الأنواع نفسه ولا يمكن أن يمر صامتًا.
 *  - المحوّلان `IndexedDbLocalStore` و`MemoryLocalStore` يحققان القدرة
 *    نفسها: يفرضه ملف المراسي النوعية (loanCapabilityAnchors.ts) وعقد
 *    السلوك (loanCapability.contract.test.ts — نفس العقود للمحوّلين عبر
 *    عدسة القدرة الضيقة).
 *  - حدود المعاملات والذرية (سجل + حدث معًا أو لا شيء) وعهدة الحتمية
 *    (مفتاح الحدث) وحماية الكتابة القديمة (storage_stale بلا كتابة، حارس
 *    علاقة AV-02) وهوية الأخطاء محفوظة كما هي داخل المحوّلين — لا سلوك
 *    يُنقل ولا يُعاد تعريفه هنا. المفهوم مملوك لـdomain/loan و
 *    domain/received-loan (سجل الملكية §2) وحارسا الكتابة
 *    loanCommitGuard/receivedLoanCommitGuard داخل حد الكتابة (STR-306
 *    PRESERVE). عقد ٢٩ يحكم القروض والعربون المحتفظ.
 *
 * العضوية (10 طرق — مجموعة «Loans & received loans & deposits» في سجل
 * الملكية §2): قراءة والتزام القروض الصادرة (4)، وقراءة والتزام القروض
 * المستلمة (4)، وتصنيف العربون المحتفظ والتزام تصحيحه (2) — قسم الودائع
 * من المجموعة نفسها لأن سجل العربون المصنف يُكتب في معاملة القرض نفسها
 * داخل المحوّلين (عهدة الحتمية المشتركة).
 *
 * الاستهلاك (جرد مستهلكين حي 2026-10-04): أربعة مستهلكي إنتاج —
 *  - loans/loanService (4 طرق القروض + قراءة الأحداث)؛
 *  - loans/receivedLoanService (4 طرق القروض المستلمة + قراءة الأحداث)؛
 *  - financial-records/retainedDepositService (طريقتا التصنيف + قراءة
 *    الطلبات والأحداث)؛
 *  - finance/integrityCheckService (قراءتا listLoans/listReceivedLoans ضمن
 *    قراءاته الشاملة — يبقى على الواجهة الكاملة حتى تقسيمه في Wave F).
 * الثلاثة الأولى يهاجرون إلى النوع الضيق في هذه الموجة نفسها. حذف أي
 * طريقة من الواجهة التوافقية لا يجوز إلا بخطوة لاحقة موثقة حين يثبت سجل
 * الملكية خلوّها من المستهلكين (قاعدة RC-7).
 */
import type { PrototypeLocalStore } from "../types";

export const loanStoreMethods = [
  "listLoans",
  "getLoan",
  "commitLoanRecord",
  "commitLoanCorrection",
  "listReceivedLoans",
  "getReceivedLoan",
  "commitReceivedLoanRecord",
  "commitReceivedLoanCorrection",
  "commitDepositClassification",
  "commitDepositClassificationCorrection",
] as const;

export type LoanStoreMethod = (typeof loanStoreMethods)[number];

/**
 * قدرة «القروض والقروض المستلمة والعقود المصنفة»: ما تحتاجه مستهلكات هذه
 * القدرة — لا أكثر ولا أقل. مشتقة من الواجهة التوافقية نفسها (Pick) فلا
 * تنحرف عنها بنيويًا أبدًا؛ ومستهلك يكتفي بجزء منها يأخذ Pick منه —
 * الاعتماد المصرح به بدقة عند الحاقن.
 */
export interface LoanStore extends Pick<PrototypeLocalStore, LoanStoreMethod> {}
