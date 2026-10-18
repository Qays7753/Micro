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

  it("rejects an empty name before any write and a failed read never becomes a write", async () => {
    const store = new MemoryLocalStore();
    const service = new ProfileService(store, () => "2026-10-18T00:00:00.000Z");
    await expect(service.create("   ")).resolves.toMatchObject({
      ok: false,
      code: "validation_error",
    });
    await expect(store.getProfile()).resolves.toMatchObject({ ok: true, value: null });
    const originalGet = store.getProfile.bind(store);
    store.getProfile = (async () => ({ ok: false, code: "storage_error", message: "read failed" })) as never;
    await expect(service.create("مشروع")).resolves.toMatchObject({
      ok: false,
      code: "storage_error",
    });
    store.getProfile = originalGet;
    await expect(store.getProfile()).resolves.toMatchObject({ ok: true, value: null });
  });

  it("a failed write is reported honestly — no partial identity and no success claim", async () => {
    const store = new MemoryLocalStore();
    const service = new ProfileService(store, () => "2026-10-18T00:00:00.000Z");
    store.saveProfile = (async () => ({
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
