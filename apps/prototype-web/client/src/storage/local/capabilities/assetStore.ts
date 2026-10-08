/**
 * R3 (WS-216/ARCH-007 — بطاقة R3-SC-05): منفذ قدرة «الأصول» —
 * استخراج جديد بنمط RC-7/4C/Wave-C المثبت.
 *
 * العلاقة الحاكمة (لا قاعدة جديدة):
 *  - الواجهة `PrototypeLocalStore` في types.ts تبقى **الواجهة التوافقية**
 *    والمصدر السلطوي لتواقيع المنفذ كله — لا توقيع يُنسخ هنا أبدًا؛ هذه
 *    القدرة **عرض مشتق** منها (Pick) فأي انحراف في التواقيع يكسر فحص
 *    الأنواع نفسه ولا يمكن أن يمر صامتًا.
 *  - المحوّلان `IndexedDbLocalStore` و`MemoryLocalStore` يحققان القدرة
 *    نفسها: يفرضه ملف المراسي النوعية (assetCapabilityAnchors.ts)
 *    وعقد السلوك (assetCapability.contract.test.ts — نفس العقود
 *    للمحوّلين عبر عدسة القدرة الضيقة).
 *  - التصحيح محروس داخل المحوّلين — لا حارس ملف مستقل.
 *
 * العضوية (4 طرق):
 * قراءة السجلات كما كُتبت (قائمة ومفردة)، وcommitAssetRecord الحتمي، وتصحيح الاستحواذ الذرّي — داخل حدود المحوّلين كما هي.
 *
 * الاستهلاك: الكاتب application/assets/assetService؛ القرّاء (وحدات integrityCheck وcorrectionHistoryService) Pick موضعي.
 * حذف أي طريقة من الواجهة التوافقية لا يجوز إلا بخطوة لاحقة موثقة حين
 * يثبت سجل الملكية خلوّها من المستهلكين (قاعدة RC-7).
 */
import type { PrototypeLocalStore } from "../types";

export const assetStoreMethods = [
  "listAssets",
  "getAsset",
  "commitAssetRecord",
  "commitAssetAcquisitionCorrection",
] as const;

export type AssetStoreMethod = (typeof assetStoreMethods)[number];

/**
 * قدرة «الأصول»: ما يحتاجه مستهلك هذه القدرة — لا أكثر ولا أقل.
 * مشتقة من الواجهة التوافقية نفسها (Pick) فلا تنحرف عنها بنيويًا أبدًا.
 */
export interface AssetStore extends Pick<PrototypeLocalStore, AssetStoreMethod> {}
