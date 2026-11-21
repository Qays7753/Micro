/**
 * باب اسأل Micro للتطبيق (الملحق §10.2 — DOC-041/WS-251، 2026-11-22):
 * السجل المحلي النصي (٢١ يومًا، بلا صوت خام) وبناء سجل الحدث المالي
 * المقترح عبر دالة إنشاء المجال نفسها — الواجهة لا تلمس المجال ولا
 * التخزين مباشرة (R2/R5/R6)؛ هذا الباب طريقها الوحيد. توسيع سطحه تعديل
 * مقصود بنفس الـPR (PC-3). لا كتابة قبل تأكيد المستخدم الصريح.
 */
export { loadAskHistory, recordAskExchange, type AskHistoryEntry } from "./askHistoryService";
export { constructFinancialEventRecord, askDraftAmountMinor } from "./askFinancialDraftService";
