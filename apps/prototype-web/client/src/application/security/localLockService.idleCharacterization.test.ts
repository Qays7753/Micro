/**
 * R11 W1b-4 (التوصيف الأصلي) ← R11 Lock Remediation (الإصلاح الفاشل-المغلق —
 * OD-LOCK-ROLLBACK=A): مصفوفة حتمية لسلوك خمول القفل المحلي على مستوى
 * الخدمة — زمن أمامي، زمن خلفي، تعليق/استئناف (نمط الإخفاء/الظهور)، حدود
 * الانتهاء، إعادة التنشيط، القفل/الفتح المتكرر، والوقفة التصاعدية تحت الزمن
 * المعكوس.
 *
 * تحديث موجة الإصلاح (2026-10-15): النتائج القديمة المصنفة FAIL_OPEN
 * (R11-W1B4-NF-001/002) صارت FAIL_CLOSED بموجب قرار المالك — كل حالة تحمل
 * تصنيفها الصادق. التوصيف التاريخي الكامل محفوظ حرفيًا في دليل W1b-4؛
 * هذا الملف الآن يثبت العقد المنفذ لا السلوك المتقادم.
 *
 * الساعة محقونة قابلة للتقديم (نمط الاختبارات القائمة)؛ المخزن MemoryLocalStore
 * حقيقي؛ PBKDF2 الفعلي في مسار الفتح.
 */
import { describe, expect, it } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { LocalLockService } from "./localLockService";

const NOW = "2026-09-05T09:00:00.000Z";
const minutesFromNow = (minutes: number) => new Date(Date.parse(NOW) + minutes * 60_000).toISOString();
const secondsFromNow = (seconds: number) => new Date(Date.parse(NOW) + seconds * 1000).toISOString();

function makeService() {
  const store = new MemoryLocalStore();
  let currentMs = Date.parse(NOW);
  const service = new LocalLockService(store, () => new Date(currentMs).toISOString());
  return {
    store,
    service,
    advanceMinutes: (minutes: number) => {
      currentMs += minutes * 60_000;
    },
    rewindMinutes: (minutes: number) => {
      currentMs -= minutes * 60_000;
    },
    setClock: (iso: string) => {
      currentMs = Date.parse(iso);
    },
  };
}

