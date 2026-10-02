/**
 * Wave 4C (ARCH-002/WS-212 — بطاقة RC-7): منفذ قدرة «دورة حياة الطلب» —
 * القدرة الطيار لاستخراج قدرات التخزين من الواجهة الموحدة (131 طريقة).
 *
 * العلاقة الحاكمة (قواعد البطاقة):
 *  - الواجهة `PrototypeLocalStore` في types.ts تبقى **الواجهة التوافقية**
 *    والمصدر السلطوي لتواقيع المنفذ كله — لا توقيع يُنسخ هنا أبدًا؛ هذه
 *    القدرة **عرض مشتق** منها (Pick) فأي انحراف في التواقيع يكسر فحص
 *    الأنواع نفسه ولا يمكن أن يمر صامتًا.
 *  - المحوّلان `IndexedDbLocalStore` و`MemoryLocalStore` يحققان القدرة نفسها:
 *    يفرضه ملف المراسي النوعية (orderLifecycleCapabilityAnchors.ts — يدخله
 *    فحص أنواع الـapp القياسي ويعيد فرضه عقد الاختبار زمن التشغيل عبر tsc)
 *    وعقد السلوك (orderLifecycleCapability.contract.test.ts — نفس العقود
 *    للمحوّلين عبر عدسة القدرة الضيقة).
 *  - حدود المعاملات والحتمية وحماية الكتابة القديمة (storage_stale بلا
 *    كتابة) وهوية الأخطاء محفوظة كما هي داخل المحوّلين — لا سلوك يُنقل ولا
 *    يُعاد تعريفه هنا.
 *
 * ملكية المفهوم: domain/craft-order (سجل الملكية §1)؛ حراس الكتابة داخل
 * حد الكتابة: orderCommitGuard + deliveryReversalCommitGuard (STR-306 — PRESERVE).
 * العضوية (9 طرق — مجموعة «Order lifecycle» في سجل الملكية §2): القراءة
 * والإنشاء والبذور (saveOrder للإنشاء والبذور فقط — عقد G-003، يحرسه
 * saveOrderGuard.contract) وستة التزامات محروسة ذرّية.
 *
 * الاستهلاك: الخدمات التي لا تحتاج غير هذه القدرة تعتمد النوع الضيق بدل
 * الواجهة الكاملة — طيّر الطيار ثلاث خدمات: agreementService،
 * agreementContextService، financialPulseService (ترحيل ميكانيكي لتوقيع
 * الحاقن فقط). حذف أي طريقة من الواجهة التوافقية لا يجوز إلا بخطوة لاحقة
 * موثقة حين يثبت سجل الملكية خلوّها من المستهلكين (قاعدة RC-7).
 */
import type { PrototypeLocalStore } from "../types";

export const orderLifecycleStoreMethods = [
  "listOrders",
  "getOrder",
  "saveOrder",
  "commitOrderUpdate",
  "commitOrderCollectionReversal",
  "commitDepositRefundSettlement",
  "commitOrderFromDraft",
  "commitOrderDelivery",
  "commitOrderDeliveryReversal",
] as const;

export type OrderLifecycleStoreMethod = (typeof orderLifecycleStoreMethods)[number];

/**
 * قدرة «دورة حياة الطلب»: ما يحتاجه مستهلك هذه القدرة — لا أكثر ولا أقل.
 * مشتقة من الواجهة التوافقية نفسها (Pick) فلا تنحرف عنها بنيويًا أبدًا.
 */
export interface OrderLifecycleStore extends Pick<PrototypeLocalStore, OrderLifecycleStoreMethod> {}
