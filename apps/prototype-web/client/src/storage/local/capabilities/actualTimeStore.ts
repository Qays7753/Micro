/**
 * R3 (WS-216/ARCH-007 — بطاقة R3-SC-10): منفذ قدرة «الوقت الفعلي» —
 * استخراج جديد بنمط RC-7/4C/Wave-C المثبت.
 *
 * العلاقة الحاكمة (لا قاعدة جديدة):
 *  - الواجهة `PrototypeLocalStore` في types.ts تبقى **الواجهة التوافقية**
 *    والمصدر السلطوي لتواقيع المنفذ كله — لا توقيع يُنسخ هنا أبدًا؛ هذه
 *    القدرة **عرض مشتق** منها (Pick) فأي انحراف في التواقيع يكسر فحص
 *    الأنواع نفسه ولا يمكن أن يمر صامتًا.
 *  - المحوّلان `IndexedDbLocalStore` و`MemoryLocalStore` يحققان القدرة
 *    نفسها: يفرضه ملف المراسي النوعية (actualTimeCapabilityAnchors.ts)
 *    وعقد السلوك (actualTimeCapability.contract.test.ts — نفس العقود
 *    للمحوّلين عبر عدسة القدرة الضيقة).
 *  - لا حارس ملف مستقل — الحدود داخل المحوّلين.
 *
 * العضوية (2 طرق):
 * قراءة سجلات الوقت الفعلي كما كُتبت وحفظها الحتمي — سطح بلا حارس كتابة مستقل، محفوظ الحدود داخل المحوّلين.
 *
 * الاستهلاك: الكاتب application/time/actualTimeService؛ القرّاء (recurringWorkService/ownerEntitlementService) Pick موضعي.
 * حذف أي طريقة من الواجهة التوافقية لا يجوز إلا بخطوة لاحقة موثقة حين
 * يثبت سجل الملكية خلوّها من المستهلكين (قاعدة RC-7).
 */
import type { PrototypeLocalStore } from "../types";

export const actualTimeStoreMethods = ["listActualTimeRecords", "saveActualTimeRecord"] as const;

export type ActualTimeStoreMethod = (typeof actualTimeStoreMethods)[number];

/**
 * قدرة «الوقت الفعلي»: ما يحتاجه مستهلك هذه القدرة — لا أكثر ولا أقل.
 * مشتقة من الواجهة التوافقية نفسها (Pick) فلا تنحرف عنها بنيويًا أبدًا.
 */
export interface ActualTimeStore extends Pick<PrototypeLocalStore, ActualTimeStoreMethod> {}
