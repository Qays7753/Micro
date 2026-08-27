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
