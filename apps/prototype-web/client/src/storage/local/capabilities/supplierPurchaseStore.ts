/**
 * R3 (WS-216/ARCH-007 — بطاقة R3-SC-03): منفذ قدرة «مشتريات المورّد» —
 * استخراج جديد بنمط RC-7/4C/Wave-C المثبت.
 *
 * العلاقة الحاكمة (لا قاعدة جديدة):
 *  - الواجهة `PrototypeLocalStore` في types.ts تبقى **الواجهة التوافقية**
 *    والمصدر السلطوي لتواقيع المنفذ كله — لا توقيع يُنسخ هنا أبدًا؛ هذه
 *    القدرة **عرض مشتق** منها (Pick) فأي انحراف في التواقيع يكسر فحص
 *    الأنواع نفسه ولا يمكن أن يمر صامتًا.
 *  - المحوّلان `IndexedDbLocalStore` و`MemoryLocalStore` يحققان القدرة
 *    نفسها: يفرضه ملف المراسي النوعية (supplierPurchaseCapabilityAnchors.ts)
 *    وعقد السلوك (supplierPurchaseCapability.contract.test.ts — نفس العقود
 *    للمحوّلين عبر عدسة القدرة الضيقة).
 *  - supplierScheduleCommitGuard (HIGH-001) وsupplierAttributionCommitGuard (G-002) — كلاهما داخل المحوّلين، لا يُمسّان (STR-306 PRESERVE للملف المشترك).
 *
 * العضوية (5 طرق):
 * قراءة السجلات كما كُتبت (قائمة ومفردة)، والحفظ، والارتباط المحرس (HIGH-001 عبر supplierScheduleCommitGuard)، والارتباط مع شفاء الإسناد الذرّي (G-002 عبر supplierAttributionCommitGuard) — الحرّاس داخل المحوّلين كما هم.
 *
 * الاستهلاك: الكاتب application/suppliers/supplierPurchaseService (يهاجر في هذه الموجة نفسها)؛ القرّاء متعددو العائلات Pick موضعي.
 * حذف أي طريقة من الواجهة التوافقية لا يجوز إلا بخطوة لاحقة موثقة حين
 * يثبت سجل الملكية خلوّها من المستهلكين (قاعدة RC-7).
 */
import type { PrototypeLocalStore } from "../types";

export const supplierPurchaseStoreMethods = [
  "listSupplierPurchases",
  "getSupplierPurchase",
  "saveSupplierPurchase",
  "commitSupplierPurchase",
  "commitSupplierPurchaseWithAttribution",
] as const;

export type SupplierPurchaseStoreMethod = (typeof supplierPurchaseStoreMethods)[number];

/**
 * قدرة «مشتريات المورّد»: ما يحتاجه مستهلك هذه القدرة — لا أكثر ولا أقل.
 * مشتقة من الواجهة التوافقية نفسها (Pick) فلا تنحرف عنها بنيويًا أبدًا.
 */
export interface SupplierPurchaseStore extends Pick<PrototypeLocalStore, SupplierPurchaseStoreMethod> {}
