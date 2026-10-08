/**
 * R3 (WS-216/ARCH-007 — بطاقة R3-SC-08): منفذ قدرة «الجداول والتكرارات» —
 * استخراج جديد بنمط RC-7/4C/Wave-C المثبت.
 *
 * العلاقة الحاكمة (لا قاعدة جديدة):
 *  - الواجهة `PrototypeLocalStore` في types.ts تبقى **الواجهة التوافقية**
 *    والمصدر السلطوي لتواقيع المنفذ كله — لا توقيع يُنسخ هنا أبدًا؛ هذه
 *    القدرة **عرض مشتق** منها (Pick) فأي انحراف في التواقيع يكسر فحص
 *    الأنواع نفسه ولا يمكن أن يمر صامتًا.
 *  - المحوّلان `IndexedDbLocalStore` و`MemoryLocalStore` يحققان القدرة
 *    نفسها: يفرضه ملف المراسي النوعية (scheduleCapabilityAnchors.ts)
 *    وعقد السلوك (scheduleCapability.contract.test.ts — نفس العقود
 *    للمحوّلين عبر عدسة القدرة الضيقة).
 *  - supplierScheduleCommitGuard (عائلة الجدول) — يبقى في ملفه المشترك الموثق.
 *
 * العضوية (9 طرق):
 * قراءة الجداول والتكرارات كما كُتبت، وإنشاء/تحديث الجدول المحرسان (supplierScheduleCommitGuard — عائلتا مورد+جدول في ملف واحد STR-306 PRESERVE)، والتكرار المحرس — saveSchedule/saveRecurrence سطح دعم اختبارات STR-618 يبقى في العضوية.
 *
 * الاستهلاك: الكاتبان application/scheduling/scheduleService وrecurrenceService؛ القارئ homeControlCenterService Pick موضعي.
 * حذف أي طريقة من الواجهة التوافقية لا يجوز إلا بخطوة لاحقة موثقة حين
 * يثبت سجل الملكية خلوّها من المستهلكين (قاعدة RC-7).
 */
import type { PrototypeLocalStore } from "../types";

export const scheduleStoreMethods = [
  "listSchedules",
  "getSchedule",
  "saveSchedule",
  "commitScheduleCreate",
  "commitScheduleUpdate",
  "listRecurrences",
  "getRecurrence",
  "saveRecurrence",
  "commitRecurrence",
] as const;

export type ScheduleStoreMethod = (typeof scheduleStoreMethods)[number];

/**
 * قدرة «الجداول والتكرارات»: ما يحتاجه مستهلك هذه القدرة — لا أكثر ولا أقل.
 * مشتقة من الواجهة التوافقية نفسها (Pick) فلا تنحرف عنها بنيويًا أبدًا.
 */
export interface ScheduleStore extends Pick<PrototypeLocalStore, ScheduleStoreMethod> {}
