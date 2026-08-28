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
});
