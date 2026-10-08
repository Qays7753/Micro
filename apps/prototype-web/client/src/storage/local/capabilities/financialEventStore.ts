/**
 * R3 (WS-216/ARCH-007 — بطاقة R3-SC-02): منفذ قدرة «الأحداث المالية» —
 * استخراج جديد بنمط RC-7/4C/Wave-C المثبت.
 *
 * العلاقة الحاكمة (لا قاعدة جديدة):
 *  - الواجهة `PrototypeLocalStore` في types.ts تبقى **الواجهة التوافقية**
 *    والمصدر السلطوي لتواقيع المنفذ كله — لا توقيع يُنسخ هنا أبدًا؛ هذه
 *    القدرة **عرض مشتق** منها (Pick) فأي انحراف في التواقيع يكسر فحص
 *    الأنواع نفسه ولا يمكن أن يمر صامتًا.
 *  - المحوّلان `IndexedDbLocalStore` و`MemoryLocalStore` يحققان القدرة
 *    نفسها: يفرضه ملف المراسي النوعية (financialEventCapabilityAnchors.ts)
 *    وعقد السلوك (financialEventCapability.contract.test.ts — نفس العقود
 *    للمحوّلين عبر عدسة القدرة الضيقة).
 *  - حدود المعاملات والحتمية وحماية الكتابة (idempotency بمفتاح الحدث،
 *    عكس/استبدال ذرّيان داخل معاملة واحدة، رفض المصدر المفقود بلا كتابة،
 *    وهوية الأخطاء storage_error/storage_stale كما في المحوّلين) محفوظة
 *    كما هي — لا سلوك يُنقل ولا يُعاد تعريفه هنا. المفهوم مملوك
 *    لـdomain/financial-event (سجل الملكية §2) ولا حارس ملف مستقل لهذه
 *    العائلة — الحماية داخل المحوّلين (موثق في البطاقة).
 *
 * العضوية (5 طرق — مجموعة «Financial events» في سجل الملكية §2):
 * قراءة السجلات كما كُتبت (قائمة ومفردة)، والحفظ الحتمي (حدث بنفس
 * idempotencyKey يُعاد كما هو فلا يتكرر الأثر المالي)، والتراجع الذرّي
 * الموثق، والتعديل الذرّي الموثق (تراجع + بديل في معاملة واحدة فلا يبقى
 * أثر معلّق بينهما).
 *
 * الاستهلاك: الكاتب application/finance/projectFinancialEventWrites (يهاجر
 * إلى النوع الضيق في هذه الموجة نفسها — مع قناة السيولة النقدية المشتركة
 * بـPick موضعي لأنها عائلة KEEP R3-SC-19)، والقرّاء الأحاديون يتبعون؛
 * القرّاء متعددو العائلات يعرّفون Pick موضعيًا (نمط statementService).
 * حذف أي طريقة من الواجهة التوافقية لا يجوز إلا بخطوة لاحقة موثقة حين
 * يثبت سجل الملكية خلوّها من المستهلكين (قاعدة RC-7).
 */
import type { PrototypeLocalStore } from "../types";

export const financialEventStoreMethods = [
  "listFinancialEvents",
  "getFinancialEvent",
  "saveFinancialEvent",
  "commitFinancialEventCorrection",
  "commitFinancialEventReplacement",
] as const;

export type FinancialEventStoreMethod = (typeof financialEventStoreMethods)[number];

/**
 * قدرة «الأحداث المالية»: ما يحتاجه مستهلك هذه القدرة — لا أكثر ولا أقل.
 * مشتقة من الواجهة التوافقية نفسها (Pick) فلا تنحرف عنها بنيويًا أبدًا.
 */
export interface FinancialEventStore extends Pick<PrototypeLocalStore, FinancialEventStoreMethod> {}
