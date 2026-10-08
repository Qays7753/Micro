/**
 * R3 (WS-216/ARCH-007 — بطاقة R3-SC-09): منفذ قدرة «الكتالوج» —
 * استخراج جديد بنمط RC-7/4C/Wave-C المثبت.
 *
 * العلاقة الحاكمة (لا قاعدة جديدة):
 *  - الواجهة `PrototypeLocalStore` في types.ts تبقى **الواجهة التوافقية**
 *    والمصدر السلطوي لتواقيع المنفذ كله — لا توقيع يُنسخ هنا أبدًا؛ هذه
 *    القدرة **عرض مشتق** منها (Pick) فأي انحراف في التواقيع يكسر فحص
 *    الأنواع نفسه ولا يمكن أن يمر صامتًا.
 *  - المحوّلان `IndexedDbLocalStore` و`MemoryLocalStore` يحققان القدرة
 *    نفسها: يفرضه ملف المراسي النوعية (catalogCapabilityAnchors.ts)
 *    وعقد السلوك (catalogCapability.contract.test.ts — نفس العقود
 *    للمحوّلين عبر عدسة القدرة الضيقة).
 *  - مراجعة القالب محروسة داخل المحوّلين — لا حارس ملف مستقل.
 *
 * العضوية (13 طرق):
 * أبعاد الكتالوج الثلاثة (البنود، وحدات القياس وتحويلاتها، القوالب ومراجعاتها) — عائلة متجر واحدة؛ مراجعة القالب المحروسة commitCatalogTemplateRevision داخل المحوّلين.
 *
 * الاستهلاك: الكاتب application/catalog/catalogService (+templatePlannedCostService للقوالب)؛ القرّاء Pick موضعي.
 * حذف أي طريقة من الواجهة التوافقية لا يجوز إلا بخطوة لاحقة موثقة حين
 * يثبت سجل الملكية خلوّها من المستهلكين (قاعدة RC-7).
 */
import type { PrototypeLocalStore } from "../types";

export const catalogStoreMethods = [
  "listCatalogItems",
  "getCatalogItem",
  "saveCatalogItem",
  "listMeasurementUnits",
  "getMeasurementUnit",
  "saveMeasurementUnit",
  "listDirectConversions",
  "getDirectConversion",
  "saveDirectConversion",
  "listCatalogTemplates",
  "getCatalogTemplate",
  "saveCatalogTemplate",
  "commitCatalogTemplateRevision",
] as const;

export type CatalogStoreMethod = (typeof catalogStoreMethods)[number];

/**
 * قدرة «الكتالوج»: ما يحتاجه مستهلك هذه القدرة — لا أكثر ولا أقل.
 * مشتقة من الواجهة التوافقية نفسها (Pick) فلا تنحرف عنها بنيويًا أبدًا.
 */
export interface CatalogStore extends Pick<PrototypeLocalStore, CatalogStoreMethod> {}