describe("lock-idle — service level (R11 W1b-4 characterization → R11 Lock Remediation fail-closed)", () => {
  it("FORWARD: القفل يقع عند تجاوز العتبة وبعدها مباشرة؛ لا يقع قبلها — الحدّ شامل (>=)", async () => {
    const { service, advanceMinutes } = makeService();
    const enabled = await service.enable("4179", 10);
    if (!enabled.ok) throw new Error(enabled.message);
    advanceMinutes(9.99);
    const before = await service.shouldLockNow();
    if (!before.ok) throw new Error(before.message);
    expect(before.value).toBe(false);
    advanceMinutes(10); /* الحد بالضبط */
    const atThreshold = await service.shouldLockNow();
    if (!atThreshold.ok) throw new Error(atThreshold.message);
    expect(atThreshold.value).toBe(true);
    advanceMinutes(45);
    const after = await service.shouldLockNow();
    if (!after.ok) throw new Error(after.message);
    expect(after.value).toBe(true);
  });

  it("FORWARD (تصنيف): FAIL_CLOSED — الزمن الأمامي فوق العتبة يقفل دومًا", async () => {
    const { service, advanceMinutes } = makeService();
    await service.enable("4179", 1);
    advanceMinutes(90);
    const status = await service.shouldLockNow();
    if (!status.ok) throw new Error(status.message);
    expect(status.value).toBe(true);
  });

  it("BACKWARD (تصنيف): FAIL_CLOSED — تقديم الساعة قبل آخر نشاط يقفل فورًا (OD-LOCK-ROLLBACK=A / R11-W1B4-NF-001)", async () => {
    const { service, rewindMinutes } = makeService();
    await service.enable("4179", 1);
    rewindMinutes(120); /* الساعة الآن قبل آخر نشاط بساعتين */
    const status = await service.shouldLockNow();
    if (!status.ok) throw new Error(status.message);
    /* الإصلاح الفاشل-المغلق: الفارق السالب ترتيبٌ زمني غير قابل للتصديق —
     * يُقفل لا أن يبقى مفتوحًا إلى أجل غير مسمى. المحرِّر الذي يعيد الفارق
     * الموقّع السالب القديم (لا قفل) يفشل هنا بالضبط. */
    expect(status.value).toBe(true);
    rewindMinutes(10_000);
    const stillRolled = await service.shouldLockNow();
    if (!stillRolled.ok) throw new Error(stillRolled.message);
    expect(stillRolled.value).toBe(true);
  });

  it("SUSPEND/RESUME (نمط الإخفاء/الظهور): اللمس عند الإخفاء ثم الزمن الحقيقي فوق العتبة عند الظهور يقفل", async () => {
    const { service, advanceMinutes } = makeService();
    await service.enable("4179", 10);
    /* الإخفاء: touchActivity (نمط AppLockGate عند visibilitychange=hidden). */
    await service.touchActivity();
    advanceMinutes(35); /* «تعليق» حقيقي: الساعة تقدمت أثناء الإخفاء. */
    const onShow = await service.shouldLockNow();
    if (!onShow.ok) throw new Error(onShow.message);
    expect(onShow.value).toBe(true);
  });

  it("SUSPEND/RESUME قصير: إخفاء ثم ظهور دون بلوغ العتبة يبقى مفتوحًا", async () => {
    const { service, advanceMinutes } = makeService();
    await service.enable("4179", 10);
    await service.touchActivity();
    advanceMinutes(4);
    const onShow = await service.shouldLockNow();
    if (!onShow.ok) throw new Error(onShow.message);
    expect(onShow.value).toBe(false);
  });

  it("REACTIVATION: الفتح الناجح يصفّر العدّاد ويحدّث آخر نشاط الآن — لا قفلًا فوريًا بعد الفتح", async () => {
    const { service, advanceMinutes } = makeService();
    await service.enable("4179", 5);
    advanceMinutes(8); /* فوق العتبة: مقفل */
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const wrong = await service.unlock("0000");
      if (!wrong.ok) throw new Error(wrong.message);
      expect(wrong.value.unlocked).toBe(false);
    }
    const right = await service.unlock("4179");
    if (!right.ok) throw new Error(right.message);
    expect(right.value.unlocked).toBe(true);
    expect(right.value.failedAttempts).toBe(0);
    /* آخر نشاط = لحظة الفتح؛ الفحص الفوري لا يقفل. */
    const immediate = await service.shouldLockNow();
    if (!immediate.ok) throw new Error(immediate.message);
    expect(immediate.value).toBe(false);
    /* وبعد عتبة كاملة جديدة يقفل مجددًا — الدورة قابلة للتكرار. */
    advanceMinutes(5);
    const again = await service.shouldLockNow();
    if (!again.ok) throw new Error(again.message);
    expect(again.value).toBe(true);
  });

  it("REPEATED CYCLES: قفل→فتح→خمول→قفل مرتين متتاليتين حتميتان", async () => {
    const { service, advanceMinutes } = makeService();
    await service.enable("4179", 1);
    for (let cycle = 0; cycle < 2; cycle += 1) {
      advanceMinutes(2);
      const locked = await service.shouldLockNow();
      if (!locked.ok) throw new Error(locked.message);
      expect(locked.value).toBe(true);
      const unlocked = await service.unlock("4179");
      if (!unlocked.ok) throw new Error(unlocked.message);
      expect(unlocked.value.unlocked).toBe(true);
    }
  });

  it("UNKNOWN ACTIVITY (تصنيف): FAIL_CLOSED — lastActiveAt غائب يقفل فورًا", async () => {
    const { service, store } = makeService();
    const enabled = await service.enable("4179", 10);
    if (!enabled.ok) throw new Error(enabled.message);
    /* سجل بلا آخر نشاط: يُحقن مباشرة في المخزن (حالة قديمة/تالفة). */
    await store.saveLocalSecurity({ ...enabled.value, lastActiveAt: null });
    const status = await service.shouldLockNow();
    if (!status.ok) throw new Error(status.message);
    expect(status.value).toBe(true);
  });

  it("NO-IDLE OPTION (تصنيف): AS_DESIGNED — autoLockMinutes=null لا يقفل بالخمول أبدًا", async () => {
    const { service, advanceMinutes } = makeService();
    await service.enable("4179", null);
    advanceMinutes(10_000);
    const status = await service.shouldLockNow();
    if (!status.ok) throw new Error(status.message);
    expect(status.value).toBe(false);
  });

  it("BACKOFF BOUNDARY: داخل النافذة رفض مبكر بلا زيادة عدّاد؛ عند حافتها وبعدها العدّاد يكمل", async () => {
    const { service, setClock } = makeService();
    await service.enable("4179", 10);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const wrong = await service.unlock("0000");
      if (!wrong.ok) throw new Error(wrong.message);
      expect(wrong.value.failedAttempts).toBe(attempt + 1);
    }
    /* الآن 3 محاولات فاشلة والوقفة ٣ ثوانٍ من آخر فشل (الآن = NOW). */
    setClock(secondsFromNow(1));
    const inside = await service.unlock("0000");
    if (!inside.ok) throw new Error(inside.message);
    expect(inside.value.unlocked).toBe(false);
    expect(inside.value.failedAttempts).toBe(3); /* لا زيادة داخل النافذة */
    expect(inside.value.retryInMs).toBeGreaterThan(0);
    setClock(secondsFromNow(3)); /* حافة النافذة بالضبط */
    const atEdge = await service.unlock("0000");
    if (!atEdge.ok) throw new Error(atEdge.message);
    expect(atEdge.value.failedAttempts).toBe(4); /* العدّاد يكمل عند الحافة */
  });

  it("BACKOFF UNDER BACKWARD CLOCK (تصنيف): FAIL_CLOSED — الساعة الخلفية تُرفض مبكرًا بكامل الوقفة بلا زيادة عدّاد ولا كتابة (OD-LOCK-ROLLBACK=A / R11-W1B4-NF-002)", async () => {
    const { service, store, rewindMinutes } = makeService();
    await service.enable("4179", 10);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const wrong = await service.unlock("0000");
      if (!wrong.ok) throw new Error(wrong.message);
      expect(wrong.value.failedAttempts).toBe(attempt + 1);
    }
    const beforeRollback = await store.getLocalSecurity();
    if (!beforeRollback.ok) throw new Error(beforeRollback.message);
    rewindMinutes(5); /* الساعة قبل آخر فشل: الفارق سالب */
    const attempt = await service.unlock("0000");
    if (!attempt.ok) throw new Error(attempt.message);
    /* الإصلاح الفاشل-المغلق: الترتيب الزمني غير القابل للتصديق يُعامل داخل
     * نافذة الوقفة بكاملها — رفض مبكر، لا تخمين منفّذ، لا زيادة عدّاد،
     * ولا إعادة إرساء lastFailedAt إلى الوراء (السجل يبقى كما هو بالضبط).
     * المحرِّر الذي يعيد شرط elapsed >= 0 القديم يفشل هنا بالضبط. */
    expect(attempt.value.unlocked).toBe(false);
    expect(attempt.value.failedAttempts).toBe(3);
    expect(attempt.value.retryInMs).toBeGreaterThan(0);
    const afterRollback = await store.getLocalSecurity();
    if (!afterRollback.ok) throw new Error(afterRollback.message);
    expect(afterRollback.value?.failedAttempts).toBe(3);
    expect(afterRollback.value?.lastFailedAt).toBe(beforeRollback.value?.lastFailedAt);
    /* محاولات متكررة تحت الساعة المقدّرة كلها تُرفض بالمثل — لا تسارع تخمين. */
    const again = await service.unlock("0000");
    if (!again.ok) throw new Error(again.message);
    expect(again.value.failedAttempts).toBe(3);
  });

  it("BACKWARD CLOCK + CORRECT PIN: الرمز الصحيح تحت الساعة المقدّرة يُرفض داخل الوقفة (لا حماية أضعف) ثم يعمل بعد استعادة الزمن", async () => {
    const { service, setClock } = makeService();
    await service.enable("4179", 10);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await service.unlock("0000");
    }
    setClock(minutesFromNow(-30)); /* الساعة قبل آخر فشل بثلاثين دقيقة */
    const blocked = await service.unlock("4179");
    if (!blocked.ok) throw new Error(blocked.message);
    /* الوقفة لا تُستبق بالساعة حتى للرمز الصحيح — حماية لا تضعف أبدًا. */
    expect(blocked.value.unlocked).toBe(false);
    expect(blocked.value.failedAttempts).toBe(3);
    expect(blocked.value.retryInMs).toBeGreaterThan(0);
    /* استعادة الزمن (تصحيح الساعة) ثم انقضاء النافذة: الصحيح يفتح ويصفّر. */
    setClock(secondsFromNow(10));
    const recovered = await service.unlock("4179");
    if (!recovered.ok) throw new Error(recovered.message);
    expect(recovered.value.unlocked).toBe(true);
    expect(recovered.value.failedAttempts).toBe(0);
  });

  it("MALFORMED lastActiveAt (تصنيف): FAIL_CLOSED — طابع نشاط تالف يقفل (زمن غير قابل للتحليل لا يفتح)", async () => {
    const { service, store } = makeService();
    const enabled = await service.enable("4179", 10);
    if (!enabled.ok) throw new Error(enabled.message);
    await store.saveLocalSecurity({ ...enabled.value, lastActiveAt: "not-a-timestamp" });
    const status = await service.shouldLockNow();
    if (!status.ok) throw new Error(status.message);
    expect(status.value).toBe(true);
  });

  it("MALFORMED lastFailedAt (تصنيف): FAIL_CLOSED — طابع فشل تالف داخل عدّاد وقفة يُرفض مبكرًا بكامل الوقفة", async () => {
    const { service, store } = makeService();
    const enabled = await service.enable("4179", 10);
    if (!enabled.ok) throw new Error(enabled.message);
    /* سجل بثلاث محاولات فاشلة وطابع فشل غير قابل للتحليل (تلف تخزين). */
    await store.saveLocalSecurity({ ...enabled.value, failedAttempts: 3, lastFailedAt: "garbage" });
    const attempt = await service.unlock("0000");
    if (!attempt.ok) throw new Error(attempt.message);
    expect(attempt.value.unlocked).toBe(false);
    expect(attempt.value.failedAttempts).toBe(3);
    expect(attempt.value.retryInMs).toBe(delayForAttemptsProbe(3));
    /* ومسار التعطيل بالمثل — لا مسار أضعف. */
    const disableAttempt = await service.disable("0000");
    expect(disableAttempt.ok).toBe(false);
    if (!disableAttempt.ok) expect(disableAttempt.message).toContain("انتظر");
  });

  it("DISABLE UNDER BACKWARD CLOCK: مسار التعطيل يخضع للرفض المبكر نفسه دون زيادة أو كتابة", async () => {
    const { service, store, rewindMinutes } = makeService();
    await service.enable("4179", null);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await service.disable("1111");
    }
    const before = await store.getLocalSecurity();
    if (!before.ok) throw new Error(before.message);
    rewindMinutes(15);
    const throttled = await service.disable("1111");
    expect(throttled.ok).toBe(false);
    if (!throttled.ok) expect(throttled.message).toContain("انتظر");
    const after = await store.getLocalSecurity();
    if (!after.ok) throw new Error(after.message);
    expect(after.value?.failedAttempts).toBe(3);
    expect(after.value?.lastFailedAt).toBe(before.value?.lastFailedAt);
  });

  it("STORAGE FAILURE: الخدمة صادقة (storage_error) والقرار على المستدعي — والبوابة الآن تفشل مغلقًا (OD-LOCK-STORAGE=A)", async () => {
    const { service } = makeService();
    await service.enable("4179", 10);
    /* فشل قراءة مقحم بوسيط تالف: نستبدل المخزن بواجهة تفشل. */
    const failing = new LocalLockService(
      {
        getLocalSecurity: async () => ({ ok: false, message: "boom" }),
        saveLocalSecurity: async () => ({ ok: false, message: "boom" }),
        deleteLocalSecurity: async () => ({ ok: false, message: "boom" }),
      } as never,
      () => NOW,
    );
    const status = await failing.shouldLockNow();
    expect(status.ok).toBe(false);
    if (!status.ok) expect(status.code).toBe("storage_error");
    /* الخدمة لا تفتح: تُعيد الخطأ بصدق. البوابة (AppLockGate) بعد الإصلاح
     * تفشل مغلقًا عند !ok (R11-W1B4-NF-003 مُصلَح) — تغطيها مصفوفة البوابة. */
  });

  it("PIN VERIFICATION نتيجة الفتح الصحيح لا تتأثر بموضع الساعة (تحقق خالص بلا زمن)", async () => {
    const { service, rewindMinutes } = makeService();
    await service.enable("4179", 10);
    rewindMinutes(60);
    const right = await service.unlock("4179");
    if (!right.ok) throw new Error(right.message);
    expect(right.value.unlocked).toBe(true);
    expect(right.value.failedAttempts).toBe(0);
  });
});

/** وقفة تصاعدية متوقعة لعدّاد المحاولات — مطابقة delayForAttempts الخاصة
 * بالإنتاج (٣/١٠/٣٠ ثانية بعد ٣/٥/٨ محاولات) لأغراض التوكيد فقط. */
function delayForAttemptsProbe(failedAttempts: number): number {
  if (failedAttempts >= 8) return 30_000;
  if (failedAttempts >= 5) return 10_000;
  if (failedAttempts >= 3) return 3_000;
  return 0;
}
