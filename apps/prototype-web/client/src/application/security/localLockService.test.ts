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
});
