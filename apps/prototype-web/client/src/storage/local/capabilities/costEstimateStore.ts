/**
 * R3 (WS-216/ARCH-007 — بطاقة R3-SC-06): منفذ قدرة «تقديرات الطلب» —
 * استخراج جديد بنمط RC-7/4C/Wave-C المثبت.
 *
 * العلاقة الحاكمة (لا قاعدة جديدة):
 *  - الواجهة `PrototypeLocalStore` في types.ts تبقى **الواجهة التوافقية**
 *    والمصدر السلطوي لتواقيع المنفذ كله — لا توقيع يُنسخ هنا أبدًا؛ هذه
 *    القدرة **عرض مشتق** منها (Pick) فأي انحراف في التواقيع يكسر فحص
 *    الأنواع نفسه ولا يمكن أن يمر صامتًا.
 *  - المحوّلان `IndexedDbLocalStore` و`MemoryLocalStore` يحققان القدرة
 *    نفسها: يفرضه ملف المراسي النوعية (costEstimateCapabilityAnchors.ts)
 *    وعقد السلوك (costEstimateCapability.contract.test.ts — نفس العقود
 *    للمحوّلين عبر عدسة القدرة الضيقة).
 *  - لا حارس ملف مستقل — الحدود داخل المحوّلين.
 *
 * العضوية (4 طرق):
 * قراءة السجلات كما كُتبت (قائمة ومفردة)، والحفظ، والحذف — سطح تقديرات بلا حارس كتابة مستقل، محفوظ الحدود داخل المحوّلين.
 *
 * الاستهلاك: المستهلك الوحيد application/estimates/costEstimateService (يهاجر في هذه الموجة).
 * حذف أي طريقة من الواجهة التوافقية لا يجوز إلا بخطوة لاحقة موثقة حين
 * يثبت سجل الملكية خلوّها من المستهلكين (قاعدة RC-7).
 */
import type { PrototypeLocalStore } from "../types";

export const costEstimateStoreMethods = [
  "listCostEstimates",
  "getCostEstimate",
  "saveCostEstimate",
  "deleteCostEstimate",
] as const;

export type CostEstimateStoreMethod = (typeof costEstimateStoreMethods)[number];

/**
 * قدرة «تقديرات الطلب»: ما يحتاجه مستهلك هذه القدرة — لا أكثر ولا أقل.
 * مشتقة من الواجهة التوافقية نفسها (Pick) فلا تنحرف عنها بنيويًا أبدًا.
 */
export interface CostEstimateStore extends Pick<PrototypeLocalStore, CostEstimateStoreMethod> {}
