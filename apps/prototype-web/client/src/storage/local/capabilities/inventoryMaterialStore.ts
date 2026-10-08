/**
 * R3 (WS-216/ARCH-007 — بطاقة R3-SC-07): منفذ قدرة «المادة والمخزون» —
 * استخراج جديد بنمط RC-7/4C/Wave-C المثبت.
 *
 * العلاقة الحاكمة (لا قاعدة جديدة):
 *  - الواجهة `PrototypeLocalStore` في types.ts تبقى **الواجهة التوافقية**
 *    والمصدر السلطوي لتواقيع المنفذ كله — لا توقيع يُنسخ هنا أبدًا؛ هذه
 *    القدرة **عرض مشتق** منها (Pick) فأي انحراف في التواقيع يكسر فحص
 *    الأنواع نفسه ولا يمكن أن يمر صامتًا.
 *  - المحوّلان `IndexedDbLocalStore` و`MemoryLocalStore` يحققان القدرة
 *    نفسها: يفرضه ملف المراسي النوعية (inventoryMaterialCapabilityAnchors.ts)
 *    وعقد السلوك (inventoryMaterialCapability.contract.test.ts — نفس العقود
 *    للمحوّلين عبر عدسة القدرة الضيقة).
 *  - مفهوم inventory commit guard منطق داخل-المحوّل — لا يُجسَّد ملفًا.
 *
 * العضوية (8 طرق):
 * قراءة المواد والحركات والتنشيطات والنواقص كما كُتبت، وحفظ التنشيط، وcommitInventory الذرّي (ومعه النقص أو الأحداث) — حرس الالتزام داخل المحوّلين (STR-606/STR-306: منطق داخل-المحوّل لا ملف).
 *
 * الاستهلاك: عائلة الكتّاب application/inventory/* (7 وحدات)؛ القرّاء Pick موضعي.
 * حذف أي طريقة من الواجهة التوافقية لا يجوز إلا بخطوة لاحقة موثقة حين
 * يثبت سجل الملكية خلوّها من المستهلكين (قاعدة RC-7).
 */
import type { PrototypeLocalStore } from "../types";

export const inventoryMaterialStoreMethods = [
  "listMaterials",
  "listInventoryMovements",
  "getInventoryActivation",
  "saveInventoryActivation",
  "commitInventory",
  "listInventoryShortages",
  "commitInventoryWithShortage",
  "commitInventoryWithEvents",
] as const;

export type InventoryMaterialStoreMethod = (typeof inventoryMaterialStoreMethods)[number];

/**
 * قدرة «المادة والمخزون»: ما يحتاجه مستهلك هذه القدرة — لا أكثر ولا أقل.
 * مشتقة من الواجهة التوافقية نفسها (Pick) فلا تنحرف عنها بنيويًا أبدًا.
 */
export interface InventoryMaterialStore extends Pick<PrototypeLocalStore, InventoryMaterialStoreMethod> {}
