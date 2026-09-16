import { afterEach, describe, expect, it } from "vitest";
import { PreferenceService, readBrowserPersistence } from "./preferenceService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");

function setStorage(storage: unknown) {
  Object.defineProperty(globalThis, "navigator", {
    value: storage === undefined ? {} : { storage },
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  if (original) Object.defineProperty(globalThis, "navigator", original);
  else Reflect.deleteProperty(globalThis as object, "navigator");
});

describe("PreferenceService", () => {
  it("defaults to system and persists a local theme through the store", async () => {
    const service = new PreferenceService(new MemoryLocalStore(), () => "2026-08-22T00:00:00.000Z");
    await expect(service.load()).resolves.toEqual({ ok: true, preference: "system" });
    await expect(service.save("dark")).resolves.toEqual({ ok: true, preference: "dark" });
    await expect(service.load()).resolves.toEqual({ ok: true, preference: "dark" });
  });

  it("reads browser persistence behind the application boundary with its honest copy", async () => {
    const service = new PreferenceService(new MemoryLocalStore(), () => "2026-08-22T00:00:00.000Z");
    setStorage(undefined);
    await expect(service.readBrowserPersistence()).resolves.toEqual({
      state: "unsupported",
      title: "التخزين الدائم غير مدعوم في هذا المتصفح",
      text: expect.any(String),
    });
    setStorage({ persisted: async () => true, persist: async () => true });
    await expect(readBrowserPersistence()).resolves.toMatchObject({
      state: "persisted",
      title: "التخزين الدائم مفعّل",
    });
  });

  it("persists the install-banner dismissal across other preference writes", async () => {
    let stamp = 0;
    const service = new PreferenceService(new MemoryLocalStore(), () => `2026-08-2${stamp++}T09:00:00.000Z`);
    await expect(service.readInstallBannerDismissal()).resolves.toEqual({ ok: true, dismissedAt: null });
    await expect(service.saveInstallBannerDismissal()).resolves.toEqual({
      ok: true,
      dismissedAt: "2026-08-20T09:00:00.000Z",
    });
    await expect(service.save("dark")).resolves.toEqual({ ok: true, preference: "dark" });
    await expect(service.readInstallBannerDismissal()).resolves.toEqual({
      ok: true,
      dismissedAt: "2026-08-20T09:00:00.000Z",
    });
  });

  /* إصلاح المتابعة (SET-003): كل كاتب تفضيلات غير مرتبط يجب أن ينقل
   * disabledCapabilities كما هو — كتابة السجل كاملًا أسقطت الحقل في ثلاثة
   * كتّاب فأعادت تفعيل كل القدرات بصمت. */
  it("keeps disabledCapabilities intact across every unrelated preference writer", async () => {
    let stamp = 0;
    const store = new MemoryLocalStore();
    const service = new PreferenceService(store, () => `2026-09-16T0${stamp++}:00:00.000Z`);
    const disabled = await service.saveDisabledCapabilities(["orders", "inventory"]);
    if (!disabled.ok) throw new Error(disabled.message);

    await expect(service.save("dark")).resolves.toEqual({ ok: true, preference: "dark" });
    await expect(service.readDisabledCapabilities()).resolves.toEqual({
      ok: true,
      disabled: ["orders", "inventory"],
    });

    await expect(service.markVerifiedExport()).resolves.toMatchObject({ ok: true });
    await expect(service.readDisabledCapabilities()).resolves.toEqual({
      ok: true,
      disabled: ["orders", "inventory"],
    });

    await expect(service.saveBackupReminderEnabled(false)).resolves.toEqual({ ok: true, enabled: false });
    await expect(service.readDisabledCapabilities()).resolves.toEqual({
      ok: true,
      disabled: ["orders", "inventory"],
    });

    await expect(service.saveInstallBannerDismissal()).resolves.toMatchObject({ ok: true });
    await expect(service.readDisabledCapabilities()).resolves.toEqual({
      ok: true,
      disabled: ["orders", "inventory"],
    });

    /* لا يفقد الكاتبُ غيرَ المرتبط حقولًا أخرى أيضًا. */
    const saved = await store.getPreferences();
    if (!saved.ok || !saved.value) throw new Error("preferences should exist");
    expect(saved.value.theme).toBe("dark");
    expect(saved.value.backupReminderEnabled).toBe(false);
    expect(saved.value.installBannerDismissedAt).toBeTruthy();
    expect(saved.value.lastVerifiedExportAt).toBeTruthy();
  });

  it("a legacy preferences record without the capabilities field reads as all capabilities enabled", async () => {
    const store = new MemoryLocalStore();
    /* سجل قديم قبل حزمة SET-003 — لا حقل disabledCapabilities إطلاقًا. */
    const legacy = await store.savePreferences({
      id: "local-preferences",
      theme: "light",
      dailyScheduleCapacityMinutes: null,
      workMode: null,
      actualTimeTrackingEnabled: false,
      installBannerDismissedAt: null,
      updatedAt: "2026-09-01T00:00:00.000Z",
    });
    if (!legacy.ok) throw new Error(legacy.message);
    const service = new PreferenceService(store, () => "2026-09-16T09:00:00.000Z");
    await expect(service.readDisabledCapabilities()).resolves.toEqual({ ok: true, disabled: [] });
    /* وأول حفظ بعده يرسّخ الحقل بلا مساس ببقية السجل. */
    await expect(service.save("system")).resolves.toMatchObject({ ok: true });
    const after = await store.getPreferences();
    if (!after.ok || !after.value) throw new Error("preferences should exist");
    expect(after.value.disabledCapabilities).toEqual([]);
    expect(after.value.theme).toBe("system");
  });

  /* حارس العقد: أي دالة عامة جديدة على PreferenceService تُلزم هذا الاختبار
   * بالتحديث — فلا يعود مضاعف اختباري ناقص إلى الرفض غير المعالج الصامت
   * (عطل CI: preferences.readDisabledCapabilities is not a function). */
  it("exposes exactly the public contract Settings surfaces rely on", () => {
    const publicMethods = Object.getOwnPropertyNames(PreferenceService.prototype)
      .filter(name => name !== "constructor")
      .sort();
    expect(publicMethods).toEqual([
      "load",
      "markVerifiedExport",
      "readBackupReminderEnabled",
      "readBrowserPersistence",
      "readDisabledCapabilities",
      "readInstallBannerDismissal",
      "readLastVerifiedExport",
      "save",
      "saveBackupReminderEnabled",
      "saveDisabledCapabilities",
      "saveInstallBannerDismissal",
    ]);
    for (const name of publicMethods) {
      expect(typeof (PreferenceService.prototype as Record<string, unknown>)[name]).toBe("function");
    }
  });
});
