/**
 * R3 (WS-216/ARCH-007 — بطاقة R3-SC-04): منفذ قدرة «البيع المباشر» —
 * استخراج جديد بنمط RC-7/4C/Wave-C المثبت.
 *
 * العلاقة الحاكمة (لا قاعدة جديدة):
 *  - الواجهة `PrototypeLocalStore` في types.ts تبقى **الواجهة التوافقية**
 *    والمصدر السلطوي لتواقيع المنفذ كله — لا توقيع يُنسخ هنا أبدًا؛ هذه
 *    القدرة **عرض مشتق** منها (Pick) فأي انحراف في التواقيع يكسر فحص
 *    الأنواع نفسه ولا يمكن أن يمر صامتًا.
 *  - المحوّلان `IndexedDbLocalStore` و`MemoryLocalStore` يحققان القدرة
 *    نفسها: يفرضه ملف المراسي النوعية (directSaleCapabilityAnchors.ts)
 *    وعقد السلوك (directSaleCapability.contract.test.ts — نفس العقود
 *    للمحوّلين عبر عدسة القدرة الضيقة).
 *  - عكس التحصيل محروس داخل المحوّلين (idempotency + CAS) — لا حارس ملف مستقل.
 *
 * العضوية (3 طرق):
 * قراءة السجلات كما كُتبت، والحفظ الحتمي، وعكس تحصيل البيع المباشر المحرس — كلها داخل حدود المحوّلين كما هي.
 *
 * الاستهلاك: الكاتبان application/direct-sales/directSaleService وapplication/collections/saleCollectionReversalService؛ القرّاء Pick موضعي.
 * حذف أي طريقة من الواجهة التوافقية لا يجوز إلا بخطوة لاحقة موثقة حين
 * يثبت سجل الملكية خلوّها من المستهلكين (قاعدة RC-7).
 */
import type { PrototypeLocalStore } from "../types";

export const directSaleStoreMethods = [
  "listDirectSales",
  "saveDirectSale",
  "commitDirectSaleCollectionReversal",
] as const;

export type DirectSaleStoreMethod = (typeof directSaleStoreMethods)[number];

/**
 * قدرة «البيع المباشر»: ما يحتاجه مستهلك هذه القدرة — لا أكثر ولا أقل.
 * مشتقة من الواجهة التوافقية نفسها (Pick) فلا تنحرف عنها بنيويًا أبدًا.
 */
export interface DirectSaleStore extends Pick<PrototypeLocalStore, DirectSaleStoreMethod> {}
