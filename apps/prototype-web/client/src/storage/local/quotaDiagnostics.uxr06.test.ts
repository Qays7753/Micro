/** UXR-06 (PERF-012 — COPY-25): رسالة نفاد حصة التخزين المخصصة عند حد فشل
 * IndexedDB — لا استثناء خام ولا ادعاء خادم ولا مسح تلقائي، مع بقاء بقية
 * الفشائل (قدم النسخة/خطأ مفتوح/عام) كما هي.
 *
 * ⚠️ مؤجل التشغيل بأمر المالك (أمر التنفيذ المتصل 2026-11-06 §6): يُكتب مع
 * التغيير ولا يُشغَّل إلا في التحقق الشامل بعد W05. */
import { describe, expect, it } from "vitest";
import { failure } from "./indexedDbLifecycle";

class QuotaError extends Error {
  constructor(name: string) {
    super("The operation failed for the quota exceeded");
    this.name = name;
  }
}

describe("UXR-06 — PERF-012: تشخيص نفاد الحصة عند حد فشل التخزين", () => {
  it("QuotaExceededError يُترجم إلى رسالة مخصصة صادقة بلا استثناء خام", () => {
    const result = failure(new QuotaError("QuotaExceededError"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("storage_error");
      expect(result.message).toContain("مساحة التخزين غير كافية لإتمام العملية");
      expect(result.message).toContain("لم يكتمل الحفظ");
      expect(result.message).toContain("لن تُمسّ بياناتك ولا مسوداتك تلقائيًا");
      /* لا dump خام ولا ادعاء خادم */
      expect(result.message).not.toContain("The operation failed");
      expect(result.message).not.toContain("Quota");
      expect(result.message).not.toContain("خادم");
    }
  });

  it("الاسم التاريخي QuotaExceeded يُترجم بالرسالة نفسها", () => {
    const result = failure(new QuotaError("QuotaExceeded"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("مساحة التخزين غير كافية لإتمام العملية");
  });

  it("بقية قنوات الفشل كما هي: قدم النسخة وسواها لم يتغير مسارها", () => {
    const versionError = new Error("VersionError message");
    versionError.name = "VersionError";
    const stale = failure(versionError);
    expect(stale.ok).toBe(false);
    if (!stale.ok) {
      expect(stale.code).toBe("storage_stale");
      expect(stale.message).toContain("أعد تحميل Micro");
    }
    const generic = failure(new Error("خطأ عابر"));
    expect(generic.ok).toBe(false);
    if (!generic.ok) {
      expect(generic.code).toBe("storage_error");
      expect(generic.message).toBe("خطأ عابر");
    }
  });
});
