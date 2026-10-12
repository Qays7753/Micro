/**
 * R10-B5/NF-020 (2026-10-13): أدوات تضييق نتائج الاختبار — الملف واحد لكل
 * ملفات اختبار التطبيق التي تدقق نوعيًا الآن (أُزيل استثناء كل ملفات
 * اختبار ts من التدقيق).
 *
 * المشكلة الجذرية: الاختبارات كانت تكتب `expect(x.ok).toBe(true)` ثم تصل
 * إلى `x.value` — التوكّد لا يُضيّق النوع عند المُدقّق (ليس asserts)، فكان
 * الوصول يتطلب استثناء كامل الملف من التدقيق النوعي. البديل المتداول في
 * ملفات tsx المدققة كان `if (!x.ok) throw ...` قبل كل وصول — صحيح لكنه
 * يضاعف الأسطر عند مئات المواقع.
 *
 * الحل هنا: دالة asserts واحدة عامة على كل اتحادات النتائج ذات التمييز
 * `ok` في هذا المستودع (StorageResult وجميع نتائج الخدمات) — الاستخراج
 * بExtract يختار الذراع الناجحة كما هي بلا أي قولبة (لا casts):
 * `assertOk(x)` بعدها `x.value` مدقق نوعيًا بالذراع الصحيحة، والفشل وقت
 * التشغيل يرمي برسالة الهدف (سلوك الاختبار لا يتغير: النتائج كانت ناجحة
 * أصلًا والتوكّد قبله يوثّق القصد نفسه).
 *
 * ملف دعم اختباري فقط: لا يستورده إنتاج أبدًا فلا يظهر في الحزمة؛ حدوده
 * القصدية: اتحادات `ok` المنطقية وحدها — اتحادات التمييز الأخرى (status)
 * تُضيّق في مواضعها بمتوكّداتها الطبيعية.
 */

/** الذراع الناجحة من اتحاد نتيجة بتمييز ok منطقي — كما هي بلا قولبة. */
export type OkArm<R extends { ok: boolean }> = Extract<R, { ok: true }>;

export function assertOk<R extends { ok: boolean }>(result: R): asserts result is OkArm<R> {
  if (!result.ok) {
    const detail = "message" in result && typeof result.message === "string" ? `: ${result.message}` : "";
    throw new Error(`assertOk — expected the ok arm, got the failure arm${detail}`);
  }
}

/**
 * نسخة القيمة للتوثيق المباشر: تعيد value من الذراع الناجحة أو ترمي —
 * للمواضع التي كان فيها الاستقبال تعبيرًا مضمنًا `(await store.x()).value`
 * حيث لا يمكن تمرير asserts فوق تعبير؛ `okValue(await store.x())` تحل
 * الموضع بتضييق صادق بلا أي قولبة. التوقيع بنيوي (ok ثنائي + قيمة) فيطابق
 * كل اتحادات النتائج المنطقية في المستودع.
 */
export function okValue<T>(result: { ok: true; value: T } | { ok: false; message?: string }): T {
  if (!result.ok) {
    const detail = typeof result.message === "string" ? `: ${result.message}` : "";
    throw new Error(`okValue — expected the ok arm, got the failure arm${detail}`);
  }
  return result.value;
}
