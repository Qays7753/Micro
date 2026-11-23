/**
 * باب اسأل Micro للتطبيق (الملحق §10.2 — DOC-041/WS-251، 2026-11-22):
 * السجل المحلي النصي (٢١ يومًا، بلا صوت خام) وبناء سجل الحدث المالي
 * المقترح عبر دالة إنشاء المجال نفسها — الواجهة لا تلمس المجال ولا
 * التخزين مباشرة (R2/R5/R6)؛ هذا الباب طريقها الوحيد. توسيع سطحه تعديل
 * مقصود بنفس الـPR (PC-3). لا كتابة قبل تأكيد المستخدم الصريح.
 *
 * إعادة إرساء مؤرخة (نفس الـPR، 2026-11-22 — استكمال بروتوكول التسجيل):
 * السجل المحلي صار عند منفذ التخزين نفسه (listAskHistory/
 * saveAskHistoryEntry في المهايئين كلاهما — نمط مسودات النماذج) فخرج
 * الدرجُ الحرّان القديمان ودخلت الخدمة القابلة للحقن AskHistoryService
 * تركّبها جذر التركيب كالمعتاد (الساعة عبر منفذ systemClock — OD-TIME).
 */
export { AskHistoryService, type AskHistoryEntry } from "./askHistoryService";
export { constructFinancialEventRecord, askDraftAmountMinor } from "./askFinancialDraftService";
