/**
 * R11 W1b-4 / D-12 (OD-TIME — lock-idle characterization only):
 * مصفوفة توصيف حتمية لسلوك خمول القفل المحلي على مستوى الخدمة —
 * زمن أمامي، زمن خلفي، تعليق/استئناف (نمط الإخفاء/الظهور)، حدود الانتهاء،
 * إعادة التنشيط، القفل/الفتح المتكرر، والوقفة التصاعدية تحت الزمن المعكوس.
 *
 * ⚠️ توصيف لا إصلاح: هذه الشريحة تسجل السلوك القائم كما هو (قرار المالك:
 * أي نتيجة fail-open تُسجَّل finding جديدًا وقرار مالك — لا ترقيع خفي).
 * كل حالة تحمل تصنيفها الصادق: FAIL_CLOSED / FAIL_OPEN / AS_DESIGNED.
 *
 * الساعة محقونة قابلة للتقديم (نمط الاختبارات القائمة)؛ المخزن MemoryLocalStore
 * حقيقي؛ لا أي كتابة إنتاجية.
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

describe("lock-idle characterization — service level (R11 W1b-4; توصيف لا إصلاح)", () => {
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

  it("BACKWARD (تصنيف): FAIL_OPEN — تقديم الساعة قبل آخر نشاط يمنع القفل إلى أجل غير مسمى", async () => {
    const { service, rewindMinutes } = makeService();
    await service.enable("4179", 1);
    rewindMinutes(120); /* الساعة الآن قبل آخر نشاط بساعتين */
    const status = await service.shouldLockNow();
    if (!status.ok) throw new Error(status.message);
    /* السلوك القائم: الفارق سالب فلا يبلغ العتبة أبدًا — القفل لا يقع.
     * توصيف صادق: نافذة مفتوحة تحت تحكم ساعة الجهاز؛ finding مسجل في
     * التقرير (R11-W1B4-NF-001) لا ترقيع داخل W1b. */
    expect(status.value).toBe(false);
    rewindMinutes(10_000);
    const stillOpen = await service.shouldLockNow();
    if (!stillOpen.ok) throw new Error(stillOpen.message);
    expect(stillOpen.value).toBe(false);
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

  it("BACKOFF UNDER BACKWARD CLOCK (تصنيف): FAIL_OPEN(محدود) — الساعة الخلفية تتجاوز الوقفة المبكرة وتكمل التحقق", async () => {
    const { service, rewindMinutes } = makeService();
    await service.enable("4179", 10);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const wrong = await service.unlock("0000");
      if (!wrong.ok) throw new Error(wrong.message);
      expect(wrong.value.failedAttempts).toBe(attempt + 1);
    }
    rewindMinutes(5); /* الساعة قبل آخر فشل: الفارق سالب */
    const attempt = await service.unlock("0000");
    if (!attempt.ok) throw new Error(attempt.message);
    /* السلوك القائم: شرط النافذة (elapsed >= 0) لا يتحقق فلا رفض مبكر —
     * التحقق يجري والعدّاد يزيد. توصيف صادق: تقديم الساعة يستبق الوقفة
     * (مسرّع تخمين) لكن كل محاولة تبقى مكلفة (PBKDF2 ١٢٠ ألف دورة) والعدّاد
     * يظل صادقًا؛ finding مسجل (R11-W1B4-NF-002) لا ترقيع داخل W1b. */
    expect(attempt.value.unlocked).toBe(false);
    expect(attempt.value.failedAttempts).toBe(4);
  });

  it("STORAGE FAILURE (تصنيف): FAIL_OPEN عند البوابة — الخدمة صادقة (storage_error) والقرار على المستدعي", async () => {
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
    /* الخدمة لا تفتح: تُعيد الخطأ؛ البوابة (AppLockGate) تفتح عند !ok —
     * يُوثَّق في مصفوفة البوابة أدناه (R11-W1B4-NF-003). */
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
