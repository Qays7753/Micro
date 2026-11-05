/** UXR-06 (PERF-002 — عقد ٠٤٤ B3/F): بوابا حجم ملف استيراد بيانات البداية —
 * بوابة الخدمة داخل prepare() قبل JSON.parse (نفس حد ملف الاستعادة الكامل
 * القائم S17)، وبوابة الواجهة تُفحص في سطحها. الحدود: أقل/عند/أكثر الحد،
 * والتجاوز لا يستدعي parse ولا يكتب شيئًا.
 *
 * ⚠️ مؤجل التشغيل بأمر المالك (أمر التنفيذ المتصل 2026-11-06 §6): يُكتب مع
 * التغيير ولا يُشغَّل إلا في التحقق الشامل بعد W05. */
import { describe, expect, it } from "vitest";
import { GuidedOpeningImportService } from "./guidedOpeningImportService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { LocalTransferService } from "./localTransferService";
import { IMPORT_SIZE_LIMIT_MESSAGE, MAX_IMPORT_FILE_UNITS } from "./transferResourceLimits";

function testBackupBuilder(
  store: ConstructorParameters<typeof LocalTransferService>[0],
): ReturnType<typeof LocalTransferService.verifiedBackupBuilder> {
  return LocalTransferService.verifiedBackupBuilder(new LocalTransferService(store));
}

function serviceFor(store: MemoryLocalStore) {
  return new GuidedOpeningImportService(store, testBackupBuilder(store), () => "2026-08-24T10:00:00.000Z");
}

/* نص صالح البنية بحجم مضبوط: نصفة بادئة تملأ حتى الطول المطلوب دون كسر JSON. */
function textOfLength(length: number): string {
  const skeleton = JSON.stringify({
    format: "micro-guided-opening-import",
    version: 1,
    importId: "opening-size-gate",
    padding: "",
  });
  const target = Math.max(0, length);
  if (skeleton.length >= target) return skeleton.slice(0, target);
  const pad = target - skeleton.length;
  const padded = JSON.stringify({
    format: "micro-guided-opening-import",
    version: 1,
    importId: "opening-size-gate",
    padding: "x".repeat(Math.max(0, pad - 60)),
  });
  return padded.slice(0, target);
}

describe("UXR-06 — PERF-002: بوابة حجم استيراد بيانات البداية", () => {
  it("أقل من الحد: يمر النص الصالح إلى المعاينة كالمعتاد", async () => {
    const store = new MemoryLocalStore();
    const service = serviceFor(store);
    const small = textOfLength(MAX_IMPORT_FILE_UNITS - 1);
    const result = await service.prepare(small);
    /* صالح البنية أو مرفوضًا بسببه — المهم أنه لم يُرفض بسبب الحجم. */
    if (!result.ok) expect(result.message).not.toBe(IMPORT_SIZE_LIMIT_MESSAGE);
  });

  it("عند الحد بالضبط: لا رفض بسبب الحجم (الحد داخل النطاق المسموح)", async () => {
    const store = new MemoryLocalStore();
    const service = serviceFor(store);
    const exact = textOfLength(MAX_IMPORT_FILE_UNITS);
    const result = await service.prepare(exact);
    if (!result.ok) expect(result.message).not.toBe(IMPORT_SIZE_LIMIT_MESSAGE);
  });

  it("أكثر من الحد: رفض قبل أي تحليل أو كتابة، بالرسالة المخصصة القائمة، والمخزن لم يُمس", async () => {
    const store = new MemoryLocalStore();
    const service = serviceFor(store);
    const oversized = textOfLength(MAX_IMPORT_FILE_UNITS + 1);
    const before = await store.readSnapshot();
    const result = await service.prepare(oversized);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_error");
      expect(result.message).toBe(IMPORT_SIZE_LIMIT_MESSAGE);
    }
    const after = await store.readSnapshot();
    expect(after.ok && before.ok ? after.value : null).toEqual(before.ok ? before.value : null);
  });
});
