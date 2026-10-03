/**
 * Wave C (ARCH-004/WS-214 — بطاقة ADR-015 مجموعة 5): منفذ قدرة «تصريحات
 * الكاش القصير» — الاستخراج الخامس بترتيب ADR-15 المعتمد، بالنمط المثبت.
 *
 * العلاقة الحاكمة (لا قاعدة جديدة):
 *  - الواجهة `PrototypeLocalStore` في types.ts تبقى **الواجهة التوافقية**
 *    والمصدر السلطوي لتواقيع المنفذ كله — لا توقيع يُنسخ هنا أبدًا؛ هذه
 *    القدرة **عرض مشتق** منها (Pick) فأي انحراف في التواقيع يكسر فحص
 *    الأنواع نفسه ولا يمكن أن يمر صامتًا.
 *  - المحوّلان `IndexedDbLocalStore` و`MemoryLocalStore` يحققان القدرة
 *    نفسها: يفرضه ملف المراسي النوعية (shortCashDeclarationCapabilityAnchors.ts)
 *    وعقد السلوك (shortCashDeclarationCapability.contract.test.ts — نفس
 *    العقود للمحوّلين عبر عدسة القدرة الضيقة).
 *  - عهدة الحتمية (مفتاح السجل) وحماية التراجع (تراجع واحد لكل سجل
 *  متوقع؛ والمفتاح المختلف على سجل متراجع سابقًا رفض صادر) وهوية الأخطاء
 *    محفوظة كما هي داخل المحوّلين — لا سلوك يُنقل ولا يُعاد تعريفه هنا.
 *
 * ملاحظة الملكية (قيد 4A — STR-622 محفوظ): التصريح سجل مخزّن يملكه
 * domain/g5 عبر financial-analysis — **ليس read model**؛ القراءة المشتقة
 * تبقى عند القارئ الكنوني. المفهوم مملوك لـdomain/g5 (سجل مخزّن) وحارس
 * التراجع shortCashDeclarationReversal داخل حد الكتابة (STR-306 PRESERVE).
 *
 * العضوية (4 طرق — مجموعة «Short cash declarations» في سجل الملكية §2):
 * القراءة والقراءة الفردية والحفظ الحتمي والتزام التراجع المحروس.
 *
 * الاستهلاك (جرد مستهلكين حي 2026-10-04): مستهلك إنتاج وحيد —
 * application/financial-analysis/financialAnalysisService يستخدم 3 من
 * الطرق الأربع (getShortCashDeclaration بلا مستهلك إنتاج اليوم — تبقى
 * في الواجهة والقدرة؛ حذفها لا يجوز إلا بخطوة لاحقة موثقة بخلوّ
 * المستهلكين). حذف أي طريقة من الواجهة التوافقية لا يجوز إلا بخطوة
 * لاحقة موثقة حين يثبت سجل الملكية خلوّها من المستهلكين (قاعدة RC-7).
 */
import type { PrototypeLocalStore } from "../types";

export const shortCashDeclarationStoreMethods = [
  "listShortCashDeclarations",
  "getShortCashDeclaration",
  "saveShortCashDeclaration",
  "commitShortCashDeclarationReversal",
] as const;

export type ShortCashDeclarationStoreMethod = (typeof shortCashDeclarationStoreMethods)[number];

/**
 * قدرة «تصريحات الكاش القصير»: ما يحتاجه مستهلك هذه القدرة — لا أكثر ولا
 * أقل. مشتقة من الواجهة التوافقية نفسها (Pick) فلا تنحرف عنها بنيويًا
 * أبدًا؛ ومستهلك يكتفي بجزء منها يأخذ Pick منه — الاعتماد المصرح به
 * بدقة عند الحاقن.
 */
export interface ShortCashDeclarationStore
  extends Pick<PrototypeLocalStore, ShortCashDeclarationStoreMethod> {}
