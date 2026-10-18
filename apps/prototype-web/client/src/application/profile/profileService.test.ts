import { describe, expect, it } from "vitest";
import { ProfileService } from "./profileService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

describe("ProfileService", () => {
  it("rejects an empty local activity name before writing", async () => {
    const store = new MemoryLocalStore();
    const service = new ProfileService(store, () => "2026-08-22T00:00:00.000Z");
    await expect(service.save("   ")).resolves.toMatchObject({
      ok: false,
      code: "validation_error",
      message: "اسم النشاط: اكتب اسم النشاط أو اسمك أولًا، ثم أعد المحاولة.",
    });
    await expect(store.getProfile()).resolves.toMatchObject({ ok: true, value: null });
  });

  it("creates the minimal local custom-craft profile and preserves its first timestamp", async () => {
    const store = new MemoryLocalStore();
    let timestamp = "2026-08-22T00:00:00.000Z";
    const service = new ProfileService(store, () => timestamp);
    const first = await service.save("مشغل ليان");
    timestamp = "2026-08-22T01:00:00.000Z";
    const second = await service.save("مشغل ليان للحرف");
    expect(first).toMatchObject({
      ok: true,
      profile: {
        activityName: "مشغل ليان",
        currency: "JOD",
        activityType: "custom_craft",
        createdAt: "2026-08-22T00:00:00.000Z",
      },
    });
    expect(second).toMatchObject({
      ok: true,
      profile: {
        activityName: "مشغل ليان للحرف",
        createdAt: "2026-08-22T00:00:00.000Z",
        updatedAt: "2026-08-22T01:00:00.000Z",
      },
    });
  });
});

/* UNIT-001 V2 (DUP-002/R02/R07): الإنشاء وحده — create() مسار idempotent
 * لا يعدّل هوية قائمة أبدًا؛ التعديل ملك 039 عبر save. */
describe("ProfileService.create — UNIT-001 single-identity create path", () => {
  it("creates once when absent and reports created=true with the trimmed name", async () => {
    const store = new MemoryLocalStore();
    const service = new ProfileService(store, () => "2026-10-18T00:00:00.000Z");
    const result = await service.create("  حلويات ليان  ");
    expect(result).toMatchObject({
      ok: true,
      created: true,
      profile: {
        id: "local-profile",
        activityName: "حلويات ليان",
        currency: "JOD",
        activityType: "custom_craft",
        createdAt: "2026-10-18T00:00:00.000Z",
        updatedAt: "2026-10-18T00:00:00.000Z",
      },
    });
  });

  it("an existing identity is returned untouched — never edited, never duplicated (DUP-002)", async () => {
    const store = new MemoryLocalStore();
    let timestamp = "2026-10-18T00:00:00.000Z";
    const service = new ProfileService(store, () => timestamp);
    await service.create("حلويات ليان");
    timestamp = "2026-10-18T02:00:00.000Z";
    const second = await service.create("اسم آخر تمامًا");
    expect(second).toMatchObject({
      ok: true,
      created: false,
      profile: { activityName: "حلويات ليان", updatedAt: "2026-10-18T00:00:00.000Z" },
    });
    const stored = await store.getProfile();
    expect(stored).toMatchObject({
      ok: true,
      value: { activityName: "حلويات ليان", updatedAt: "2026-10-18T00:00:00.000Z" },
    });
  });

  it("rejects an empty name before any write and a failed atomic commit never becomes a write", async () => {
    const store = new MemoryLocalStore();
    const service = new ProfileService(store, () => "2026-10-18T00:00:00.000Z");
    await expect(service.create("   ")).resolves.toMatchObject({
      ok: false,
      code: "validation_error",
    });
    await expect(store.getProfile()).resolves.toMatchObject({ ok: true, value: null });
    /* U001-IR-002: فشل الحد الذرّي (قراءة داخل الكتابة أو كتابة) فشل صريح —
     * لا كتابة بديلة ولا هوية نصفية بعده. */
    const originalCommit = store.commitProfileCreate.bind(store);
    store.commitProfileCreate = (async () => ({
      ok: false,
      code: "storage_error",
      message: "commit read failed",
    })) as never;
    await expect(service.create("مشروع")).resolves.toMatchObject({
      ok: false,
      code: "storage_error",
    });
    store.commitProfileCreate = originalCommit;
    await expect(store.getProfile()).resolves.toMatchObject({ ok: true, value: null });
  });

  it("a failed write is reported honestly — no partial identity and no success claim", async () => {
    const store = new MemoryLocalStore();
    const service = new ProfileService(store, () => "2026-10-18T00:00:00.000Z");
    store.commitProfileCreate = (async () => ({
      ok: false,
      code: "storage_error",
      message: "write failed",
    })) as never;
    await expect(service.create("مشروع")).resolves.toMatchObject({
      ok: false,
      code: "storage_error",
      message: "لم يتم حفظ التأسيس على هذا الجهاز. تحقق من مساحة التخزين ثم أعد المحاولة.",
    });
    expect((await store.getProfile()).ok).toBe(true);
  });
});

