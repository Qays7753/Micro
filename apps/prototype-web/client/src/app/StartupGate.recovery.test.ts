import { describe, expect, it } from "vitest";
import { storageRecoveryCopy } from "./StartupGate";
import type { StorageFailure } from "@/storage/local/types";

const failure = (code: StorageFailure["code"]): StorageFailure => ({ ok: false, code, message: "test" });

describe("storage recovery copy", () => {
  it("distinguishes a blocked database and tells the user to close other windows", () => {
    expect(storageRecoveryCopy(failure("storage_blocked"))).toEqual({
      title: "Micro مفتوح في نافذة أخرى.",
      description: "أغلق النوافذ الأخرى ثم أعد المحاولة. لم يتم تغيير بياناتك.",
    });
  });

  it("distinguishes a failed upgrade and prevents new entry on this copy", () => {
    expect(storageRecoveryCopy(failure("storage_upgrade_failed"))).toEqual({
      title: "تعذر ترقية التخزين المحلي بأمان.",
      description: "أغلق النسخ الأخرى ثم أعد المحاولة. لا تستخدم هذه النسخة لإدخال بيانات جديدة.",
    });
  });

  it("distinguishes a stale connection and requires a reload before new entry", () => {
    expect(storageRecoveryCopy(failure("storage_stale"))).toEqual({
      title: "هذه النسخة من Micro قديمة.",
      description: "أعد تحميل التطبيق قبل إدخال بيانات جديدة. لم يتم تغيير بياناتك.",
    });
  });
});
