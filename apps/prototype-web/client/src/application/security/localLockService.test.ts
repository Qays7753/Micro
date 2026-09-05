/** المجموعة ٥ (عقد ٣٧ — اختبار القفل المحلي): بصمة لا رمز، فتح صحيح/خاطئ
 * بعدّاد، خمول بزمن حقيقي محقون، تعطيل بالرمز — والسجل خارج اللقطة. */
import { describe, expect, it } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { LocalLockService } from "./localLockService";

const NOW = "2026-09-05T09:00:00.000Z";
const minutesLater = (minutes: number) => new Date(Date.parse(NOW) + minutes * 60_000).toISOString();

describe("local lock service (المجموعة ٥ — عقد ٣٧)", () => {
  it("enables with a hash + salt, never the pin itself; unlock verifies and resets failures", async () => {
    const store = new MemoryLocalStore();
    const lock = new LocalLockService(store, () => NOW);
    const enabled = await lock.enable("4179", 10);
    if (!enabled.ok) throw new Error(enabled.message);
    expect(enabled.value.pinHash).not.toContain("4179");
    expect(enabled.value.pinHash).toMatch(/^[0-9a-f]{64}$/);
    expect(enabled.value.salt).toMatch(/^[0-9a-f]{32}$/);
    const wrong = await lock.unlock("0000");
    if (!wrong.ok) throw new Error(wrong.message);
    expect(wrong.value.unlocked).toBe(false);
    expect(wrong.value.failedAttempts).toBe(1);
    const right = await lock.unlock("4179");
    if (!right.ok) throw new Error(right.message);
    expect(right.value.unlocked).toBe(true);
    expect(right.value.failedAttempts).toBe(0);
  });

  it("rejects invalid pins and unsupported idle options up front", async () => {
    const store = new MemoryLocalStore();
    const lock = new LocalLockService(store, () => NOW);
    const shortPin = await lock.enable("123", 10);
    expect(shortPin.ok).toBe(false);
    if (!shortPin.ok) expect(shortPin.code).toBe("validation_error");
    const letters = await lock.enable("abcd", 10);
    expect(letters.ok).toBe(false);
    const badIdle = await lock.enable("4179", 7);
    expect(badIdle.ok).toBe(false);
  });

  it("locks after the idle threshold and stays open before it", async () => {
    const store = new MemoryLocalStore();
    let clock = NOW;
    const lock = new LocalLockService(store, () => clock);
    await lock.enable("4179", 10);
    clock = minutesLater(5);
    const early = await lock.shouldLockNow();
    if (!early.ok) throw new Error(early.message);
    expect(early.value).toBe(false);
    clock = minutesLater(11);
    const late = await lock.shouldLockNow();
    if (!late.ok) throw new Error(late.message);
    expect(late.value).toBe(true);
    /* النشاط يؤخر القفل من جديد. */
    await lock.touchActivity();
    clock = minutesLater(15);
    const afterTouch = await lock.shouldLockNow();
    if (!afterTouch.ok) throw new Error(afterTouch.message);
    expect(afterTouch.value).toBe(false);
  });

  it("disable requires the correct pin; wrong pin is refused", async () => {
    const store = new MemoryLocalStore();
    const lock = new LocalLockService(store, () => NOW);
    await lock.enable("4179", null);
    const wrong = await lock.disable("1111");
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.code).toBe("wrong_pin");
    const right = await lock.disable("4179");
    expect(right.ok).toBe(true);
    const status = await lock.status();
    if (!status.ok) throw new Error(status.message);
    expect(status.value.enabled).toBe(false);
  });

  it("the lock record never enters the export snapshot — secrets stay local", async () => {
    const store = new MemoryLocalStore();
    const lock = new LocalLockService(store, () => NOW);
    const enabled = await lock.enable("4179", 10);
    if (!enabled.ok) throw new Error(enabled.message);
    const snapshot = await store.readSnapshot();
    if (!snapshot.ok) throw new Error(snapshot.message);
    expect(JSON.stringify(snapshot.value)).not.toContain(enabled.value.pinHash);
    expect(JSON.stringify(snapshot.value)).not.toContain(enabled.value.salt);
  });

  /* المجموعة ٦ (تدقيق A1 — SP-02): التفعيل الجديد يخزن بصمة PBKDF2، والسجل
   * القديم (sha256 مفردة) يُفتح بمساره ثم يُرقّى تلقائيًا — لا قفل خارج صاحب الرمز. */
  it("enables with a slow-derived hash (PBKDF2) and unlocks with the same pin", async () => {
    const store = new MemoryLocalStore();
    const lock = new LocalLockService(store, () => NOW);
    const enabled = await lock.enable("4179", 10);
    if (!enabled.ok) throw new Error(enabled.message);
    expect(enabled.value.hashAlgo).toBe("pbkdf2");
    const right = await lock.unlock("4179");
    if (!right.ok) throw new Error(right.message);
    expect(right.value.unlocked).toBe(true);
    const wrong = await lock.unlock("4180");
    if (!wrong.ok) throw new Error(wrong.message);
    expect(wrong.value.unlocked).toBe(false);
  });

  it("legacy single-hash records still unlock and are upgraded transparently", async () => {
    const store = new MemoryLocalStore();
    const lock = new LocalLockService(store, () => NOW);
    /* سجل قديم بالبصمة المفردة كما كان يُخزن قبل المجموعة ٦. */
    const legacyHash = await sha256HexForTest("aabbccddeeff00112233445566778899:4179");
    await store.saveLocalSecurity({
      id: "local-security" as const,
      pinHash: legacyHash,
      salt: "aabbccddeeff00112233445566778899",
      autoLockMinutes: 10,
      lastActiveAt: NOW,
      failedAttempts: 0,
      createdAt: NOW,
      updatedAt: NOW,
    });
    const wrong = await lock.unlock("0000");
    if (!wrong.ok) throw new Error(wrong.message);
    expect(wrong.value.unlocked).toBe(false);
    const right = await lock.unlock("4179");
    if (!right.ok) throw new Error(right.message);
    expect(right.value.unlocked).toBe(true);
    const saved = await store.getLocalSecurity();
    if (!saved.ok) throw new Error(saved.message);
    expect(saved.value?.hashAlgo).toBe("pbkdf2");
    expect(saved.value?.pinHash).not.toBe(legacyHash);
    /* بعد الترقية يبقى الرمز نفسه صالحًا والمسار الجديد هو المستخدم. */
    const again = await lock.unlock("4179");
    if (!again.ok) throw new Error(again.message);
    expect(again.value.unlocked).toBe(true);
  });

  /* المجموعة ٦ (تدقيق A1 — SP-04): الوقفة مُنفَّذة — المحاولة داخل النافذة
   * تُرفض مبكرًا بلا زيادة العدّاد. */
  it("enforces wrong-pin backoff inside the window without inflating the counter", async () => {
    const store = new MemoryLocalStore();
    let clock = NOW;
    const lock = new LocalLockService(store, () => clock);
    await lock.enable("4179", 10);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await lock.unlock("0000");
      if (!result.ok) throw new Error(result.message);
      expect(result.value.unlocked).toBe(false);
    }
    clock = minutesLater(0.01); /* ~٦ ثوانٍ بعد المحاولة الثالثة (الوقفة ٣ ثوان). */
    const insideWindow = await lock.unlock("0000");
    if (!insideWindow.ok) throw new Error(insideWindow.message);
    expect(insideWindow.value.unlocked).toBe(false);
    expect(insideWindow.value.failedAttempts).toBe(3);
    expect(insideWindow.value.retryInMs).toBeGreaterThan(0);
    clock = minutesLater(1); /* بعد النافذة: العدّاد يكمل عمله. */
    const outsideWindow = await lock.unlock("0000");
    if (!outsideWindow.ok) throw new Error(outsideWindow.message);
    expect(outsideWindow.value.unlocked).toBe(false);
    expect(outsideWindow.value.failedAttempts).toBe(4);
  });

  it("disable path counts wrong attempts and applies the same backoff", async () => {
    const store = new MemoryLocalStore();
    let clock = NOW;
    const lock = new LocalLockService(store, () => clock);
    await lock.enable("4179", null);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await lock.disable("1111");
      expect(result.ok).toBe(false);
    }
    clock = minutesLater(0.01);
    const throttled = await lock.disable("1111");
    expect(throttled.ok).toBe(false);
    if (!throttled.ok) expect(throttled.message).toContain("انتظر");
    clock = minutesLater(1);
    const right = await lock.disable("4179");
    expect(right.ok).toBe(true);
  });
});

/** بصمة مفردة بنفس بناء المسار القديم — لأغراض اختبار الترقية فقط. */
async function sha256HexForTest(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}
