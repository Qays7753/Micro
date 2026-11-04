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
    /* S03 (UNIT-038 P3.2): توسيع سطح مقصود بنفس الـPR — قارئ/كاتب تفضيل
     * العرض من المصدر الواحد (سؤال البداية 001 ومحرر الإعدادات 038). */
    expect(publicMethods).toEqual([
      "load",
      "markVerifiedExport",
      "readBackupReminderEnabled",
      "readBrowserPersistence",
      "readDisabledCapabilities",
      "readInstallBannerDismissal",
      "readLastVerifiedExport",
      "readLowStockThresholds",
      "readOfferingPreference",
      "save",
      "saveBackupReminderEnabled",
      "saveDisabledCapabilities",
      "saveInstallBannerDismissal",
      "saveLowStockThreshold",
      "saveOfferingPreference",
    ]);
    for (const name of publicMethods) {
      expect(typeof (PreferenceService.prototype as unknown as Record<string, unknown>)[name]).toBe(
        "function",
      );
    }
  });
});

/* S03 (UNIT-038 P3.2 + UNIT-001 P3.2 — عقد §5.1/§15.1): تفضيل ما يقدمه
 * المشروع — اختياري محايد مستقل عن workMode؛ قراءة/حفظ من المصدر الواحد
 * عبر بوابة الدمج فلا يسقط أي حقل آخر، والغياب محايد لا يفترض منتجات. */
describe("PreferenceService.offeringPreference — single-source optional neutral preference (S03)", () => {
  it("reads neutral (null) on a fresh device and after an unrelated writer — never assumes products", async () => {
    const service = new PreferenceService(new MemoryLocalStore(), () => "2026-10-28T00:00:00.000Z");
    await expect(service.readOfferingPreference()).resolves.toEqual({ ok: true, offering: null });
    await expect(service.save("dark")).resolves.toMatchObject({ ok: true });
    await expect(service.readOfferingPreference()).resolves.toEqual({ ok: true, offering: null });
  });

  it("saves each canonical value and reads it back — products, services, both, and back to neutral", async () => {
    let stamp = 0;
    const service = new PreferenceService(new MemoryLocalStore(), () => `2026-10-28T0${stamp++}:00:00.000Z`);
    for (const value of ["products", "services", "both"] as const) {
      await expect(service.saveOfferingPreference(value)).resolves.toEqual({ ok: true, offering: value });
      await expect(service.readOfferingPreference()).resolves.toEqual({ ok: true, offering: value });
    }
    await expect(service.saveOfferingPreference(null)).resolves.toEqual({ ok: true, offering: null });
    await expect(service.readOfferingPreference()).resolves.toEqual({ ok: true, offering: null });
  });

  it("an offering write preserves every unrelated preference field (merge, not replace)", async () => {
    let stamp = 0;
    const store = new MemoryLocalStore();
    const service = new PreferenceService(store, () => `2026-10-28T0${stamp++}:00:00.000Z`);
    await service.save("dark");
    await service.saveDisabledCapabilities(["orders"]);
    await service.saveBackupReminderEnabled(false);
    await service.saveLowStockThreshold("wood", 8000);
    const saved = await service.saveOfferingPreference("services");
    expect(saved).toEqual({ ok: true, offering: "services" });
    const record = await store.getPreferences();
    if (!record.ok || !record.value) throw new Error("preferences should exist");
    expect(record.value.theme).toBe("dark");
    expect(record.value.disabledCapabilities).toEqual(["orders"]);
    expect(record.value.backupReminderEnabled).toBe(false);
    expect(record.value.lowStockThresholdsMilli).toEqual({ wood: 8000 });
    expect(record.value.offeringPreference).toBe("services");
  });

  it("a legacy record without the field reads neutral and the first save establishes it (no drop of others)", async () => {
    const store = new MemoryLocalStore();
    const legacy = await store.savePreferences({
      id: "local-preferences",
      theme: "light",
      dailyScheduleCapacityMinutes: null,
      workMode: "material_focused",
      actualTimeTrackingEnabled: false,
      installBannerDismissedAt: null,
      updatedAt: "2026-10-01T00:00:00.000Z",
    });
    if (!legacy.ok) throw new Error(legacy.message);
    const service = new PreferenceService(store, () => "2026-10-28T00:00:00.000Z");
    await expect(service.readOfferingPreference()).resolves.toEqual({ ok: true, offering: null });
    await expect(service.saveOfferingPreference("both")).resolves.toEqual({ ok: true, offering: "both" });
    const after = await store.getPreferences();
    if (!after.ok || !after.value) throw new Error("preferences should exist");
    expect(after.value.offeringPreference).toBe("both");
    expect(after.value.workMode).toBe("material_focused");
    expect(after.value.theme).toBe("light");
  });

  it("read and write failures are honest storage errors — no silent default and no fake success", async () => {
    const store = new MemoryLocalStore();
    const service = new PreferenceService(store, () => "2026-10-28T00:00:00.000Z");
    const originalGet = store.getPreferences.bind(store);
    store.getPreferences = (async () => ({
      ok: false,
      code: "storage_error",
      message: "read failed",
    })) as never;
    await expect(service.readOfferingPreference()).resolves.toMatchObject({
      ok: false,
      code: "storage_error",
      message: "تعذر قراءة تفضيل ما يقدمه مشروعك.",
    });
    store.getPreferences = originalGet;
    /* S03 revalidation (§A2): حد الكتابة صار commitPreferencesUpdate (لا
     * read-merge-full-write خارج الحد) — قناة حقن فشل الكتابة تنتقل إليه
     * والعقد نفسه: الفشل صادق لا نجاح زائف ولا ابتلاع. */
    const originalCommit = store.commitPreferencesUpdate.bind(store);
    store.commitPreferencesUpdate = (async () => ({
      ok: false,
      code: "storage_error",
      message: "write failed",
    })) as never;
    await expect(service.saveOfferingPreference("products")).resolves.toMatchObject({
      ok: false,
      code: "storage_error",
      message: "تعذر حفظ التفضيل. حاول مرة أخرى.",
    });
    store.commitPreferencesUpdate = originalCommit;
    await expect(service.readOfferingPreference()).resolves.toEqual({ ok: true, offering: null });
  });
});
