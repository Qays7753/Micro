import { describe, expect, it } from "vitest";
import { PreferenceService } from "./preferenceService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

describe("PreferenceService", () => {
  it("defaults to system and persists a local theme through the store", async () => {
    const service = new PreferenceService(new MemoryLocalStore(), () => "2026-08-22T00:00:00.000Z");
    await expect(service.load()).resolves.toEqual({ ok: true, preference: "system" }); await expect(service.save("dark")).resolves.toEqual({ ok: true, preference: "dark" }); await expect(service.load()).resolves.toEqual({ ok: true, preference: "dark" });
  });
});