/* U001-IR-002 (مراجعة مستقلة 2026-10-18): الإنشاء ذرّي عبر حد الكتابة —
 * استدعاءان متزامنان باسمين مختلفين: هوية واحدة بالضبط تبقى والفائز لا
 * يُطمس أبدًا، والخاسر يستعيد الهوية القائمة بـcreated:false صادق لا كتابة
 * فوقها (عقد ٣٦ نفسه عند حد الهوية — نفس عقد commitScheduleCreate). */
describe("ProfileService.create — atomic across concurrent callers (U001-IR-002)", () => {
  it("two concurrent creates keep exactly one identity — the winner is never silently overwritten", async () => {
    const store = new MemoryLocalStore();
    const service = new ProfileService(store, () => "2026-10-18T00:00:00.000Z");
    const [first, second] = await Promise.all([
      service.create("ورشة الأولى"),
      service.create("متجر مختلف تمامًا"),
    ]);
    expect(first).toMatchObject({ ok: true, created: true, profile: { activityName: "ورشة الأولى" } });
    expect(second).toMatchObject({
      ok: true,
      created: false,
      profile: { activityName: "ورشة الأولى" },
    });
    /* هوية واحدة بالضبط بمفتاح ثابت واحد — الفائز باقٍ حرفيًا. */
    const stored = await store.getProfile();
    expect(stored).toMatchObject({
      ok: true,
      value: { id: "local-profile", activityName: "ورشة الأولى", createdAt: "2026-10-18T00:00:00.000Z" },
    });
  });

  it("the losing caller is told the truth — the existing profile is returned untouched, never a second identity", async () => {
    const store = new MemoryLocalStore();
    let timestamp = "2026-10-18T00:00:00.000Z";
    const service = new ProfileService(store, () => timestamp);
    await service.create("الهوية الأصلية");
    timestamp = "2026-10-18T03:00:00.000Z";
    const concurrent = await Promise.all([
      service.create("محاولة طمس متزامنة"),
      service.create("محاولة طمس متزامنة ثانية"),
    ]);
    expect(concurrent).toHaveLength(2);
    for (const attempt of concurrent) {
      expect(attempt).toMatchObject({
        ok: true,
        created: false,
        profile: { activityName: "الهوية الأصلية", updatedAt: "2026-10-18T00:00:00.000Z" },
      });
    }
    const stored = await store.getProfile();
    expect(stored).toMatchObject({
      ok: true,
      value: { activityName: "الهوية الأصلية", updatedAt: "2026-10-18T00:00:00.000Z" },
    });
  });

  it("a failed atomic commit is reported honestly and never becomes an identity", async () => {
    const store = new MemoryLocalStore();
    const service = new ProfileService(store, () => "2026-10-18T00:00:00.000Z");
    store.commitProfileCreate = (async () => ({
      ok: false,
      code: "storage_error",
      message: "commit failed",
    })) as never;
    const [first, second] = await Promise.all([service.create("أول"), service.create("ثانٍ")]);
    expect(first).toMatchObject({ ok: false, code: "storage_error" });
    expect(second).toMatchObject({ ok: false, code: "storage_error" });
    expect(await store.getProfile()).toMatchObject({ ok: true, value: null });
  });
});
