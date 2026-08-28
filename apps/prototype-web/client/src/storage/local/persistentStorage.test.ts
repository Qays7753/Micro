import { afterEach, describe, expect, it, vi } from "vitest";
import {
  persistentStorageCopy,
  readPersistentStorageState,
  requestPersistentStorage,
} from "./persistentStorage";

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

describe("persistent storage — P-01 الطبقة 0", () => {
  it("يعلن عدم الدعم بدل ادعاء الحماية عندما تغيب الواجهة", async () => {
    setStorage(undefined);
    expect(await readPersistentStorageState()).toBe("unsupported");
    expect(await requestPersistentStorage()).toBe("unsupported");
  });

  it("لا يعيد الطلب عندما يكون الدوام ممنوحًا أصلًا", async () => {
    const persist = vi.fn(async () => true);
    setStorage({ persisted: async () => true, persist });
    expect(await requestPersistentStorage()).toBe("persisted");
    expect(persist).not.toHaveBeenCalled();
  });

  it("يطلب الدوام مرة واحدة عندما يكون غير ممنوح", async () => {
    const persist = vi.fn(async () => true);
    setStorage({ persisted: async () => false, persist });
    expect(await requestPersistentStorage()).toBe("persisted");
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("يعامل رفض المتصفح كحالة معلنة لا كخطأ تشغيلي", async () => {
    setStorage({ persisted: async () => false, persist: async () => false });
    expect(await requestPersistentStorage()).toBe("not_persisted");
  });

  it("يهبط إلى حالة صادقة عندما ترمي الواجهة استثناءً", async () => {
    setStorage({
      persisted: async () => {
        throw new Error("blocked");
      },
      persist: async () => true,
    });
    expect(await readPersistentStorageState()).toBe("unsupported");
  });

  it("لا يعِد أي نص بحماية كاملة أو نسخة احتياطية", () => {
    for (const state of ["persisted", "not_persisted", "unsupported"] as const) {
      const copy = persistentStorageCopy(state);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.text).not.toMatch(/نسخة احتياطية تلقائية|محمي بالكامل|مزامنة/);
    }
    expect(persistentStorageCopy("persisted").text).toMatch(/التصدير ما زال مطلوبًا/);
  });
});
