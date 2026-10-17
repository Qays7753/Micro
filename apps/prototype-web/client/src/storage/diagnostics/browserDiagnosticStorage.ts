/**
 * R11 ARCH-010 / R11-W1A-NF-001 (موجة المتابعة 2026-10-15): حد تخزين التشخيص
 * الصريح — هذا الملف هو الموضع الإنتاجي الوحيد المسجل الذي يلمس متصفح
 * `localStorage` لسجل التشخيص المحلي. خدمة التطبيق
 * (`application/diagnostics/localDiagnosticsService.ts`) تستهلك منفذها
 * المحقون `DiagnosticStorage` ولا تعرف المتصفح إطلاقًا؛ المهايئ هنا في طبقة
 * التخزين داخل حد مستقل (`storage/diagnostics/` — خارج `storage/local/`
 * وعقد التخزين المالية 130-طريقة كليًا بقرار العقد: التشخيص غير مالي
 * ومحلي ولا يُوجَّه عبر `PrototypeLocalStore` أبدًا).
 *
 * الحارس المخصص `scripts/check-diagnostics-storage.mjs` يقبل هذا الملف
 * بالضبط (registered-entry) ويرفض أي وصول إنتاجي جديد لمفاتيح تخزين
 * المتصفح في أي مكان آخر — لا قائمة `localStorage` عامة.
 *
 * عقد الفشل (كما كان بلا أي تغيير سلوك): التخزين الغائب أو null يُرجع كعبًا
 * يرمي عند القراءة والكتابة معًا — فتُرجع الخدمة `null` من `recordIncident`
 * وتُظهر الواجهة الركن بلا معرف حادثة، لا خطأ ثانٍ ولا رمي للمستخدم.
 */

/** منفذ تخزين التشخيص الضيق القابل للحقن — الإنتاج localStorage (هنا وحده)
 * والاختبار كعب. مملوك لحد تخزين التشخيص وتستهلكه الخدمة نوعًا فقط. */
export type DiagnosticStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

/** مهايئ متصفح التشخيص — المدخل المسجل الوحيد لكل تشخيص الإنتاج. */
export function browserDiagnosticStorage(): DiagnosticStorage {
  const storage = globalThis.localStorage;
  if (storage === undefined || storage === null) {
    /* بلا تخزين: سجل يُرمى كتابته بلا انفجار — recordIncident يعيد null. */
    return {
      getItem: () => {
        throw new Error("diagnostics storage unavailable");
      },
      setItem: () => {
        throw new Error("diagnostics storage unavailable");
      },
    };
  }
  return storage;
}
